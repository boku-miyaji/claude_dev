// supabase/functions/narrator-update/index.ts
// Scheduled narrator memory updater.
// Runs Arc Reader (weekly) and Theme Finder (monthly) on schedule.
// Call via cron or manual trigger.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPUS_MODEL = "claude-opus-4-7";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PLUTCHIK = ["joy", "trust", "fear", "surprise", "sadness", "disgust", "anger", "anticipation"] as const;

// Narrator memory (Arc/Theme/Chapter) uses Claude Opus 4.7 for deep self-understanding.
async function llmJson(
  systemPrompt: string,
  userMessage: string,
  temperature: number,
  maxTokens: number,
): Promise<Record<string, unknown> | null> {
  if (!ANTHROPIC_API_KEY) {
    console.error("[narrator-update] ANTHROPIC_API_KEY not set");
    return null;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: OPUS_MODEL,
      max_tokens: maxTokens,
      temperature,
      system: `${systemPrompt}\n\n必ず JSON オブジェクトのみを返してください。前後に説明文を付けない。`,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    console.error("[narrator-update] Anthropic error", res.status, (await res.text()).substring(0, 200));
    return null;
  }
  const data = await res.json();
  const text = Array.isArray(data.content)
    ? data.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("")
    : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

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

  const systemPrompt = `感情データと日記の内容から、この人が今どんな時期にいるかを判定する。
narrativeは友達が「最近どう？」と聞かれて答えるくらいの自然な日本語で、具体的な出来事や気持ちに触れて1-2文で書く。
抽象的・詩的な表現は禁止（×「大きな扉を開けた」「キラリと見えてきた」）。日記の内容に基づいた具体的な事実を述べる。
出力JSON: {"phase":"exploration|immersion|reflection|reconstruction|leap","narrative":"1-2文の具体的な説明","confidence":0.0-1.0}`;
  const parsed = await llmJson(
    systemPrompt,
    `感情:\n${JSON.stringify(timeline)}\n\n日記:\n${diaryText}`,
    0.5,
    300,
  );
  if (!parsed || !parsed.phase) return { updated: false };

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

  const parsed = await llmJson(
    `長期の日記から人生テーマを発見。出力JSON: {"identity":"テーマ","emotionalDNA":{"joyTriggers":["3つ"],"energySources":["2-3つ"],"recoveryStyle":"傾向"},"aspirations":"志向1-2文"}`,
    `日記(${(diaryRes.data || []).length}件):\n${diaryText}\n\n夢: ${dreamsText || "なし"}`,
    0.6,
    500,
  );
  if (!parsed || !parsed.identity) return { updated: false };

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

  const parsed = await llmJson(
    `四半期の日記と転機から「章」を生成。出力JSON: {"title":"章タイトル(5語以内)","summary":"この期間の要約(3-4文)","emotional_journey":"感情の旅路(2文)","learnings":"学んだこと(2文)"}`,
    `日記(${(diaryRes.data || []).length}件):\n${diaryText}\n\n転機:\n${momentsText || "なし"}`,
    0.6,
    400,
  );
  if (!parsed || !parsed.title) return { created: false };

  await sb.from("story_memory").insert({
    memory_type: "chapter",
    content: parsed,
    narrative_text: `${parsed.title}: ${parsed.summary}`,
  });

  return { created: true, title: parsed.title };
}

// ============================================================
// Dream Detection: weekly scan of recent diaries vs active dreams
// ============================================================

async function runDreamDetection(): Promise<{ detected: number; skipped?: boolean }> {
  // Skip if we already ran in the past 7 days
  const { data: lastRun } = await sb
    .from("activity_log")
    .select("created_at")
    .eq("action", "dream_detection_weekly")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lastRun) {
    const daysSince = (Date.now() - new Date(lastRun.created_at).getTime()) / 86400000;
    if (daysSince < 7) return { detected: 0, skipped: true };
  }

  // Active dreams
  const { data: dreams } = await sb
    .from("dreams")
    .select("id, title, description")
    .in("status", ["active", "in_progress"]);
  if (!dreams || dreams.length === 0) return { detected: 0 };

  // Past 7 days of diaries
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: diaries } = await sb
    .from("diary_entries")
    .select("id, body, entry_date, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);
  if (!diaries || diaries.length === 0) return { detected: 0 };

  const dreamList = dreams
    .map((d: { id: number; title: string; description: string | null }) =>
      `- ID:${d.id} "${d.title}"${d.description ? ` (${d.description})` : ""}`)
    .join("\n");

  const diaryText = diaries
    .map((d: { id: number; body: string; entry_date: string }) =>
      `[diary_id=${d.id}, ${d.entry_date}] ${d.body.substring(0, 300)}`)
    .join("\n\n");

  const systemPrompt = `ユーザーの過去1週間の日記と夢リストを照合し、達成・進捗に近づいた気づきを検出してください。
過剰検出は避ける。confidence が medium 以上のみ返す。
出力JSON: { "detections": [{ "diary_id": number, "dream_id": number, "confidence": "high"|"medium", "reason": "日記の具体的な表現を引用して理由(1-2文)" }] }
該当なしは detections:[] で返す。`;

  const parsed = await llmJson(
    systemPrompt,
    `## 日記\n${diaryText}\n\n## 夢リスト\n${dreamList}`,
    0.3,
    1500,
  );

  const detections = (parsed && Array.isArray(parsed.detections) ? parsed.detections : []) as Array<{
    diary_id: number;
    dream_id: number;
    confidence: string;
    reason: string;
  }>;

  const filtered = detections.filter((d) => d.confidence === "high" || d.confidence === "medium");

  if (filtered.length > 0) {
    // Record each detection as a separate activity_log entry for UI retrieval
    const rows = filtered.map((d) => {
      const dream = dreams.find((dr: { id: number }) => dr.id === d.dream_id);
      return {
        action: "dream_detected",
        description: `「${dream?.title ?? `Dream #${d.dream_id}`}」に近づいた気づき: ${d.reason}`,
        metadata: { ...d, dream_title: dream?.title ?? null },
      };
    });
    await sb.from("activity_log").insert(rows);
  }

  // Always log the weekly run itself so next call skips correctly
  await sb.from("activity_log").insert({
    action: "dream_detection_weekly",
    description: `Weekly dream scan: ${filtered.length} detection(s)`,
    metadata: { detected: filtered.length, diaries: diaries.length, dreams: dreams.length },
  });

  return { detected: filtered.length };
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
    const [arc, theme, chapter, dreamScan] = await Promise.all([
      runArcReader(),
      runThemeFinder(),
      runChapterGenerator(),
      runDreamDetection(),
    ]);

    const summary = {
      arc_reader: arc,
      theme_finder: theme,
      chapter_generator: chapter,
      dream_detection: dreamScan,
      run_at: new Date().toISOString(),
    };

    // Log
    await sb.from("activity_log").insert({
      action: "narrator_update",
      description: `Arc:${arc.updated ? arc.phase : 'skip'} Theme:${theme.updated ? 'updated' : 'skip'} Chapter:${chapter.created ? chapter.title : 'skip'} Dream:${dreamScan.skipped ? 'skip' : dreamScan.detected}`,
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
