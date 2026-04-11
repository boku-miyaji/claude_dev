---
name: supabase-preflight
description: >
  Supabase テーブルへの読み書き前にプリフライトチェックを実行する。
  RLS ポリシー、CHECK constraint、カラム型を一括取得し、
  安全な curl テンプレート（x-ingest-key 付き）を生成する。
  Hook やバッチスクリプトでテーブルに触る前に必ず実行する。
trigger: /supabase-preflight
category: ops
---

# Supabase Preflight Check

## いつ使うか

- Hook / バッチスクリプトで Supabase テーブルに INSERT / SELECT する前
- anon key で空配列が返って「データがない？」と疑う前
- 新しいテーブルに初めてアクセスする前
- CHECK constraint 違反（42514）や RLS 違反（42501）が出た時

## 引数

`/supabase-preflight {テーブル名}` — テーブル名を1つ指定

例: `/supabase-preflight growth_events`

## 実行手順

### Step 1: 接続情報の読み込み

```bash
source ~/.claude/hooks/supabase.env
MGMT_API="https://api.supabase.com/v1/projects/akycymnahqypmtsfqhtr/database/query"
```

### Step 2: カラム一覧と型を取得

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '{テーブル名}'
ORDER BY ordinal_position;
```

結果を表形式で表示する。

### Step 3: CHECK constraint を取得

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = '{テーブル名}'::regclass AND contype = 'c';
```

各 constraint について **有効な値の一覧** を見やすく列挙する。

### Step 4: RLS ポリシーを取得

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = '{テーブル名}';
```

結果から以下を判定して明示する:
- **SELECT に x-ingest-key が必要か** — `qual` に `check_ingest_key()` があれば YES
- **INSERT に x-ingest-key が必要か** — `with_check` に `check_ingest_key()` があれば YES
- **Management API が必要か** — `is_owner()` のみで anon アクセス不可の場合 YES

### Step 5: curl テンプレートを生成

判定結果に基づき、すぐコピペできる curl コマンドを生成する。

#### SELECT テンプレート
```bash
curl -s "${SUPABASE_URL}/rest/v1/{テーブル名}?select=*&limit=5" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  # x-ingest-key が必要な場合のみ↓を追加
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}"
```

#### INSERT テンプレート
```bash
curl -s -X POST "${SUPABASE_URL}/rest/v1/{テーブル名}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  # x-ingest-key が必要な場合のみ↓を追加
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{サンプル payload — カラム名と型、CHECK constraint の有効値を反映}'
```

#### Management API テンプレート（RLS 回避が必要な場合）
```bash
curl -s -X POST "$MGMT_API" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM {テーブル名} LIMIT 5"}'
```

### Step 6: サマリー出力

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Preflight: {テーブル名}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

カラム数: N
CHECK constraints: N 件
RLS: SELECT → {ingest-key / open / mgmt-api-only}
     INSERT → {ingest-key / open / mgmt-api-only}

⚠️ 注意点:
  - {CHECK constraint で引っかかりやすい enum 値}
  - {RLS の罠}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 出力しないもの

- テーブルの作成・変更は行わない（読み取り専用）
- RLS ポリシーの変更提案はしない（別途判断）
- 実データの表示は最小限（プリフライトの目的はスキーマ確認）
