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
  定例会資料スタイル（提案仮説構築AI_定例会2_v0.pptx準拠）で生成する。
---

## 引数

$ARGUMENTS

- 第1引数: 入力ソース（必須）— Markdownファイルパス、ディレクトリ、またはテーマの説明
- 第2引数（オプション）: 出力ファイルパス（デフォルト: `output/{テーマ名}.pptx`）
- 追加コンテキスト: タイトル、宛先、日付などの指定があれば使用する

## ACES/Rikyu ブランドカラー定義

以下のカラースキームを**厳守**すること。全てのスライドで一貫して使用する。

### カラーパレット

```
/* === Primary Colors === */
--aces-charcoal:     #3D3D3D;   /* セクション仕切りスライド背景 */
--aces-dark-text:    #333333;   /* 本文テキスト */
--aces-green:        #1B8A6B;   /* テーブルヘッダー、アクセントバー、強調 */
--aces-green-light:  #E8F5F0;   /* ハイライトボックス背景、薄緑帯 */
--aces-green-mint:   #C8E8DC;   /* 3軸×7要素の分類ボックス等 */
--aces-blue-callout: #5A8DBF;   /* 青コメントボックス（見直しポイント等） */
--aces-red-accent:   #CC3333;   /* 赤テキスト（整理状況、注意喚起） */
--aces-white:        #FFFFFF;   /* メイン背景 */
--aces-light-gray:   #F5F5F5;   /* 薄いセクション背景 */
--aces-border-gray:  #CCCCCC;   /* テーブル罫線、区切り線 */
--aces-footer-line:  #999999;   /* フッター区切り線 */
--aces-gold:         #B8860B;   /* ゴールドマイルストーン▼ */
```

### PptxGenJSでの使用（#プレフィックスなし）

```javascript
const COLORS = {
  charcoal:    '3D3D3D',
  darkText:    '333333',
  green:       '1B8A6B',
  greenLight:  'E8F5F0',
  greenMint:   'C8E8DC',
  blueCallout: '5A8DBF',
  redAccent:   'CC3333',
  white:       'FFFFFF',
  lightGray:   'F5F5F5',
  borderGray:  'CCCCCC',
  footerLine:  '999999',
  gold:        'B8860B',
};
```

## スライドタイプ定義

全スライドのHTMLテンプレートで以下を共通とする:

### 共通CSS

```css
html { background: #ffffff; }
body {
  width: 720pt; height: 405pt; margin: 0; padding: 0;
  font-family: Arial, Helvetica, sans-serif;
  display: flex; flex-direction: column;
}
```

### フッター（全スライド共通）

全コンテンツスライド（タイトルスライド以外）の下部にフッターを配置:
- 細い区切り線（1pt, #999999）
- 左中央: 「ACES」テキスト（12pt, #999999, letter-spacing: 2pt）
- 右: 「CONFIDENTIAL」テキスト（9pt, #BBBBBB, letter-spacing: 3pt） + ページ番号

```html
<!-- フッター -->
<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 28pt;">
  <div style="position: absolute; top: 0; left: 30pt; right: 30pt; border-top: 1px solid #999999;"></div>
  <div style="position: absolute; bottom: 4pt; left: 0; right: 0; display: flex; justify-content: center;">
    <p style="font-size: 10pt; color: #999999; letter-spacing: 2pt; margin: 0;">ACES</p>
  </div>
  <div style="position: absolute; bottom: 4pt; right: 30pt; display: flex; align-items: center; gap: 12pt;">
    <p style="font-size: 8pt; color: #BBBBBB; letter-spacing: 3pt; margin: 0;">CONFIDENTIAL</p>
    <p style="font-size: 9pt; color: #999999; margin: 0;">|</p>
    <p style="font-size: 9pt; color: #999999; margin: 0;">{ページ番号}</p>
  </div>
</div>
```

---

### Type 1: タイトルスライド

- 背景: 白
- 左側2/3: タイトル（太字28pt黒）、サブタイトル（太字22pt黒）、日付（14pt灰色）
- 右側1/3: 装飾的なグレーグラデーション幾何図形（PNGで事前生成）
- 左下: 「ACES」ロゴテキスト（太字18pt黒, letter-spacing: 4pt）
- フッターなし

### Type 2: セクション仕切りスライド

- 背景: `#3D3D3D`（チャコール）
- 左側にグレーの装飾幾何図形（半透明PNG）
- 中央にセクションタイトル（白, 30pt, 細字）
- 右下にフッター（CONFIDENTIALとページ番号は白文字、線は半透明白）

### Type 3: INDEXスライド

- 背景: 左1/3がグレーグラデーション、右2/3が白
- 左側: 「INDEX」テキスト（太字26pt白）
- 右側: 番号付きリスト（18pt黒）
- フッターあり

### Type 4: コンテンツスライド（標準）

- 左上: スライドタイトル（太字22pt黒）
- タイトル下: サブタイトル/説明（13pt灰色）
- コンテンツ領域: バレットポイント、テキスト（12-14pt）
- オプション: 右側に青色コールアウトボックス（背景 #5A8DBF, 白テキスト, 角丸4pt）
- フッターあり

### Type 5: テーブルスライド

- タイトル + サブタイトル
- テーブル:
  - ヘッダー行: 背景 `#1B8A6B`、テキスト白、太字
  - データ行: 背景白、テキスト `#333333`
  - 罫線: `#CCCCCC` 1pt
  - フォントサイズ: ヘッダー11pt、データ10-11pt
- フッターあり

### Type 6: フロー/ダイアグラムスライド

- タイトル + サブタイトル
- ボックス要素:
  - 通常ボックス: 背景白、罫線 `#CCCCCC` 1pt、角丸2pt
  - ハイライトボックス: 背景 `#E8F5F0`（薄緑）、罫線 `#1B8A6B`
  - 強調ボックス: 背景 `#1B8A6B`、テキスト白
- 矢印: `#666666`、テキストでの表現時は「→」を使用
- フッターあり

### Type 7: スケジュール/ガントチャートスライド

- タイトル + サブタイトル
- 凡例: 右上に「ACES担当」（白背景枠線）、「お客さま担当」（`#1B8A6B`背景白テキスト）
- タイムライン表:
  - 月ヘッダー: 太字、中央揃え
  - タスクバー: ACES=`#1B8A6B`、顧客=`#5A8DBF`、共同=`#999999`
  - マイルストーン: `#B8860B`のテキスト（▼マーク）
- フッターあり

### Type 8: ３軸×要素図解スライド

- 3つの縦に並ぶ軸ブロック:
  - A軸: 背景 `#1B8A6B`（濃緑）、テキスト白
  - B軸: 背景 `#1B8A6B`、テキスト白
  - C軸: 背景 `#1B8A6B`、テキスト白
- 各軸の右に要素ブロック: 背景 `#C8E8DC`（薄ミント）、テキスト黒
- フッターあり

---

## 実行手順

### 1. 入力コンテンツの読み取り

- 引数で指定されたファイル/ディレクトリを読み取る
- Markdownの場合は構造（見出し、リスト、テーブル）を解析
- 内容をスライド単位に分割する

### 2. スライド構成の設計

[ultrathink] 入力内容からスライド構成を設計する:

1. **タイトルスライド**（Type 1）— 必ず最初に1枚
2. **打ち合わせのゴール**（Type 4）— 定例会の場合
3. **INDEXスライド**（Type 3）— セクションが3つ以上ある場合
4. 各セクションの前に**セクション仕切り**（Type 2）
5. コンテンツに応じたスライドタイプ選択:
   - テーブルデータ → Type 5
   - プロセスフロー → Type 6
   - スケジュール → Type 7
   - 3軸×7要素関連 → Type 8
   - その他 → Type 4
6. **ご依頼事項**スライド（Type 4）— 必要に応じて
7. **Appendix仕切り**（Type 2）— 参考資料がある場合

### 3. HTML スライドファイルの生成

- `/pptx` スキルを使ってPPTXを生成する
- 各スライドをHTMLファイルとして作成
- 出力ディレクトリ: `output/slides/` に個別HTMLファイルを配置
- カラーパレットを厳守すること

### 4. PPTX生成

- `html2pptx` ライブラリを使用してHTMLをPPTXに変換
- build-pptx.js スクリプトを作成して一括変換
- 出力先にPPTXファイルを書き出す

### 5. 生成確認

- ファイルサイズを確認
- スライド数を報告
- 出力パスを表示

## テキストルール

- 日本語テキストは`Arial`フォントを使用（PowerPoint側で日本語フォールバックが効く）
- フォントサイズガイド:
  - スライドタイトル: 22-28pt（太字）
  - サブタイトル: 13-16pt
  - 本文: 11-14pt
  - テーブルセル: 10-11pt
  - フッター: 8-10pt
- 1スライドあたりの情報量を適切に制限する（テーブルは最大12行程度）

## 注意事項

- CSSグラデーションは使用禁止。背景画像はSharpでPNG事前生成する
- PptxGenJSの色指定で`#`プレフィックスは使用禁止（ファイル破損の原因）
- `<div>`内のテキストは必ず`<p>`タグで囲む
- 箇条書きは`<ul>`/`<ol>`を使用し、手動の`•`記号は禁止
- フォントはWeb-safeフォントのみ使用可能
- ACES/rikyuのカラーパレットから逸脱しないこと
