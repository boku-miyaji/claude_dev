# ダッシュボード AIチャット機能 — 設計書 v2

**作成日**: 2026-03-31
**ステータス**: 設計中
**パイプライン**: A（新機能開発）
**複雑度**: large
**参考**: OpenCode (https://opencode.ai) のエージェントアーキテクチャ

---

## 1. 概要 — 一発LLMではなくエージェント

ダッシュボードに**エージェント型AIアシスタント**を追加する。
ChatGPTのような「質問→回答」の1往復ではなく、OpenCodeのように
**自律的にツールを使い、考え、また使い、最終回答を組み立てる**エージェントループを実装する。

### 従来のLLMチャットとの違い

```
一発LLMチャット:
  ユーザー → LLM → 回答（終了）

本設計（エージェント型）:
  ユーザー → LLM → 「タスク一覧を見よう」→ tasks検索
                  → 「この成果物の内容は？」→ artifact読み取り
                  → 「最新のナレッジは？」→ knowledge_base検索
                  → 「関連情報をWebで確認」→ Web検索
                  → 全情報を統合して最終回答
```

---

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  company-dashboard (index.html)                          │
│                                                          │
│  Chat UI                                                 │
│  ┌──────────┬──────────────────────────────────────────┐│
│  │ 会話一覧  │  [ツール実行中: tasks検索... ◌]         ││
│  │          │                                          ││
│  │ ● 新規   │  ┌─ assistant (gpt-4o) ───────────────┐ ││
│  │          │  │ タスクを確認しました。               │ ││
│  │ ○ 回路PJ │  │ 現在3件のオープンタスクがあります:  │ ││
│  │ ○ 全体   │  │ ...                                 │ ││
│  │          │  └──────────────────────────────────────┘ ││
│  │          │                                          ││
│  │          │  ┌─ tool: tasks_search ────────────────┐ ││
│  │          │  │ ▸ SELECT * FROM tasks WHERE ...      │ ││
│  │          │  │   → 3件取得                          │ ││
│  │          │  └──────────────────────────────────────┘ ││
│  │          │                                          ││
│  │          ├──────────────────────────────────────────┤│
│  │          │ [メッセージを入力...]         [送信 ↩]  ││
│  │          │ [Auto ▼] [Context: Full ▼]              ││
│  └──────────┴──────────────────────────────────────────┘│
└────────────────────┬────────────────────────────────────┘
                     │ fetch (SSE streaming)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase Edge Function: ai-agent                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  AGENT LOOP (OpenCode inspired)                     │ │
│  │                                                     │ │
│  │  [1] メッセージ + コンテキスト構築                  │ │
│  │      ↓                                              │ │
│  │  [2] LLM呼び出し（ストリーミング）                  │ │
│  │      ↓                                              │ │
│  │  [3] finish_reason 判定                             │ │
│  │      ├── "tool_use" → [4] ツール実行 → [2]に戻る  │ │
│  │      └── "end_turn" → [5] 最終回答を返却           │ │
│  │                                                     │ │
│  │  最大ステップ: 10（暴走防止）                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Tool Registry │  │ Provider     │  │ Session      │  │
│  │ (10+ tools)   │  │ Abstraction  │  │ Manager      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. エージェントループ

### 3.1 ループの実装（Edge Function内）

```typescript
// 擬似コード: supabase/functions/ai-agent/index.ts

async function agentLoop(messages, tools, model, maxSteps = 10) {
  let step = 0;

  while (step < maxSteps) {
    step++;

    // SSEでステップ開始を通知
    sendSSE({ type: 'step_start', step, total: maxSteps });

    // LLM呼び出し
    const response = await callLLM(model, messages, tools);

    // テキスト部分をストリーミング送信
    for await (const chunk of response.stream) {
      sendSSE({ type: 'delta', content: chunk.text });
    }

    // finish_reason 判定
    if (response.stop_reason === 'end_turn') {
      // ツール呼び出しなし → ループ終了
      sendSSE({ type: 'done', step, model, tokens: response.usage });
      break;
    }

    if (response.stop_reason === 'tool_use') {
      // ツール呼び出しあり → 実行してループ継続
      for (const toolCall of response.tool_calls) {
        sendSSE({ type: 'tool_start', tool: toolCall.name, input: toolCall.input });

        const result = await executeTool(toolCall.name, toolCall.input);

        sendSSE({ type: 'tool_result', tool: toolCall.name, output: summarize(result) });

        // ツール結果をメッセージに追加
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: [{ type: 'tool_result', ...result }] });
      }
      // → ループの先頭に戻る（LLMが次のアクションを判断）
    }
  }

  // 上限到達時
  if (step >= maxSteps) {
    sendSSE({ type: 'max_steps', message: 'ステップ上限に到達しました' });
  }
}
```

### 3.2 SSEイベント一覧

| type | 内容 | UI表示 |
|------|------|--------|
| `step_start` | ステップ開始 | 「Step 2/10...」プログレス |
| `delta` | テキストチャンク | 文字がストリーミング表示 |
| `tool_start` | ツール実行開始 | 「🔧 tasks_search を実行中...」 |
| `tool_result` | ツール実行結果 | 折りたたみ可能な結果表示 |
| `done` | ループ完了 | モデル名、トークン数、コスト表示 |
| `max_steps` | 上限到達 | 警告メッセージ |
| `error` | エラー | エラーメッセージ |

---

## 4. ツール定義（Tool Registry）

### 4.1 組み込みツール

LLMが自律的に呼び出せるツール。すべてEdge Function内で実行される。

| ツール名 | 説明 | データソース |
|---------|------|-------------|
| `tasks_search` | タスク検索・フィルタ | tasks テーブル |
| `tasks_create` | タスク作成 | tasks テーブル |
| `artifacts_read` | 成果物の内容取得 | artifacts テーブル |
| `artifacts_list` | 成果物一覧 | artifacts テーブル |
| `knowledge_search` | ナレッジ検索 | knowledge_base テーブル |
| `company_info` | PJ会社情報取得 | companies + claude_settings |
| `prompt_history` | プロンプト履歴検索 | prompt_log テーブル |
| `insights_read` | CEO分析結果取得 | ceo_insights テーブル |
| `activity_search` | アクティビティ検索 | activity_log テーブル |
| `web_search` | Web検索 | 外部API (DuckDuckGo等) |
| `intelligence_read` | 最新情報レポート取得 | secretary_notes (intelligence) |
| `calendar_today` | 今日の予定取得 | Google Calendar MCP※ |

※ calendar_today は将来拡張。Phase 1 では省略。

### 4.2 ツール定義のフォーマット（LLMに渡す）

```json
{
  "name": "tasks_search",
  "description": "タスク・TODOを検索する。status, company_id, priority でフィルタ可能。",
  "input_schema": {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["open", "done", "all"], "default": "open" },
      "company_id": { "type": "string", "description": "PJ会社ID (例: circuit, foundry)" },
      "query": { "type": "string", "description": "テキスト検索キーワード" },
      "limit": { "type": "integer", "default": 10, "maximum": 50 }
    }
  }
}
```

```json
{
  "name": "artifacts_read",
  "description": "成果物の内容を取得する。file_path または id で指定。",
  "input_schema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Artifact UUID" },
      "file_path": { "type": "string", "description": "ファイルパス (例: circuit_diagram/docs/...)" }
    }
  }
}
```

```json
{
  "name": "knowledge_search",
  "description": "ナレッジベースからルール・知見を検索する。カテゴリやキーワードでフィルタ。",
  "input_schema": {
    "type": "object",
    "properties": {
      "category": { "type": "string", "enum": ["coding", "design", "process", "tools", "domain", "all"] },
      "query": { "type": "string" },
      "scope": { "type": "string", "enum": ["global", "company"], "default": "global" }
    }
  }
}
```

```json
{
  "name": "web_search",
  "description": "最新情報をWeb検索する。技術的な質問、最新ニュース、ドキュメント検索に使う。",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "検索クエリ" },
      "max_results": { "type": "integer", "default": 5 }
    },
    "required": ["query"]
  }
}
```

### 4.3 ツール実行の実装

```typescript
async function executeTool(name: string, input: any): Promise<ToolResult> {
  switch (name) {
    case 'tasks_search': {
      let query = supabase.from('tasks').select('*');
      if (input.status !== 'all') query = query.eq('status', input.status);
      if (input.company_id) query = query.eq('company_id', input.company_id);
      if (input.query) query = query.ilike('title', `%${input.query}%`);
      const { data } = await query.limit(input.limit || 10);
      return { content: JSON.stringify(data) };
    }
    case 'artifacts_read': {
      const { data } = input.id
        ? await supabase.from('artifacts').select('*').eq('id', input.id).single()
        : await supabase.from('artifacts').select('*').eq('file_path', input.file_path).single();
      return { content: data?.content || 'Not found' };
    }
    case 'knowledge_search': {
      let query = supabase.from('knowledge_base').select('*').eq('status', 'active');
      if (input.category !== 'all') query = query.eq('category', input.category);
      const { data } = await query;
      return { content: JSON.stringify(data) };
    }
    case 'web_search': {
      // DuckDuckGo Instant Answer API or similar
      const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(input.query)}&format=json`);
      const data = await res.json();
      return { content: JSON.stringify(data) };
    }
    // ... 他のツール
  }
}
```

---

## 5. モデルルーティング

### 5.1 対応モデル（OpenCodeのProviderTransform方式を参考）

| モデル | Provider | Input $/1M | Output $/1M | 用途 |
|--------|----------|-----------|-------------|------|
| gpt-4o-mini | OpenAI | $0.15 | $0.60 | 分類、簡単な質問 |
| gpt-4o | OpenAI | $2.50 | $10.00 | 汎用タスク |
| claude-sonnet-4-6 | Anthropic | $3.00 | $15.00 | 複雑な推論、設計 |
| claude-haiku-4-5 | Anthropic | $0.80 | $4.00 | 速度重視 |

### 5.2 Provider Abstraction

```typescript
// OpenCodeのProviderTransformに相当
interface LLMProvider {
  stream(messages: Message[], tools: Tool[]): AsyncIterableIterator<StreamChunk>;
}

class OpenAIProvider implements LLMProvider {
  // OpenAI Chat Completions API
  // tool_calls → function calling format
}

class AnthropicProvider implements LLMProvider {
  // Anthropic Messages API
  // tool_use → content block format
  // 空コンテンツ除去等のtransform処理
}

function getProvider(model: string): LLMProvider {
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return new OpenAIProvider(model);
  if (model.startsWith('claude-')) return new AnthropicProvider(model);
  throw new Error(`Unknown model: ${model}`);
}
```

### 5.3 自動ルーティング（分類器）

```typescript
async function classifyComplexity(message: string): Promise<'simple' | 'moderate' | 'complex'> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Classify complexity as "simple", "moderate", or "complex":
- simple: translation, factual lookup, casual chat, short summary
- moderate: code explanation, data analysis, comparison
- complex: architecture design, long reasoning, strategy, multi-step planning
Message: "${message.substring(0, 200)}"
Reply with one word only.`
    }],
    max_tokens: 5
  });
  return res.choices[0].message.content.trim().toLowerCase();
}

const MODEL_MAP = {
  simple: 'gpt-4o-mini',
  moderate: 'gpt-4o',
  complex: 'claude-sonnet-4-6'
};
```

UIで手動選択した場合は分類をスキップしてそのモデルを直接使用。

---

## 6. コンテキスト注入（システムプロンプト）

### 6.1 構成

```typescript
function buildSystemPrompt(companyId?: string): string {
  return `あなたはダッシュボードのAIアシスタントです。
ユーザーの質問に答えるために、利用可能なツールを自律的に使ってください。

## 行動原則
- 質問に答えるために必要な情報は、ツールを使って自分で集める
- 推測ではなく、実データに基づいて回答する
- 複数のツールを組み合わせて、包括的な回答を組み立てる
- ツールの結果が不十分なら、別のツールや別のクエリで再検索する

## 利用可能なコンテキスト
- tasks: タスク・TODO管理
- artifacts: 成果物（設計書、レポート等）
- knowledge_base: 蓄積されたナレッジ・ルール
- prompt_log: 過去のプロンプト履歴
- ceo_insights: ユーザーの行動パターン分析
- activity_log: アクティビティ履歴
- intelligence: 最新情報レポート
- web_search: 最新のWeb情報

## 現在のコンテキスト
PJ会社: ${companyId || 'HD（全社）'}

## 回答スタイル
- 簡潔だが十分な情報量
- データに基づく場合はソースを明示
- 日本語で回答（技術用語は英語OK）`;
}
```

### 6.2 トークン管理

- システムプロンプト: ~500 tokens（固定）
- 会話履歴: 直近20メッセージ（超過時は古いものから要約）
- ツール結果: 各結果を最大2,000 tokensにトリミング
- 合計上限: モデルのコンテキスト窓の80%まで

---

## 7. データモデル（Supabase テーブル）

### conversations テーブル
```sql
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT,                          -- 固定モデル（nullなら自動ルーティング）
  context_mode TEXT DEFAULT 'full',
  company_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived BOOLEAN DEFAULT false
);
```

### messages テーブル
```sql
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  model TEXT,                          -- 使用モデル
  tool_calls JSONB,                    -- LLMが要求したツール呼び出し
  tool_name TEXT,                      -- tool roleの場合のツール名
  tool_input JSONB,                    -- ツール入力パラメータ
  tokens_input INT,
  tokens_output INT,
  cost_usd NUMERIC(10, 6),
  routing_reason TEXT,                 -- 自動ルーティング理由
  step INT,                            -- エージェントループのステップ番号
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 8. UI設計

### 8.1 ツール実行の可視化（OpenCode参考）

エージェントがツールを使っている過程をリアルタイムで見せる:

```
┌─ user ──────────────────────────────────────┐
│ circuit PJのタスク状況を教えて               │
└─────────────────────────────────────────────┘

┌─ 🔧 tasks_search ─────────────────────────┐
│ ▸ status: open, company_id: circuit         │
│ → 3件取得 (12ms)                    [折畳] │
└─────────────────────────────────────────────┘

┌─ 🔧 artifacts_list ───────────────────────┐
│ ▸ company_id: circuit, status: active       │
│ → 5件取得 (8ms)                     [折畳] │
└─────────────────────────────────────────────┘

┌─ assistant (gpt-4o) ── Step 3/10 ──────────┐
│ ## Circuit PJ 現況レポート                   │
│                                              │
│ ### オープンタスク (3件)                      │
│ 1. 暗黙知抽出サーベイのレビュー              │
│ 2. KiCadプラグインのテスト                   │
│ ...                                          │
│                                              │
│ ### 成果物 (5件)                              │
│ ...                                          │
│                              $0.008 · 450tok │
└─────────────────────────────────────────────┘
```

### 8.2 ツール実行ブロックのUI

- デフォルト折りたたみ（結果のサマリのみ表示）
- クリックで展開（入力パラメータ + 全結果）
- ツール名のアイコン: 🔧
- 実行時間を表示
- エラー時は赤色表示

### 8.3 モデルセレクター + コンテキスト

```
┌─────────────────────────────────────────┐
│ [Auto ▼]  [Context: Full ▼]            │
│                                          │
│  Auto (Recommended)                      │
│  ─────────────────                       │
│  gpt-4o-mini    $0.15/M  ⚡ 最速        │
│  gpt-4o         $2.50/M  ⚖ バランス     │
│  claude-haiku   $0.80/M  ⚡ 速い+賢い   │
│  claude-sonnet  $3.00/M  🧠 最も賢い    │
└─────────────────────────────────────────┘
```

### 8.4 会話リスト（左サイドバー）

- 今日 / 昨日 / 今週 / それ以前 でグルーピング
- 自動タイトル生成（最初のメッセージからLLMで1行要約）
- PJ会社バッジ表示
- 削除・アーカイブ操作

---

## 9. コスト見積もり

### エージェントループのコスト構造

1回の質問あたりの想定:
- 分類: gpt-4o-mini 1回 = ~$0.001
- エージェントループ: 平均3ステップ（ツール2回 + 最終回答）
- ツール結果の再入力: 各ステップでコンテキスト増加

| 質問タイプ | ステップ数 | モデル | コスト/回 |
|-----------|-----------|--------|----------|
| 簡単（1ステップ） | 1 | gpt-4o-mini | ~$0.002 |
| 普通（3ステップ） | 3 | gpt-4o | ~$0.03 |
| 複雑（5ステップ） | 5 | claude-sonnet | ~$0.15 |

### 月間想定（個人利用: 30回/日）

| パターン | 回数/日 | コスト/回 | 月コスト |
|---------|---------|----------|---------|
| 簡単 | 15回 | $0.002 | ~$0.90 |
| 普通 | 10回 | $0.03 | ~$9.00 |
| 複雑 | 5回 | $0.15 | ~$22.50 |
| **合計** | | | **~$32/月** |

→ ルーティングなし（全てsonnet）だと ~$135/月。**ルーティングで75%削減。**

---

## 10. セキュリティ

- APIキーは Supabase Edge Function 環境変数（ブラウザに露出しない）
- Edge Function は Supabase JWT で認証
- ツール実行はSupabase内のデータのみ（ファイルシステムアクセスなし）
- Rate limiting: 60 req/min per user
- ステップ上限: 10（暴走防止）
- web_search はサニタイズ済みクエリのみ

---

## 11. 実装フェーズ

### Phase 1: エージェントMVP
- [ ] Supabase migration: conversations, messages テーブル
- [ ] Edge Function: ai-agent（エージェントループ + gpt-4o-mini）
- [ ] ツール: tasks_search, artifacts_read, knowledge_search（3ツール）
- [ ] UI: Chat ページ（メッセージ + ツール実行表示 + 入力）
- [ ] SSEストリーミング + ツール実行の可視化
- [ ] 会話履歴の保存・復元

### Phase 2: マルチモデル + コンテキスト拡張
- [ ] Provider Abstraction（OpenAI + Anthropic）
- [ ] 自動ルーティング（分類器）
- [ ] 手動モデル選択UI
- [ ] ツール追加: prompt_history, insights_read, activity_search
- [ ] コスト表示（メッセージごと + セッション合計）

### Phase 3: 全ツール + UX
- [ ] ツール追加: web_search, intelligence_read, company_info
- [ ] 会話の自動タイトル生成
- [ ] 会話リストのグルーピング・検索
- [ ] モバイル対応
- [ ] PJ会社コンテキスト切り替え

### Phase 4: 高度な機能
- [ ] 会話のエクスポート（Markdown）
- [ ] プロンプトテンプレート（よく使う質問のプリセット）
- [ ] prompt_log との統合（チャットもprompt_logに記録）
- [ ] Auto Compact（コンテキスト圧縮）
- [ ] コスト分析ダッシュボード

---

## 12. OpenCodeとの対応関係

| OpenCode | 本設計 |
|----------|--------|
| Agent Loop (finish_reason制御) | Edge Function内のwhileループ |
| 14 built-in tools | 10+ Supabaseツール |
| ProviderTransform | Provider Abstraction Layer |
| SQLite永続化 | Supabase conversations/messages |
| SSE streaming | Edge Function → SSE → フロントエンド |
| パーミッション (allow/ask/deny) | Phase 4で検討（現在は全てallow） |
| Agent Teams | 将来: サブエージェント委譲 |
| Auto Compact | Phase 4 |
| Plugin hooks | 将来: カスタムツール追加 |

---

## 次のステップへの申し送り

**実装部署（sys-dev）へ:**

1. Phase 1 のMVPから着手。**最小構成: Edge Function + 3ツール + Chat UI**
2. Edge Function は Deno (TypeScript)。`Deno.serve` + SSE
3. UI は既存 index.html に `renderChat` を追加
4. SSEパースは `fetch` + `ReadableStream`（POST なので EventSource 不可）
5. ツール実行の可視化がUXの肝。折りたたみブロックで表示
6. エージェントループの各ステップをSSEで逐次送信し、リアルタイム感を出す
