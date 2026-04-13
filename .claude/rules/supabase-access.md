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

## 禁止事項

- `mcp__plugin_supabase_supabase__authenticate` を使わない（OAuth認証が毎回必要で面倒）
- Service Role Key はこの env に存在しない。スキーマ変更は Management API を使う
