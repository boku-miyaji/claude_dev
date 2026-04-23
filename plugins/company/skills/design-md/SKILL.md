---
name: design-md
trigger: /design-md
description: DESIGN.md フォーマットを使ったデザインシステム定義。コーディングエージェントにビジュアルアイデンティティを伝えるための DESIGN.md ファイルを作成・検証・更新する。フロントエンド実装前にデザインシステムを定義したい、既存デザインを DESIGN.md 化したい、UI の一貫性を保ちたい場合に使う。
---

# DESIGN.md スキル

Google Labs Code が策定した [DESIGN.md](https://github.com/google-labs-code/design.md) フォーマットを使い、デザインシステムを定義・管理するスキル。

## DESIGN.md とは

AIコーディングエージェントに「見た目の意図」を永続的・構造的に伝えるためのファイル形式。

- **YAML フロントマター**: 機械可読なデザイントークン（色・タイポ・スペーシング）
- **Markdown 本文**: そのトークンが「なぜその値か」を人間向けに説明するデザイン根拠

このファイルがあれば、どのエージェントがどのセッションでコードを書いても同じビジュアルアイデンティティを再現できる。

---

## ワークフロー

### 1. 新規作成

ユーザーのプロダクト・ブランドについてヒアリングしてから DESIGN.md を生成する。

**ヒアリング項目（最低限）:**
- プロダクトの性格（ビジネス/クリエイティブ/コンシューマー）
- ターゲットユーザーの感情（信頼感/軽快さ/プロフェッショナル）
- メインカラー（既存があればその HEX）
- フォント指定（あれば）

**生成時の注意:**
- YAML と Markdown の両方を必ず書く
- `primary` カラーは必須。missing-primary lint エラーになる
- タイポグラフィも最低 1 スケールを定義する（missing-typography 警告回避）

### 2. 既存ファイルの検証

```bash
npx @google/design.md lint DESIGN.md
```

返ってくる findings を見てユーザーに説明・修正提案する。

### 3. バージョン比較

```bash
npx @google/design.md diff DESIGN.md DESIGN-v2.md
```

### 4. 他フォーマットへのエクスポート

```bash
# Tailwind テーマ
npx @google/design.md export --format tailwind DESIGN.md > tailwind.theme.json

# W3C DTCG tokens.json
npx @google/design.md export --format dtcg DESIGN.md > tokens.json
```

---

## DESIGN.md フォーマット仕様

### ファイル構造

```
---
<YAML フロントマター: デザイントークン>
---

## Overview
## Colors
## Typography
## Layout
## Elevation & Depth
## Shapes
## Components
## Do's and Don'ts
```

セクションは必要なものだけ書けばよいが、**順序は上記に従う**（section-order lint 警告）。

### トークンスキーマ

```yaml
version: alpha           # 任意
name: <string>           # デザインシステム名（必須）
description: <string>    # 任意

colors:
  primary: "#RRGGBB"     # 必須
  secondary: "#RRGGBB"
  tertiary: "#RRGGBB"
  neutral: "#RRGGBB"

typography:
  <token-name>:
    fontFamily: <string>
    fontSize: <px|rem|em>
    fontWeight: <number>     # 400, 500, 600, 700 など
    lineHeight: <number|px>  # 1.6 または 24px
    letterSpacing: <em>

rounded:
  sm: 4px
  md: 8px
  lg: 16px

spacing:
  sm: 8px
  md: 16px
  lg: 32px

components:
  <component-name>:
    backgroundColor: "{colors.primary}"   # トークン参照
    textColor: "{colors.neutral}"
    typography: "{typography.body-md}"    # composite 参照
```

**トークン参照構文**: `{path.to.token}` — broken-ref lint エラーを防ぐため、必ず定義済みのパスを参照する。

### 型定義

| 型 | 形式 | 例 |
|---|---|---|
| Color | `#RRGGBB` | `"#1A1C1E"` |
| Dimension | px / em / rem | `"16px"`, `"1rem"` |
| fontWeight | 数値 | `400`, `700` |
| lineHeight | 数値または Dimension | `1.6`, `"24px"` |

---

## Lint ルール一覧

| ルール | Severity | 内容 |
|---|---|---|
| `broken-ref` | error | `{path.to.token}` が未定義トークンを参照 |
| `missing-primary` | warning | colors が定義されているが primary がない |
| `contrast-ratio` | warning | component の背景/文字色が WCAG AA（4.5:1）を下回る |
| `orphaned-tokens` | warning | 定義されたカラートークンがどのコンポーネントも参照していない |
| `missing-typography` | warning | colors はあるがタイポグラフィがない |
| `section-order` | warning | セクション順序が仕様と異なる |
| `token-summary` | info | 定義済みトークン数のサマリー |
| `missing-sections` | info | spacing/rounded が未定義 |

---

## 出力テンプレート（最小構成）

```markdown
---
version: alpha
name: {プロダクト名}
colors:
  primary: "#??????"
  secondary: "#??????"
  neutral: "#??????"
typography:
  body-md:
    fontFamily: {フォント}
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  heading-lg:
    fontFamily: {フォント}
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
spacing:
  sm: 8px
  md: 16px
  lg: 32px
rounded:
  sm: 4px
  md: 8px
---

## Overview

{プロダクトの性格・ブランドの雰囲気を 2〜3 文で}

## Colors

- **Primary ({HEX}):** {役割と印象}
- **Secondary ({HEX}):** {役割と印象}
- **Neutral ({HEX}):** {役割と印象}

## Typography

{フォント選定の理由と各スケールの使い分け}

## Layout

{グリッド・スペーシング方針}
```

---

## 注意事項

- DESIGN.md は `alpha` バージョン。仕様は変更中
- フロントマターがなくても（Markdown のみでも）エージェントは解釈できるが、トークンがあった方が精度が高い
- Figma 変数 / Tailwind テーマとの相互変換は `export` コマンドを使う
- 仕様の最新版: `npx @google/design.md spec`
