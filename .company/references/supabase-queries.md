# Supabase クエリテンプレート

## 認証ヘッダー（共通）

```bash
source /workspace/.claude/hooks/supabase.env

# 全リクエストに必須
-H "apikey: ${SUPABASE_ANON_KEY}"
-H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
-H "x-ingest-key: ${SUPABASE_INGEST_KEY}"
```

**注意**: `x-ingest-key` なしでは RLS で空配列が返る。必ず付与すること。

## ブリーフィング用クエリ

### 未処理コメント
```bash
curl -4 -s "${SUPABASE_URL}/rest/v1/comments?select=*&order=created_at.desc&limit=20" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}"
```

### 未完了タスク
```bash
curl -4 -s "${SUPABASE_URL}/rest/v1/tasks?select=*&status=eq.open&order=priority.asc,created_at.desc" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}"
```

### アクティブ ナレッジルール
```bash
curl -4 -s "${SUPABASE_URL}/rest/v1/knowledge_base?select=*&status=eq.active" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}"
```

## タスク操作

### タスク作成
```bash
curl -4 -s "${SUPABASE_URL}/rest/v1/tasks" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d '{"title":"[prefix] タイトル","description":"tags: ...","priority":"normal","status":"open","company_id":"hd"}'
```

### タスク完了
```bash
curl -4 -s -X PATCH "${SUPABASE_URL}/rest/v1/tasks?id=eq.{ID}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d '{"status":"done","completed_at":"now()"}'
```

## CEO分析用クエリ

### 曜日別集計（JST）
```sql
SELECT extract(dow from created_at at time zone 'Asia/Tokyo') as dow,
       count(*) as cnt
FROM prompt_log
GROUP BY dow ORDER BY dow;
```

### 時間帯別集計（JST）
```sql
SELECT extract(hour from created_at at time zone 'Asia/Tokyo') as hour,
       count(*) as cnt
FROM prompt_log
GROUP BY hour ORDER BY hour;
```
