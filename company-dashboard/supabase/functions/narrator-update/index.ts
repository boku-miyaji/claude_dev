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

/**
 * design-philosophy ③ Append-only: before any UPDATE on story_memory,
 * snapshot the current row into story_memory_archive so the history is
 * never destroyed. Failures MUST NOT block the update.
 */
async function archiveStoryMemory(id: number, memoryType: string, reason: string): Promise<void> {
  try {
    const { data: current } = await sb
      .from("story_memory")
      .select("id, memory_type, content, narrative_text, version, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (!current) return;
    await sb.from("story_memory_archive").insert({
      original_id: current.id,
      memory_type: current.memory_type,
      content: current.content,
      narrative_text: current.narrative_text,
      version: current.version,
      original_created_at: current.created_at,
      original_updated_at: current.updated_at,
      archive_reason: reason,
    });
  } catch (e) {
    console.warn(`[narrator-update] archive ${memoryType} failed:`, e);
  }
}

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
      // Claude Opus 4.7+ では temperature が deprecated のため送らない。
      ...(temperature !== undefined && !/opus-4-7|opus-4-8|sonnet-4-7|sonnet-4-8/i.test(OPUS_MODEL)
        ? { temperature }
        : {}),
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

async function runArcReader(): Promise<{ updated: boolean; phase?: string; silent?: boolean }> {
  // Check last update + fetch previous narrative for SILENT comparison
  const { data: existing } = await sb
    .from("story_memory")
    .select("id, updated_at, narrative_text")
    .eq("memory_type", "current_arc")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
  const previousBlock = existing?.narrative_text
    ? `\n\n## 前回の解釈 (${existing.updated_at.substring(0, 10)})\n"${existing.narrative_text}"`
    : "";

  const systemPrompt = `感情データと日記の内容から、この人が今どんな時期にいるかを判定する。
narrativeは友達が「最近どう？」と聞かれて答えるくらいの自然な日本語で、具体的な出来事や気持ちに触れて1-2文で書く。
抽象的・詩的な表現は禁止（×「大きな扉を開けた」「キラリと見えてきた」）。日記の内容に基づいた具体的な事実を述べる。

## 沈黙の選択（design-philosophy ⑩）
「前回の解釈」が提示されている場合、前回と実質同じ状態（同じフェーズ・同じ文脈で前回の narrative でも通用する）なら、再解釈せず SILENT を返す。
週次の定期実行に従って機械的に書き直すと、ユーザーから見ると AI の過剰介入になる。本当に変化があった時だけ新しい narrative を書く。
SILENT 時の出力: {"phase": null, "narrative": "SILENT", "confidence": 0}

## 通常の出力
{"phase":"exploration|immersion|reflection|reconstruction|leap","narrative":"1-2文の具体的な説明","confidence":0.0-1.0}`;
  const parsed = await llmJson(
    systemPrompt,
    `感情:\n${JSON.stringify(timeline)}\n\n日記:\n${diaryText}${previousBlock}`,
    0.5,
    300,
  );

  // Silence: keep prior row, skip write.
  if (!parsed || !parsed.phase || parsed.narrative === "SILENT") {
    return { updated: false, silent: true };
  }

  // Upsert to story_memory with archive-then-update.
  if (existing) {
    await archiveStoryMemory(existing.id as number, "current_arc", "arc_reader_cron");
    await sb.from("story_memory").update({
      content: parsed,
      narrative_text: parsed.narrative,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id as number);
  } else {
    await sb.from("story_memory").insert({ memory_type: "current_arc", content: parsed, narrative_text: parsed.narrative });
  }

  return { updated: true, phase: parsed.phase as string };
}

// ============================================================
// Theme Finder: monthly identity/theme detection
// ============================================================

async function runThemeFinder(): Promise<{ updated: boolean; identity?: string; silent?: boolean }> {
  const { data: existing } = await sb
    .from("story_memory")
    .select("updated_at, content, narrative_text")
    .eq("memory_type", "identity")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
  const previousBlock = existing?.narrative_text
    ? `\n\n## 前回のテーマ (${existing.updated_at.substring(0, 10)})\n"${existing.narrative_text}"\n前回の詳細: ${JSON.stringify(existing.content).substring(0, 400)}`
    : "";

  const parsed = await llmJson(
    `長期の日記から人生テーマを発見。

## 沈黙の選択（design-philosophy ⑩）
「前回のテーマ」が提示されている場合、この3ヶ月で identity や志向性に実質的な変化が見られなければ再解釈しない。
月1回のスケジュールに従って機械的に書き直すと、ユーザーの自己理解が AI の言い換えに振り回される。
本当に新しい材料（新しい夢の達成、価値観の転換、感情パターンの明確な変化）があった時だけ更新する。
SILENT 時の出力: {"silent": true}

## 通常の出力
{"identity":"テーマ","emotionalDNA":{"joyTriggers":["3つ"],"energySources":["2-3つ"],"recoveryStyle":"傾向"},"aspirations":"志向1-2文"}`,
    `日記(${(diaryRes.data || []).length}件):\n${diaryText}\n\n夢: ${dreamsText || "なし"}${previousBlock}`,
    0.6,
    500,
  );

  if (!parsed || parsed.silent || !parsed.identity) {
    return { updated: false, silent: true };
  }

  // Upsert identity, emotional_dna, aspirations (archive-then-update).
  for (const [type, content, narrative] of [
    ["identity", parsed, parsed.identity],
    ["emotional_dna", parsed.emotionalDNA || {}, JSON.stringify(parsed.emotionalDNA)],
    ["aspirations", { aspirations: parsed.aspirations }, parsed.aspirations],
  ] as [string, Record<string, unknown>, string][]) {
    const { data: ex } = await sb.from("story_memory").select("id").eq("memory_type", type).limit(1).maybeSingle();
    if (ex) {
      await archiveStoryMemory(ex.id as number, type, "theme_finder_cron");
      await sb.from("story_memory").update({ content, narrative_text: narrative, updated_at: new Date().toISOString() }).eq("id", ex.id);
    } else {
      await sb.from("story_memory").insert({ memory_type: type, content, narrative_text: narrative });
    }
  }

  return { updated: true, identity: parsed.identity as string };
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
// Manual Refresh: propose updated user_manual seeds as pending_updates
// Triggers when the last proposal/acceptance is >30 days old, so the user
// reviews fresh takes periodically without having to press a button.
// ============================================================

const MANUAL_CATEGORY_META: Record<string, { label: string; order: number }> = {
  identity: { label: "私という人", order: 1 },
  values: { label: "大事にしているもの", order: 2 },
  joy_trigger: { label: "幸せを感じる瞬間", order: 3 },
  energy_source: { label: "エネルギーの源", order: 4 },
  failure_pattern: { label: "つまずきのクセ", order: 5 },
  recovery_style: { label: "回復のしかた", order: 6 },
  aspiration: { label: "本当に求めているもの", order: 7 },
};

async function runManualRefresh(): Promise<{ refreshed: boolean; categories?: number; skipped?: string }> {
  // Single-user focus-you: grab the primary user from existing user-scoped data.
  // Existing tables use `user_id`; new ones (pending_updates, life_story_entries)
  // use `owner_id`. We read user_id from user_manual_cards first, then fall back
  // to life_story_entries.
  let ownerId: string | undefined;
  const { data: card } = await sb.from("user_manual_cards").select("user_id").limit(1).maybeSingle();
  ownerId = (card as { user_id?: string } | null)?.user_id;
  if (!ownerId) {
    const { data: roots } = await sb.from("life_story_entries").select("owner_id").limit(1).maybeSingle();
    ownerId = (roots as { owner_id?: string } | null)?.owner_id;
  }
  if (!ownerId) return { refreshed: false, skipped: "no_user" };

  // Skip if a recent manual_seed proposal (pending OR accepted) exists within 30 days
  const thirty = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count: recentCount } = await sb
    .from("pending_updates")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("source", "manual_seed")
    .in("status", ["pending", "accepted"])
    .gte("created_at", thirty);
  if ((recentCount ?? 0) > 0) return { refreshed: false, skipped: "recent_exists" };

  // Gather input: diary (90d) + story_memory + Roots (life_story_entries) + current cards
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  // diary_entries doesn't have owner_id column — relies on is_owner() RLS function.
  // Service role bypasses RLS so we see all rows; limited by recency is fine for single-user setup.
  const [diaryRes, themeRes, rootsRes, existingCardsRes] = await Promise.all([
    sb.from("diary_entries").select("body, entry_date")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(60),
    sb.from("story_memory").select("memory_type, narrative_text")
      .in("memory_type", ["identity", "emotional_dna", "aspirations"]),
    sb.from("life_story_entries").select("stage, axis, question, answer")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(120),
    sb.from("user_manual_cards").select("id, category, seed_text, user_text, user_edited_at")
      .eq("user_id", ownerId)
      .eq("archived", false),
  ]);

  const diaries = (diaryRes.data ?? []) as Array<{ body: string; entry_date: string }>;
  const rootsEntries = (rootsRes.data ?? []) as Array<{ stage: string; axis: string; question: string; answer: string }>;
  if (diaries.length < 10 && rootsEntries.length === 0) return { refreshed: false, skipped: "insufficient_data" };

  const diaryText = diaries.map((d) => `[${d.entry_date}] ${d.body.substring(0, 180)}`).join("\n");
  const themeSummary = ((themeRes.data ?? []) as Array<{ memory_type: string; narrative_text: string | null }>)
    .map((m) => `${m.memory_type}: ${m.narrative_text ?? ""}`).join("\n");
  const rootsText = rootsEntries
    .map((e) => `[${e.stage}/${e.axis}] Q:${e.question} A:${e.answer.substring(0, 160)}`)
    .join("\n");

  const systemPrompt = `あなたは、ある人の日記・Theme Finder の結果・Roots（人生の棚卸し）を深く読み解き「自分の取扱説明書」の種を書く存在。
その人が自分について読んで「ああ、そうかもしれない」と腑に落ちる1〜2文を、カテゴリごとに生成する。Roots には幼少期から現在までの価値観・家庭環境・転機が含まれるので、それを根拠として織り込む。

## 出力 (JSON)
{
  "identity": { "text": "この人を一言で表すと", "evidence": ["引用1", "引用2"] },
  "values": [{ "text": "価値観カード", "evidence": ["引用"] }],
  "joy_trigger": [{ "text": "幸せを感じる瞬間の傾向", "evidence": ["引用"] }],
  "energy_source": [{ "text": "エネルギーの源", "evidence": ["引用"] }],
  "failure_pattern": [{ "text": "つまずきのクセ", "evidence": ["引用"] }],
  "recovery_style": [{ "text": "回復のしかた", "evidence": ["引用"] }],
  "aspiration": { "text": "本当に求めているもの", "evidence": ["引用"] }
}

## ルール
- 1カードは1〜2文、80字以内
- 「頑張り屋」「努力家」等の汎用ラベルは禁止
- failure_pattern は評価せず観察する語り方で
- evidence は日記 or Roots の生の言葉を短く引用 (20字以内)
- 日本語で、各配列カテゴリは最大2件まで`;

  const userMessage = `## 日記 (${diaries.length}件)\n${diaryText || "(なし)"}\n\n## Theme Finder\n${themeSummary || "なし"}\n\n## Roots (${rootsEntries.length}件)\n${rootsText || "まだ未着手"}`;

  const parsed = await llmJson(systemPrompt, userMessage, 0.6, 1500);
  if (!parsed) return { refreshed: false, skipped: "llm_failed" };

  // Group proposed seeds by category
  const byCategory = new Map<string, Array<{ text: string; evidence?: string[] }>>();
  const push = (cat: string, entry: unknown) => {
    const e = entry as { text?: string; evidence?: string[] } | undefined;
    if (!e?.text) return;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push({ text: e.text, evidence: e.evidence });
  };
  push("identity", parsed.identity);
  for (const v of (parsed.values as unknown[]) ?? []) push("values", v);
  for (const v of (parsed.joy_trigger as unknown[]) ?? []) push("joy_trigger", v);
  for (const v of (parsed.energy_source as unknown[]) ?? []) push("energy_source", v);
  for (const v of (parsed.failure_pattern as unknown[]) ?? []) push("failure_pattern", v);
  for (const v of (parsed.recovery_style as unknown[]) ?? []) push("recovery_style", v);
  push("aspiration", parsed.aspiration);

  // Build current_content snapshot per category for diff UI
  const currentByCat = new Map<string, Array<{ id: number; text: string; user_edited: boolean }>>();
  for (const c of (existingCardsRes.data ?? []) as Array<{ id: number; category: string; seed_text: string | null; user_text: string | null; user_edited_at: string | null }>) {
    if (!currentByCat.has(c.category)) currentByCat.set(c.category, []);
    currentByCat.get(c.category)!.push({
      id: c.id,
      text: c.user_text ?? c.seed_text ?? "",
      user_edited: c.user_edited_at !== null,
    });
  }

  const metadata = {
    diary_count: diaries.length,
    roots_count: rootsEntries.length,
    generated_at: new Date().toISOString(),
    triggered_by: "narrator_update_cron",
  };

  const rows = Array.from(byCategory.entries()).map(([cat, seeds]) => ({
    owner_id: ownerId,
    source: "manual_seed",
    category: cat,
    title: `${MANUAL_CATEGORY_META[cat]?.label ?? cat} の更新候補`,
    preview: seeds[0]?.text?.substring(0, 100) ?? null,
    proposed_content: { seeds },
    current_content: { cards: currentByCat.get(cat) ?? [] },
    metadata,
  }));

  if (rows.length === 0) return { refreshed: false, skipped: "no_proposals" };

  await sb.from("pending_updates").insert(rows);
  return { refreshed: true, categories: rows.length };
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
    const [arc, theme, chapter, dreamScan, manualRefresh] = await Promise.all([
      runArcReader(),
      runThemeFinder(),
      runChapterGenerator(),
      runDreamDetection(),
      runManualRefresh(),
    ]);

    const summary = {
      arc_reader: arc,
      theme_finder: theme,
      chapter_generator: chapter,
      dream_detection: dreamScan,
      manual_refresh: manualRefresh,
      run_at: new Date().toISOString(),
    };

    // Log
    await sb.from("activity_log").insert({
      action: "narrator_update",
      description: `Arc:${arc.updated ? arc.phase : 'skip'} Theme:${theme.updated ? 'updated' : 'skip'} Chapter:${chapter.created ? chapter.title : 'skip'} Dream:${dreamScan.skipped ? 'skip' : dreamScan.detected} Manual:${manualRefresh.refreshed ? manualRefresh.categories : 'skip'}`,
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
