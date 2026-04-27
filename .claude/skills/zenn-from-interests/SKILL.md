---
name: zenn-from-interests
description: >
  「気になった」(interest_articles テーブル) に登録された未まとめの記事を一括 WebFetch し、
  boku_yaji スタイルの Zenn 記事フォーマットで日本語の一括まとめレポートを生成する。
  出力は artifacts テーブルに保存され、Reports タブの research に「未読」として並ぶ。
  起動: `/zenn-from-interests` または「気になった記事をまとめて」「Zenn記事化して」と頼まれた時。
---

# zenn-from-interests — 気になった記事の Zenn まとめ生成

## 何をするスキルか

`interest_articles` テーブルの `zenn_artifact_id IS NULL` な記事（= まだ Zenn まとめに含まれていない記事）を一括取得し、各 URL を WebFetch で収集して、boku_yaji スタイルの Zenn 風日本語まとめ記事を生成する。生成物は `artifacts` テーブルに INSERT し、Reports タブの research に並ぶ。処理した `interest_articles` には `zenn_artifact_id` を埋めて二重まとめを防ぐ。

`zenn-article` スキル（論文・記事1本を入力にする方）とは別物。こちらは複数の "気になった" を1本のまとめ記事にする集約系。

## 起動条件

- 社長が `/zenn-from-interests` と入力した
- 「気になった記事をまとめて」「Zenn 記事化して」「気になったを Zenn に」と頼まれた

## 実行手順

### Step 1: 未まとめの記事を取得

```bash
/workspace/.claude/hooks/api/sb.sh query "SELECT id, url, title, notes, source_domain, created_at FROM interest_articles WHERE zenn_artifact_id IS NULL ORDER BY created_at"
```

該当 0 件なら「未まとめの記事はありません」と報告して終了。

### Step 2: 各 URL の本文取得

各記事の URL に対して `WebFetch` を呼ぶ。プロンプトは:

> 「この記事の主題、結論、キーポイント（3-5個）を箇条書きで日本語で抽出してください。原文の主張を曲げない範囲で要約。」

WebFetch が失敗した記事は `notes` と `title` だけを使い、まとめ本文に「メタ情報のみ（本文取得失敗）」と明示する。**嘘をつかない。** タイトルや結論を捏造しない。

### Step 3: Zenn 風まとめ Markdown を生成

#### 構成（必須・順序固定）

```
（リード — です・ます調）
このまとめは、社長が「気になった」に登録した N 件の記事を一括で日本語化したものです。
対象期間: YYYY-MM-DD 〜 YYYY-MM-DD。
うち M 件は本文取得済み、L 件はメタ情報（タイトル・URL・社長メモ）のみ。

# 0. TL;DR （だ・である調）
- 全体の3-5行要約
- 通底するテーマがあればここで一言

# 1. 各記事の解説 （だ・である調）
## 1-1. {記事タイトル}
- 出典: {source_domain} / {URL}
- 公開日: 不明 or 取得できた場合のみ表示
- 要点:
  - 〜
  - 〜
- 社長メモ: {notes があれば}

## 1-2. {記事タイトル}
...

# 2. 通底するテーマ
{なぜこれらが集まったのか、共通する関心軸を読み解く}
{Mermaid 図や表を効果的に使う(中核モデル・分類・比較がある場合)}

# 3. 制約
- 本文取得失敗した記事はメタ情報のみで扱った旨を明示
- まとめは boku_yaji（社長）の関心軸からの読み解きであり、客観的サマリではない

# ぼくおも （カジュアル）
社長として何が刺さったか、次に何をしたいか、を1人称で。
「〜したい」「〜が気になる」「〜だなと思った」のような自然なトーン。

# 参考
全 URL リスト（{title} → {url} 形式）
```

#### 文体ルール

- リード: です・ます調
- 本文（0〜3 と 参考）: だ・である調で統一
- ぼくおも: カジュアル
- 絵文字は本文中で使わない（frontmatter があるなら最小限のみ）
- Mermaid 図 / 表で構造化（中核モデル・フロー・比較）

### Step 4: artifacts に保存

```bash
TS=$(date +%Y%m%d%H%M)
DATE=$(date +%Y-%m-%d)
TITLE="Zenn: 気になった記事まとめ ${DATE}"
DESC="${COUNT}件の気になった記事を boku_yaji スタイルで日本語まとめ"
FILE_PATH="zenn-from-interests-${TS}.md"

# Markdown を /tmp に書いてから INSERT する（jq で安全にエスケープ）
echo "$CONTENT" > /tmp/zenn-from-interests-${TS}.md

PAYLOAD=$(jq -n \
  --arg t "$TITLE" \
  --arg d "$DESC" \
  --rawfile c /tmp/zenn-from-interests-${TS}.md \
  --arg fp "$FILE_PATH" \
  --argjson tags '["zenn","interest-articles"]' \
  '{title:$t, description:$d, content:$c, file_type:"md", file_path:$fp, status:"active", tags:$tags}')

ARTIFACT=$(/workspace/.claude/hooks/api/sb.sh post artifacts "$PAYLOAD")
ARTIFACT_ID=$(echo "$ARTIFACT" | jq -r '.[0].id // empty')
```

INSERT が失敗したら全体を中断し、社長にエラーを報告する（途中まで作った下書きは `/tmp/zenn-from-interests-${TS}.md` に残す）。

### Step 5: interest_articles を更新

```bash
# Step 1 で取得した id 群をカンマ区切りに
IDS_CSV=$(echo "$INTEREST_IDS" | paste -sd ',' -)
/workspace/.claude/hooks/api/sb.sh patch interest_articles "?id=in.($IDS_CSV)" "{\"zenn_artifact_id\": ${ARTIFACT_ID}}"
```

### Step 6: 報告

社長に以下を返す:

- ✅ 生成完了: `{TITLE}` (artifact_id: {ARTIFACT_ID})
- 含めた記事: {COUNT} 件（うち本文取得 {M}、メタのみ {L}）
- ダッシュボードの Reports → research に「未読 ●」で並んでいる
- ★ をつけてお気に入りにすれば、お気に入り絞り込みでいつでも戻れる

## 注意事項

- **内容の捏造禁止**: WebFetch 失敗時はそれを明示。要点は原文ベースで書く
- **重複起動防止**: `zenn_artifact_id IS NULL` で絞っているので、再実行しても既まとめは含まれない
- **タイトル・URL は interest_articles から正確に転記**
- **社長メモ (notes) は最大限尊重**: 「なぜこれを気になった」が記録されているので、ぼくおもの主軸として使う
- **コスト**: WebFetch とプロンプト処理は Claude Code セッション内で完結する（Edge Function は使わない）
- **長すぎる記事数**: 10件超なら、ぼくおもとテーマセクションを長めに。30件超なら社長に「分割しますか？」と確認する
