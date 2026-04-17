// supabase/functions/diary-embed/index.ts
//
// 日記テキストを OpenAI text-embedding-3-small で埋め込みベクトル化する。
//
// 2つのモード:
//   1. { text } を受け取って embedding を返す (書き込み時のリアルタイム類似検索用)
//   2. { mode: "backfill" } を受け取って embedding が NULL な全 diary_entries を埋める
//   3. { id, text } を受け取って diary_entries.embedding を更新する (新規エントリ書き込み後の persist)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dims, cheap
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function embed(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    console.error("[diary-embed] OPENAI_API_KEY not set");
    return null;
  }
  const truncated = text.slice(0, 4000); // safety
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: truncated }),
  });
  if (!res.ok) {
    console.error("[diary-embed] OpenAI error", res.status, await res.text());
    return null;
  }
  const json = await res.json();
  return json.data?.[0]?.embedding ?? null;
}

function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

async function backfill(): Promise<{ processed: number; failed: number }> {
  const { data: rows } = await sb
    .from("diary_entries")
    .select("id, body")
    .is("embedding", null)
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(100); // batch

  if (!rows || rows.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    if (!row.body || row.body.trim().length < 5) continue;
    const vec = await embed(row.body);
    if (!vec) {
      failed++;
      continue;
    }
    const { error } = await sb
      .from("diary_entries")
      .update({ embedding: toPgVector(vec) })
      .eq("id", row.id);
    if (error) {
      console.error("[diary-embed] update failed", row.id, error);
      failed++;
    } else {
      processed++;
    }
  }
  return { processed, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    const payload = await req.json();

    // Mode 2: backfill
    if (payload.mode === "backfill") {
      const result = await backfill();
      return new Response(JSON.stringify(result), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Need text
    const text = typeof payload.text === "string" ? payload.text : "";
    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const vec = await embed(text);
    if (!vec) {
      return new Response(JSON.stringify({ error: "embedding failed" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Mode 3: persist to diary_entries if id given
    if (typeof payload.id === "number") {
      const { error } = await sb
        .from("diary_entries")
        .update({ embedding: toPgVector(vec) })
        .eq("id", payload.id);
      if (error) console.error("[diary-embed] persist failed", error);
    }

    // Mode 1: return embedding (for on-the-fly similarity search)
    return new Response(JSON.stringify({ embedding: vec }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[diary-embed] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
