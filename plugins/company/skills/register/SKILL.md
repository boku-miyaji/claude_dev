---
name: register
description: 成果物ファイルをArtifactsに登録。ダッシュボードで確認・コメント可能になる。
user_invocable: true
---

# /register — 成果物ファイル登録

## いつ使うか

- `/register path/to/file.md` を実行したとき
- `/register path/to/file.html タイトル` でタイトル付きで登録

## 実行手順

### Step 1: 引数解析

```
/register path/to/file.md                → パスのみ（タイトルはファイル名から自動生成）
/register path/to/file.md 技術スタック方針  → パス + タイトル指定
```

- 第1引数: ファイルパス（必須）
- 第2引数以降: タイトル（省略時はファイル名を使用）

### Step 2: ファイル確認

1. 指定パスのファイルが存在するか確認
   - 絶対パス: そのまま使用
   - 相対パス: `/workspace/` をプレフィックスに付けて解決
2. ファイルタイプを拡張子から判定（md / html / yaml / json / txt）
3. ファイル内容を読み込む

### Step 3: PJ会社の自動推定

パスからPJ会社を推定する:

| パスのパターン | company_id |
|--------------|------------|
| `project-scotch-care/` | foundry |
| `project-rikyu*/` | rikyu |
| `circuit_diagram/` | circuit |
| `.company-polaris/` | polaris |
| `.company/` | null (HD) |
| その他 | null (HD) |

### Step 4: Supabase に登録

```bash
source .claude/hooks/supabase.env

# ファイル内容のハッシュ
HASH=$(sha256sum "$FILE_PATH" | cut -c1-16)

# 登録
curl -4 -s "${SUPABASE_URL}/rest/v1/artifacts?on_conflict=file_path" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal,resolution=merge-duplicates" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d '{
    "title": "...",
    "file_path": "...",
    "file_type": "md",
    "content": "...",
    "content_hash": "...",
    "last_synced_at": "now()",
    "company_id": "...",
    "status": "active"
  }'
```

### Step 5: 確認メッセージ

```
✅ Artifact 登録完了

📄 技術スタック方針
   パス: project-scotch-care/docs/final_output/02_tech_stack_policy_storyline.md
   PJ: foundry
   タイプ: md

ダッシュボードの Artifacts タブで確認・コメントできます。
次回セッション起動時に自動同期されます。
アーカイブしたい場合はダッシュボードから操作してください。
```

## 複数ファイルの一括登録

```
/register path/to/dir/
```

ディレクトリを指定した場合、中の .md / .html ファイルを一覧表示し、どれを登録するか確認する。

## 注意事項

- 同じ file_path は upsert（既存があれば更新）
- gitignore のファイルも登録可能（内容はSupabaseに直接保存）
- アーカイブはダッシュボードから操作（status を 'archived' に変更）
- アーカイブされたファイルは artifact-sync.sh で同期対象外になる
