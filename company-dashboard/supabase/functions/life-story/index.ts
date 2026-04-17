// supabase/functions/life-story/index.ts
// Interactive life-story builder: LLM asks targeted questions about the user's
// past (childhood through career) and saves structured answers. The system
// tracks coverage per stage × axis so subsequent sessions dig into thin areas.

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

const STAGES = [
  { key: "childhood", label: "幼少期（〜小学校入学前）" },
  { key: "elementary", label: "小学生" },
  { key: "junior_high", label: "中学生" },
  { key: "high_school", label: "高校生" },
  { key: "university", label: "大学・専門学校" },
  { key: "early_career", label: "社会人初期（〜5年）" },
  { key: "mid_career", label: "社会人中期（6〜15年）" },
  { key: "recent", label: "最近（直近3年）" },
] as const;

const AXES = [
  { key: "values", label: "価値観・人生観" },
  { key: "family", label: "家庭環境" },
  { key: "joy", label: "嬉しかったこと・ワクワク" },
  { key: "struggle", label: "苦しかったこと・挫折" },
  { key: "turning_point", label: "転機・決断" },
  { key: "career", label: "仕事・キャリア" },
  { key: "relationships", label: "人間関係" },
] as const;

type StageKey = typeof STAGES[number]["key"];
type AxisKey = typeof AXES[number]["key"];

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
      // Claude Opus 4.7+ では temperature が deprecated のため送らない。
      // (temperature 引数は将来の旧モデル対応のため残す)
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
// Coverage computation: stage × axis matrix
// ============================================================

interface EntryRow {
  stage: string;
  axis: string;
  question: string;
  answer: string;
  depth_level: number;
  created_at: string;
}

function computeCoverage(entries: EntryRow[]): Array<{ stage: StageKey; axis: AxisKey; count: number; maxDepth: number }> {
  const coverage: Record<string, { count: number; maxDepth: number }> = {};
  for (const e of entries) {
    const key = `${e.stage}|${e.axis}`;
    if (!coverage[key]) coverage[key] = { count: 0, maxDepth: 0 };
    coverage[key].count += 1;
    coverage[key].maxDepth = Math.max(coverage[key].maxDepth, e.depth_level);
  }
  const out: Array<{ stage: StageKey; axis: AxisKey; count: number; maxDepth: number }> = [];
  for (const s of STAGES) {
    for (const a of AXES) {
      const key = `${s.key}|${a.key}`;
      const c = coverage[key] || { count: 0, maxDepth: 0 };
      out.push({ stage: s.key, axis: a.key, count: c.count, maxDepth: c.maxDepth });
    }
  }
  return out;
}

/** Pick the most underfilled stage × axis. Prefer zero-count cells; ties broken by lowest maxDepth. */
function suggestNext(
  coverage: ReturnType<typeof computeCoverage>,
  focus: { stage?: string; axis?: string } = {},
): { stage: StageKey; axis: AxisKey } {
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
  action: "next_question" | "answer" | "summarize" | "coverage";
  session_id?: string;
  mode?: "quick" | "medium" | "deep";
  focus_stage?: string;
  focus_axis?: string;
  question?: string;
  answer?: string;
  stage?: string;
  axis?: string;
  depth_level?: number;
}

async function handleNextQuestion(sb: ReturnType<typeof userClient>, body: RequestBody) {
  const { data: entriesData } = await sb
    .from("life_story_entries")
    .select("stage, axis, question, answer, depth_level, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const entries: EntryRow[] = entriesData ?? [];

  const coverage = computeCoverage(entries);
  const target = suggestNext(coverage, { stage: body.focus_stage, axis: body.focus_axis });
  const stageLabel = STAGES.find((s) => s.key === target.stage)!.label;
  const axisLabel = AXES.find((a) => a.key === target.axis)!.label;

  // Build coverage summary text for the LLM to avoid repetition
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

async function handleCoverage(sb: ReturnType<typeof userClient>) {
  const { data: entriesData } = await sb
    .from("life_story_entries")
    .select("stage, axis, question, answer, depth_level, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const entries: EntryRow[] = entriesData ?? [];
  return new Response(
    JSON.stringify({
      coverage: computeCoverage(entries),
      total_entries: entries.length,
      stages: STAGES,
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
// Main handler
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
        return await handleNextQuestion(auth.sb, body);
      case "answer":
        return await handleAnswer(auth.sb, auth.userId, body);
      case "coverage":
        return await handleCoverage(auth.sb);
      case "summarize":
        return await handleSummarize(auth.sb, body);
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
