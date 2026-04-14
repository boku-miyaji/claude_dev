# Supabase アクセスルール

## 接続情報

**ファイル**: `~/.claude/hooks/supabase.env`（= `/home/node/.claude/hooks/supabase.env`）

```bash
source ~/.claude/hooks/supabase.env
```

| 変数 | 用途 |
|------|------|
| `SUPABASE_URL` | REST API ベースURL |
| `SUPABASE_ANON_KEY` | データ読み書き（RLS適用） |
| `SUPABASE_ACCESS_TOKEN` | Management API（SQL実行、スキーマ変更） |
| `SUPABASE_INGEST_KEY` | Hook用インジェストキー |

## パターン集

### データ読み取り（REST API + anon key）
```bash
source ~/.claude/hooks/supabase.env
curl -s "${SUPABASE_URL}/rest/v1/tasks?status=eq.open&select=id,title" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

### データ書き込み（REST API + anon key）
```bash
curl -s -X POST "${SUPABASE_URL}/rest/v1/tasks" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title": "...", "status": "open"}'
```

### データ読み取り（Management API — RLS付きテーブル）

**原則: anon key で `[]` が返ってきたら「データなし」と判断するのは禁止。** 必ず Management API で再確認する。
ほぼ全ての業務テーブルに RLS が掛かっており、anon key では空配列になる。**列挙して覚えるな。デフォルトで Management API を使え。**

確認済み RLS 対象（参考、これに限らない）:
- `tasks` — タスク・TODO
- `knowledge_base` — ナレッジ
- `diary_entries`, `emotion_analysis`, `secretary_notes`, `ceo_insights` — 日記・分析系
- `growth_events`, `agent_sessions`, `pipeline_runs`, `comments` — ログ・セッション系

**`/company` ブリーフィング・分析・集計は最初から Management API を使う。** anon key を試して空だったから Management API、ではなく、最初からこちら。
anon key + REST は「ダッシュボードからの認証付きクライアント」を想定したパスで、CLI/Hook からは原則使わない（書き込みで `x-ingest-key` を付ける場合を除く）。

### SQL実行（Management API + access token）
RLS変更、マイグレーション適用、RLS付きテーブルの読み取りに使う。
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/akycymnahqypmtsfqhtr/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1"}'
```

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

RLS 付きテーブル/関数へのアクセスは、クライアントで必ず以下を守る:

1. **呼ぶ直前に `supabase.auth.refreshSession()` で access_token を新鮮にする**（残有効60秒未満なら強制リフレッシュ）
2. **401 が返ったら一度だけリフレッシュしてリトライ**するラッパーを作る（例: `authedFetch`）
3. `Authorization` ヘッダに空文字 `Bearer ` を送らない（ゲートウェイが Invalid JWT として拒否する）
4. `user_id` を body で送ってサーバ側で信頼してはならない（**認証バイパスと等価**）。必ず JWT から `sb.auth.getUser(jwt)` で復元する

## 禁止事項

- `mcp__plugin_supabase_supabase__authenticate` を使わない（OAuth認証が毎回必要で面倒）
- Service Role Key はこの env に存在しない。スキーマ変更は Management API を使う
- **Edge Function で `user_id` を body フィールドとして認証フォールバックにしない**（認証バイパス）
