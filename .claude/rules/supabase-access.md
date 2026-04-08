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
以下のテーブルは RLS が有効で、anon key では空配列が返る。**必ず Management API を使うこと。**
- `diary_entries` — 日記
- `emotion_analysis` — 感情分析
- `secretary_notes` (type=diary) — 秘書ノート
- `ceo_insights` — CEOインサイト

**anon key で空配列が返ったら「データがない」と判断してはいけない。まず Management API で件数を確認する。**

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
