---
name: export-self
description: >
  focus-you の自己データ（日記・夢・目標・習慣・物語・キャリア・気になった記事）を
  Markdown + YAML frontmatter で構造化し、zip エクスポートする。
  退会・移行・バックアップ時のデータ portability を保証する一級ルート。
  起動: `/export-self` または「データを export して」「自分のデータをエクスポートして」と頼まれた時。
---

# export-self — focus-you 自己データの Markdown エクスポート

## 何をするスキルか

社長の Supabase 上の自己データを **Markdown + YAML frontmatter** に変換し、カテゴリ別ファイルにして zip 化する。出力は `scratch/exports/focus-you-export-{YYYY-MM-DD}.zip`（git管理外）。

**なぜやるか**: tolaria の Files-first 思想を取り入れ、focus-you を「データを持ち帰れるプロダクト」にする。Notion/Day One のロックインに対抗する個人プロダクトの旗。商用化時の信頼の核。

## 起動条件

- 社長が `/export-self` と入力した
- 「自分のデータを export して」「全部 Markdown で出して」「バックアップ取って」と頼まれた

## 対象テーブル（focus-you 自己データ）

| テーブル | 出力ファイル | 1レコード = 1ファイル/章 |
|---------|------------|---------------------|
| `diary_entries` | `journal/{YYYY-MM-DD}.md` | 1日1ファイル |
| `dreams` | `dreams/{slug}.md` | 1夢1ファイル |
| `goals` | `goals/{slug}.md` | 1目標1ファイル |
| `habits` | `habits/{slug}.md` | 1習慣1ファイル（履歴は habit_logs を内包） |
| `habit_logs` | `habits/{slug}.md` 内の表 | habit に内包 |
| `story_memory` | `story/memory.md` | 1ファイル |
| `story_moments` | `story/moments.md` | 1ファイル（時系列リスト） |
| `life_story_entries` | `roots/{stage}.md` | ステージ別 |
| `life_story_user_stages` | `roots/_stages.md` | 1ファイル |
| `career_history` | `career.md` | 1ファイル |
| `interest_articles` | `interests/{YYYY-MM-DD}-{domain}.md` | 1記事1ファイル |
| `diary_analysis` | export しない | LLM 分析結果は再生成可能 |
| `diary_entries_backup_*` / `story_memory_archive` | export しない | バックアップは除外 |
| `diary_entry_revisions` | export しない | 履歴は git 的に冗長 |

## 実行手順

### Step 1: 出力ディレクトリ準備

```bash
DATE=$(date +%Y-%m-%d)
EXPORT_ROOT="scratch/exports/focus-you-export-${DATE}"
rm -rf "$EXPORT_ROOT"
mkdir -p "$EXPORT_ROOT"/{journal,dreams,goals,habits,story,roots,interests}
```

### Step 2: 各テーブルのデータ取得 → Markdown 生成

`/workspace/.claude/hooks/api/sb.sh query "SELECT ..."` で取得し、jq + Markdown テンプレートで変換する。

#### 例: diary_entries → journal/

```bash
/workspace/.claude/hooks/api/sb.sh query "SELECT id, entry_date, content, mood, tags, created_at, updated_at FROM diary_entries ORDER BY entry_date DESC" > /tmp/journal.json

jq -c '.[]' /tmp/journal.json | while read -r row; do
  date=$(echo "$row" | jq -r '.entry_date')
  cat > "$EXPORT_ROOT/journal/${date}.md" <<EOF
---
type: journal_entry
date: ${date}
mood: $(echo "$row" | jq -r '.mood // "null"')
tags: $(echo "$row" | jq -c '.tags // []')
created_at: $(echo "$row" | jq -r '.created_at')
updated_at: $(echo "$row" | jq -r '.updated_at')
source: diary_entries.id=$(echo "$row" | jq -r '.id')
---

$(echo "$row" | jq -r '.content')
EOF
done
```

各テーブルのカラム構造に合わせて同様のループを書く。**カラムが分からない場合は `information_schema.columns` で先に確認する。**

```bash
/workspace/.claude/hooks/api/sb.sh query "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='dreams' ORDER BY ordinal_position"
```

### Step 3: README.md（目次）を生成

```bash
cat > "$EXPORT_ROOT/README.md" <<EOF
# focus-you Export — ${DATE}

社長 (yumzzz.my6223@gmail.com) の自己データを Markdown + YAML frontmatter でエクスポートしたもの。

## 構造

- \`journal/\` — 日記エントリ（YYYY-MM-DD.md、1日1ファイル）
- \`dreams/\` — 夢
- \`goals/\` — 目標
- \`habits/\` — 習慣（履歴を内包）
- \`story/\` — Story Memory / Moments
- \`roots/\` — Life Story（ライフステージ別）
- \`career.md\` — Career History
- \`interests/\` — 気になった記事

## 復元（移行先で）

各 .md ファイルは YAML frontmatter にメタデータ + 本文に内容を含む。任意の Markdown ツール (Obsidian / tolaria / Logseq / Notion import 等) で読める。
\`source:\` 行は元の Supabase テーブルとレコード ID。

## カウント

| カテゴリ | 件数 |
|---------|------|
| Journal | $JOURNAL_COUNT |
| Dreams | $DREAMS_COUNT |
| Goals | $GOALS_COUNT |
| Habits | $HABITS_COUNT |
| Story Moments | $MOMENTS_COUNT |
| Roots | $ROOTS_COUNT |
| Interests | $INTERESTS_COUNT |

## 注意

- LLM 分析結果（diary_analysis 等）は再生成可能なため除外
- バックアップテーブル / 履歴テーブルは除外
- これは ${DATE} 時点のスナップショット
EOF
```

### Step 4: zip 化

```bash
cd scratch/exports
zip -r "focus-you-export-${DATE}.zip" "focus-you-export-${DATE}" >/dev/null
ZIP_SIZE=$(du -h "focus-you-export-${DATE}.zip" | cut -f1)
echo "✅ Exported to scratch/exports/focus-you-export-${DATE}.zip (${ZIP_SIZE})"
```

### Step 5: 社長に報告

- zip パス（`scratch/exports/focus-you-export-{DATE}.zip`）
- 各カテゴリの件数（README の表をそのまま転記）
- ファイルサイズ
- README で復元方法も明示してる旨

## 注意事項

- **`scratch/` は git 管理外**。zip がコミットされることはない。手元保管・他端末転送は社長の手で行う
- **データ捏造禁止**: 取得失敗したテーブルがあれば README に「export 失敗: {table}」と明示
- **個人情報を含む**: zip を共有する際は社長が判断する（このスキルは生成のみ、配布はしない）
- **再実行は冪等**: 同じ日に複数回走らせても上書きされる
- **大量データ対応**: diary_entries が数千件以上ある場合、処理時間がかかる。途中報告を入れる
- **frontmatter の値**: null / 空配列 / 改行を含む長文には注意。jq で安全にエスケープすること
- **本文に `---` を含む可能性**: frontmatter の終端と衝突するので、必要に応じて escape

## 将来の拡張（やらない、メモのみ）

- ダッシュボードから「Export」ボタンで Edge Function 経由 zip ダウンロード
- 増分エクスポート（前回からの差分のみ）
- import 側スキル（他ユーザーのデータを focus-you に取り込む）
