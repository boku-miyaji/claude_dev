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
- **テーブルデータ行**: 背景白、テキスト `#000000`（交互行色は使わない。シンプルに）
- **テーブル罫線**: `#6E6F73` 0.5pt
- **強調テキスト**: `#006843` 太字 or `#009A62`
- **注意テキスト**: `#EC6C1F`（オレンジ）
- **セカンダリテキスト**: `#6E6F73`
- **確信度ブロック（高）**: バー `#006843`、背景 `#E8F5E9`（淡緑）、ラベル色 `#006843`
- **確信度ブロック（中）**: バー `#8B9DAF`（スレートブルーグレー）、背景 `#EEF1F5`、ラベル色 `#8B9DAF`
- **確信度ブロック（低）**: バー `#B0B0B0`（グレー）、背景 `#F5F5F5`（淡グレー）、ラベル色 `#B0B0B0`
- **注意**: 確信度レベルに応じてバー・背景・ラベルの3点セットを必ず一致させること。中なのに緑背景等の不一致は厳禁

### フォント定義

- **ラテン文字**: Trebuchet MS
- **日本語**: Meiryo UI（メイリオUI）
- **タイトル**: Trebuchet MS + Meiryo UI、太字
- **本文**: Trebuchet MS + Meiryo UI、通常

### フォントサイズガイド

| 要素 | 通常版 | 詳細版 |
|------|--------|--------|
| タイトルスライド メインタイトル | 32pt | 32pt |
| タイトルスライド 日付 | 24pt | 16pt |
| スライドタイトル | shape-0 デフォルト | 同左 |
| キーメッセージ（shape-1） | 11pt | 11pt |
| 本文バレット | 9-10pt | 7.5-8pt |
| セクションヘッダー | 10pt | 9pt |
| テーブルヘッダー | 8-9pt | 6.5-7.5pt |
| テーブルセル | 7-8pt | 5.5-6.5pt |
| 脚注 | 7-8pt | 6.5pt |

### East Asian フォント設定（重要）

python-pptxのデフォルトでは `a:ea` タグが付かず、日本語がフォールバックフォントで表示される。
全てのrun に対して East Asian フォントを明示的に設定すること:

```python
from pptx.oxml.ns import qn

def _ea(run, typeface='Meiryo UI'):
    """Attach East Asian font to a run. Removes existing a:ea first to prevent duplicates."""
    rPr = run._r.get_or_add_rPr()
    for ea in rPr.findall(qn('a:ea')):
        rPr.remove(ea)
    ea = rPr.makeelement(qn('a:ea'), {})
    ea.set('typeface', typeface)
    rPr.append(ea)

# 使用例: 全ての _run() 呼び出しの最後に _ea(r) を実行
```

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

#### 2-1. rearrange → replace

```bash
# rearrange
python3 "$SCRIPTS/rearrange.py" "$TEMPLATE" "$WORKDIR/std-working.pptx" 0,2,3,4,3,3

# inventory（必要に応じて）
python3 "$SCRIPTS/inventory.py" "$WORKDIR/std-working.pptx" "$WORKDIR/std-inventory.json"

# replacement JSON 作成 → $WORKDIR/std-replacement.json
# ※ shape-1 にはキーメッセージ（そのスライドの要約）を入れる

# replace
python3 "$SCRIPTS/replace.py" "$WORKDIR/std-working.pptx" "$WORKDIR/std-replacement.json" "$WORKDIR/std-replaced.pptx"
```

#### 2-2. OOXML クリーンアップ（テンプレート残骸除去）

**重要: python-pptx でコンテンツを追加する前に実行すること。**
python-pptx が作成する TextBox は "TextBox N" と自動命名されるため、
クリーンアップを後に実行するとコンテンツも削除されてしまう。

```bash
python3 "$OOXML_SCRIPTS/unpack.py" "$WORKDIR/std-replaced.pptx" /tmp/{name}-std-unpacked

# テンプレート残骸を除去（cleanup スクリプト）
python3 /tmp/cleanup_ooxml.py /tmp/{name}-std-unpacked

# presentation.xml の不要セクション除去（sectionLst の重複ID対策）
python3 -c "
import re
fpath = '/tmp/{name}-std-unpacked/ppt/presentation.xml'
with open(fpath, 'r') as f:
    content = f.read()
content = re.sub(r'<p14:sectionLst\b[^>]*>.*?</p14:sectionLst>', '', content, flags=re.DOTALL)
with open(fpath, 'w') as f:
    f.write(content)
"

python3 "$OOXML_SCRIPTS/validate.py" /tmp/{name}-std-unpacked --original "$WORKDIR/std-replaced.pptx"
python3 "$OOXML_SCRIPTS/pack.py" /tmp/{name}-std-unpacked "$WORKDIR/std-cleaned.pptx"
```

#### 2-3. コンテンツ追加（python-pptx）→ 最終出力

```bash
# クリーン済みPPTXにコンテンツを追加
python3 "$WORKDIR/add_tables_std.py" "$WORKDIR/std-cleaned.pptx" "output/{name}.pptx"
```

### 3. 詳細版を生成

同じ手順（rearrange → replace → OOXML クリーンアップ → コンテンツ追加）で実行。

```bash
python3 "$SCRIPTS/rearrange.py" "$TEMPLATE" "$WORKDIR/det-working.pptx" 0,2,3,3
# replace → OOXML クリーンアップ → コンテンツ追加
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

## OOXML シェイプ作成の注意事項

### spPr 内の要素順序（厳守）

python-pptxで矩形シェイプ等を作成・修正する際、`p:spPr` 内の子要素は以下の順序でなければならない。
順序が違うとシェイプが描画されない（特に LibreOffice で顕著）:

```
xfrm → prstGeom → solidFill → ln
```

**NG例（solidFill が xfrm の前 — 描画されない）:**
```xml
<p:spPr>
  <a:solidFill><a:srgbClr val="009A62"/></a:solidFill>  <!-- ✗ ここにあるとNG -->
  <a:xfrm>...</a:xfrm>
  <a:prstGeom prst="rect">...</a:prstGeom>
</p:spPr>
```

**OK例:**
```xml
<p:spPr>
  <a:xfrm>...</a:xfrm>
  <a:prstGeom prst="rect">...</a:prstGeom>
  <a:solidFill><a:srgbClr val="009A62"/></a:solidFill>  <!-- ✓ prstGeom の後 -->
  <a:ln><a:noFill/></a:ln>
</p:spPr>
```

### プログラムでシェイプを追加する場合の推奨

テンプレート内の既存シェイプを `copy.deepcopy()` でクローンし、位置・ID・名前を変更するのが最も安全:

```python
import copy
from pptx.oxml.ns import qn

# 既存の動作するシェイプをクローン
new_shape = copy.deepcopy(existing_shape._element)
# ID・名前を変更
cNvPr = new_shape.find(qn('p:nvSpPr')).find(qn('p:cNvPr'))
cNvPr.set('id', str(new_id))
cNvPr.set('name', 'New Shape Name')
# 位置を変更
off = new_shape.find(qn('p:spPr')).find(qn('a:xfrm')).find(qn('a:off'))
off.set('x', str(new_x))
off.set('y', str(new_y))
# スライドに追加
slide.shapes._spTree.append(new_shape)
```

---

## テーブル視認性・番号体系ガイドライン

### テーブルヘッダのコントラスト

テーブルヘッダは **背景 `#006843`（深緑）+ テキスト白（`#FFFFFF`）** を厳守。
黒テキスト+深緑背景はコントラスト不足で読みにくい。

```python
# ヘッダセル設定の正しいパターン
for ci in range(num_cols):
    cell = table.cell(0, ci)
    cell.fill.solid()
    cell.fill.fore_color.rgb = RGBColor(0x00, 0x68, 0x43)
    for para in cell.text_frame.paragraphs:
        for run in para.runs:
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)  # 必ず白
            run.font.bold = True
```

### 番号体系のベストプラクティス

テーブル内の番号列には **接頭辞なしの数字のみ** を使用する:

| NG | OK | 理由 |
|----|-----|------|
| V-1, V-2 | 1, 2 | 接頭辞は読み手に余計な認知コストをかける |
| RP-1, RP-2 | 1, 2 | テーブルのセクション名で区別すれば十分 |
| N-1, N-3 | 1, 3 | 番号だけで連番として機能する |

### 紐づき・参照列の表記

他テーブルの項目を参照する列（紐づきニーズ等）では、IDではなく **人が読める名前** を使う:

| NG | OK |
|----|-----|
| N-1 | 物流拠点移転 |
| N-1〜5 | 主要テーマ全般 |
| N-3,N-6 | 物流戦略・共同配送 |

---

## テーブル追加ガイド（python-pptx）

### add_run ヘルパー（テキスト追加の標準パターン）

全テキスト追加で使用する汎用ヘルパー。フォント・色・East Asianフォントを一括設定:

```python
def add_run(para, text, font_size=Pt(10.5), bold=False,
            color=RGBColor(0x00, 0x00, 0x00), font_name='Trebuchet MS'):
    """Format-aware run addition with East Asian font support."""
    run = para.add_run()
    run.text = text
    run.font.size = font_size
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = font_name
    _ea(run)  # 必ず East Asian フォントを設定
    return run
```

### rikyu テーブルスタイリング

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

COLORS = {
    'header_bg': RGBColor(0x00, 0x68, 0x43),   # accent1: dark green
    'header_text': RGBColor(0xFF, 0xFF, 0xFF),  # white（必ず白。黒は NG）
    'cell_text': RGBColor(0x00, 0x00, 0x00),    # dk1: black
    'border': RGBColor(0x6E, 0x6F, 0x73),       # accent5: gray
    'source_text': RGBColor(0x6E, 0x6F, 0x73),  # 出典タグ用グレー
    'green_accent': RGBColor(0x00, 0x9A, 0x62),  # dk2: bright green（セパレータライン）
    'section_label': RGBColor(0x00, 0x68, 0x43), # セクションヘッダーラベル
}

def add_rikyu_table(slide, data, left_in=0.25, top_in=1.10, width_in=9.50,
                    header_font_pt=9, cell_font_pt=8):
    """rikyuスタイルのテーブルをスライドに追加する（シンプル: 緑ヘッダー + 白行）"""
    rows, cols = len(data), len(data[0])
    height_in = 0.30 * rows

    table_shape = slide.shapes.add_table(
        rows, cols, Inches(left_in), Inches(top_in),
        Inches(width_in), Inches(height_in))
    table = table_shape.table

    # ★ 組み込みテーブルスタイルのバンディングを無効化（交互行色を防ぐ）
    tblPr = table._tbl.tblPr
    tblPr.attrib.pop('bandRow', None)
    tblPr.attrib.pop('bandCol', None)
    tblPr.attrib.pop('firstRow', None)
    tblPr.attrib.pop('lastRow', None)
    for child in list(tblPr):
        if child.tag.endswith('}tblStyle'):
            tblPr.remove(child)

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

    return table
```

### テーブルレイアウト

- 配置: コンテンツエリア内（top: 1.55" 以降、キーメッセージボックスの下）
- width: 通常 9.50"〜9.67"（4:3フォーマットのため狭い）
- テーブルがあるスライドでは本文テキストを最小限に
- 1スライドに複数テーブルを配置する場合は、section_hdr で区切る

### レイアウト定数

```python
# 共通
Y0      = 1.55    # content top (below key message box)
Y_MAX   = 7.10    # bottom limit
X_FULL  = 0.17    # full-width x (for tables)
W_FULL  = 9.67    # full-width width

# 2カラムレイアウト（均等分割）
X_L     = 0.25    # left column x
W_L     = 4.50    # left column width
X_R     = 5.00    # right column x
W_R     = 4.75    # right column width

# 2カラムレイアウト（EMU単位 — python-pptxでの直接配置用）
X_L_EMU  = 228600   # 0.25"
W_L_EMU  = 4114800  # 4.50"（左カラム）
X_R_EMU  = 4572000  # 5.00"
W_R_EMU  = 4343400  # 4.75"（右カラム）
```

### 確信度ブロック生成ヘルパー

確信度レベルに応じた色分けブロック。バー・背景・ラベルの3点セットを一致させること:

```python
CONFIDENCE_STYLES = {
    '高': {
        'bar':   RGBColor(0x00, 0x68, 0x43),  # #006843
        'bg':    'E8F5E9',                      # 淡緑
        'label': RGBColor(0x00, 0x68, 0x43),
    },
    '中': {
        'bar':   RGBColor(0x8B, 0x9D, 0xAF),  # #8B9DAF
        'bg':    'EEF1F5',                      # 淡青灰 ※ E8F5E9(緑)は NG
        'label': RGBColor(0x8B, 0x9D, 0xAF),
    },
    '低': {
        'bar':   RGBColor(0xB0, 0xB0, 0xB0),  # #B0B0B0
        'bg':    'F5F5F5',                      # 淡灰
        'label': RGBColor(0xB0, 0xB0, 0xB0),
    },
}

def add_confidence_block(slide, confidence, title, description, x, y, w, h):
    """確信度ブロック（背景矩形 + 左バー + タイトル + 説明）を追加。
    confidence: '高' | '中' | '低'
    Returns: block の下端 y 座標"""
    style = CONFIDENCE_STYLES[confidence]

    # 背景矩形
    bg = slide.shapes.add_shape(1, x, y, w, h)
    set_shape_fill(bg, style['bg'])
    bg.line.fill.background()

    # 左バー（幅45720 EMU ≈ 0.05"）
    bar = slide.shapes.add_shape(1, x, y, Emu(45720), h)
    set_shape_fill(bar, style['bar'].rgb_str if hasattr(style['bar'], 'rgb_str') else ...)
    bar.line.fill.background()

    # タイトル TextBox
    # ... add_run(p, f'確信度: {confidence}', bold=True, color=style['label'])
    # ... add_run(p, f' ー {title}', bold=True, color=BLACK)

    # 説明 TextBox (gray text)
    # ... add_run(p, description, color=GRAY_TEXT)

    return y + h  # 次ブロックの開始位置
```

### 詳細版: 推論チェーンブロック

推論過程を可視化するための構造化ブロック（L3詳細版で使用）:

```python
def reasoning_block(slide, title, facts, conclusion, x, y, w, level='高'):
    """Reasoning chain: facts → interpretation → conclusion.
    facts = [(fact_text, interpretation_text), ...]
    Returns y after the block."""
    style = CONFIDENCE_STYLES[level]
    bar_c = style['bar']
    # Header with confidence level
    # Fact lines with gray interpretation
    # Conclusion bar with colored left border + light gray background
    ...
```

### 詳細版: 複数テーブルのY位置管理

1スライドに複数テーブルを配置する場合、各テーブルの後のY位置を計算する:

```python
y = section_hdr(s, 'セクション1', X_FULL, Y0, W_FULL)
add_table(s, data1, x=X_FULL, y=y, ...)
y2 = y + rh * (len(data1)) + 0.08  # テーブル高さ + マージン
y2 = section_hdr(s, 'セクション2', X_FULL, y2, W_FULL)
add_table(s, data2, x=X_FULL, y=y2, ...)
```

### バレットの高さ計算（改行対応）

`\n` を含むバレット項目は複数行として計算する:

```python
total_lines = sum(1 + str(item).count('\n') for item in items)
h = total_lines * sz * 1.5 / 72 + 0.15
```

---

## OOXML クリーンアップ

テンプレートスライドに含まれる不要なシェイプを除去する。

**重要: 必ず python-pptx でコンテンツを追加する前に実行すること。**
python-pptx の `add_textbox()` は "TextBox N" という名前でシェイプを作成するため、
クリーンアップを後に実行すると追加したコンテンツも削除されてしまう。

### パイプライン順序（厳守）

```
rearrange → replace → OOXML クリーンアップ → python-pptx コンテンツ追加 → thumbnail
```

### テンプレート残骸の種類

このテンプレートには以下の不要シェイプが含まれている:

| 種類 | 名前例 | 説明 |
|------|--------|------|
| `p:pic` | "図 3", "think-cell data" | テンプレートの画像・think-cell残骸 |
| `p:cxnSp` | "直線コネクタ 5" | コネクタ線 |
| `p:graphicFrame` | "think-cell data" | テーブルでないグラフィックフレーム |
| `mc:AlternateContent` | — | spTree内の互換コンテンツ |

**注意**: `p:sp` の "TextBox *" はテンプレートには存在しない。
TextBox を削除対象にするとpython-pptxで追加したコンテンツが消えるため、
TextBox の除去ルールは含めないこと。

### クリーンアップスクリプト

`/tmp/cleanup_ooxml.py` を作成して使用する:

```python
"""Remove template leftover shapes from content slides in unpacked PPTX."""
import re, sys, os

def cleanup_slide(fpath, slide_num):
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    original_len = len(content)
    sptree_match = re.search(r'(<p:spTree>)(.*?)(</p:spTree>)', content, re.DOTALL)
    if not sptree_match:
        return
    prefix = content[:sptree_match.start(2)]
    sptree_content = sptree_match.group(2)
    suffix = content[sptree_match.end(2):]
    removed = []
    # 1. Remove p:pic
    for m in reversed(list(re.finditer(r'<p:pic\b[^>]*>.*?</p:pic>', sptree_content, re.DOTALL))):
        removed.append('p:pic')
        sptree_content = sptree_content[:m.start()] + sptree_content[m.end():]
    # 2. Remove p:cxnSp
    for m in reversed(list(re.finditer(r'<p:cxnSp\b[^>]*>.*?</p:cxnSp>', sptree_content, re.DOTALL))):
        removed.append('p:cxnSp')
        sptree_content = sptree_content[:m.start()] + sptree_content[m.end():]
    # 3. Remove p:graphicFrame without <a:tbl>
    for m in reversed(list(re.finditer(r'<p:graphicFrame\b[^>]*>.*?</p:graphicFrame>', sptree_content, re.DOTALL))):
        if '<a:tbl' not in m.group():
            removed.append('p:graphicFrame')
            sptree_content = sptree_content[:m.start()] + sptree_content[m.end():]
    # 4. Remove mc:AlternateContent inside spTree
    for m in reversed(list(re.finditer(r'<mc:AlternateContent\b[^>]*>.*?</mc:AlternateContent>', sptree_content, re.DOTALL))):
        removed.append('mc:AlternateContent')
        sptree_content = sptree_content[:m.start()] + sptree_content[m.end():]
    # ※ TextBox は除去しない（python-pptxで追加したコンテンツが消えるため）
    content = prefix + sptree_content + suffix
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)
    if removed:
        print(f"  Slide {slide_num}: Removed {len(removed)} elements")

def main(unpacked_dir):
    slides_dir = os.path.join(unpacked_dir, 'ppt', 'slides')
    slide_files = sorted([f for f in os.listdir(slides_dir) if f.startswith('slide') and f.endswith('.xml')])
    for fname in slide_files:
        slide_num = int(re.search(r'slide(\d+)', fname).group(1))
        if slide_num < 2:
            continue
        cleanup_slide(os.path.join(slides_dir, fname), slide_num)

if __name__ == '__main__':
    main(sys.argv[1])
```

### presentation.xml の修正

テンプレートの `p14:sectionLst` に重複 sldId が含まれているため除去する:

```python
import re
fpath = '/tmp/{name}-unpacked/ppt/presentation.xml'
with open(fpath, 'r') as f:
    content = f.read()
content = re.sub(r'<p14:sectionLst\b[^>]*>.*?</p14:sectionLst>', '', content, flags=re.DOTALL)
with open(fpath, 'w') as f:
    f.write(content)
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
- shape-1: **キーメッセージ**（非プレースホルダー、pos 0.17, 0.66）
  - そのスライドの要約を1-2文で記載する
  - キーメッセージだけ読めばスライド全体の言いたいことがわかるようにする
  - replacement.json の shape-1 paragraphs で設定
- 緑ヘッダーラインはスライドマスターから自動継承
- **最もシンプルなコンテンツテンプレート**
- 本文コンテンツは python-pptx で y=1.55" 以降に追加（セクションヘッダー + バレット / テーブル）

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
