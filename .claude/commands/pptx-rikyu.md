---
allowed-tools: >
  Bash(*),
  Read(*),
  Write(*),
  Edit(*),
  Glob(*),
  Grep(*),
  Task(*),
  Skill(pptx)
description: |
  Markdownやドキュメントの内容をACES/rikyuブランドのPowerPointにまとめる。
  テンプレートベース生成（提案仮説構築AI_定例会1_20260219_v1.pptx準拠）。
---

## 引数

$ARGUMENTS

- 第1引数: 入力ソース（必須）— Markdownファイルパス、ディレクトリ、またはテーマの説明
- 第2引数（オプション）: 出力ファイルパス（デフォルト: `output/{テーマ名}.pptx`）
- 追加コンテキスト: タイトル、宛先、日付などの指定があれば使用する

---

## テンプレート情報

### テンプレートファイル

```
project-rikyu-sales-proposals-poc/untracked/original_document/report/提案仮説構築AI_定例会1_20260219_v1.pptx
```

- **テーマ**: ACES Slide Master / ACES color scheme v2
- **スライドサイズ**: 16:9（13.33" × 7.50"）
- **スライド数**: 35枚

### テンプレートスライドインデックス（0始まり）

| タイプ | インデックス | シェイプ数 | 用途 |
|--------|:-----------:|:---------:|------|
| **タイトル** | 0 | 2 | 表紙（宛先 + タイトル + 日付） |
| **INDEX** | 1 | 1 | 目次（右側にバレットリスト） |
| **コンテンツ（3プレースホルダー）** | 21 | 3 | 標準コンテンツ（タイトル + サブタイトル + 本文） |
| **コンテンツ（2プレースホルダー）** | 2 | 2 | タイトル + 大きな本文（サブタイトルなし） |
| **セクション仕切り** | 6 | 1 | チャコール背景にセクション名（8, 14, 22, 24も同等） |

### コンテンツスライドのプレースホルダー構造（Slide 21基準）

| シェイプ | 位置(in) | サイズ(in) | フォント | 用途 |
|---------|----------|-----------|----------|------|
| shape-0 | (0.42, 0.44) | 12.46 × 0.40 | Yu Gothic | タイトル |
| shape-1 | (0.42, 0.91) | 12.46 × 0.73 | Yu Gothic Medium | サブタイトル（キーメッセージ） |
| shape-2 | (0.42, 1.79) | 12.46 × 5.14 | Century Gothic | 本文（バレットポイント対応） |

---

## カラーパレット

スライドマスター左上のカラーパレットに準拠。

### テーマカラー

```
dk1:           #121212    メインテキスト（ほぼ黒）
lt1:           #FFFFFF    メイン背景（白）
dk2:           #757575    セカンダリグレー
lt2:           #C7C7C7    装飾用ライトグレー（幾何図形・罫線）
accent1:       #5298BA    青（コールアウト、KPIハイライト）
accent2:       #DB5F5F    赤（注意喚起テキスト）
accent3:       #629F64    テーマグリーン（アクセント3）
accent4:       #C0B76A    ゴールド（マイルストーン▼）
```

### スライドレベルカラー

```
charcoal:      #393939    セクション仕切り背景
tableText:     #454545    テーブルセルのテキスト
greenDark:     #006843    テーブルヘッダー、強調ボックス背景
greenMedium:   #197A56    スケジュールバー、強めの緑
greenBright:   #009A62    明るい緑アクセント
greenMint:     #C2E7D9    薄ミント（ハイライト行、強調背景）
greenPale:     #DFE6E0    極薄緑背景（交互行等）
orange:        #FBAE40    オレンジアクセント
borderGray:    #C7C7C7    テーブル罫線、区切り線
```

### カラー使用ガイドライン

- **テーブルヘッダー**: 背景 `#006843`、テキスト白
- **テーブルデータ行**: 背景白、テキスト `#454545`
- **テーブル交互行**: 背景 `#DFE6E0`（オプション）
- **テーブル罫線**: `#C7C7C7` 1pt
- **強調セル**: テキスト `#006843` 太字、または背景 `#C2E7D9`
- **コールアウトボックス**: 背景 `#5298BA`、テキスト白
- **ハイライトボックス**: 背景 `#C2E7D9` or `#DFE6E0`
- **セクション仕切り**: 背景 `#393939`、テキスト白

### フォント定義

- **タイトル**: Yu Gothic
- **サブタイトル**: Yu Gothic Medium
- **本文（バレットポイント）**: Century Gothic
- **ラテン文字**: Century Gothic
- **日本語**: 游ゴシック / Yu Gothic

### フォントサイズガイド

- 宛先/大タイトル: 28-32pt
- スライドタイトル: shape-0のデフォルトに従う
- サブタイトル: shape-1のデフォルトに従う
- 本文バレット Level 0: 通常サイズ
- 本文バレット Level 1: 通常サイズ（インデント）
- 本文バレット Level 2: 通常サイズ（さらにインデント）
- テーブルセル: 8-10pt

---

## 実行手順

### 1. 入力コンテンツの読み取りとスライド設計

[ultrathink] 入力内容を読み取り、スライド構成を設計する:

1. **タイトルスライド**（テンプレート Slide 0）— 必ず最初に1枚
2. **INDEXスライド**（テンプレート Slide 1）— セクションが3つ以上ある場合
3. コンテンツに応じたテンプレートスライド選択:
   - バレットポイント中心 → Slide 21（3プレースホルダー）
   - テーブル中心 → Slide 21（本文エリアにテーブルを配置）
   - タイトル + 大きな本文のみ → Slide 2（2プレースホルダー）
4. 各セクション前に**セクション仕切り**（テンプレート Slide 6）を必要に応じて配置
5. テンプレートマッピングを作成

**テンプレートマッピング例:**
```python
# テンプレートスライドインデックス（0始まり）
template_mapping = [
    0,   # Slide 0: タイトル
    1,   # Slide 1: INDEX
    21,  # Slide 2: コンテンツ（実施概要）
    21,  # Slide 3: コンテンツ（評価スケール）
    6,   # Slide 4: セクション仕切り（アンケート設問）
    21,  # Slide 5: コンテンツ（Section A）
    21,  # Slide 6: コンテンツ（Section B・C）
]
```

### 2. rearrange.py でテンプレートスライドを配置

```bash
SCRIPTS=/home/node/.claude/plugins/cache/anthropic-agent-skills/document-skills/69c0b1a06741/skills/pptx/scripts
TEMPLATE="project-rikyu-sales-proposals-poc/untracked/original_document/report/提案仮説構築AI_定例会1_20260219_v1.pptx"

python3 "$SCRIPTS/rearrange.py" "$TEMPLATE" output/{name}/working.pptx 0,1,21,21,6,21,21
```

### 3. inventory.py でシェイプ情報を抽出

```bash
python3 "$SCRIPTS/inventory.py" output/{name}/working.pptx output/{name}/text-inventory.json
```

text-inventory.json を読み込んで全シェイプの位置・サイズ・プレースホルダータイプを確認する。

### 4. replacement-text.json を作成

入力コンテンツをシェイプにマッピング。`/pptx` スキルの replace.py 仕様に従う。

**フォーマットルール:**
- `font_name: "Yu Gothic"` — タイトル (shape-0)
- `font_name: "Yu Gothic Medium"` — サブタイトル (shape-1)
- `font_name: "Century Gothic"` — 本文バレット (shape-2)
- `bullet: true, level: 0` — メイン項目
- `bullet: true, level: 1` — サブ項目
- `bullet: true, level: 2` — 詳細項目
- バレットテキストに `•`, `-`, `*` などの記号を含めない（自動付与される）

**replacement-text.json の例:**
```json
{
  "slide-0": {
    "shape-0": {
      "paragraphs": [
        {"text": "株式会社りそな銀行 御中", "font_size": 32.0},
        {"text": "アンケート実施内容 v1.0", "font_size": 28.0}
      ]
    },
    "shape-1": {
      "paragraphs": [{"text": "2026/2/26"}]
    }
  },
  "slide-2": {
    "shape-0": {
      "paragraphs": [{"text": "実施概要", "font_name": "Yu Gothic"}]
    },
    "shape-1": {
      "paragraphs": [{"text": "AI出力の品質評価とベースライン測定", "font_name": "Yu Gothic Medium"}]
    },
    "shape-2": {
      "paragraphs": [
        {"text": "目的", "bullet": true, "level": 0, "font_name": "Century Gothic"},
        {"text": "AI出力の品質評価", "bullet": true, "level": 1, "font_name": "Century Gothic"}
      ]
    }
  }
}
```

### 5. replace.py でテキストを適用

```bash
python3 "$SCRIPTS/replace.py" output/{name}/working.pptx output/{name}/replacement-text.json output/{name}/replaced.pptx
```

### 6. テーブル追加（必要な場合）

テーブルを含むスライドがある場合、python-pptx を使用してテーブルを追加する。

**テーブル追加スクリプト例:**
```python
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

prs = Presentation('output/{name}/replaced.pptx')

# テーブルを追加するスライド（0始まり）
slide = prs.slides[2]

# テーブルの位置とサイズ（本文エリア内に配置）
left, top = Inches(0.42), Inches(1.90)
width, height = Inches(12.46), Inches(2.5)

rows, cols = 5, 3
table_shape = slide.shapes.add_table(rows, cols, left, top, width, height)
table = table_shape.table

# ACES テーブルスタイリング
COLORS = {
    'header_bg': RGBColor(0x00, 0x68, 0x43),   # greenDark
    'header_text': RGBColor(0xFF, 0xFF, 0xFF),  # white
    'cell_text': RGBColor(0x45, 0x45, 0x45),    # tableText
    'alt_row': RGBColor(0xDF, 0xE6, 0xE0),      # greenPale
    'highlight': RGBColor(0xC2, 0xE7, 0xD9),    # greenMint
    'border': RGBColor(0xC7, 0xC7, 0xC7),       # borderGray
}

# ヘッダー行スタイリング
for cell in table.rows[0].cells:
    cell.fill.solid()
    cell.fill.fore_color.rgb = COLORS['header_bg']
    for para in cell.text_frame.paragraphs:
        para.font.size = Pt(9)
        para.font.color.rgb = COLORS['header_text']
        para.font.bold = True
        para.font.name = 'Century Gothic'

# データ行スタイリング
for row_idx in range(1, rows):
    for cell in table.rows[row_idx].cells:
        for para in cell.text_frame.paragraphs:
            para.font.size = Pt(8)
            para.font.color.rgb = COLORS['cell_text']
            para.font.name = 'Century Gothic'
        # 交互行の背景色（オプション）
        if row_idx % 2 == 0:
            cell.fill.solid()
            cell.fill.fore_color.rgb = COLORS['alt_row']

prs.save('output/{name}/with-tables.pptx')
```

**テーブルを使うべき場面:**
- 項目×内容の対応表（実施概要、評価基準など）
- スコア一覧
- スケジュール表
- 比較表

**テーブルレイアウトのガイドライン:**
- テーブルは本文エリア内（top: 1.79"以降, width: 12.46"）に配置
- サブタイトルとの間に適切なマージンを取る
- 1スライドあたり最大12行程度
- テーブルがあるスライドでは shape-2（本文）のバレットテキストを最小限にするか空にする

### 7. OOXML クリーンアップ（必要な場合）

テンプレートスライドに不要な非プレースホルダーシェイプがある場合、OOXML編集で除去する。

```bash
OOXML_SCRIPTS=/home/node/.claude/plugins/cache/anthropic-agent-skills/document-skills/69c0b1a06741/skills/pptx/ooxml/scripts

# アンパック
python3 "$OOXML_SCRIPTS/unpack.py" output/{name}/replaced.pptx /tmp/{name}-unpacked

# Python で不要シェイプを除去（例: 特定位置の非プレースホルダーシェイプ）
python3 -c "
import re
for i in range(3, 11):  # slide3.xml～slide10.xml
    fpath = f'/tmp/{name}-unpacked/ppt/slides/slide{i}.xml'
    with open(fpath, 'r') as f:
        content = f.read()
    # 非プレースホルダーの不要シェイプを特定・除去
    # （位置座標やシェイプIDで識別）
    with open(fpath, 'w') as f:
        f.write(content)
"

# バリデーション
python3 "$OOXML_SCRIPTS/validate.py" /tmp/{name}-unpacked --original output/{name}/replaced.pptx

# リパック
python3 "$OOXML_SCRIPTS/pack.py" /tmp/{name}-unpacked output/{name}.pptx
```

### 8. サムネイル検証

```bash
python3 "$SCRIPTS/thumbnail.py" output/{name}.pptx output/{name}/thumbnails --cols 5
```

サムネイル画像を確認:
- テキストの切れ、重なりがないか
- テーブルの表示が正しいか
- フォント・色が正しいか
- フッター（ACES / CONFIDENTIAL）が表示されているか
- 問題があれば replacement-text.json を修正して再実行

---

## スライドタイプガイド

### タイトルスライド（テンプレート Slide 0）

- shape-0: 宛先テキスト（32pt）+ タイトル（28pt）
- shape-1: 日付
- スライドマスターの幾何図形、ACESロゴ、フッターは自動継承

### INDEXスライド（テンプレート Slide 1）

- shape-0: セクション名のバレットリスト
- 左側のグレー領域と「INDEX」テキストはスライドマスターから自動継承

### セクション仕切りスライド（テンプレート Slide 6）

- shape-0: セクション名テキスト
- チャコール（#393939）背景と幾何図形はスライドマスターから自動継承

### コンテンツスライド（テンプレート Slide 21）

- shape-0: スライドタイトル（Yu Gothic）
- shape-1: サブタイトル/キーメッセージ（Yu Gothic Medium）
- shape-2: 本文コンテンツ — バレットポイント or テーブル or 両方
- **テーブルを使う場合**: shape-2のテキストは最小限にし、python-pptxでテーブルを追加

---

## テキストルール

- 1スライドあたりの情報量を適切に制限する
- テーブルは最大12行程度
- バレットは3レベルまで（level 0, 1, 2）
- テンプレートのフォント設定を尊重する（明示的なfont_name指定で上書き可能）
- ACES/rikyuのカラーパレットから逸脱しないこと

## 注意事項

- **テンプレートアプローチを必ず使用すること**（HTMLベースの生成は使わない）
- テンプレートのスライドマスター、フッター画像、幾何図形はそのまま継承される
- テンプレートファイルが存在しない場合はエラーメッセージを表示
- python3 コマンドを使用すること（python は使用不可）
- pip install には `--break-system-packages` フラグが必要
