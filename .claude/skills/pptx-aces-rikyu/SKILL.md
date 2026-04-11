---
name: pptx-aces-rikyu
description: >
  ACES format・rikyu向け資料作成コマンド。
  Markdownやドキュメントの内容をACES/rikyuブランドのPowerPointにまとめる。
  テンプレートベース生成（提案仮説構築AI_定例会1_20260219_v1.pptx準拠）。
  通常版と詳細版の2バージョンを同時生成する。
trigger: /pptx-aces-rikyu
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
| セクション仕切り | 各セクション前に配置 | 省略（INDEXのみ） |
| 本文バレット数 | 1スライド 6-8項目 | 1スライド 12-18項目 |
| テーブル行数 | 最大12行 | 最大20行 |
| 情報密度 | 低（プレゼン向け） | 高（配布資料向け） |
| コンテンツ分割 | 細かく分割 | 関連するセクションをまとめる |


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
