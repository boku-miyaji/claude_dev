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
  通常版と詳細版の2バージョンを同時生成する。
---

## 引数

$ARGUMENTS

- 第1引数: 入力ソース（必須）— Markdownファイルパス、ディレクトリ、またはテーマの説明
- 第2引数（オプション）: 出力ファイルパス（デフォルト: `output/{テーマ名}.pptx`）
- 追加コンテキスト: タイトル、宛先、日付などの指定があれば使用する

## 出力バージョン

**必ず2バージョンを同時生成する。**

| バージョン | ファイル名 | 用途 | 特徴 |
|-----------|-----------|------|------|
| **通常版** | `output/{name}.pptx` | プレゼン投影用 | 1スライド1トピック、余白あり、読みやすい |
| **詳細版** | `output/{name}_detailed.pptx` | 配布・手元資料用 | 1スライドに多くの情報、テーブル多用、コンパクト |

### 通常版と詳細版の違い

| 項目 | 通常版 | 詳細版 |
|------|--------|--------|
| スライド数 | 多め（1トピック=1スライド） | 少なめ（関連トピックを統合） |
| セクション仕切り | 各セクション前に配置 | 省略（INDEXのみ） |
| 本文バレット数 | 1スライド 6-8項目 | 1スライド 12-18項目 |
| テーブル行数 | 最大12行 | 最大20行 |
| 情報密度 | 低（プレゼン向け） | 高（配布資料向け） |
| コンテンツ分割 | 細かく分割 | 関連するセクションをまとめる |

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

### 共通定義

```bash
SCRIPTS=/home/node/.claude/plugins/cache/anthropic-agent-skills/document-skills/69c0b1a06741/skills/pptx/scripts
OOXML_SCRIPTS=/home/node/.claude/plugins/cache/anthropic-agent-skills/document-skills/69c0b1a06741/skills/pptx/ooxml/scripts
TEMPLATE="project-rikyu-sales-proposals-poc/untracked/original_document/report/提案仮説構築AI_定例会1_20260219_v1.pptx"
WORKDIR=output/{name}
```

### 1. 入力コンテンツの読み取りとスライド設計（2バージョン分）

[ultrathink] 入力内容を読み取り、**通常版と詳細版の両方**のスライド構成を同時に設計する。

#### 通常版の設計方針

- 1スライド = 1トピック（プレゼン投影向け）
- セクション仕切りを各大セクション前に配置
- バレットポイントは1スライド 6-8項目まで
- テーブルは1スライド最大12行
- 情報が多い場合は複数スライドに分割

#### 詳細版の設計方針

- 関連するトピックを1スライドに統合（配布資料向け）
- セクション仕切りは**省略**（INDEX で十分）
- バレットポイントは1スライド 12-18項目まで
- テーブルは1スライド最大20行、テーブルを積極的に使う
- 通常版で2-3スライドに分けた内容を1スライドにまとめる

#### 設計例: アンケート実施内容の場合

**通常版（10スライド）:**
```python
standard_mapping = [
    0,   # タイトル
    1,   # INDEX
    21,  # 実施概要
    21,  # 評価スケール
    21,  # Section A（6問）
    21,  # Section B・C（8問）
    21,  # Section D・E（8問）
    21,  # 定量評価目標
    21,  # 実施スケジュール
    21,  # 回答者への依頼事項
]
```

**詳細版（6スライド）:**
```python
detailed_mapping = [
    0,   # タイトル
    1,   # INDEX
    21,  # 実施概要 + 評価スケール（統合）
    21,  # Section A + B + C（全設問をテーブルで一覧）
    21,  # Section D + E（全設問をテーブルで一覧）
    21,  # 定量評価目標 + スケジュール + 依頼事項（統合）
]
```

### 2. 通常版を生成

#### 2-1. rearrange → inventory → replace

```bash
# rearrange
python3 "$SCRIPTS/rearrange.py" "$TEMPLATE" "$WORKDIR/std-working.pptx" 0,1,21,21,21,21,21,21,21,21

# inventory
python3 "$SCRIPTS/inventory.py" "$WORKDIR/std-working.pptx" "$WORKDIR/std-inventory.json"

# replacement JSON を作成（後述のフォーマットルールに従う）
# → $WORKDIR/std-replacement.json

# replace
python3 "$SCRIPTS/replace.py" "$WORKDIR/std-working.pptx" "$WORKDIR/std-replacement.json" "$WORKDIR/std-replaced.pptx"
```

#### 2-2. テーブル追加 + OOXML クリーンアップ + 出力

```bash
# テーブル追加（必要な場合、python-pptx スクリプトで）
# OOXML クリーンアップ（不要シェイプ除去）
# → 最終出力: output/{name}.pptx
```

### 3. 詳細版を生成

#### 3-1. rearrange → inventory → replace

```bash
# rearrange（スライド数が少ない）
python3 "$SCRIPTS/rearrange.py" "$TEMPLATE" "$WORKDIR/det-working.pptx" 0,1,21,21,21,21

# inventory
python3 "$SCRIPTS/inventory.py" "$WORKDIR/det-working.pptx" "$WORKDIR/det-inventory.json"

# replacement JSON を作成（情報密度の高いバージョン）
# → $WORKDIR/det-replacement.json

# replace
python3 "$SCRIPTS/replace.py" "$WORKDIR/det-working.pptx" "$WORKDIR/det-replacement.json" "$WORKDIR/det-replaced.pptx"
```

#### 3-2. テーブル追加 + OOXML クリーンアップ + 出力

```bash
# テーブル追加（詳細版はテーブルを多用する）
# OOXML クリーンアップ
# → 最終出力: output/{name}_detailed.pptx
```

### 4. サムネイル検証（両バージョン）

```bash
# 通常版
python3 "$SCRIPTS/thumbnail.py" "output/{name}.pptx" "$WORKDIR/thumbnails-std" --cols 5

# 詳細版
python3 "$SCRIPTS/thumbnail.py" "output/{name}_detailed.pptx" "$WORKDIR/thumbnails-det" --cols 5
```

両方のサムネイルを確認:
- テキストの切れ、重なりがないか
- テーブルの表示が正しいか
- フォント・色が正しいか
- フッター（ACES / CONFIDENTIAL）が表示されているか
- 問題があれば replacement JSON を修正して再実行

---

## replacement-text.json のフォーマットルール

**共通ルール（通常版・詳細版とも）:**
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

---

## テーブル追加ガイド（python-pptx）

テーブルを含むスライドがある場合、replace.py 後に python-pptx で追加する。

### ACES テーブルスタイリング

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

COLORS = {
    'header_bg': RGBColor(0x00, 0x68, 0x43),   # greenDark
    'header_text': RGBColor(0xFF, 0xFF, 0xFF),  # white
    'cell_text': RGBColor(0x45, 0x45, 0x45),    # tableText
    'alt_row': RGBColor(0xDF, 0xE6, 0xE0),      # greenPale
    'highlight': RGBColor(0xC2, 0xE7, 0xD9),    # greenMint
    'border': RGBColor(0xC7, 0xC7, 0xC7),       # borderGray
}

def add_aces_table(slide, data, left_in=0.42, top_in=1.90, width_in=12.46,
                   header_font_pt=9, cell_font_pt=8):
    """ACESスタイルのテーブルをスライドに追加する"""
    rows, cols = len(data), len(data[0])
    height_in = 0.35 * rows  # 行あたり約0.35インチ

    table_shape = slide.shapes.add_table(
        rows, cols, Inches(left_in), Inches(top_in),
        Inches(width_in), Inches(height_in))
    table = table_shape.table

    for row_idx, row_data in enumerate(data):
        for col_idx, cell_text in enumerate(row_data):
            cell = table.cell(row_idx, col_idx)
            cell.text = str(cell_text)

            for para in cell.text_frame.paragraphs:
                para.font.name = 'Century Gothic'
                if row_idx == 0:  # ヘッダー
                    para.font.size = Pt(header_font_pt)
                    para.font.color.rgb = COLORS['header_text']
                    para.font.bold = True
                else:  # データ行
                    para.font.size = Pt(cell_font_pt)
                    para.font.color.rgb = COLORS['cell_text']

            if row_idx == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = COLORS['header_bg']
            elif row_idx % 2 == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = COLORS['alt_row']

    return table
```

### テーブル使用の場面

- **通常版**: 項目×内容の対応表、スコア一覧、スケジュール表（最大12行）
- **詳細版**: 上記に加え、設問一覧、比較表、詳細仕様（最大20行）

### テーブルレイアウト

- 配置: 本文エリア内（top: 1.79"以降, width: 12.46"）
- テーブルがあるスライドでは shape-2 のバレットテキストを最小限にするか空にする
- サブタイトル（shape-1）の下にマージンを確保

---

## OOXML クリーンアップ

テンプレートスライドに不要な非プレースホルダーシェイプがある場合、除去する。

```bash
# アンパック
python3 "$OOXML_SCRIPTS/unpack.py" input.pptx /tmp/{name}-unpacked

# 不要シェイプを除去（位置座標で識別）
python3 -c "
import re
for i in range(3, N):  # コンテンツスライドの範囲
    fpath = f'/tmp/{name}-unpacked/ppt/slides/slide{i}.xml'
    with open(fpath, 'r') as f:
        content = f.read()
    shapes = list(re.finditer(r'<p:sp\b[^>]*>.*?</p:sp>', content, re.DOTALL))
    for shape in reversed(shapes):
        shape_text = shape.group()
        off_match = re.search(r'<a:off x=\"(\d+)\"', shape_text)
        if off_match:
            x = int(off_match.group(1))
            # 非プレースホルダーの特定位置のシェイプを除去
            if x > 7300000:  # 例: 右端のコールアウトボックス
                content = content[:shape.start()] + content[shape.end():]
    with open(fpath, 'w') as f:
        f.write(content)
"

# バリデーション → リパック
python3 "$OOXML_SCRIPTS/validate.py" /tmp/{name}-unpacked --original input.pptx
python3 "$OOXML_SCRIPTS/pack.py" /tmp/{name}-unpacked output.pptx
```

---

## スライドタイプガイド

### タイトルスライド（テンプレート Slide 0）

- shape-0: 宛先テキスト（32pt）+ タイトル（28pt）
- shape-1: 日付
- スライドマスターの幾何図形、ACESロゴ、フッターは自動継承
- **通常版・詳細版で共通**（タイトルは常に同じ）

### INDEXスライド（テンプレート Slide 1）

- shape-0: セクション名のバレットリスト
- 左側のグレー領域と「INDEX」テキストはスライドマスターから自動継承
- **通常版・詳細版で共通**（ただし詳細版はセクション数が少なくなる場合あり）

### セクション仕切りスライド（テンプレート Slide 6）

- shape-0: セクション名テキスト
- チャコール（#393939）背景と幾何図形はスライドマスターから自動継承
- **通常版のみ使用**（詳細版では省略）

### コンテンツスライド（テンプレート Slide 21）

- shape-0: スライドタイトル（Yu Gothic）
- shape-1: サブタイトル/キーメッセージ（Yu Gothic Medium）
- shape-2: 本文コンテンツ — バレットポイント or テーブル or 両方
- **テーブルを使う場合**: shape-2のテキストは最小限にし、python-pptxでテーブルを追加

---

## テキストルール

### 通常版

- 1スライド = 1トピック
- バレットポイントは 6-8項目
- テーブルは最大12行
- バレットは3レベルまで（level 0, 1, 2）
- 余白を活かして読みやすく

### 詳細版

- 関連トピックを1スライドに統合
- バレットポイントは 12-18項目
- テーブルは最大20行
- テーブルを積極的に使い、情報を構造化する
- 本文エリア（5.14"の高さ）を最大限活用する

### 共通

- テンプレートのフォント設定を尊重する（明示的なfont_name指定で上書き可能）
- ACES/rikyuのカラーパレットから逸脱しないこと
- テーブルは項目×内容の対応関係や一覧データに積極的に使用してよい
- スライドマスター左上のカラーパレットを参考に、テーブル・ボックスに色を活用してよい

## 注意事項

- **テンプレートアプローチを必ず使用すること**（HTMLベースの生成は使わない）
- **必ず通常版と詳細版の2ファイルを出力すること**
- テンプレートのスライドマスター、フッター画像、幾何図形はそのまま継承される
- テンプレートファイルが存在しない場合はエラーメッセージを表示
- python3 コマンドを使用すること（python は使用不可）
- pip install には `--break-system-packages` フラグが必要
