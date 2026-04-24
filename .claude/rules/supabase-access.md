# Supabase アクセスルール

## 将来方針: MCP server 移行（次 quarter）

> Claude Code v2.1.119 の MCP parallelization で 67% 起動時間削減が実証された。
> Hook の `sb.sh` → Supabase MCP server 移行が次 quarter のフォーカス（詳細: `hd-operations.md`）。
> 現在は `sb.sh` を使い続ける。移行設計が固まり次第このセクションを更新する。

## 原則: `sb.sh` ラッパー経由で叩く

**CLI / Hook / バッチから Supabase を叩くときは、必ず `/workspace/.claude/hooks/api/sb.sh` を使う。** `source supabase.env && curl ...` を直接書かない。

理由:
1. **承認ダイアログが出ない**（`Bash(.claude/hooks/api/sb.sh:*)` で allow 済み）
2. URL・ヘッダ・ingest-key の付け忘れを防ぐ
3. env ファイルの読み込みを隠蔽してプロンプトが短くなる

## 接続情報

**env ファイル**: `~/.claude/hooks/supabase.env`（`sb.sh` 内部で自動 source）

| 変数 | 用途 |
|------|------|
| `SUPABASE_URL` | REST API ベースURL |
| `SUPABASE_ANON_KEY` | データ読み書き（RLS適用） |
| `SUPABASE_ACCESS_TOKEN` | Management API（SQL実行、スキーマ変更） |
| `SUPABASE_INGEST_KEY` | 書き込み用 x-ingest-key |

## `sb.sh` パターン集

```bash
# Management API: SQL実行（RLS迂回、分析・集計の基本形）
sb.sh query "SELECT id, title FROM tasks WHERE status='open' LIMIT 10"

# REST GET（anon key）— ダッシュボード相当、RLS が掛かる
sb.sh get tasks "?status=eq.open&select=id,title&limit=10"

# REST GET + x-ingest-key（RLS を通過して読む）
sb.sh get-auth tasks "?status=eq.open"

# REST POST（書き込み、x-ingest-key 自動付与）
sb.sh post tasks '{"title":"新規タスク","status":"open"}'

# REST PATCH
sb.sh patch tasks "?id=eq.xxx" '{"status":"done","completed_at":"now()"}'

# REST DELETE
sb.sh delete tasks "?id=eq.xxx"

# Edge Function 呼び出し
sb.sh fn ai-agent '{"prompt":"hello"}'

# ヘルプ
sb.sh help
```

**呼び出しパス**: プロンプトからは `.claude/hooks/api/sb.sh` でも `/workspace/.claude/hooks/api/sb.sh` でも allow 済み。Hook / スクリプト内からは絶対パスを推奨。

## RLS とデータ読み取りの原則

**anon key（`sb.sh get`）で `[]` が返ってきたら「データなし」と判断するのは禁止。**
ほぼ全ての業務テーブルに RLS が掛かっており、anon key では空配列になる。

**`/company` ブリーフィング・分析・集計は最初から `sb.sh query` を使う**（Management API、RLS迂回）。

確認済み RLS 対象（参考、これに限らない）:
- `tasks` — タスク・TODO
- `knowledge_base` — ナレッジ
- `diary_entries`, `emotion_analysis`, `secretary_notes`, `ceo_insights` — 日記・分析系
- `growth_events`, `agent_sessions`, `pipeline_runs`, `comments` — ログ・セッション系

`sb.sh get` + anon key は「ダッシュボードからの認証付きクライアント」を想定したパスで、CLI/Hook からは原則使わない。書き込みで `x-ingest-key` を付ける場合は `sb.sh post/patch/delete` を使う（自動付与される）。

## Edge Functions（ユーザー認証が必要なもの）

### 原則: `verify_jwt = false` + 関数内検証

**新しく user 認証を要求する Edge Function を作るときは、デフォルトで以下にする:**

1. `supabase/config.toml` に `[functions.{name}] verify_jwt = false` を書く
2. 関数内で `sb.auth.getUser(jwt)` を使って user を復元し、そこで認証検証する
3. デプロイは `supabase functions deploy {name} --no-verify-jwt`

### なぜゲートウェイ検証を使わないか

Supabase は 2025 末〜2026 初頭に **ES256 非対称鍵 + `sb_publishable_*` publishable key** 方式に移行した。この方式だと、Edge Function のゲートウェイ組み込み `verify_jwt` が ES256 署名の user JWT を拒否する事象が発生する（`{"code":401,"message":"Invalid JWT"}` を返す）。関数内の `sb.auth.getUser(jwt)` は `/auth/v1/user` を叩いて Supabase 自身に検証させるため、署名アルゴリズムに依存せず動く。

実績: `google-calendar-proxy` / `ai-agent` は `verify_jwt = false` で正常稼働。

### エラー形式で切り分ける

401 を見たら、**レスポンス body の形式**で層を判定する:

| 形式 | 出所 | 意味 |
|------|------|------|
| `{"code":401,"message":"Invalid JWT"}` | Supabase ゲートウェイ | 関数到達前にゲートウェイが拒否。ES256 非対称鍵問題 or 署名不一致 |
| `{"code":401,"message":"Missing authorization header"}` | Supabase ゲートウェイ | Authorization ヘッダ自体が無い |
| `{"error":"Missing authorization"}` / `{"error":"Invalid token"}` | 自分の関数コード | 関数には到達している。関数内の検証ロジックで弾かれている |

**`{"error": ...}` 形式を自分の関数で統一しておくと、平文で出所が区別できる。**

### クライアント側の原則

RLS 付きテーブル/関数へのアクセスは、クライアント（ブラウザ・React）で必ず以下を守る:

1. **呼ぶ直前に `supabase.auth.refreshSession()` で access_token を新鮮にする**（残有効60秒未満なら強制リフレッシュ）
2. **401 が返ったら一度だけリフレッシュしてリトライ**するラッパーを作る（例: `authedFetch`）
3. `Authorization` ヘッダに空文字 `Bearer ` を送らない（ゲートウェイが Invalid JWT として拒否する）
4. `user_id` を body で送ってサーバ側で信頼してはならない（**認証バイパスと等価**）。必ず JWT から `sb.auth.getUser(jwt)` で復元する

## 禁止事項

- **CLI / Hook / バッチから `source supabase.env && curl ...` の生コマンドを書かない**（`sb.sh` を使う）
- `mcp__plugin_supabase_supabase__authenticate` を使わない（OAuth認証が毎回必要で面倒）
- Service Role Key はこの env に存在しない。スキーマ変更は `sb.sh query` を使う
- **Edge Function で `user_id` を body フィールドとして認証フォールバックにしない**（認証バイパス）

## 既存コード例（参考・レガシー）

既存の Hook / バッチには `source ~/.claude/hooks/supabase.env && curl ...` の形式が残っている場合がある。動作上は問題ないが、触るときは `sb.sh` ベースに書き換える。新規に書くときは必ず `sb.sh` を使う。

<details>
<summary>生 curl の例（新規では使わない）</summary>

```bash
# Management API SQL
source ~/.claude/hooks/supabase.env
curl -s -X POST "https://api.supabase.com/v1/projects/akycymnahqypmtsfqhtr/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1"}'
```

</details>
