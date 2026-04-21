# 未来のあなた（partner_chat）に日記全文検索を追加する設計

- 対象PJ: focus-you
- 担当: AI開発部
- 作成日: 2026-04-21
- スコープ: `supabase/functions/ai-agent/index.ts` の `partner_chat` モード、および関連フロント
- 実装者: システム開発部

## 1. 背景と問題

AI partner（Today ページの「未来のあなた」、`FutureYouChat`）は `partner_chat` モード（`index.ts` L1413〜1494）で応答している。このモードは以下の構造：

- `buildSystemPrompt()`（L737〜912）で system prompt を作り、その中に **直近7日分の日記本文（最大10件、各400字）を静的注入** している（L780〜789）
- OpenAI Chat Completions を **1ショット呼び出し**、tools を一切渡していない
- 応答 JSON を受けてそのまま返す。tool use ループがない

このため「山口さんと会ったときにもう一人いた人は？」のような **直近7日の範囲外かつ固有名詞検索が必要な事実質問** には答えられない。

一方、`agent` モード（L1080〜1340）には既に `diary_search` ツール（定義 L250〜268、実装 L386〜482：PGroonga 全文検索 + pgvector 感情ベクトル検索 + gpt-nano による rerank）が実装されている。この資産を partner_chat に持ち込むのが本設計の主題。

## 2. 設計原則

### 2.1 キャラ維持（最重要）

「未来のあなた」の口調（親密・穏やか・敬語・想起誘導）は絶対に崩さない。ツール呼び出しは **キャラの裏側で行う内部動作** として扱い、ユーザーに「検索しました」「日記を探しています」のような応答は絶対させない。

### 2.2 受動 AI としての節度（Auto Memory `feedback_ai_active_passive.md`）

AI partner は「想起誘導」が基本スタンス。ただし今回対応したいのは **事実質問**（who/when/where/what）で、想起誘導ではなく事実を返すべきもの。この境界を system prompt で明示する：

- **検索を使う**: 固有名詞・日時・場所・具体的な出来事が質問に含まれるとき
- **検索を使わない**: 「最近の自分は…」「どう思う？」等、感情の整理・内省・相談

### 2.3 遅延とコストの抑制

- 毎ターン検索すると 300〜500ms 上乗せ + gpt-nano rerank で数十トークン課金される
- モデルに **ツール判断を委ねる**（`tool_choice: "auto"`）ことで、必要なときだけ呼ぶ。強制しない

## 3. 方針決定

### 3.1 tool use ループ：`agent` モードの既存パターンを流用

`agent` モードの L1259〜1340 のループ構造（callLLM → toolCalls があれば executeTool → messages に push → ループ）をそのまま持ってくる。流用に足る理由：

- `callLLM`（L538）/ `callOpenAI`（L543）/ `executeTool`（L293）は mode に非依存で、messages と tools を渡すだけ
- `diary_search` は既に service-role で動く（L387）ので RLS 引き回しも不要
- Anthropic / OpenAI の provider abstraction も既に済んでいる

**差分**（partner_chat 固有）:

| 観点 | agent モード | partner_chat（新） |
|---|---|---|
| ストリーミング | SSE で都度 delta 送信 | 非ストリーミング（現状維持）、最終テキストのみ返す |
| DB 書き込み | `messages`, `conversations` に保存 | `chat_interactions` に保存（現状どおり） |
| model | auto routing あり | `gpt-5.4` 固定（現状どおり） |
| reasoning_effort | `low`〜`high` | `low` 固定（現状どおり） |
| MAX_STEPS | 10 | **3** に抑制（キャラ性のため多重検索させない） |
| ツール | 全 TOOLS | **`diary_search` のみ**（他ツールは無関係） |
| メモリ抽出並列実行 | なし | `extractAndSaveMemories` 並列（現状どおり） |

キャラのため `MAX_STEPS=3` に制限。1ターンで「検索→応答」で終わるのが通常、最大 2 回検索して応答する余地のみ残す。

### 3.2 system prompt：直近7日の静的注入は **残す**（削らない）

#### 判断

- **削る案**: tool に一任すればトークン節約になる。ただし毎ターン検索が走る、または「話題に触れる日記」が検索で引けない場合（感情的な話で keyword が薄いとき）に文脈が失われる
- **残す案**: 直近7日はカジュアル対話のベース文脈として不可欠。検索はあくまで「範囲外」を拾うもの
- **決定: 残す**。直近7日は「呼吸するように参照する生テキスト」、検索は「想起に失敗したときの補助記憶」として層を分ける

#### 追加する指示（system prompt 末尾）

現行の `## ツール使用` セクション（L907〜909）を以下に置換：

```
## ツール使用（diary_search）
- あなたは過去の日記を検索するツール diary_search を持っています。判断は以下に従ってください。
- 使うとき: 本人が固有名詞（人名・場所・固有の出来事）や具体的な時期（「去年」「先月」「3月頃」）を挙げて、事実を思い出そうとしているとき。直近7日の文脈に答えが無いとき。
- 使わないとき: 気持ちの整理・相談・「最近どう思う？」のような内省的な問い。直近の日記だけで応答できるとき。
- 使い方の感覚: keyword には本人の言葉で使われた語をそのまま入れる。迷ったら入れない（検索は無料ではない）。
- 応答の出し方: 検索結果を使っても「調べました」「検索したところ」と言わず、自分が覚えていた記憶として自然に提示する。
  - 悪い例: 「日記を検索したところ、山口さんとお会いした日には田中さんも同席されていました」
  - 良い例: 「たしかあの日、田中さんもご一緒でしたね」
- 検索結果が引けなかった/該当がなかった場合は、正直に「その記憶は見当たらず」「自分でも思い出せなくて」のように、キャラ内で言葉にする。知ったかぶりで作話しない。
```

### 3.3 フロント側の変更：**無し**（レスポンス互換を守る）

現状の `aiPartnerChat`（`edgeAi.ts` L112〜151）は `{content, model, saved_memories, forgotten_memories}` を期待している。Edge Function 側でツールループを内部的に回し、**最終的な assistant テキストだけをこの形で返す**ことで、フロントは一切変えない。

すなわち、ツール呼び出しの途中状態（`tool_calls` / `tool` role メッセージ）はクライアントに一切見せない。Edge 内で閉じる。

### 3.4 会話履歴の扱い

`aiPartnerChat` は `history` を送ってくる（role=user/assistant の配列、tool 情報は含まない）。これは **問題ない**：

- Edge 内部ループで発生する tool_calls / tool role メッセージは **このターンの messages 配列内にだけ存在し**、最終応答後に破棄される
- クライアントには最終 assistant 本文しか返らないので、次ターンの `history` にツール痕跡が混ざらない
- 過去ターンの検索結果が必要なら再度検索させれば良い（キャラ的にもそのほうが自然）

## 4. 変更する関数と変更内容（コード断片）

### 変更ファイル: `company-dashboard/supabase/functions/ai-agent/index.ts` のみ

### 4.1 partner_chat ブロック（L1413〜1494）をツールループ化

**before（L1422〜1466 抜粋）:**

```typescript
const { prompt: systemPrompt } = await buildSystemPrompt();
const model = body.model || "gpt-5.4";
const history: { role: string; content: string }[] = Array.isArray(body.history) ? body.history : [];
const userMessage = String(body.message || "");

const messages = [
  { role: "system", content: systemPrompt },
  ...history.filter((m) => m && m.role && m.content).map((m) => ({ role: m.role, content: m.content })),
  { role: "user", content: userMessage },
];

// 応答生成とメモリ抽出を並列で実行
const mainRequest = fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model,
    messages,
    max_completion_tokens: 2000,
    reasoning_effort: "low",
  }),
});
// ... extractionPromise, openaiRes, openaiData.choices?.[0]?.message?.content
```

**after（概要）:**

```typescript
const { prompt: systemPrompt } = await buildSystemPrompt();
const model = body.model || "gpt-5.4";
const history: { role: string; content: string }[] = Array.isArray(body.history) ? body.history : [];
const userMessage = String(body.message || "");

// Typed messages to reuse callLLM / executeTool
const messages: Message[] = [
  { role: "system", content: systemPrompt },
  ...history
    .filter((m) => m && m.role && m.content)
    .map((m) => ({ role: m.role as Message["role"], content: m.content })),
  { role: "user", content: userMessage },
];

// partner_chat 専用: diary_search のみ許可、キャラ維持のため最大 3 ステップ
const partnerTools = TOOLS.filter((t) => t.name === "diary_search");
const MAX_PARTNER_STEPS = 3;

// メモリ抽出は従来どおり並列で走らせる
const extractionPromise = extractAndSaveMemories(
  userMessage,
  body.session_id || null,
  userId,
).catch((e) => {
  console.error("extractAndSaveMemories threw:", e);
  return { saved: [], forgotten: 0 };
});

// ツールループ（非ストリーミング — onDelta は no-op でよい）
let assistantMessage = "";
let totalIn = 0;
let totalOut = 0;
let step = 0;
let usedTools: string[] = [];
const noop = () => {};

try {
  while (step < MAX_PARTNER_STEPS) {
    step++;
    const result = await callLLM(model, messages, partnerTools, noop, "low");
    totalIn += result.tokensInput;
    totalOut += result.tokensOutput;

    if (result.stopReason === "end_turn" || result.toolCalls.length === 0) {
      assistantMessage = result.text;
      break;
    }

    // tool_calls を含む assistant メッセージを messages に push
    messages.push({
      role: "assistant",
      content: result.text || "",
      tool_calls: result.toolCalls,
    });

    for (const tc of result.toolCalls) {
      // partner_chat では diary_search のみ許可（防御的チェック）
      if (tc.name !== "diary_search") {
        messages.push({
          role: "tool",
          content: `(tool ${tc.name} is not available in partner_chat)`,
          tool_call_id: tc.id,
          name: isAnthropicModel(model) ? undefined : tc.name,
        });
        continue;
      }
      usedTools.push(tc.name);
      const toolResult = await executeTool(tc.name, tc.input, userJwt);
      const truncated = toolResult.substring(0, MAX_TOOL_RESULT_CHARS);
      messages.push({
        role: "tool",
        content: truncated,
        tool_call_id: tc.id,
        name: isAnthropicModel(model) ? undefined : tc.name,
      });
    }
  }

  // MAX 到達時は messages に最後まで積んだ状態なので、最終呼び出しで必ず end_turn を引き出す
  if (!assistantMessage) {
    const finalRes = await callLLM(model, messages, [], noop, "low");
    assistantMessage = finalRes.text;
    totalIn += finalRes.tokensInput;
    totalOut += finalRes.tokensOutput;
  }
} catch (err) {
  const msg = (err as Error).message;
  return new Response(JSON.stringify({ error: `LLM error: ${msg.substring(0, 500)}` }), {
    status: 500,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

const memoryResult = await extractionPromise;

// chat_interactions への記録（現状どおり）
try {
  const sb = getSupabase();
  await sb.from("chat_interactions").insert({
    session_id: body.session_id || null,
    user_message: userMessage,
    assistant_message: assistantMessage,
    entry_point: body.entry_point || "today_partner",
    model,
    // ツール使用痕跡を context_snapshot に残す（運用観測用）
    context_snapshot: usedTools.length > 0 ? { tools_used: usedTools, steps: step } : null,
  });
} catch (e) {
  console.error("chat_interactions insert failed:", e);
}

return new Response(JSON.stringify({
  content: assistantMessage,
  model,
  usage: { prompt_tokens: totalIn, completion_tokens: totalOut, total_tokens: totalIn + totalOut },
  saved_memories: memoryResult.saved,
  forgotten_memories: memoryResult.forgotten,
}), {
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
});
```

**ポイント:**
- 既存 import（`createClient` 以外は一切追加不要）を全て流用。`Message`, `ToolDef`, `callLLM`, `executeTool`, `TOOLS`, `isAnthropicModel`, `MAX_TOOL_RESULT_CHARS`, `extractAndSaveMemories`, `buildSystemPrompt`, `getSupabase` は既に同ファイル内に定義済み
- ストリーミング不使用（`onDelta = noop`）。レスポンス形式・フロントは非変更
- `usage` フィールドは agent loop のようにトークン合算値で返す。従来形と互換

### 4.2 buildSystemPrompt（L854〜909）の末尾 `## ツール使用` セクション書き換え

**before（L907〜909）:**

```
## ツール使用
必要に応じて tasks_search / artifacts_read / web_search などのツールを使ってもよいですが、
本人の気持ちの整理や人生相談においては、ツールより日記と傾向から静かに応答することを優先してください。
```

**after:**

```
## ツール使用（diary_search）
- あなたは過去の日記を検索するツール diary_search を持っています。
- 使うとき: 本人が固有名詞（人名・場所・固有の出来事）や具体的な時期（「去年」「先月」「3月頃」）を挙げて、事実を思い出そうとしているとき。直近7日に答えが無いとき。
- 使わないとき: 気持ちの整理・内省・「最近どう思う？」のような相談。直近の日記だけで応答できるとき。
- 使い方: keyword には本人が口にした語をそのまま入れる。迷ったら入れない。1ターンに何度も検索しない。
- 応答: 検索結果は「自分の記憶」として自然に織り込む。「検索した」「調べた」とは言わない。
  - 悪い例: 「日記を検索したところ、山口さんとお会いした日には田中さんも同席されていました」
  - 良い例: 「たしかあの日、田中さんもご一緒でしたね」
- 見つからなかったとき: 正直に「思い出せない」旨を言葉にする。作話しない。
```

この書き換えは `agent` モード（同じ `buildSystemPrompt()` を使う）にも適用されるが、agent モード側は元々 web_search 等も許可されていたので実害を検証する必要がある。

**安全策**: `buildSystemPrompt` の引数に `mode?: "agent" | "partner_chat"` を追加し、mode ごとにセクションを出し分ける。

```typescript
// before: async function buildSystemPrompt(companyId?: string, personalization?: Record<string, unknown>)
// after:
async function buildSystemPrompt(
  companyId?: string,
  personalization?: Record<string, unknown>,
  mode: "agent" | "partner_chat" = "agent",
): Promise<{ prompt: string; report: ContextInjectionReport }> {
  // ... (内部は既存同様)
  const toolSection = mode === "partner_chat"
    ? `\n## ツール使用（diary_search）\n- ... 上記の partner_chat 用指示 ...\n`
    : `\n## ツール使用\n必要に応じて tasks_search / artifacts_read / web_search などのツールを使ってもよいですが、\n本人の気持ちの整理や人生相談においては、ツールより日記と傾向から静かに応答することを優先してください。\n`;

  const prompt = `...既存本文...
${personSection}${customSection}${timeSection}${diarySection}${insightsSection}${analysisSection}${dreamsSection}${learnedSection}${memoriesSection}
## 禁止事項（厳守）
... 既存 ...
${toolSection}`;
  return { prompt, report };
}
```

partner_chat での呼び出しを `buildSystemPrompt(undefined, undefined, "partner_chat")` にする。agent モード（L1168）は引数を渡さないので従来挙動を維持。

### 4.3 型定義の調整不要

- `body` の型定義（L1379）には既に `mode?: string` がある
- `Message` 型（L14〜20）は tool_calls / tool_call_id / name を持つ
- 新規 import: **無し**。既存ファイルのトップで import されている `createClient` を追加利用するだけ（既にループ内の executeTool 経由で使う）

## 5. レスポンス形式の互換性

| フィールド | 現状 | 変更後 | フロント影響 |
|---|---|---|---|
| `content` | string | string（同） | 無 |
| `model` | string | string（同） | 無 |
| `usage` | OpenAI の usage オブジェクト | `{prompt_tokens, completion_tokens, total_tokens}`（合算） | 無（形状互換） |
| `saved_memories` | array | array（同） | 無 |
| `forgotten_memories` | number | number（同） | 無 |

`FutureYouChat.tsx` / `aiPartnerChat` / `edgeAi.ts` は変更不要。

## 6. リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| モデルが毎ターン検索してしまい遅くなる | UX 劣化（+0.5〜1s） | system prompt で「迷ったら検索しない」を明記。`MAX_PARTNER_STEPS=3` で暴走抑止。観測用に `context_snapshot` に tools_used を記録 |
| 「検索した」とメタ発言してキャラが崩れる | キャラ信頼失墜（最重要） | system prompt に悪い例/良い例を提示。QA で「山口さんと誰がいた？」系質問を20パターン回して検証（後述） |
| tool_calls が 4xx で返る（未対応 model 等） | 応答不能 | `gpt-5.4` は function calling 対応済み。fallback に `callLLM` 既存の try/catch が効く |
| diary_search が0件を返したときに作話 | 幻覚 | system prompt で「見つからなければ正直に言う」を明記。さらに tool result に `(no matches)` を明示的に含める変更は diary_search 側で将来検討（本設計では必須にしない） |
| 会話履歴に tool 痕跡が残り context が膨らむ | トークン浪費 | partner_chat では履歴にツール痕跡を **保存しない**（messages 配列はターン内限り、`chat_interactions` にも assistant 本文しか保存しない）。次ターンは検索をやり直す仕様 |
| buildSystemPrompt 書き換えが agent モードに副作用 | agent モードの回帰 | `mode` 引数で分岐。agent のデフォルト挙動は不変 |
| precision_mode / reasoning_effort: "high" のような将来拡張との混線 | 拡張時の混乱 | partner_chat では `reasoning_effort` を `low` 固定で明示。body から受け取らない |
| Anthropic モデルが選ばれた場合 | tool 呼び出しは動くが、gpt-5.4 固定のため現状は発生しない | 将来 Anthropic 許容する場合は `callAnthropic` のループ互換を確認。今回はスコープ外 |

## 7. 検証計画（QA へのハンドオフ用チェックリスト）

実装完了後、以下を QA で確認：

- [ ] **検索が走るケース**（事実質問20件）: 「〇〇さんと会ったとき、他に誰がいた？」「去年の3月頃、何してた？」「引越しの日、日記に何書いた？」など。`chat_interactions.context_snapshot` に `tools_used: ["diary_search"]` が記録されている
- [ ] **検索が走らないケース**（内省10件）: 「今日どう思う？」「最近の自分ってどう？」「少し疲れてる」など。`context_snapshot` が null
- [ ] **キャラが崩れない**: 検索を使ったとしても応答に「検索」「調べ」「日記を確認」等の語が混入しない
- [ ] **見つからない場合の挙動**: 存在しない人名で質問して、作話せず「思い出せない」旨を返す
- [ ] **応答時間**: 検索なし 1〜2秒、検索あり 2〜4秒に収まる
- [ ] **直近7日に含まれる事実**: 静的注入だけで答えられ、ツール発火しない（不要検索をしていない証拠）
- [ ] **agent モードの回帰テスト**: Today 以外の AI chat（agent モード）が従来どおり動く
- [ ] **メモリ抽出**: 並列抽出が従来どおり `ai_partner_memories` に保存される
- [ ] **chat_interactions 保存**: assistant_message にはツール痕跡が含まれず、本文のみ

## 8. 想定工数

- Edge Function 実装: 1.5h（partner_chat ブロック書き換え + buildSystemPrompt 分岐）
- デプロイ（`supabase functions deploy ai-agent --no-verify-jwt`）: 0.1h
- QA 検証: 1h（上記チェックリスト）
- docs 更新（Blueprint の AI Features タブ）: 0.3h

合計 約3h

---

# handoff

```yaml
handoff:
  - to: sys-dev
    context: "focus-you ダッシュボードの AI partner（Today ページ FutureYouChat）に過去日記の事実検索能力を与える。既存の diary_search ツールを partner_chat モードでも使えるようにする。本設計書 `.company-focus-you/ai-dev/design/diary-search-for-partner-chat.md` の §4 に該当する変更を実装する。"
    tasks:
      - "[focus-you] partner_chat モードを tool use ループ化し、diary_search のみを許可する（MAX_STEPS=3）。コード位置は company-dashboard/supabase/functions/ai-agent/index.ts の L1413〜1494。設計書 §4.1 の after 断片をそのまま参考にしてよい。新しい import は追加しない（既存の Message / ToolDef / callLLM / executeTool / TOOLS / isAnthropicModel / MAX_TOOL_RESULT_CHARS / extractAndSaveMemories / buildSystemPrompt / getSupabase を流用）"
      - "[focus-you] buildSystemPrompt に `mode: 'agent' | 'partner_chat'` 引数を追加し、既存の `## ツール使用` セクションを mode ごとに分岐。デフォルトは 'agent' で挙動不変。partner_chat 用の指示文は設計書 §4.2 の after 断片を使う"
      - "[focus-you] partner_chat 呼び出し側（L1421 付近）を `buildSystemPrompt(undefined, undefined, 'partner_chat')` に変更"
      - "[focus-you] レスポンス形式は互換維持（content/model/usage/saved_memories/forgotten_memories）。フロント側（FutureYouChat.tsx, aiPartner.ts, edgeAi.ts）は変更しないこと"
      - "[focus-you] chat_interactions.context_snapshot に `{tools_used: [...], steps: n}` を保存（ツールが発火したターンのみ）"
      - "[focus-you] 実装後、`supabase functions deploy ai-agent --no-verify-jwt` でデプロイするところまで1セットで行う（feedback_edge_function_deploy）"
  - to: qa
    context: "実装完了後、設計書 §7 のチェックリストで検証する"
    tasks:
      - "事実質問20件で diary_search が発火することを chat_interactions.context_snapshot で確認"
      - "内省質問10件で発火しないことを確認"
      - "応答に『検索した』『調べた』等のメタ表現が混入しないことを確認（キャラ崩壊の検知）"
      - "存在しない人名で作話しないことを確認"
      - "agent モードの既存機能に回帰がないことを確認（Today 以外の AI chat）"
  - to: ops
    context: "実装変更に伴うダッシュボード側の説明更新"
    tasks:
      - "company-dashboard/src/pages/Blueprint.tsx の AI Features タブに『partner_chat で日記全文検索が使えるようになった』旨を追記"
```
