---
name: pptx-rikyu
description: >
  rikyu format 資料作成コマンド。
  Markdownやドキュメントの内容をrikyu（りそな向けコンサル資料）フォーマットのPowerPointにまとめる。
  テンプレートベース生成（りそなの法人戦略とコンサル営業強化について（説明用）7.pptx準拠）。
  通常版と詳細版の2バージョンを同時生成する。
trigger: /pptx-rikyu
category: materials
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
