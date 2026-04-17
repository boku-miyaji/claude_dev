// supabase/functions/news-learn/index.ts
// Feedback loop for news sources: learn from user clicks.
//
// Run daily (via cron or manual trigger). Does 3 things:
// 1. Adjusts source priority based on click-through rate
// 2. Extracts keywords from clicked articles → creates new keyword sources
// 3. Decays sources that never get clicked

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================
// 1. Priority auto-adjustment from click data
// ============================================================

async function adjustPriorities(): Promise<{ adjusted: number }> {
  // Get click stats per source (last 14 days)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: items } = await sb
    .from("news_items")
    .select("source, source_type, click_count, impression_count")
    .gte("collected_at", fourteenDaysAgo.toISOString());

  if (!items || items.length === 0) return { adjusted: 0 };

  // Aggregate by source name
  const sourceStats: Record<string, { clicks: number; impressions: number; source_type: string }> = {};
  for (const item of items) {
    const key = item.source || "unknown";
    if (!sourceStats[key]) sourceStats[key] = { clicks: 0, impressions: 0, source_type: item.source_type || "" };
    sourceStats[key].clicks += item.click_count || 0;
    sourceStats[key].impressions += item.impression_count || 0;
  }

  // Get all sources
  const { data: sources } = await sb
    .from("intelligence_sources")
    .select("id, name, priority, click_rate, click_total, impression_total");

  if (!sources) return { adjusted: 0 };

  let adjusted = 0;
  for (const src of sources) {
    const stats = sourceStats[src.name];
    if (!stats) continue;

    const totalClicks = (src.click_total || 0) + stats.clicks;
    const totalImpressions = (src.impression_total || 0) + stats.impressions;
    const clickRate = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

    // Determine new priority based on click rate
    let newPriority = src.priority;
    if (clickRate > 0.15) newPriority = "high";       // >15% CTR → high
    else if (clickRate > 0.05) newPriority = "normal"; // 5-15% CTR → normal
    else if (totalImpressions > 20) newPriority = "low"; // <5% CTR with enough data → low

    if (newPriority !== src.priority || clickRate !== src.click_rate) {
      await sb.from("intelligence_sources").update({
        priority: newPriority,
        click_rate: Math.round(clickRate * 1000) / 1000,
        click_total: totalClicks,
        impression_total: totalImpressions,
        last_adjusted_at: new Date().toISOString(),
      }).eq("id", src.id);
      adjusted++;
    }
  }

  return { adjusted };
}

// ============================================================
// 2. Extract keywords from clicked articles → auto-create sources
// ============================================================

async function extractKeywordsFromClicks(): Promise<{ created: number }> {
  if (!OPENAI_API_KEY) return { created: 0 };

  // Get recently clicked articles (last 7 days, click_count > 0)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: clicked } = await sb
    .from("news_items")
    .select("title, topic, source")
    .gt("click_count", 0)
    .gte("collected_at", sevenDaysAgo.toISOString())
    .order("click_count", { ascending: false })
    .limit(20);

  if (!clicked || clicked.length < 3) return { created: 0 };

  // Get existing keyword sources to avoid duplicates
  const { data: existing } = await sb
    .from("intelligence_sources")
    .select("name, config")
    .eq("source_type", "keyword");

  const existingTerms = new Set(
    (existing || []).map((s) => ((s.config as Record<string, string>)?.term || s.name).toLowerCase())
  );

  // Ask LLM to extract new keywords from clicked articles
  const titles = clicked.map((c) => c.title).join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-5.4-nano",
        messages: [{
          role: "user",
          content: `以下はユーザーがクリックしたニュース記事のタイトルです。この人が関心を持っている具体的な技術トピックやキーワードを3-5個抽出してください。\n\n既に登録済みのキーワード: ${Array.from(existingTerms).join(", ")}\n\nクリックした記事:\n${titles}\n\n新しいキーワードのみJSON配列で返してください。汎用的すぎるもの（"AI"、"tech"等）は除外。例: ["MCP server", "prompt caching", "code generation"]`,
        }],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return { created: 0 };
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { created: 0 };

    const parsed = JSON.parse(content);
    const keywords: string[] = Array.isArray(parsed) ? parsed : parsed.keywords || parsed.items || [];

    let created = 0;
    for (const kw of keywords) {
      if (!kw || kw.length < 3 || kw.length > 50) continue;
      if (existingTerms.has(kw.toLowerCase())) continue;

      const { error } = await sb.from("intelligence_sources").insert({
        name: kw,
        source_type: "keyword",
        config: { term: kw },
        priority: "normal",
        enabled: true,
        auto_generated: true,
      });

      if (!error) {
        created++;
        existingTerms.add(kw.toLowerCase());
      }
    }

    return { created };
  } catch {
    return { created: 0 };
  }
}

// ============================================================
// 3. Decay: lower priority of never-clicked sources
// ============================================================

async function decayStaleSources(): Promise<{ decayed: number; disabled: number }> {
  const { data: sources } = await sb
    .from("intelligence_sources")
    .select("id, name, priority, click_total, impression_total, auto_generated, enabled, created_at");

  if (!sources) return { decayed: 0, disabled: 0 };

  let decayed = 0;
  let disabled = 0;

  for (const src of sources) {
    const impressions = src.impression_total || 0;
    const clicks = src.click_total || 0;
    const daysSinceCreation = (Date.now() - new Date(src.created_at).getTime()) / 86400000;

    // Only decay if source has had enough time (>14 days)
    if (daysSinceCreation < 14) continue;

    // Auto-generated sources with 0 clicks after 50+ impressions → disable
    if (src.auto_generated && clicks === 0 && impressions > 50 && src.enabled) {
      await sb.from("intelligence_sources").update({ enabled: false, last_adjusted_at: new Date().toISOString() }).eq("id", src.id);
      disabled++;
      continue;
    }

    // Manual sources: downgrade priority if CTR is very low
    if (!src.auto_generated && impressions > 30 && clicks === 0 && src.priority !== "low") {
      await sb.from("intelligence_sources").update({ priority: "low", last_adjusted_at: new Date().toISOString() }).eq("id", src.id);
      decayed++;
    }
  }

  return { decayed, disabled };
}

// ============================================================
// 4. Update news_preferences topic scores
// ============================================================

async function updateTopicPreferences(): Promise<{ updated: number }> {
  // Aggregate clicks by topic (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: items } = await sb
    .from("news_items")
    .select("topic, click_count, impression_count")
    .gte("collected_at", thirtyDaysAgo.toISOString());

  if (!items || items.length === 0) return { updated: 0 };

  const topicStats: Record<string, { clicks: number; impressions: number }> = {};
  for (const item of items) {
    const topic = item.topic || "misc";
    if (!topicStats[topic]) topicStats[topic] = { clicks: 0, impressions: 0 };
    topicStats[topic].clicks += item.click_count || 0;
    topicStats[topic].impressions += item.impression_count || 0;
  }

  let updated = 0;
  for (const [topic, stats] of Object.entries(topicStats)) {
    const score = stats.impressions > 0
      ? Math.min(1.0, 0.3 + (stats.clicks / stats.impressions) * 2) // Base 0.3, max 1.0
      : 0.5;

    const { error } = await sb.from("news_preferences").upsert({
      topic,
      click_total: stats.clicks,
      impression_total: stats.impressions,
      interest_score: Math.round(score * 100) / 100,
      last_clicked_at: stats.clicks > 0 ? new Date().toISOString() : undefined,
    }, { onConflict: "topic" });

    if (!error) updated++;
  }

  return { updated };
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
    });
  }

  try {
    // Run all learning steps in sequence
    const [priorities, keywords, decay, topics] = await Promise.all([
      adjustPriorities(),
      extractKeywordsFromClicks(),
      decayStaleSources(),
      updateTopicPreferences(),
    ]);

    const summary = {
      priorities_adjusted: priorities.adjusted,
      keywords_created: keywords.created,
      sources_decayed: decay.decayed,
      sources_disabled: decay.disabled,
      topics_updated: topics.updated,
      run_at: new Date().toISOString(),
    };

    // Log to activity_log
    await sb.from("activity_log").insert({
      action: "news_learn",
      description: `Priorities: ${priorities.adjusted}, Keywords: +${keywords.created}, Decayed: ${decay.decayed}, Disabled: ${decay.disabled}`,
      metadata: summary,
    });

    return new Response(JSON.stringify(summary), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
