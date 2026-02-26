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
  定例会資料スタイル（提案仮説構築AI_定例会1_20260219_v1.pptx準拠）で生成する。
---

## 引数

$ARGUMENTS

- 第1引数: 入力ソース（必須）— Markdownファイルパス、ディレクトリ、またはテーマの説明
- 第2引数（オプション）: 出力ファイルパス（デフォルト: `output/{テーマ名}.pptx`）
- 追加コンテキスト: タイトル、宛先、日付などの指定があれば使用する

## ACES/Rikyu ブランドカラー定義

以下のカラースキームを**厳守**すること。全てのスライドで一貫して使用する。
参照元: `project-rikyu-sales-proposals-poc/untracked/original_document/report/提案仮説構築AI_定例会1_20260219_v1.pptx`

### テーマ情報

- **テーマ名**: ACES Slide Master
- **カラースキーム**: ACES color scheme v2
- **スライドサイズ**: 16:9（13.33" × 7.50" = 960pt × 540pt）

### カラーパレット

```
/* === Theme Colors (from ACES color scheme v2) === */
--aces-dk1:           #121212;   /* メインテキスト（ほぼ黒） */
--aces-lt1:           #FFFFFF;   /* メイン背景（白） */
--aces-dk2:           #757575;   /* セカンダリグレー */
--aces-lt2:           #C7C7C7;   /* 装飾用ライトグレー（幾何図形等） */
--aces-accent1-blue:  #5298BA;   /* 青コメントボックス、KPIハイライト */
--aces-accent2-red:   #DB5F5F;   /* 赤テキスト（注意喚起） */
--aces-accent3-green: #629F64;   /* テーマグリーン（アクセント3） */
--aces-accent4-gold:  #C0B76A;   /* ゴールドマイルストーン▼ */

/* === Slide-Level Colors (実際のスライドで使用) === */
--aces-charcoal:      #393939;   /* セクション仕切りスライド背景 */
--aces-table-text:    #454545;   /* テーブルセルのテキスト */
--aces-green-dark:    #006843;   /* テーブルヘッダー、強調ボックス背景 */
--aces-green-medium:  #197A56;   /* スケジュールバー、強調アクセント */
--aces-green-bright:  #009A62;   /* 明るい緑アクセント */
--aces-green-mint:    #C2E7D9;   /* 薄ミント（3軸ボックス、ハイライト行等） */
--aces-green-pale:    #DFE6E0;   /* 極薄緑背景 */
--aces-orange:        #FBAE40;   /* オレンジアクセント（レイアウト装飾） */
--aces-white:         #FFFFFF;   /* メイン背景 */
--aces-border-gray:   #C7C7C7;   /* テーブル罫線、区切り線 */
```

### PptxGenJSでの使用（#プレフィックスなし）

```javascript
const COLORS = {
  dk1:         '121212',  // メインテキスト
  charcoal:    '393939',  // セクション仕切り背景
  tableText:   '454545',  // テーブルテキスト
  dk2:         '757575',  // セカンダリグレー
  lt2:         'C7C7C7',  // ライトグレー（装飾・罫線）
  greenDark:   '006843',  // テーブルヘッダー、強調ボックス
  greenMedium: '197A56',  // スケジュールバー、強めの緑
  greenBright: '009A62',  // 明るい緑アクセント
  greenMint:   'C2E7D9',  // 薄ミント背景
  greenPale:   'DFE6E0',  // 極薄緑背景
  blue:        '5298BA',  // 青コールアウト
  red:         'DB5F5F',  // 赤アクセント
  gold:        'C0B76A',  // ゴールド
  orange:      'FBAE40',  // オレンジアクセント
  white:       'FFFFFF',
};
```

### フォント定義

- **ラテン文字**: Century Gothic（HTMLレンダリング時はVerdanaフォールバック）
- **日本語**: 游ゴシック / Yu Gothic（HTMLレンダリング時はNoto Sans CJK JPフォールバック）
- **テーマフォント設定**:
  - Major: Century Gothic + 游ゴシック
  - Minor: Century Gothic + 游ゴシック Medium

```css
/* HTML用フォントスタック */
font-family: 'Century Gothic', Verdana, 'Yu Gothic', 'Noto Sans CJK JP', sans-serif;
```

## スライドタイプ定義

全スライドのHTMLテンプレートで以下を共通とする:

### 共通CSS

```css
html { background: #ffffff; }
body {
  width: 960pt; height: 540pt; margin: 0; padding: 0;
  font-family: 'Century Gothic', Verdana, 'Yu Gothic', 'Noto Sans CJK JP', sans-serif;
  color: #121212;
  display: flex; flex-direction: column;
}
```

### フッター（全スライド共通）

全コンテンツスライド（タイトルスライド以外）の下部にフッターを配置。
参照PPTXではフッターは画像だが、html2pptxではHTMLで再現する:

- 細い区切り線（1pt, #C7C7C7）
- 左中央: 「ACES」テキスト（10pt, #757575, letter-spacing: 3pt, Century Gothic太字）
- 右: 「CONFIDENTIAL」テキスト（8pt, #C7C7C7, letter-spacing: 3pt） + ページ番号

```html
<!-- フッター -->
<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 36pt;">
  <div style="position: absolute; top: 0; left: 30pt; right: 30pt; border-top: 1px solid #C7C7C7;"></div>
  <div style="position: absolute; bottom: 8pt; left: 0; right: 0; display: flex; justify-content: center;">
    <p style="font-size: 10pt; color: #757575; letter-spacing: 3pt; font-weight: bold; margin: 0;">ACES</p>
  </div>
  <div style="position: absolute; bottom: 8pt; right: 30pt; display: flex; align-items: center; gap: 12pt;">
    <p style="font-size: 8pt; color: #C7C7C7; letter-spacing: 3pt; margin: 0;">CONFIDENTIAL</p>
    <p style="font-size: 9pt; color: #757575; margin: 0;">|</p>
    <p style="font-size: 9pt; color: #757575; margin: 0;">{ページ番号}</p>
  </div>
</div>
```

### フッター（セクション仕切りスライド用・白文字版）

```html
<!-- フッター（暗背景用） -->
<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 36pt;">
  <div style="position: absolute; top: 0; left: 30pt; right: 30pt; border-top: 1px solid rgba(255,255,255,0.3);"></div>
  <div style="position: absolute; bottom: 8pt; left: 0; right: 0; display: flex; justify-content: center;">
    <p style="font-size: 10pt; color: rgba(255,255,255,0.7); letter-spacing: 3pt; font-weight: bold; margin: 0;">ACES</p>
  </div>
  <div style="position: absolute; bottom: 8pt; right: 30pt; display: flex; align-items: center; gap: 12pt;">
    <p style="font-size: 8pt; color: rgba(255,255,255,0.4); letter-spacing: 3pt; margin: 0;">CONFIDENTIAL</p>
    <p style="font-size: 9pt; color: rgba(255,255,255,0.6); margin: 0;">|</p>
    <p style="font-size: 9pt; color: rgba(255,255,255,0.6); margin: 0;">{ページ番号}</p>
  </div>
</div>
```

---

### Type 1: タイトルスライド

- 背景: 白
- 左側2/3:
  - 宛先テキスト（32ptレギュラー, #121212）例: 「株式会社りそな銀行 御中」
  - タイトル（28ptレギュラー, #121212）例: 「提案仮説構築AI 定例会1」
- 左下: 日付テキスト（14pt, #757575）
- 右側1/3: 装飾的なグレー幾何図形（PNGで事前生成、#C7C7C7系のストライプ/三角形）
- 最左下: 「ACES」ロゴテキスト（太字14pt, #121212, letter-spacing: 4pt）
- フッターなし

### Type 2: セクション仕切りスライド

- 背景: `#393939`（チャコール）
- 左側にグレーの装飾幾何図形（半透明PNG, #C7C7C7系）
- 中央やや左にセクションタイトル（白, 28-30pt, レギュラー〜Light）
- 右下にフッター（白文字版を使用）

### Type 3: INDEXスライド

- 背景: 左約40%がグレー系グラデーション画像（PNG）、右60%が白
- 左側（グレー領域内）: 「INDEX」テキスト（太字26pt白）
- 右側: 番号付きセクションリスト
  - 番号: #757575 テキスト
  - セクション名: #121212 テキスト（16-18pt）
  - 現在のセクション: `#006843`の左ボーダーまたは`#C2E7D9`ハイライト帯でマーク
- フッターあり

### Type 4: コンテンツスライド（標準）

- 左上: スライドタイトル（太字22pt, #121212）
- タイトル下: サブタイトル/説明文（13pt, #757575）
- コンテンツ領域: テキスト・バレットポイント（11-14pt, #121212）
- オプション: 青色コールアウトボックス（背景 `#5298BA`, 白テキスト, 角丸4pt）
- オプション: 薄緑ハイライトボックス（背景 `#DFE6E0` or `#C2E7D9`）
- フッターあり

### Type 5: テーブルスライド

- タイトル + サブタイトル
- テーブル:
  - ヘッダー行: 背景 `#006843`、テキスト白、太字
  - データ行: 背景白、テキスト `#454545`
  - 交互行: 背景 `#DFE6E0`（オプション）
  - 罫線: `#C7C7C7` 1pt
  - フォントサイズ: ヘッダー11pt、データ10-11pt
  - 強調セル: テキスト `#006843` 太字、または背景 `#C2E7D9`
- フッターあり

### Type 6: フロー/ダイアグラムスライド

- タイトル + サブタイトル
- ボックス要素:
  - 通常ボックス: 背景白、罫線 `#C7C7C7` 1pt、角丸2pt
  - ハイライトボックス: 背景 `#C2E7D9`（薄ミント）、罫線 `#006843`
  - 強調ボックス: 背景 `#006843`、テキスト白
  - 青ボックス: 背景 `#5298BA`、テキスト白
- 矢印: `#757575`、テキストでの表現時は「→」を使用
- フッターあり

### Type 7: スケジュール/ガントチャートスライド

- タイトル + サブタイトル
- 凡例: 右上に「ACES担当」（白背景枠線）、「お客さま担当」（`#197A56`背景白テキスト）
- タイムライン表:
  - 月ヘッダー: 太字、中央揃え
  - タスクバー: ACES=`#197A56`、顧客=`#5298BA`、共同=`#757575`
  - マイルストーン: `#C0B76A`のテキスト（▼マーク）
- フットノート: `#757575` 小文字（9pt）で注記
- フッターあり

### Type 8: ３軸×要素図解スライド

- 3つの縦に並ぶ軸ブロック:
  - A軸: 背景 `#006843`（濃緑）、テキスト白
  - B軸: 背景 `#006843`、テキスト白
  - C軸: 背景 `#006843`、テキスト白
- 各軸の右に要素ブロック: 背景 `#C2E7D9`（薄ミント）、テキスト `#121212`
- 横断軸（ある場合）: 背景 `#5298BA`、テキスト白
- フッターあり

### Type 9: 体制図スライド

- タイトル + サブタイトル
- 組織ボックス: 罫線 `#C7C7C7`、テキスト `#121212`
- 役割ラベル: 背景 `#006843`、テキスト白（小さめ）
- 接続線: `#C7C7C7`
- フッターあり

### Type 10: 検証サイクル/プロセスフロースライド

- タイトル + サブタイトル
- ステップボックス:
  - ステップ番号: 背景 `#006843`、テキスト白（丸または四角）
  - ステップタイトル: 太字 `#121212`
  - ステップ内容: `#454545` テキスト
- 矢印/接続: `#197A56` or `#757575`
- 担当者セクション: 背景 `#DFE6E0` 薄緑帯
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
2. **INDEXスライド**（Type 3）— セクションが3つ以上ある場合
3. 最初のセクション前に**セクション仕切り**（Type 2）
4. コンテンツに応じたスライドタイプ選択:
   - テーブルデータ → Type 5
   - プロセスフロー → Type 6 or Type 10
   - スケジュール → Type 7
   - 3軸×要素関連 → Type 8
   - 体制図 → Type 9
   - その他 → Type 4
5. 各セクション前に**セクション仕切り**（Type 2）
6. **ご相談事項**スライド（Type 4）— 必要に応じて
7. **Appendix仕切り**（Type 2）— 参考資料がある場合

### 3. HTML スライドファイルの生成

- `/pptx` スキルを使ってPPTXを生成する
- 各スライドをHTMLファイルとして作成
- 出力ディレクトリ: `output/slides/` に個別HTMLファイルを配置
- カラーパレットを厳守すること
- html2pptx.md の制約事項を必ず確認する

### 4. PPTX生成

- `html2pptx` ライブラリを使用してHTMLをPPTXに変換
- build-pptx.js スクリプトを作成して一括変換
- 出力先にPPTXファイルを書き出す

### 5. 生成確認

- ファイルサイズを確認
- サムネイル画像を生成して目視確認
- スライド数を報告
- 出力パスを表示

## テキストルール

- 日本語テキストはCentury Gothic + 游ゴシックが目標フォント
- HTMLレンダリングでは `'Century Gothic', Verdana, 'Yu Gothic', 'Noto Sans CJK JP', sans-serif` を指定
- フォントサイズガイド:
  - 宛先/大タイトル: 28-32pt（レギュラー）
  - スライドタイトル: 22pt（太字）
  - サブタイトル: 13pt（#757575）
  - 本文: 11-14pt
  - テーブルセル: 10-11pt
  - フッター: 8-10pt
- 1スライドあたりの情報量を適切に制限する（テーブルは最大12行程度）

## 注意事項

- CSSグラデーションは使用禁止。背景画像はSharpでPNG事前生成する
- PptxGenJSの色指定で`#`プレフィックスは使用禁止（ファイル破損の原因）
- `<div>`内のテキストは必ず`<p>`タグで囲む
- 箇条書きは`<ul>`/`<ol>`を使用し、手動の`•`記号は禁止
- ACES/rikyuのカラーパレットから逸脱しないこと
- セクション仕切りスライドの背景は必ず `#393939` を使用する
- テーブルヘッダーの緑は必ず `#006843` を使用する
- テーブルテキストは `#454545`、通常テキストは `#121212` を使い分ける
