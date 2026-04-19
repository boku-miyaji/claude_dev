// supabase/functions/life-story/index.ts
// Interactive life-story builder. 機能:
//   1) Q&A セッション (next_question/answer/summarize/coverage) — 既存
//   2) 自然文一括入力 (ingest_narrative) — LLM が axis 分解して複数 entry を保存
//   3) 動的ステージ管理 (list_stages / propose_splits / save_stages)
//      - preset: 幼少期〜最近の8ステージ
//      - custom: 情報が多いステージを AI が「1社目」「○年目」等に分割提案
//        → ユーザー承認で life_story_user_stages に保存
//   life_story_entries.stage は TEXT。preset/custom の key を入れる。
//   既存データ（early_career 等）は preset のまま残る。

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPUS_MODEL = "claude-opus-4-7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================
// Preset stages（初回投入用）
// ============================================================

const PRESET_STAGES = [
  { key: "childhood",   label: "幼少期",        sort_order: 10 },
  { key: "elementary",  label: "小学生",        sort_order: 20 },
  { key: "junior_high", label: "中学生",        sort_order: 30 },
  { key: "high_school", label: "高校生",        sort_order: 40 },
  { key: "university",  label: "大学",          sort_order: 50 },
  { key: "early_career",label: "社会人初期",    sort_order: 60 },
  { key: "mid_career",  label: "社会人中期",    sort_order: 70 },
  { key: "recent",      label: "最近",          sort_order: 80 },
] as const;

const AXES = [
  { key: "values",         label: "価値観・人生観" },
  { key: "family",         label: "家庭環境" },
  { key: "joy",            label: "嬉しかったこと・ワクワク" },
  { key: "struggle",       label: "苦しかったこと・挫折" },
  { key: "turning_point",  label: "転機・決断" },
  { key: "career",         label: "仕事・キャリア" },
  { key: "relationships",  label: "人間関係" },
] as const;

type AxisKey = typeof AXES[number]["key"];

interface UserStage {
  key: string;
  label: string;
  kind: "preset" | "custom";
  sort_order: number;
  year_start: number | null;
  year_end: number | null;
  parent_key: string | null;
}

// ============================================================
// Auth helpers
// ============================================================

function userClient(jwt: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { error: new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }) };

  const sb = userClient(jwt);
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data.user) {
    return { error: new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }) };
  }
  return { jwt, userId: data.user.id, sb };
}

async function anthropicJson<T = Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  temperature: number,
  maxTokens: number,
): Promise<T | null> {
  if (!ANTHROPIC_API_KEY) {
    console.error("[life-story] ANTHROPIC_API_KEY not set");
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
      ...(temperature !== undefined && !/opus-4-7|opus-4-8|sonnet-4-7|sonnet-4-8/i.test(OPUS_MODEL)
        ? { temperature }
        : {}),
      system: `${systemPrompt}\n\n必ず JSON オブジェクトのみを返してください。前後に説明文を付けない。`,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    console.error("[life-story] Anthropic error", res.status, (await res.text()).substring(0, 200));
    return null;
  }
  const data = await res.json();
  const text = Array.isArray(data.content)
    ? data.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("")
    : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

// ============================================================
// User stages: 取得＋preset自動投入＋孤児ステージ吸収
// ============================================================

/** user の stages を取得。無ければ preset を投入してから返す。
 *  life_story_entries にあるが user_stages に無いキー（既存データ or 削除済み）も
 *  orphan として label=key のまま表示用に含める。 */
async function listUserStages(
  sb: ReturnType<typeof userClient>,
  userId: string,
): Promise<UserStage[]> {
  const { data, error } = await sb
    .from("life_story_user_stages")
    .select("key, label, kind, sort_order, year_start, year_end, parent_key")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[life-story] list_stages select error", error.message);
    return [];
  }

  let rows = (data ?? []) as UserStage[];

  if (rows.length === 0) {
    const presetRows = PRESET_STAGES.map((p) => ({
      owner_id: userId,
      key: p.key,
      label: p.label,
      kind: "preset" as const,
      sort_order: p.sort_order,
    }));
    const { data: inserted, error: insErr } = await sb
      .from("life_story_user_stages")
      .insert(presetRows)
      .select("key, label, kind, sort_order, year_start, year_end, parent_key");
    if (insErr) {
      console.error("[life-story] preset insert error", insErr.message);
      return [];
    }
    rows = (inserted ?? []) as UserStage[];
  }

  // 既存 entries の中に user_stages に無いキーがあれば orphan として混ぜる（後方互換）
  const { data: entryStages } = await sb
    .from("life_story_entries")
    .select("stage")
    .limit(2000);
  const seen = new Set(rows.map((r) => r.key));
  const orphans = new Set<string>();
  for (const e of (entryStages ?? []) as Array<{ stage: string }>) {
    if (!seen.has(e.stage)) orphans.add(e.stage);
  }
  for (const key of orphans) {
    const preset = PRESET_STAGES.find((p) => p.key === key);
    rows.push({
      key,
      label: preset?.label ?? key,
      kind: "preset",
      sort_order: preset?.sort_order ?? 999,
      year_start: null,
      year_end: null,
      parent_key: null,
    });
  }

  rows.sort((a, b) => a.sort_order - b.sort_order);
  return rows;
}

// ============================================================
// Coverage
// ============================================================

interface EntryRow {
  stage: string;
  axis: string;
  question: string;
  answer: string;
  depth_level: number;
  created_at: string;
}

function computeCoverage(
  entries: EntryRow[],
  stages: UserStage[],
): Array<{ stage: string; axis: AxisKey; count: number; maxDepth: number }> {
  const coverage: Record<string, { count: number; maxDepth: number }> = {};
  for (const e of entries) {
    const key = `${e.stage}|${e.axis}`;
    if (!coverage[key]) coverage[key] = { count: 0, maxDepth: 0 };
    coverage[key].count += 1;
    coverage[key].maxDepth = Math.max(coverage[key].maxDepth, e.depth_level);
  }
  const out: Array<{ stage: string; axis: AxisKey; count: number; maxDepth: number }> = [];
  for (const s of stages) {
    for (const a of AXES) {
      const key = `${s.key}|${a.key}`;
      const c = coverage[key] || { count: 0, maxDepth: 0 };
      out.push({ stage: s.key, axis: a.key, count: c.count, maxDepth: c.maxDepth });
    }
  }
  return out;
}

/** 最も手薄な stage × axis を選ぶ。count=0 優先、次に maxDepth 低い順。 */
function suggestNext(
  coverage: ReturnType<typeof computeCoverage>,
  focus: { stage?: string; axis?: string } = {},
): { stage: string; axis: AxisKey } {
  let pool = coverage;
  if (focus.stage) pool = pool.filter((c) => c.stage === focus.stage);
  if (focus.axis) pool = pool.filter((c) => c.axis === focus.axis);
  if (pool.length === 0) pool = coverage;
  pool.sort((a, b) => (a.count - b.count) || (a.maxDepth - b.maxDepth) || (Math.random() - 0.5));
  return { stage: pool[0].stage, axis: pool[0].axis };
}

// ============================================================
// Handlers
// ============================================================

interface RequestBody {
  action:
    | "next_question"
    | "answer"
    | "summarize"
    | "coverage"
    | "list_stages"
    | "ingest_narrative"
    | "propose_splits"
    | "save_stages";
  session_id?: string;
  mode?: "quick" | "medium" | "deep";
  focus_stage?: string;
  focus_axis?: string;
  question?: string;
  answer?: string;
  stage?: string;
  axis?: string;
  depth_level?: number;
  // ingest_narrative
  stage_key?: string;
  narrative?: string;
  // save_stages
  upserts?: Array<{
    key: string;
    label: string;
    kind?: "preset" | "custom";
    sort_order?: number;
    year_start?: number | null;
    year_end?: number | null;
    parent_key?: string | null;
  }>;
  deletions?: string[];
  entry_migrations?: Array<{ entry_id: number; new_stage_key: string }>;
}

async function handleListStages(sb: ReturnType<typeof userClient>, userId: string) {
  const stages = await listUserStages(sb, userId);
  const { data: entriesData } = await sb
    .from("life_story_entries")
    .select("stage")
    .limit(2000);
  const countByStage: Record<string, number> = {};
  for (const e of (entriesData ?? []) as Array<{ stage: string }>) {
    countByStage[e.stage] = (countByStage[e.stage] ?? 0) + 1;
  }
  const enriched = stages.map((s) => ({ ...s, entry_count: countByStage[s.key] ?? 0 }));
  return new Response(JSON.stringify({ stages: enriched, axes: AXES }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function handleNextQuestion(sb: ReturnType<typeof userClient>, userId: string, body: RequestBody) {
  const stages = await listUserStages(sb, userId);

  const { data: entriesData } = await sb
    .from("life_story_entries")
    .select("stage, axis, question, answer, depth_level, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const entries: EntryRow[] = entriesData ?? [];

  const coverage = computeCoverage(entries, stages);
  const target = suggestNext(coverage, { stage: body.focus_stage, axis: body.focus_axis });
  const stageLabel = stages.find((s) => s.key === target.stage)?.label ?? target.stage;
  const axisLabel = AXES.find((a) => a.key === target.axis)?.label ?? target.axis;

  const existingInArea = entries.filter((e) => e.stage === target.stage && e.axis === target.axis);
  const recentInArea = existingInArea.slice(0, 3).map((e) => `Q: ${e.question}\nA: ${e.answer.substring(0, 120)}`).join("\n\n");
  const depthSoFar = existingInArea.length === 0 ? 0 : Math.max(...existingInArea.map((e) => e.depth_level));

  const systemPrompt = `ユーザーの人生の棚卸しを手伝う質問者です。
今回フォーカスする領域: stage="${target.stage}"(${stageLabel}) × axis="${target.axis}"(${axisLabel})
すでにこの領域で聞いた質問がある場合、**同じ質問を繰り返さず、次の深さの質問をしてください**。
これまでの深度: ${depthSoFar}/5 (0=未着手, 5=深堀り済み)

## 良い質問の作り方
- 具体的なエピソードを引き出す（「どんな時に」「誰と」「どこで」）
- 感情を含める（「どう感じたか」）
- ステージ固有の文脈（小学生なら「学校」「友達」「家族」、社会人なら「仕事」「人間関係」「成長」）
- 一度に1つだけ聞く（複合質問は避ける）
- 30〜60字程度、あまり長くしない
- クリシェを避ける（「夢は何でしたか？」のような月並みな質問は NG）

## 出力JSON
{
  "question": "質問文",
  "stage": "${target.stage}",
  "axis": "${target.axis}",
  "suggested_depth": 1..5,
  "rationale": "なぜこの質問を今聞くか（短く）"
}`;

  const userMessage = recentInArea
    ? `この領域でこれまでの質問と回答:\n${recentInArea}\n\n次の質問を生成してください。`
    : `この領域はまだ未着手です。最初の質問を生成してください。`;

  const result = await anthropicJson<{
    question: string;
    stage: string;
    axis: string;
    suggested_depth: number;
    rationale: string;
  }>(systemPrompt, userMessage, 0.7, 300);

  if (!result) {
    return new Response(JSON.stringify({ error: "Failed to generate question" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      question: result.question,
      stage: target.stage,
      stage_label: stageLabel,
      axis: target.axis,
      axis_label: axisLabel,
      suggested_depth: result.suggested_depth ?? Math.min(depthSoFar + 1, 5),
      rationale: result.rationale,
      coverage,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
}

async function handleAnswer(sb: ReturnType<typeof userClient>, userId: string, body: RequestBody) {
  if (!body.question || !body.answer || !body.stage || !body.axis) {
    return new Response(JSON.stringify({ error: "question, answer, stage, axis required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const { error } = await sb.from("life_story_entries").insert({
    owner_id: userId,
    stage: body.stage,
    axis: body.axis,
    question: body.question,
    answer: body.answer,
    depth_level: body.depth_level ?? 1,
    session_id: body.session_id ?? null,
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ saved: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function handleCoverage(sb: ReturnType<typeof userClient>, userId: string) {
  const stages = await listUserStages(sb, userId);
  const { data: entriesData } = await sb
    .from("life_story_entries")
    .select("stage, axis, question, answer, depth_level, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const entries: EntryRow[] = entriesData ?? [];
  return new Response(
    JSON.stringify({
      coverage: computeCoverage(entries, stages),
      total_entries: entries.length,
      stages,
      axes: AXES,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
}

async function handleSummarize(sb: ReturnType<typeof userClient>, body: RequestBody) {
  if (!body.session_id) {
    return new Response(JSON.stringify({ error: "session_id required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const { data: entriesData } = await sb
    .from("life_story_entries")
    .select("stage, axis, question, answer, depth_level, created_at")
    .eq("session_id", body.session_id)
    .order("created_at", { ascending: true });
  const entries: EntryRow[] = entriesData ?? [];
  if (entries.length === 0) {
    return new Response(JSON.stringify({ digest: [], themes: [], next_suggestions: [] }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const formatted = entries
    .map((e) => `[${e.stage}/${e.axis}] Q: ${e.question}\nA: ${e.answer}`)
    .join("\n\n");

  const systemPrompt = `ユーザーの人生の棚卸しセッションの回答群を整理する役割です。
次の JSON で返してください:
{
  "digest": [
    { "stage": "...", "axis": "...", "text": "このステージ・軸から浮かび上がる短い言語化（1-3文）" }
  ],
  "themes": ["全体を貫くテーマ1", "テーマ2"],
  "next_suggestions": ["次回深掘りするとよい領域や問い（2-3つ）"]
}
- 引用ではなく抽象化・言語化する
- 日本語の自然な語りで。クリシェや詩的比喩は避ける`;

  const parsed = await anthropicJson<{
    digest: Array<{ stage: string; axis: string; text: string }>;
    themes: string[];
    next_suggestions: string[];
  }>(systemPrompt, `回答群:\n\n${formatted}`, 0.5, 1500);

  return new Response(
    JSON.stringify({
      digest: parsed?.digest ?? [],
      themes: parsed?.themes ?? [],
      next_suggestions: parsed?.next_suggestions ?? [],
      total_entries: entries.length,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
}

// ============================================================
// ingest_narrative: 自然文を複数 entry に分解して保存
// ============================================================

async function handleIngestNarrative(sb: ReturnType<typeof userClient>, userId: string, body: RequestBody) {
  if (!body.stage_key || !body.narrative || body.narrative.trim().length < 10) {
    return new Response(JSON.stringify({ error: "stage_key and non-empty narrative required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const stages = await listUserStages(sb, userId);
  const stage = stages.find((s) => s.key === body.stage_key);
  if (!stage) {
    return new Response(JSON.stringify({ error: `Unknown stage_key: ${body.stage_key}` }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const axesList = AXES.map((a) => `  - ${a.key}: ${a.label}`).join("\n");
  const systemPrompt = `ユーザーが書いた自然文から、人生の棚卸し用のエントリを抽出します。
対象ステージ: key="${stage.key}", label="${stage.label}"

## 軸（axis）— この中から選ぶ
${axesList}

## 出力 JSON
{
  "entries": [
    {
      "axis": "values|family|joy|struggle|turning_point|career|relationships",
      "question": "その内容を引き出す擬似質問（なかった想定で後から聞く形にする、30-50字）",
      "answer": "本文の該当部分を、ユーザーの一人称のままコンパクトに抜粋・再構成（100-400字）",
      "depth_level": 1..5
    }
    // 文量に応じて複数。1つの話題は1エントリ。薄い記述も取りこぼさない
  ]
}

## 抽出のコツ
- 1つのエピソード/感情/気づき = 1 エントリ
- axis は1つに決める（迷ったら最も中心的なもの）
- answer はユーザーの言葉を残す。要約しすぎない。感情語・固有名詞は残す
- depth_level: 1=表層的な事実、3=エピソード+感情、5=価値観・本質まで踏み込んだ振り返り
- 内容がほぼ無い（挨拶のみ・10字未満）なら entries は空配列でよい
- 事実だけでなく、書いていないが自然に推論できる感情/価値観は取りすぎない（書いてあることから離れない）`;

  const parsed = await anthropicJson<{
    entries: Array<{ axis: AxisKey; question: string; answer: string; depth_level: number }>;
  }>(systemPrompt, `自然文:\n\n${body.narrative}`, 0.4, 3000);

  const rawEntries = parsed?.entries ?? [];
  const axisKeys = new Set(AXES.map((a) => a.key));
  const validEntries = rawEntries
    .filter((e) => axisKeys.has(e.axis) && e.answer && e.answer.trim().length > 0)
    .map((e) => ({
      owner_id: userId,
      stage: body.stage_key!,
      axis: e.axis,
      question: (e.question || "").slice(0, 300),
      answer: e.answer.slice(0, 4000),
      depth_level: Math.max(1, Math.min(5, Math.round(e.depth_level || 1))),
      session_id: body.session_id ?? null,
    }));

  if (validEntries.length === 0) {
    return new Response(
      JSON.stringify({ saved_count: 0, entries: [], warning: "抽出できる内容がありませんでした" }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const { data: inserted, error } = await sb
    .from("life_story_entries")
    .insert(validEntries)
    .select("id, stage, axis, question, answer, depth_level");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ saved_count: inserted?.length ?? 0, entries: inserted ?? [] }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
}

// ============================================================
// propose_splits: 情報量の多い stage を AI が分割提案
// ============================================================

async function handleProposeSplits(sb: ReturnType<typeof userClient>, userId: string, body: RequestBody) {
  if (!body.stage_key) {
    return new Response(JSON.stringify({ error: "stage_key required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const stages = await listUserStages(sb, userId);
  const stage = stages.find((s) => s.key === body.stage_key);
  if (!stage) {
    return new Response(JSON.stringify({ error: `Unknown stage_key: ${body.stage_key}` }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: entriesData } = await sb
    .from("life_story_entries")
    .select("id, stage, axis, question, answer, depth_level, created_at")
    .eq("stage", body.stage_key)
    .order("created_at", { ascending: true });
  const entries = (entriesData ?? []) as Array<EntryRow & { id: number }>;

  // 情報量しきい値: 5 件以上、もしくは総文字数 1500 以上
  const totalChars = entries.reduce((n, e) => n + (e.answer?.length ?? 0), 0);
  const enoughInfo = entries.length >= 5 || totalChars >= 1500;

  if (!enoughInfo) {
    return new Response(
      JSON.stringify({
        should_split: false,
        reason: `まだ情報が少ないため分割提案は保留（${entries.length}件 / ${totalChars}字）`,
        proposals: [],
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // 子ステージ候補として既存 custom stages も渡す（重複提案を避ける）
  const siblings = stages.filter((s) => s.parent_key === body.stage_key);

  const entriesDump = entries
    .map((e) => `#${e.id} [${e.axis}] Q: ${e.question}\nA: ${e.answer.substring(0, 400)}`)
    .join("\n\n");

  const existingChildren = siblings.length > 0
    ? `\n\n【すでに存在する子ステージ】\n${siblings.map((s) => `- ${s.key}: ${s.label} (${s.year_start ?? "?"}-${s.year_end ?? "?"})`).join("\n")}`
    : "";

  const systemPrompt = `ユーザーの人生の棚卸しデータを読み、**このステージを複数の粒度に分割できそうか**判断します。
対象: key="${stage.key}", label="${stage.label}" (kind=${stage.kind})

## 分割の考え方
- 社会人期なら「1社目（会社名）」「2社目」「独立後」「転職直後1年目」等、所属や役割の節目で分ける
- 学生期なら「小学校高学年」「中学の部活時代」「高3受験期」等、情報量が多い場合のみ
- 情報量が不十分なら should_split=false を返す（無理に分割しない）
- 既存の子ステージと重複する提案はしない。足りない区切りだけ追加する
- 既に粒度が十分（例: 各年ごと）なら should_split=false
- **ユーザーの言葉に固有名詞（会社名、学校名、地名）があればそれを label に使う**

## key の命名
- 半角英数字とアンダースコアのみ
- 親との関連がわかる名前: "company_accenture", "freelance_year_1", "high_school_senior"

## 出力 JSON
{
  "should_split": true/false,
  "reason": "判断理由（2-3文）",
  "proposals": [
    {
      "key": "company_accenture",
      "label": "1社目（アクセンチュア）",
      "year_start": 2015,
      "year_end": 2018,
      "rationale": "この分割をする理由（1-2文）",
      "entry_ids": [12, 15, 18]  // このステージに移すべき既存エントリのID
    }
  ]
}

- 分割する場合は 2 個以上の proposals を返す（1個だけなら分割する意味がない）
- year_start/year_end は本文から読み取れなければ null
- entry_ids は必ず実在する ID のみ（不明なら空配列）`;

  const parsed = await anthropicJson<{
    should_split: boolean;
    reason: string;
    proposals: Array<{
      key: string;
      label: string;
      year_start: number | null;
      year_end: number | null;
      rationale: string;
      entry_ids: number[];
    }>;
  }>(systemPrompt, `エントリ:\n\n${entriesDump}${existingChildren}`, 0.3, 2000);

  if (!parsed) {
    return new Response(JSON.stringify({ error: "Failed to generate proposals" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // entry_ids の妥当性チェック
  const validIds = new Set(entries.map((e) => e.id));
  const sanitized = (parsed.proposals ?? []).map((p) => ({
    ...p,
    entry_ids: (p.entry_ids ?? []).filter((id) => validIds.has(id)),
  }));

  return new Response(
    JSON.stringify({
      should_split: !!parsed.should_split && sanitized.length >= 2,
      reason: parsed.reason ?? "",
      proposals: sanitized,
      entry_count: entries.length,
      total_chars: totalChars,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
}

// ============================================================
// save_stages: stages の upsert / delete / entry 移行
// ============================================================

async function handleSaveStages(sb: ReturnType<typeof userClient>, userId: string, body: RequestBody) {
  const upserts = body.upserts ?? [];
  const deletions = body.deletions ?? [];
  const migrations = body.entry_migrations ?? [];

  if (upserts.length === 0 && deletions.length === 0 && migrations.length === 0) {
    return new Response(JSON.stringify({ error: "no changes specified" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // 既存 stages 取得（sort_order 付番に必要）
  const stages = await listUserStages(sb, userId);

  // Upsert
  if (upserts.length > 0) {
    const rows = upserts.map((u) => {
      const existing = stages.find((s) => s.key === u.key);
      // 新規の場合、sort_order が未指定なら parent の直後に挿入
      let sortOrder = u.sort_order;
      if (sortOrder === undefined) {
        if (u.parent_key) {
          const parent = stages.find((s) => s.key === u.parent_key);
          const siblings = stages
            .filter((s) => s.parent_key === u.parent_key)
            .sort((a, b) => a.sort_order - b.sort_order);
          const last = siblings[siblings.length - 1];
          const base = parent ? parent.sort_order : 0;
          const step = 0.1;
          sortOrder = last
            ? last.sort_order + step
            : base + step;
        } else {
          sortOrder = (existing?.sort_order) ?? 999;
        }
      }
      return {
        owner_id: userId,
        key: u.key,
        label: u.label,
        kind: u.kind ?? (existing?.kind ?? "custom"),
        sort_order: sortOrder,
        year_start: u.year_start ?? null,
        year_end: u.year_end ?? null,
        parent_key: u.parent_key ?? null,
      };
    });
    const { error } = await sb
      .from("life_story_user_stages")
      .upsert(rows, { onConflict: "owner_id,key" });
    if (error) {
      return new Response(JSON.stringify({ error: `upsert failed: ${error.message}` }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  // Delete（preset は削除禁止）
  if (deletions.length > 0) {
    const toDelete = deletions.filter((k) => {
      const s = stages.find((x) => x.key === k);
      return s && s.kind !== "preset";
    });
    if (toDelete.length > 0) {
      const { error } = await sb
        .from("life_story_user_stages")
        .delete()
        .in("key", toDelete);
      if (error) {
        return new Response(JSON.stringify({ error: `delete failed: ${error.message}` }), {
          status: 500,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }
  }

  // Entry 移行
  if (migrations.length > 0) {
    // 新しい stage_key の存在チェック（upsert後なので再取得）
    const { data: allStages } = await sb
      .from("life_story_user_stages")
      .select("key");
    const validStageKeys = new Set(((allStages ?? []) as Array<{ key: string }>).map((s) => s.key));

    for (const m of migrations) {
      if (!validStageKeys.has(m.new_stage_key)) continue;
      const { error } = await sb
        .from("life_story_entries")
        .update({ stage: m.new_stage_key })
        .eq("id", m.entry_id);
      if (error) {
        console.error("[life-story] entry migration failed", m.entry_id, error.message);
      }
    }
  }

  const updated = await listUserStages(sb, userId);
  return new Response(
    JSON.stringify({ stages: updated, applied: { upserts: upserts.length, deletions: deletions.length, migrations: migrations.length } }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
}

// ============================================================
// Main
// ============================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    switch (body.action) {
      case "next_question":
        return await handleNextQuestion(auth.sb, auth.userId, body);
      case "answer":
        return await handleAnswer(auth.sb, auth.userId, body);
      case "coverage":
        return await handleCoverage(auth.sb, auth.userId);
      case "summarize":
        return await handleSummarize(auth.sb, body);
      case "list_stages":
        return await handleListStages(auth.sb, auth.userId);
      case "ingest_narrative":
        return await handleIngestNarrative(auth.sb, auth.userId, body);
      case "propose_splits":
        return await handleProposeSplits(auth.sb, auth.userId, body);
      case "save_stages":
        return await handleSaveStages(auth.sb, auth.userId, body);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    const msg = (err as Error).message || String(err);
    console.error("[life-story] handler error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
