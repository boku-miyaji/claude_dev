---
name: register
description: >
  成果物ファイルをArtifactsに登録。ダッシュボードで確認・コメント可能になる。
  【自動実行】パイプライン完了後、以下の条件を全て満たすファイルが存在する場合、
  ユーザーに言われなくても自動でこのスキルを実行する:
  (1) .company/departments/, docs/final_output/, secretary/archive/ 配下のファイル
  (2) ファイルサイズ 5KB 以上
  (3) 拡張子が .md / .html / .pptx / .pdf
  (4) ファイル名が temp- / wip- / draft- で始まらない
  手動実行は `/register path/to/file.md` または `/register path/to/dir/`。
---

# register — 成果物ファイル登録

## 自動実行トリガー（ユーザー指示不要）

パイプライン完了後に以下を自動チェックし、条件を満たすファイルを登録する:

1. パスが登録対象（`.company/departments/`, `docs/final_output/`, `secretary/archive/` 等）
2. ファイルサイズが 5KB 以上
3. 拡張子が `.md`, `.html`, `.pptx`, `.pdf`
4. ファイル名が `temp-`, `wip-`, `draft-` で始まらない

**複数ファイルが対象なら一括登録する。**

## 手動実行

- `/register path/to/file.md` — ファイルを1件登録
- `/register path/to/file.html タイトル` — タイトル付きで登録
- `/register path/to/dir/` — ディレクトリ内を一覧して選択登録

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

**必ずこの手順に従う。** プレースホルダ任せの組み立て（`"content": "..."` を LLM が直接埋める等）は禁止。
過去に `content` が NULL のまま登録された事故・`content_hash` に `$HASH` リテラルが入った事故が発生したため、
ファイル本文とハッシュは `jq --rawfile` と `sha256sum` で必ず bash 側に確実に埋め込む。

```bash
# 入力（呼び出し側で決める）
FILE_PATH="..."        # 絶対パス（例: /workspace/.company/.../2026-04-29-1200.md）
FILE_PATH_REL="..."    # DB保存用の相対パス（例: .company/departments/intelligence/reports/2026-04-29-1200.md）
TITLE="..."            # Step 3 で決めたタイトル
FILE_TYPE="md"         # 拡張子
COMPANY_ID="null"      # 文字列 "null" or "rikyu" 等の company_id

# 1) ハッシュ計算（必ず bash で）
HASH=$(sha256sum "$FILE_PATH" | cut -c1-16)

# 2) JSON ボディ生成（jq --rawfile で本文を確実に埋め込む）
jq -n \
  --arg title   "$TITLE" \
  --arg path    "$FILE_PATH_REL" \
  --arg ftype   "$FILE_TYPE" \
  --rawfile content "$FILE_PATH" \
  --arg hash    "$HASH" \
  --arg company "$COMPANY_ID" \
  '{
    title: $title,
    file_path: $path,
    file_type: $ftype,
    content: $content,
    content_hash: $hash,
    last_synced_at: "now()",
    company_id: (if $company == "null" then null else $company end),
    status: "active"
  }' > /tmp/register-body.json

# 3) upsert（file_path で衝突解決）
/workspace/.claude/hooks/api/sb.sh upsert artifacts file_path "@/tmp/register-body.json"
```

**禁止事項:**

- ❌ `curl` を直接書かない（`sb.sh upsert` を使う）
- ❌ `"content": "..."` のプレースホルダで LLM に本文を直接埋めさせない（content NULL 事故の温床）
- ❌ `"content_hash": "$HASH"` のように JSON リテラル内でシェル変数を書かない（リテラル文字列として保存される事故あり）
- ❌ HTML/PDF などバイナリ/巨大ファイルで `--rawfile` を使う場合は事前にサイズ確認（>5MB は警告）

**バイナリ系ファイル（pdf/pptx）の扱い:**

`--rawfile` は UTF-8 として読むため、PDF/PPTX 等のバイナリは content に入れず、`content` を省略して `file_path` のみ登録する:

```bash
jq -n --arg title "$TITLE" --arg path "$FILE_PATH_REL" --arg ftype "$FILE_TYPE" \
      --arg hash "$HASH" --arg company "$COMPANY_ID" \
  '{
    title: $title, file_path: $path, file_type: $ftype,
    content_hash: $hash, last_synced_at: "now()",
    company_id: (if $company == "null" then null else $company end),
    status: "active"
  }' > /tmp/register-body.json
/workspace/.claude/hooks/api/sb.sh upsert artifacts file_path "@/tmp/register-body.json"
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
