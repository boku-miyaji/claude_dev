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
  rikyu format 資料作成コマンド。
  Markdownやドキュメントの内容をrikyu（りそな向けコンサル資料）フォーマットのPowerPointにまとめる。
  テンプレートベース生成（りそなの法人戦略とコンサル営業強化について（説明用）7.pptx準拠）。
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
| 本文バレット数 | 1スライド 6-8項目 | 1スライド 12-18項目 |
| テーブル行数 | 最大12行 | 最大20行 |
| 情報密度 | 低（プレゼン向け） | 高（配布資料向け） |
| コンテンツ分割 | 細かく分割 | 関連するセクションをまとめる |

---

## テンプレート情報

### テンプレートファイル

```
project-rikyu-sales-proposals-poc/untracked/original_document/drive-download-20260129T020114Z-3-001/20260227_りそなの法人戦略とコンサル営業強化について/りそなの法人戦略とコンサル営業強化について（説明用） 7.pptx
```

- **テーマ**: Custom 1
- **スライドサイズ**: **4:3**（10.00" × 7.50"）— ※ACESフォーマット(16:9)と異なる
- **スライド数**: 30枚

### テンプレートスライドインデックス（0始まり）

| タイプ | インデックス | シェイプ数 | 用途 |
|--------|:-----------:|:---------:|------|
| **タイトル** | 0 | 2 | 表紙（CENTER_TITLE + 日付） |
| **目次** | 2 | 5 | 目次（TITLE + 項目リスト + ページ参照） |
| **コンテンツ（シンプル）** | 3 | 2 | タイトル + 説明テキスト |
| **コンテンツ（サブタイトル付き）** | 4 | 3 | タイトル + サブタイトル + 脚注 |
| **コンテンツ（BODY付き）** | 22 | 6 | タイトル + BODY + フリーテキスト |

### コンテンツスライドのプレースホルダー構造

**全コンテンツスライド共通（slideLayout2）:**
- 緑ライン（#009A62, 1.5pt）がスライド全幅に y=0.53" で自動配置
- ページ番号が右下に自動配置

**Slide 3 基準（シンプルコンテンツ）:**

| シェイプ | 位置(in) | サイズ(in) | タイプ | 用途 |
|---------|----------|-----------|--------|------|
| shape-0 | (0.17, 0.08) | 6.53 × 0.36 | TITLE | スライドタイトル（太字） |
| shape-1 | (0.17, 0.66) | 9.67 × 可変 | None | 本文テキスト（サブタイトル/説明文） |

**Slide 4 基準（サブタイトル付き）:**

| シェイプ | 位置(in) | サイズ(in) | タイプ | 用途 |
|---------|----------|-----------|--------|------|
| shape-0 | (0.17, 0.08) | 6.53 × 0.36 | TITLE | スライドタイトル |
| shape-1 | (0.17, 0.66) | 9.67 × 0.32 | None | サブタイトル/キーメッセージ |
| shape-2 | (0.24, 7.14) | 可変 | None | 脚注 |

---

## カラーパレット

### テーマカラー（Custom 1）

```
dk1:           #000000    メインテキスト（黒）
lt1:           #FFFFFF    メイン背景（白）
dk2:           #009A62    グリーンアクセント（ヘッダーライン）
lt2:           #F2F2F2    ライトグレー背景
accent1:       #006843    ダークグリーン（テーブルヘッダー、強調）
accent2:       #4472C4    ブルー（チャート、リンク）
accent3:       #EC6C1F    オレンジ（警告、注意）
accent4:       #D0B806    ゴールド（ハイライト）
accent5:       #6E6F73    グレー（セカンダリテキスト）
accent6:       #009A62    ブライトグリーン（ヘッダーライン）
```

### カラー使用ガイドライン

- **ヘッダーライン**: `#009A62` 1.5pt（スライドマスターで自動付与）
- **テーブルヘッダー**: 背景 `#006843`、テキスト白
- **テーブルデータ行**: 背景白、テキスト `#000000`
- **テーブル交互行**: 背景 `#F2F2F2`（オプション）
- **テーブル罫線**: `#6E6F73` 0.5pt
- **強調テキスト**: `#006843` 太字 or `#009A62`
- **注意テキスト**: `#EC6C1F`（オレンジ）
- **セカンダリテキスト**: `#6E6F73`
- **ハイライトボックス**: 背景 `#F9F5DF`（淡黄色、レイアウトで使用）

### フォント定義

- **ラテン文字**: Trebuchet MS
- **日本語**: Meiryo UI（メイリオUI）
- **タイトル**: Trebuchet MS + Meiryo UI、太字
- **本文**: Trebuchet MS + Meiryo UI、通常

### フォントサイズガイド

- タイトルスライド メインタイトル: 32pt
- タイトルスライド 日付: 24pt
- スライドタイトル: shape-0 のデフォルト（太字）
- サブタイトル/キーメッセージ: 11-14pt
- 本文バレット: 10-12pt
- テーブルヘッダー: 9-10pt
- テーブルセル: 8-9pt
- 脚注: 7-8pt

---

## 実行手順

### 共通定義

```bash
SCRIPTS=/home/node/.claude/plugins/cache/anthropic-agent-skills/document-skills/69c0b1a06741/skills/pptx/scripts
OOXML_SCRIPTS=/home/node/.claude/plugins/cache/anthropic-agent-skills/document-skills/69c0b1a06741/skills/pptx/ooxml/scripts
TEMPLATE="project-rikyu-sales-proposals-poc/untracked/original_document/drive-download-20260129T020114Z-3-001/20260227_りそなの法人戦略とコンサル営業強化について/りそなの法人戦略とコンサル営業強化について（説明用） 7.pptx"
WORKDIR=output/{name}
```

### 1. 入力コンテンツの読み取りとスライド設計（2バージョン分）

[ultrathink] 入力内容を読み取り、**通常版と詳細版の両方**のスライド構成を同時に設計する。

#### 通常版の設計方針

- 1スライド = 1トピック
- バレットポイントは1スライド 6-8項目
- テーブルは1スライド最大12行
- 情報が多い場合は複数スライドに分割

#### 詳細版の設計方針

- 関連するトピックを1スライドに統合
- バレットポイントは1スライド 12-18項目
- テーブルは1スライド最大20行、テーブルを積極的に使う
- 通常版で2-3スライドに分けた内容を1スライドにまとめる

#### テンプレートスライド選択の基準

- タイトルスライド → Slide 0（CENTER_TITLE付き）
- 目次 → Slide 2（TITLE + 項目リスト）
- シンプルコンテンツ → Slide 3（タイトル + テキスト）
- サブタイトル付き → Slide 4（タイトル + サブタイトル + 脚注）
- 構造化コンテンツ → Slide 22（タイトル + BODY + フリーテキスト）

**テンプレートマッピング例:**
```python
standard_mapping = [
    0,   # タイトル
    2,   # 目次
    3,   # コンテンツ（概要）
    4,   # コンテンツ（背景）
    3,   # コンテンツ（課題）
    3,   # コンテンツ（解決策）
]
```

### 2. 通常版を生成

#### 2-1. rearrange → inventory → replace

```bash
# rearrange
python3 "$SCRIPTS/rearrange.py" "$TEMPLATE" "$WORKDIR/std-working.pptx" 0,2,3,4,3,3

# inventory
python3 "$SCRIPTS/inventory.py" "$WORKDIR/std-working.pptx" "$WORKDIR/std-inventory.json"

# replacement JSON 作成 → $WORKDIR/std-replacement.json

# replace
python3 "$SCRIPTS/replace.py" "$WORKDIR/std-working.pptx" "$WORKDIR/std-replacement.json" "$WORKDIR/std-replaced.pptx"
```

#### 2-2. テーブル追加 + OOXML クリーンアップ + 出力

```bash
# テーブル追加（python-pptx スクリプトで）
# OOXML クリーンアップ（不要シェイプ除去）
# → 最終出力: output/{name}.pptx
```

### 3. 詳細版を生成

#### 3-1. rearrange → inventory → replace

```bash
# rearrange（スライド数が少ない）
python3 "$SCRIPTS/rearrange.py" "$TEMPLATE" "$WORKDIR/det-working.pptx" 0,2,3,3

# inventory → replace → テーブル追加 → OOXML クリーンアップ
# → 最終出力: output/{name}_detailed.pptx
```

### 4. サムネイル検証（両バージョン）

```bash
python3 "$SCRIPTS/thumbnail.py" "output/{name}.pptx" "$WORKDIR/thumbnails-std" --cols 5
python3 "$SCRIPTS/thumbnail.py" "output/{name}_detailed.pptx" "$WORKDIR/thumbnails-det" --cols 5
```

---

## replacement-text.json のフォーマットルール

**共通ルール（通常版・詳細版とも）:**
- タイトルスライド shape-0: `font_size: 32.0`（メインタイトル）
- コンテンツスライド shape-0 は TITLE プレースホルダー（フォント自動継承）
- shape-1 以降は非プレースホルダーの場合が多い
- バレットテキストに `•`, `-`, `*` 記号を含めない（自動付与される）

**例:**
```json
{
  "slide-0": {
    "shape-0": {
      "paragraphs": [
        {"text": "【勉強会資料】りそなの法人戦略とコンサル営業強化について"}
      ]
    },
    "shape-1": {
      "paragraphs": [{"text": "2026年2月27日"}]
    }
  },
  "slide-2": {
    "shape-0": {
      "paragraphs": [{"text": "コンサルティング営業の概要"}]
    },
    "shape-1": {
      "paragraphs": [
        {"text": "法人顧客への価値提供力向上を図るべく、全社で営業スタイル変革に取り組む"}
      ]
    }
  }
}
```

---

## テーブル追加ガイド（python-pptx）

### rikyu テーブルスタイリング

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

COLORS = {
    'header_bg': RGBColor(0x00, 0x68, 0x43),   # accent1: dark green
    'header_text': RGBColor(0xFF, 0xFF, 0xFF),  # white
    'cell_text': RGBColor(0x00, 0x00, 0x00),    # dk1: black
    'alt_row': RGBColor(0xF2, 0xF2, 0xF2),      # lt2: light gray
    'highlight': RGBColor(0xF9, 0xF5, 0xDF),    # pale yellow
    'border': RGBColor(0x6E, 0x6F, 0x73),       # accent5: gray
    'green_accent': RGBColor(0x00, 0x9A, 0x62),  # dk2: bright green
}

def add_rikyu_table(slide, data, left_in=0.25, top_in=1.10, width_in=9.50,
                    header_font_pt=9, cell_font_pt=8):
    """rikyuスタイルのテーブルをスライドに追加する"""
    rows, cols = len(data), len(data[0])
    height_in = 0.30 * rows

    table_shape = slide.shapes.add_table(
        rows, cols, Inches(left_in), Inches(top_in),
        Inches(width_in), Inches(height_in))
    table = table_shape.table

    for row_idx, row_data in enumerate(data):
        for col_idx, cell_text in enumerate(row_data):
            cell = table.cell(row_idx, col_idx)
            cell.text = str(cell_text)

            for para in cell.text_frame.paragraphs:
                para.font.name = 'Trebuchet MS'
                if row_idx == 0:
                    para.font.size = Pt(header_font_pt)
                    para.font.color.rgb = COLORS['header_text']
                    para.font.bold = True
                else:
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

### テーブルレイアウト

- 配置: コンテンツエリア内（top: 0.66"以降, width: 9.50"）— 4:3のため幅が狭い
- サブタイトルの下にマージンを確保
- テーブルがあるスライドでは本文テキストを最小限に

---

## OOXML クリーンアップ

テンプレートスライドに不要な非プレースホルダーシェイプがある場合、除去する。

```bash
python3 "$OOXML_SCRIPTS/unpack.py" input.pptx /tmp/{name}-unpacked

python3 -c "
import re
for i in range(3, N):
    fpath = f'/tmp/{name}-unpacked/ppt/slides/slide{i}.xml'
    with open(fpath, 'r') as f:
        content = f.read()
    shapes = list(re.finditer(r'<p:sp\b[^>]*>.*?</p:sp>', content, re.DOTALL))
    for shape in reversed(shapes):
        shape_text = shape.group()
        # プレースホルダーでないシェイプを識別して除去
        if '<p:ph' not in shape_text:
            off_match = re.search(r'<a:off x=\"(\d+)\" y=\"(\d+)\"', shape_text)
            if off_match:
                # 不要な位置のシェイプを除去
                content = content[:shape.start()] + content[shape.end():]
    with open(fpath, 'w') as f:
        f.write(content)
"

python3 "$OOXML_SCRIPTS/validate.py" /tmp/{name}-unpacked --original input.pptx
python3 "$OOXML_SCRIPTS/pack.py" /tmp/{name}-unpacked output.pptx
```

---

## スライドタイプガイド

### タイトルスライド（テンプレート Slide 0）

- shape-0: CENTER_TITLE — メインタイトル（32pt太字）
- shape-1: BODY — 日付テキスト（24pt, Trebuchet MS）
- **通常版・詳細版で共通**

### 目次スライド（テンプレート Slide 2）

- shape-0: TITLE — 「目次」
- shape-1: セクション名リスト（Trebuchet MS）
- shape-2〜4: ページ参照テキスト（右側に配置）

### コンテンツスライド（テンプレート Slide 3）

- shape-0: TITLE — スライドタイトル（太字）
- shape-1: 本文テキスト（非プレースホルダー、pos 0.17, 0.66）
- 緑ヘッダーラインはスライドマスターから自動継承
- **最もシンプルなコンテンツテンプレート**

### コンテンツスライド + サブタイトル（テンプレート Slide 4）

- shape-0: TITLE — スライドタイトル
- shape-1: サブタイトル/キーメッセージ
- shape-2: 脚注テキスト
- 本文エリアは shape-1 の下からフッター上まで（約 0.98" 〜 7.14"、高さ約6.16"）

---

## テキストルール

### 通常版

- 1スライド = 1トピック
- バレットポイントは 6-8項目
- テーブルは最大12行
- 余白を活かして読みやすく

### 詳細版

- 関連トピックを1スライドに統合
- バレットポイントは 12-18項目
- テーブルは最大20行
- テーブルを積極的に使い、情報を構造化する
- 4:3フォーマットでの縦の高さ（7.50"）を最大限活用する

### 共通

- フォントは Trebuchet MS + Meiryo UI を使用
- ACES/rikyuのカラーパレットから逸脱しないこと
- テーブルは項目×内容の対応関係や一覧データに積極的に使用してよい
- テーマカラーを参考に、テーブル・ボックスに色を活用してよい

## ACES format との違い

| 項目 | rikyu format（本コマンド） | ACES format（pptx-aces-rikyu） |
|------|--------------------------|-------------------------------|
| アスペクト比 | **4:3**（10.00" × 7.50"） | 16:9（13.33" × 7.50"） |
| フォント（ラテン） | **Trebuchet MS** | Century Gothic |
| フォント（日本語） | **Meiryo UI** | Yu Gothic |
| テーマ | Custom 1 | ACES Slide Master |
| ヘッダー | 緑ライン #009A62 | なし（スライドマスターのデザイン） |
| フッター | ページ番号のみ | ACES / CONFIDENTIAL + ページ番号 |
| テーブル幅 | 最大 9.50" | 最大 12.46" |
| 用途 | りそな向けコンサル資料 | ACES社内/定例会資料 |

## 注意事項

- **テンプレートアプローチを必ず使用すること**（HTMLベースの生成は使わない）
- **必ず通常版と詳細版の2ファイルを出力すること**
- **4:3フォーマット** — テーブル幅やコンテンツ幅が16:9より狭い（最大 ~9.67"）
- テンプレートのスライドマスター、緑ヘッダーライン、ページ番号はそのまま継承される
- テンプレートファイルが存在しない場合はエラーメッセージを表示
- python3 コマンドを使用すること（python は使用不可）
- pip install には `--break-system-packages` フラグが必要
