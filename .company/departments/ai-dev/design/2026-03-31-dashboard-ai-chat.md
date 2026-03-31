# ダッシュボード AIチャット機能 — 設計書

**作成日**: 2026-03-31
**ステータス**: 設計中
**パイプライン**: A（新機能開発）
**複雑度**: large

---

## 1. 概要

company-dashboard に ChatGPT ライクなAIチャット機能を追加する。
ユーザーがダッシュボード上で直接AIと対話でき、Supabase上のデータや
ローカルファイル（sync済み）をコンテキストとして利用できる。

### 参考: opencode.ai
- ブラウザベースのAIコーディング環境
- 複数モデル対応（OpenAI, Anthropic, Google, etc.）
- ストリーミングレスポンス
- 会話履歴の永続化

---

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────┐
│  company-dashboard (index.html)              │
│                                              │
│  ┌─────────────────────────────────┐        │
│  │  Chat UI                        │        │
│  │  ┌─────────────┐ ┌───────────┐ │        │
│  │  │ 会話リスト   │ │ メッセージ │ │        │
│  │  │ (sidebar)   │ │ (main)    │ │        │
│  │  └─────────────┘ └───────────┘ │        │
│  │  [モデル選択] [コンテキスト選択] │        │
│  └─────────────────────────────────┘        │
└──────────────────┬──────────────────────────┘
                   │ fetch (streaming)
                   ▼
┌─────────────────────────────────────────────┐
│  Supabase Edge Function: ai-chat            │
│                                              │
│  1. 認証チェック (JWT)                       │
│  2. コンテキスト収集                         │
│     - conversations/messages テーブル        │
│     - artifacts, tasks, knowledge_base       │
│     - claude_settings (CLAUDE.md content)    │
│  3. モデルルーティング                       │
│     - auto: 複雑さ判定 → 最適モデル選択     │
│     - manual: ユーザー指定モデル             │
│  4. API呼び出し (OpenAI / Anthropic)        │
│  5. ストリーミングレスポンス返却             │
│  6. messages テーブルに保存                  │
└─────────────────────────────────────────────┘
```

---

## 3. データモデル（Supabase テーブル）

### conversations テーブル
```sql
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT,                          -- 固定モデル（nullなら自動ルーティング）
  context_mode TEXT DEFAULT 'full',    -- 'full' | 'supabase' | 'none'
  company_id TEXT,                     -- PJ会社コンテキスト（nullならHD）
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
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,                          -- 実際に使用されたモデル
  tokens_input INT,
  tokens_output INT,
  cost_usd NUMERIC(10, 6),            -- 概算コスト
  routing_reason TEXT,                 -- 自動ルーティングの理由
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### chat_api_keys テーブル（Edge Function用）
```sql
-- Supabase Vault (secrets) を使用
-- Edge Function の環境変数に設定:
--   OPENAI_API_KEY
--   ANTHROPIC_API_KEY
```

---

## 4. モデルルーティング

### 4.1 対応モデル

| モデル | Provider | Input $/1M | Output $/1M | 用途 |
|--------|----------|-----------|-------------|------|
| gpt-4o-mini | OpenAI | $0.15 | $0.60 | 簡単な質問、翻訳、要約 |
| gpt-4o | OpenAI | $2.50 | $10.00 | 分析、コード説明、一般質問 |
| claude-sonnet-4-6 | Anthropic | $3.00 | $15.00 | 設計、長文推論、複雑なタスク |
| claude-haiku-4-5 | Anthropic | $0.80 | $4.00 | 速度重視の中程度タスク |

### 4.2 自動ルーティングロジック

```
入力プロンプト
  ↓
分類器（gpt-4o-mini で判定、~$0.001/回）
  ↓
┌─────────────────────────────────────┐
│ complexity: simple                   │ → gpt-4o-mini
│  例: 翻訳、定型質問、短い要約       │
├─────────────────────────────────────┤
│ complexity: moderate                 │ → gpt-4o
│  例: コード解説、データ分析、比較    │
├─────────────────────────────────────┤
│ complexity: complex                  │ → claude-sonnet-4-6
│  例: 設計レビュー、長文推論、戦略    │
└─────────────────────────────────────┘
```

**分類プロンプト（~50 tokens）:**
```
Classify this user message complexity as "simple", "moderate", or "complex":
- simple: translation, short summary, factual lookup, casual chat
- moderate: code explanation, data analysis, comparison, moderate reasoning
- complex: architecture design, long-form reasoning, strategy, multi-step
Message: {first 200 chars of user message}
Reply with only one word.
```

**コスト**: 分類自体は gpt-4o-mini で ~$0.001/回（ほぼ無視可能）

### 4.3 手動オーバーライド

UI上部にモデルセレクター。選択するとそのconversation全体で固定。
「Auto」を選ぶと自動ルーティングに戻る。

---

## 5. コンテキスト注入

### 5.1 コンテキストソース

| ソース | 取得方法 | サイズ目安 |
|--------|----------|-----------|
| 会話履歴 | conversations + messages テーブル | ~直近20件 |
| ナレッジ | knowledge_base (active) | ~2000 tokens |
| タスク | tasks (open, 該当company) | ~1000 tokens |
| 成果物 | artifacts (active, 要約) | ~2000 tokens |
| CLAUDE.md | claude_settings.claude_md_content | ~1500 tokens |
| PJ CLAUDE.md | claude_settings.company_claude_md | ~1000 tokens |
| CEOインサイト | ceo_insights (直近5件) | ~500 tokens |

### 5.2 システムプロンプト構成

```
あなたは {company_name} のAIアシスタントです。

## コンテキスト
{knowledge_base のルール一覧}

## 現在のタスク
{open tasks の一覧}

## 直近の成果物
{artifacts の要約}

## 組織設定
{CLAUDE.md の内容}

## ユーザーの傾向
{ceo_insights の要約}
```

**トークン上限**: システムプロンプト全体で最大 8,000 tokens
超過時は優先度順にトリミング（knowledge > tasks > artifacts > insights）

### 5.3 ローカルファイル参照

`claude_settings` テーブルに sync済みの `claude_md_content` と `company_claude_md` を使用。
Edge Function はSupabaseのデータのみ参照するため、ファイルシステムアクセスは不要。
（config-sync.sh が SessionStart で同期済み）

---

## 6. Edge Function 設計

### 6.1 エンドポイント

```
POST /functions/v1/ai-chat
Authorization: Bearer {supabase_jwt}
Content-Type: application/json

{
  "conversation_id": "uuid",        // 既存会話（省略で新規作成）
  "message": "ユーザーの質問",
  "model": "auto" | "gpt-4o-mini" | "gpt-4o" | "claude-sonnet-4-6" | "claude-haiku-4-5",
  "context_mode": "full" | "supabase" | "none",
  "company_id": "circuit" | null
}
```

### 6.2 レスポンス（Server-Sent Events）

```
data: {"type": "meta", "model": "gpt-4o", "routing_reason": "moderate complexity"}
data: {"type": "delta", "content": "こんにちは"}
data: {"type": "delta", "content": "、回路設計について"}
data: {"type": "done", "tokens_input": 1200, "tokens_output": 350, "cost_usd": 0.0065}
```

### 6.3 処理フロー

```typescript
// supabase/functions/ai-chat/index.ts (Deno)

1. JWT検証 → user_id 取得
2. conversation_id がなければ新規作成
3. 会話履歴を取得（直近20件）
4. コンテキスト収集（context_mode に応じて）
5. モデル決定
   - model === "auto" → 分類器で判定
   - それ以外 → 指定モデルを使用
6. プロバイダーAPI呼び出し（ストリーミング）
   - OpenAI: POST https://api.openai.com/v1/chat/completions
   - Anthropic: POST https://api.anthropic.com/v1/messages
7. ストリーミングチャンクをSSEで返却
8. 完了後、messagesテーブルにINSERT（user + assistant）
9. conversation.updated_at を更新
```

---

## 7. UI設計

### 7.1 ページ構成

ダッシュボードに「Chat」タブを追加（ナビゲーション）。

```
┌──────────────────────────────────────────────┐
│ [← 戻る]  Chat   [Auto ▼] [⚙ Context: Full]│  ← ヘッダー
├──────────┬───────────────────────────────────┤
│ 会話一覧  │                                   │
│          │  こんにちは！                       │
│ ● 新規   │  回路設計のPJについて...           │
│          │                                   │
│ 今日     │  ┌─ assistant (gpt-4o) ─────────┐│
│ ○ 回路の │  │ 回路設計PJの現状を説明します。 ││
│   相談   │  │ ...                           ││
│ ○ コスト │  └──────────────────────────────┘│
│   分析   │                                   │
│          │                                   │
│ 昨日     │                                   │
│ ○ ...   │                                   │
│          ├───────────────────────────────────┤
│          │ [メッセージを入力...]    [送信 ↩] │  ← 入力欄
└──────────┴───────────────────────────────────┘
```

### 7.2 メッセージ表示

- **ユーザー**: 右寄せ、薄い背景
- **アシスタント**: 左寄せ、モデル名バッジ付き
- **ストリーミング**: 文字が流れるように表示（SSE）
- **Markdown対応**: marked.js でレンダリング
- **コード**: シンタックスハイライト
- **コスト表示**: 各メッセージに概算コスト（小さく）

### 7.3 モバイル対応

- 会話リストはハンバーガーメニューで表示/非表示
- 入力欄は画面下部に固定
- スマホからでもフル操作可能

---

## 8. コスト見積もり

### 月間利用想定（個人利用）

| 利用パターン | 回数/日 | モデル | コスト/回 | 月コスト |
|-------------|---------|--------|----------|---------|
| 簡単な質問 | 20回 | gpt-4o-mini | ~$0.001 | ~$0.60 |
| 普通の質問 | 10回 | gpt-4o | ~$0.01 | ~$3.00 |
| 複雑な相談 | 3回 | claude-sonnet | ~$0.05 | ~$4.50 |
| ルーティング判定 | 33回 | gpt-4o-mini | ~$0.001 | ~$1.00 |
| **合計** | | | | **~$9.10/月** |

### ルーティングなしの場合（全てgpt-4oを使用）

| 回数/日 | コスト/回 | 月コスト |
|---------|----------|---------|
| 33回 | ~$0.01 | ~$9.90/月 |

→ ルーティングにより **月$0.80程度の節約** + 複雑なタスクはSonnetの高品質回答を得られる

---

## 9. 実装計画

### Phase 1: 基盤（MVP）
- [ ] Supabase migration: conversations, messages テーブル作成
- [ ] Edge Function: ai-chat（gpt-4o-mini のみ、ストリーミング）
- [ ] UI: Chat ページ（会話リスト + メッセージ表示 + 入力）
- [ ] 会話履歴の保存・読み込み

### Phase 2: マルチモデル
- [ ] 自動ルーティング実装
- [ ] 手動モデル選択UI
- [ ] Anthropic API 対応
- [ ] コスト表示

### Phase 3: コンテキスト
- [ ] Supabaseデータのコンテキスト注入
- [ ] PJ会社コンテキスト切り替え
- [ ] コンテキストモード選択UI

### Phase 4: 拡張
- [ ] 会話のエクスポート（Markdown）
- [ ] 会話の検索
- [ ] プロンプトテンプレート
- [ ] prompt_log との統合

---

## 10. セキュリティ

- API キーは Supabase Vault / Edge Function 環境変数に保存（ブラウザに露出しない）
- Edge Function は Supabase JWT で認証
- Rate limiting: Edge Function 側で 60 req/min
- コンテキストに含まれるデータは認証ユーザーのものに限定

---

## 次のステップへの申し送り

**実装部署（sys-dev）へ:**
1. まず Phase 1 のMVPから着手
2. Edge Function は Deno (TypeScript) で実装
3. UI は既存の index.html に `renderChat` 関数を追加する形で統合
4. SSE のパースは `EventSource` ではなく `fetch` + `ReadableStream` を使用（POSTリクエストのため）
5. opencode.ai のUI/UXを参考に、ミニマルだが使いやすいチャットUIを目指す
