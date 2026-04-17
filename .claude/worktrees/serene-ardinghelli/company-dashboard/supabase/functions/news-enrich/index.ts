// supabase/functions/news-enrich/index.ts
//
// news-collect でDBに入ったばかりの項目を後追いで enrich する。
// - 記事URLを取得してHTMLから本文を抽出
// - LLM (gpt-5-nano) で日本語タイトル翻訳 + 日本語要約を生成
// - news_items.title_ja / summary / enriched_at を UPDATE
//
// 対象: enriched_at IS NULL の行（最大 20 件/実行）
// 失敗時: enriched_at を NOW() にセット（再試行を無限ループさせない）
//         title_ja は NULL のまま、summary は元のままになる

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BATCH_LIMIT = 20;
const FETCH_TIMEOUT_MS = 8000;
const MAX_CONTENT_CHARS = 3000;

interface NewsRow {
  id: number;
  title: string;
  url: string | null;
  summary: string | null;
  source_type: string | null;
}

/** HTMLから本文らしき部分を抽出する粗いパーサ。LLMの入力を作るだけなので精度は程々で良い */
function extractMainText(html: string): string {
  // script / style / svg / noscript を削る
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
              .replace(/<style[\s\S]*?<\/style>/gi, " ")
              .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
              .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  // article / main タグの中身を優先
  const articleMatch = t.match(/<article[\s\S]*?<\/article>/i);
  const mainMatch = t.match(/<main[\s\S]*?<\/main>/i);
  const core = articleMatch?.[0] || mainMatch?.[0] || t;

  // タグを剥がして空白を整形
  const text = core
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text.substring(0, MAX_CONTENT_CHARS);
}

async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FocusYou-NewsBot/1.0; +https://focus-you)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("text")) return null;
    const html = await res.text();
    return extractMainText(html);
  } catch {
    return null;
  }
}

async function summarizeInJapanese(title: string, content: string | null): Promise<{ title_ja: string; summary: string } | null> {
  const sourceText = content && content.length > 40
    ? `タイトル: ${title}\n\n記事本文:\n${content}`
    : `タイトル: ${title}`;

  const prompt = `以下の記事を読んで、JSONで以下を返してください:
{
  "title_ja": "タイトルを日本語で簡潔に（30字以内）",
  "summary": "2〜3文の日本語要約。何が起きたか/何が重要か/どう使えるかのうち、読んで得られる中身を伝える。記事を開く前に価値判断できる内容にする。数値・固有名詞があれば含める。"
}

- 英語の記事は必ず日本語に翻訳する
- 煽りや「〜は必見！」などは不要
- JSON以外は返さない

${sourceText}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-nano",
        messages: [
          { role: "system", content: "あなたは技術記事の日本語要約アシスタントです。正確で簡潔な日本語で要約します。" },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 500,
        reasoning_effort: "minimal",
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`OpenAI error: ${res.status} ${errText.substring(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content);
    if (typeof parsed.title_ja !== "string" || typeof parsed.summary !== "string") return null;
    return { title_ja: parsed.title_ja.substring(0, 100), summary: parsed.summary.substring(0, 500) };
  } catch (e) {
    console.error(`summarize failed: ${(e as Error).message}`);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // 未 enrichment の行を取得
    const { data: rows, error: selErr } = await sb
      .from("news_items")
      .select("id, title, url, summary, source_type")
      .is("enriched_at", null)
      .order("collected_at", { ascending: false })
      .limit(BATCH_LIMIT);

    if (selErr) {
      return new Response(JSON.stringify({ error: selErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const items = (rows || []) as NewsRow[];
    let enrichedCount = 0;
    let failedCount = 0;

    for (const item of items) {
      let summarized: { title_ja: string; summary: string } | null = null;

      if (item.url) {
        const content = await fetchUrlContent(item.url);
        summarized = await summarizeInJapanese(item.title, content);
      } else {
        summarized = await summarizeInJapanese(item.title, null);
      }

      const patch: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
      };
      if (summarized) {
        patch.title_ja = summarized.title_ja;
        patch.summary = summarized.summary;
        enrichedCount++;
      } else {
        failedCount++;
      }

      const { error: updErr } = await sb.from("news_items").update(patch).eq("id", item.id);
      if (updErr) {
        console.error(`UPDATE failed for id=${item.id}: ${updErr.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        processed: items.length,
        enriched: enrichedCount,
        failed: failedCount,
      }),
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
