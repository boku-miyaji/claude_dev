// supabase/functions/narrator-update/index.ts
// Scheduled narrator memory updater.
// Runs Arc Reader (weekly) and Theme Finder (monthly) on schedule.
// Call via cron or manual trigger.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PLUTCHIK = ["joy", "trust", "fear", "surprise", "sadness", "disgust", "anger", "anticipation"] as const;

// ============================================================
// Arc Reader: weekly emotional phase detection
// ============================================================

async function runArcReader(): Promise<{ updated: boolean; phase?: string }> {
  // Check last update
  const { data: existing } = await sb
    .from("story_memory")
    .select("updated_at")
    .eq("memory_type", "current_arc")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    const daysSince = (Date.now() - new Date(existing.updated_at).getTime()) / 86400000;
    if (daysSince < 7) return { updated: false };
  }

  // Fetch recent emotions (14 days)
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data: emotions } = await sb
    .from("emotion_analysis")
    .select("joy, trust, fear, surprise, sadness, disgust, anger, anticipation, valence, arousal, wbi_score, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (!emotions || emotions.length < 3) return { updated: false };

  // Fetch diary snippets
  const { data: diaries } = await sb
    .from("diary_entries")
    .select("body, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(10);

  const timeline = emotions.map((e) => {
    let dominant = "joy", maxVal = 0;
    for (const k of PLUTCHIK) { const v = (e as Record<string, number>)[k] || 0; if (v > maxVal) { maxVal = v; dominant = k; } }
    return { date: e.created_at.substring(0, 10), dominant, wbi: e.wbi_score, valence: e.valence, arousal: e.arousal };
  });

  const diaryText = (diaries || []).map((d) => `[${d.created_at.substring(0, 10)}] ${d.body.substring(0, 120)}`).join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: `感情データの時系列から現在のフェーズを判定。出力JSON: {"phase":"exploration|immersion|reflection|reconstruction|leap","narrative":"1-2文","confidence":0.0-1.0}` },
        { role: "user", content: `感情:\n${JSON.stringify(timeline)}\n\n日記:\n${diaryText}` },
      ],
      temperature: 0.5,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return { updated: false };
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  if (!parsed.phase) return { updated: false };

  // Upsert to story_memory
  if (existing) {
    await sb.from("story_memory").update({ content: parsed, narrative_text: parsed.narrative, updated_at: new Date().toISOString() }).eq("memory_type", "current_arc");
  } else {
    await sb.from("story_memory").insert({ memory_type: "current_arc", content: parsed, narrative_text: parsed.narrative });
  }

  return { updated: true, phase: parsed.phase };
}

// ============================================================
// Theme Finder: monthly identity/theme detection
// ============================================================

async function runThemeFinder(): Promise<{ updated: boolean; identity?: string }> {
  const { data: existing } = await sb
    .from("story_memory")
    .select("updated_at")
    .eq("memory_type", "identity")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    const daysSince = (Date.now() - new Date(existing.updated_at).getTime()) / 86400000;
    if (daysSince < 30) return { updated: false };
  }

  // Check diary count
  const { count } = await sb.from("diary_entries").select("id", { count: "exact", head: true });
  if (!count || count < 30) return { updated: false };

  // Fetch long-term data
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const [diaryRes, dreamsRes] = await Promise.all([
    sb.from("diary_entries").select("body, entry_date").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    sb.from("dreams").select("title, status").in("status", ["active", "in_progress", "achieved"]),
  ]);

  const diaryText = (diaryRes.data || []).map((d) => `[${d.entry_date}] ${d.body.substring(0, 150)}`).join("\n");
  const dreamsText = (dreamsRes.data || []).map((d) => `${d.title} (${d.status})`).join(", ");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: `長期の日記から人生テーマを発見。出力JSON: {"identity":"テーマ","emotionalDNA":{"joyTriggers":["3つ"],"energySources":["2-3つ"],"recoveryStyle":"傾向"},"aspirations":"志向1-2文"}` },
        { role: "user", content: `日記(${(diaryRes.data || []).length}件):\n${diaryText}\n\n夢: ${dreamsText || "なし"}` },
      ],
      temperature: 0.6,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return { updated: false };
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  if (!parsed.identity) return { updated: false };

  // Upsert identity, emotional_dna, aspirations
  for (const [type, content, narrative] of [
    ["identity", parsed, parsed.identity],
    ["emotional_dna", parsed.emotionalDNA || {}, JSON.stringify(parsed.emotionalDNA)],
    ["aspirations", { aspirations: parsed.aspirations }, parsed.aspirations],
  ] as [string, Record<string, unknown>, string][]) {
    const { data: ex } = await sb.from("story_memory").select("id").eq("memory_type", type).limit(1).single();
    if (ex) {
      await sb.from("story_memory").update({ content, narrative_text: narrative, updated_at: new Date().toISOString() }).eq("id", ex.id);
    } else {
      await sb.from("story_memory").insert({ memory_type: type, content, narrative_text: narrative });
    }
  }

  return { updated: true, identity: parsed.identity };
}

// ============================================================
// Chapter Generator: quarterly chapter creation
// ============================================================

async function runChapterGenerator(): Promise<{ created: boolean; title?: string }> {
  // Check if a chapter was generated this quarter
  const quarterStart = new Date();
  quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
  quarterStart.setHours(0, 0, 0, 0);

  const { data: recentChapter } = await sb
    .from("story_memory")
    .select("id")
    .eq("memory_type", "chapter")
    .gte("created_at", quarterStart.toISOString())
    .limit(1)
    .single();

  if (recentChapter) return { created: false }; // Already generated this quarter

  // Need at least 30 days of data in this quarter
  const { count } = await sb.from("diary_entries")
    .select("id", { count: "exact", head: true })
    .gte("created_at", quarterStart.toISOString());

  if (!count || count < 15) return { created: false };

  // Fetch quarter's data
  const [diaryRes, momentsRes] = await Promise.all([
    sb.from("diary_entries").select("body, entry_date, wbi").gte("created_at", quarterStart.toISOString()).order("created_at").limit(50),
    sb.from("story_moments").select("moment_type, title, description, detected_at").gte("detected_at", quarterStart.toISOString()).eq("user_confirmed", true),
  ]);

  const diaryText = (diaryRes.data || []).map((d) => `[${d.entry_date}] ${d.body.substring(0, 100)}`).join("\n");
  const momentsText = (momentsRes.data || []).map((m) => `[${m.moment_type}] ${m.title}: ${m.description}`).join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: `四半期の日記と転機から「章」を生成。出力JSON: {"title":"章タイトル(5語以内)","summary":"この期間の要約(3-4文)","emotional_journey":"感情の旅路(2文)","learnings":"学んだこと(2文)"}` },
        { role: "user", content: `日記(${(diaryRes.data || []).length}件):\n${diaryText}\n\n転機:\n${momentsText || "なし"}` },
      ],
      temperature: 0.6,
      max_tokens: 400,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return { created: false };
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  if (!parsed.title) return { created: false };

  await sb.from("story_memory").insert({
    memory_type: "chapter",
    content: parsed,
    narrative_text: `${parsed.title}: ${parsed.summary}`,
  });

  return { created: true, title: parsed.title };
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
    const [arc, theme, chapter] = await Promise.all([
      runArcReader(),
      runThemeFinder(),
      runChapterGenerator(),
    ]);

    const summary = {
      arc_reader: arc,
      theme_finder: theme,
      chapter_generator: chapter,
      run_at: new Date().toISOString(),
    };

    // Log
    await sb.from("activity_log").insert({
      action: "narrator_update",
      description: `Arc:${arc.updated ? arc.phase : 'skip'} Theme:${theme.updated ? 'updated' : 'skip'} Chapter:${chapter.created ? chapter.title : 'skip'}`,
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
