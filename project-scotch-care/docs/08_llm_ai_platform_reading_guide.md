# LLM/AI基盤の設計に必要な知識体系

> 作成日: 2026-03-03 | 更新日: 2026-03-04 | 目的: Foundry移行先の新環境で「LLM/AI基盤」を正しく設計するために、何を読み・何を考えるべきかを整理する

---

## Part 1: まず押さえるべき「大きな考え方」3つ

細かい機能比較の前に、**設計判断の軸になる3つのパラダイム**を理解する必要がある。

### 考え方①: Compound AI System（複合AIシステム）

**一言で**: ChatGPTのように「AI単体に質問して答えが返る」のではなく、裏側で複数の仕組みが連携して初めて「信頼できる回答」が出てくる設計のこと。

**身近な例で理解する: Googleマップのルート案内**

Googleマップで「東京駅から大阪駅」と聞くと、ルートが返ってくる。しかし裏側では:
- 地図データベースが道路情報を提供
- 交通情報APIがリアルタイム渋滞を取得
- ルーティングアルゴリズムが最適経路を計算
- 料金計算エンジンが高速料金を算出
- 表示エンジンが結果を見やすく整形

**1つのAIが全部やっているわけではない**。専門的な仕組みが連携して、初めて「正確で使えるルート案内」が実現している。

LLMを使った業務システムも同じ構造になる:

```
SOMPOケアでの例: 「先月の稼働率が低い施設はどこ？原因は？」

  この質問をAIが正しく答えるために裏で動くもの:
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │  ① ルーター: 「稼働率の質問だ」→ 数値分析ルートへ │
  │  ② セマンティックレイヤー:                        │
  │     「稼働率 = 入居者数 ÷ 定員 × 100」を参照      │
  │  ③ SQL生成: LLMが正しいSQLクエリを作る            │
  │  ④ バリデーション: SQLが安全か確認                 │
  │  ⑤ データベース: SQLを実行して結果を取得           │
  │  ⑥ LLM解釈: 結果を人間にわかる文章にする          │
  │  ⑦ 権限チェック: この人に見せていいデータか確認    │
  │                                                 │
  │  → 最終回答（信頼度レベル付き）                    │
  └─────────────────────────────────────────────────┘
```

**他社の事例**:
- **Databricks Genie**: 内部で5つのAIエージェントが協調して動作。1つ目が質問を理解し、2つ目がテーブルを特定し、3つ目がSQLを生成し、4つ目がSQLの安全性を確認し、5つ目が結果をまとめる
- **Snowflake Cortex Analyst**: 複数のLLMが段階的に処理。まず小さいLLMで意図分類、次に大きいLLMでSQL生成、最後に別のLLMで結果を解釈
- **Palantir AIP Logic**: ワークフローとして各ステップを明示的に定義。「データ取得→分析→承認→アクション」の各段階でLLMを活用

**なぜSOMPOケアで重要か**: RFIベンダーは「うちのAI機能すごい」と言うが、1,000施設×数千人が使うには**LLM単体ではなくシステム全体の設計**が必要。PoC段階から「どのコンポーネントが連携して答えを返すか」を意識して設計しないと、本番で精度が出ない。

**参考資料**:
- [Databricks AI/BI Genie](https://docs.databricks.com/aws/en/genie/) — Compound AI Systemの実装例
- [Databricks AI/BI Genie Blog](https://www.databricks.com/blog/aibi-genie-now-generally-available) — Genieの内部アーキテクチャ詳細

---

### 考え方②: Semantic Layer（セマンティックレイヤー）= LLMと人間の「共通言語」

**一言で**: 「稼働率ってどう計算するの？」「離職率って何を含むの？」という**ビジネス用語の定義**をコードで書き出しておく仕組み。これがないとAIは毎回違う計算をしてしまう。

**身近な例で理解する: レシピブック**

料理で考えてみる。「カレーを作って」と言われたとき:
- レシピがない場合 → 人によって全然違うカレーができる（辛さも具材もバラバラ）
- レシピがある場合 → 誰が作っても同じカレーができる

セマンティックレイヤーは**データ分析のレシピブック**。「稼働率を出して」と言われたとき:
- レシピ（定義）がない → AIが勝手に計算式を考える → 毎回違う数字が出る
- レシピ（定義）がある → AIが定義を見て正確に計算 → いつも同じ数字が出る

```
❌ セマンティックレイヤーがない場合:
   社長: 「全社の稼働率は？」 → AI: 「87.2%」
   施設長: 「稼働率教えて」 → AI: 「83.5%」（計算式が違う）
   → 会議で数字が合わなくて混乱

✅ セマンティックレイヤーがある場合:
   YAML定義: 稼働率 = 入居者数 ÷ 定員 × 100（ショートステイ除く）
   → 誰が聞いても同じ「87.2%」が返る
```

**他社の事例**:
- **Airbnb**: セマンティックレイヤー「Minerva」を構築。「予約率」「キャンセル率」等の定義を一元管理。2,000人以上のデータ利用者が同じ定義を参照することで、部門間のKPI不一致を解消
- **Spotify**: 「月間アクティブユーザー(MAU)」の定義を統一。マーケティング部門と経営層で定義が違っていた問題を、セマンティックレイヤーで解決
- **dbt Labs導入企業**: セマンティックレイヤー導入後、LLMの自然言語→SQL変換精度が83%→99.8%に向上したという報告

**3つのアーキテクチャパターン**:

| パターン | イメージ | 代表例 | メリット/デメリット |
|---|---|---|---|
| **DWH内蔵型** | データベースの中にレシピブックを置く | Snowflake Semantic Views, Databricks Unity Catalog | メリット: 権限管理が一体。デメリット: DWHに依存 |
| **コード管理型** | Gitでレシピブックを管理 | dbt MetricFlow | メリット: 変更履歴が残る、DWH非依存。デメリット: 別途管理が必要 |
| **キャッシュ型** | レシピ+作り置き | Cube.dev | メリット: 高速。デメリット: もう一つシステムが増える |

**Foundryとの関係**: Foundryの「オントロジー」はまさにこのセマンティックレイヤーだった。**移行先でこれをゼロから作り直す**ことになる。どのパターンで再構築するかの設計判断が必要。

**参考資料**:
- [Semantic Layer as Data Interface for LLMs (dbt Labs)](https://www.getdbt.com/blog/semantic-layer-as-the-data-interface-for-llms) — **最重要文献**
- [Semantic Layer Architectures比較](https://www.typedef.ai/resources/semantic-layer-metricflow-vs-snowflake-vs-databricks)
- [Snowflake Cortex Analyst Semantic Model Spec](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst/semantic-model-spec) — YAML定義の具体例

---

### 考え方③: Governance as Code（ガバナンスの自動化）

**一言で**: 「○○してはいけない」というルールを、マニュアルや研修ではなく**技術的に破れない仕組み**として実装すること。

**身近な例で理解する: ATMの引き出し上限**

銀行で「1日50万円まで」という引き出し上限がある。これは:
- ❌ 「50万円以上引き出さないでね」とお願いする（＝マニュアルベース）
- ✅ ATMのシステムで50万円を超えると物理的に引き出せない（＝コードベース）

AI時代のデータ管理も同じ。「このデータは見せちゃダメ」を:
- ❌ 「社外秘です、気をつけてね」（教育・マニュアル）
- ✅ AIが回答する前に自動チェックし、含まれていたらブロック（コード/設定）

```
ガバナンスの3層（SOMPOケアの例）:

Layer 1: アクセス制御（誰が何を見られるか）
  例: 施設長は自分の施設のデータだけ見える
    → AIに質問しても、他施設のデータは回答に含まれない
    → Unity CatalogやSnowflake RLSで実装

Layer 2: セマンティック制御（定義を勝手に変えられない）
  例: 「稼働率」の計算式を現場が勝手に変えるのを防ぐ
    → Git管理された定義を、承認フローを通さないと変更できない

Layer 3: 実行制御（暴走を防ぐ）
  例: AIが複雑すぎるSQLを生成してDBに高負荷をかけるのを防ぐ
    → クエリ複雑度の上限、1回あたりのコスト上限、月間利用量の上限
```

**他社の事例**:
- **JPモルガン**: AIが生成した金融レポートを、自動コンプライアンスチェックにかけてから公開。機密情報や不適切な表現が含まれていると自動ブロック
- **Kaiser Permanente（米国医療）**: 患者データへのAIアクセスをHIPAA準拠で自動制御。AIが回答を生成する前に、患者の同意状況を自動確認
- **Netflix**: データエンジニアリングチームが「データコントラクト」を導入。上流テーブルの構造変更が下流のAIモデルを壊さないよう、自動チェック機構を実装

**なぜSOMPOケアで特に重要か**: 介護データには**要配慮個人情報**（病歴、障害、介護度）が含まれる。1,000施設の現場スタッフがLLMで自由に質問する世界では、「使い方を教育する」だけでは不十分。**技術的に壊せない仕組み**が必須。

**参考資料**:
- [2026 Predictions: Architecture, Governance, and AI Trends (Cloudera)](https://www.cloudera.com/blog/business/2026-predictions-the-architecture-governance-and-ai-trends-every-enterprise-must-prepare-for.html)
- [5 Data Infrastructure Shifts for Enterprise AI 2026](https://techarena.ai/content/5-data-infrastructure-shifts-that-will-define-enterprise-ai-in-2026)

---

## Part 2: 具体的な技術選定で読むべき資料

### DWH/データ基盤 — Databricks vs Snowflake

本PJTでは Databricks (Deloitte/Fujitsu案) vs Snowflake (Hitachi案) が主な選択肢。

| 比較軸 | Databricks | Snowflake | 例えるなら |
|---|---|---|---|
| LLM統合 | AI-BI Genie（複数AIが協調） | Cortex Analyst + Cortex Code | Databricks=オーケストラ、Snowflake=少人数バンド |
| セマンティックレイヤー | Unity Catalog | Semantic Views | どちらもレシピブックの置き場所 |
| 自然言語→SQL | Genie（マルチエージェント方式） | Cortex Analyst（マルチLLM方式） | アプローチは違うが目指すところは同じ |
| ML/AI開発 | MLflow + Mosaic AI | Cortex ML + Snowpark | Databricksの方がML開発に強い |
| コスト体系 | DBU（演算単位課金） | クレジット（クエリ課金） | 電気代のようなもの。使い方で有利不利が変わる |

**読むべき資料**:
- [Databricks AI/BI Genie](https://docs.databricks.com/aws/en/genie/) — 自然言語分析の実装
- [Snowflake Cortex Analyst](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst) — セマンティックモデルベースの自然言語SQL

---

### セマンティックレイヤー — dbt MetricFlow

Foundryオントロジーの移行先として**最有力**。

```yaml
# こんなYAMLファイルを書くだけで「稼働率」の定義ができる
# これがあれば、AIは毎回正しい計算式でSQLを生成する
semantic_models:
  - name: facility_occupancy
    description: "施設稼働率 — 全施設の日次稼働状況を示す"
    model: ref('fct_facility_daily')
    entities:
      - name: facility
        type: primary
        expr: facility_id
    measures:
      - name: occupancy_rate
        description: "稼働率 = 入居者数 / 定員 × 100（ショートステイ除く）"
        agg: derived
        expr: "resident_count / capacity * 100"
```

**参考資料**:
- [dbt Semantic Layer](https://docs.getdbt.com/docs/use-dbt-semantic-layer/dbt-sl)
- [MetricFlow (GitHub)](https://github.com/dbt-labs/metricflow)

---

### MCP（Model Context Protocol）

**一言で**: AIが外部のデータやツールに**安全にアクセスするための「共通コンセント」**。

```
身近な例: USBは「共通コンセント」
  昔: プリンター専用ケーブル、カメラ専用ケーブル...（バラバラ）
  今: USB-C 1本でなんでも繋がる

MCPも同じ:
  昔: AIツールごとにデータ接続方法が違う（Genie専用、Cortex専用...）
  今: MCP対応していれば、どのAIツールからでも同じ方法でデータにアクセス

Claude Desktop / Cursor / 自社AIアプリ
       │
       ▼
   MCP Protocol（共通コンセント）
       │
       ├→ dbt Semantic Layer（KPI定義を取得）
       ├→ DWH（SQLを実行）
       ├→ データカタログ（テーブル情報を取得）
       └→ 権限チェック（ユーザー権限を確認）
```

**参考資料**:
- [The Ultimate Guide to Semantic Layers for AI (PromptQL)](https://promptql.io/blog/the-ultimate-guide-to-semantic-layers-for-ai)

---

## Part 3: 既存プロジェクト資料の活用度マップ

### 社内RFI回答の「LLM/AI観点での」活用度

| 資料 | LLM/AI基盤に役立つ部分 | 活用度 |
|---|---|---|
| **Deloitte回答** | Databricks AI-BI、MLflowの提案。AI/ML事例多数 | ★★★★ |
| **Fujitsu回答** | DI Basic構成（Databricks+dbt）。Foundryハイブリッド案 | ★★★ |
| **Salesforce回答** | Tableau Agent、Data 360 MCP。AI Model Builder/BYOM | ★★★ |
| **PwC回答** | Bedrock/SageMaker中心のAI構成。AWS基盤設計 | ★★ |
| **Hitachi回答** | Snowflake Cortex への言及あるが薄い | ★ |
| **0219_Foundry移行_技術観点** | 現行パイプライン棚卸し。移行対象の理解に必須 | ★★★★ |
| **Foundry環境及び新環境要件** | 現行のオントロジー・権限構造の理解 | ★★★★ |

---

## Part 4: 外部で読むべき資料（優先度順）

### 必読（設計判断に直結）

| # | タイトル | 読むと何がわかるか |
|---|---|---|
| 1 | [Semantic Layer as the Data Interface for LLMs](https://www.getdbt.com/blog/semantic-layer-as-the-data-interface-for-llms) | AIにデータを触らせる際の最も基本的な設計思想。「レシピブックがないとAIは使い物にならない」がわかる |
| 2 | [Semantic Layer Architectures比較](https://www.typedef.ai/resources/semantic-layer-metricflow-vs-snowflake-vs-databricks) | 3つの「レシピブックの置き場所」の長所短所が比較できる |
| 3 | [Databricks AI/BI Genie](https://docs.databricks.com/aws/en/genie/) | 「裏で複数のAIが連携する仕組み」の具体的な実装がわかる |
| 4 | [Snowflake Cortex Analyst](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst) | YAMLでセマンティックモデルを定義する具体的な書き方がわかる |
| 5 | [Open Source MetricFlow](https://www.getdbt.com/blog/open-source-metricflow-governed-metrics) | Foundryオントロジーの代替技術として最有力のものが理解できる |

### 推奨（視座を広げる）

| # | タイトル | 読むと何がわかるか |
|---|---|---|
| 6 | [State of Data Mesh in 2026](https://www.thoughtworks.com/insights/blog/data-strategy/the-state-of-data-mesh-in-2026-from-hype-to-hard-won-maturity) | 部門ごとにデータを管理する設計思想と、その現実的な教訓 |
| 7 | [2026 Predictions: Architecture, Governance, AI](https://www.cloudera.com/blog/business/2026-predictions-the-architecture-governance-and-ai-trends-every-enterprise-must-prepare-for.html) | エンタープライズAIガバナンスの2026年最新トレンド |
| 8 | [5 Data Infrastructure Shifts for Enterprise AI 2026](https://techarena.ai/content/5-data-infrastructure-shifts-that-will-define-enterprise-ai-in-2026) | AIエージェントのガードレール設計パターン |

---

## Part 5: 「大きな考え方」のフレームワーク

### 設計判断フレームワーク: 4つの問い

新環境のLLM/AI基盤を設計する際、以下の4つの問いに答えられる状態を目指す:

```
問い1: AIは「何を知っている」べきか？ ← セマンティックレイヤーの設計
  例: AIは「稼働率」と聞かれたら、「入居者数÷定員×100（ショートステイ除く）」
     と定義を知っている状態にする
  → Foundryオントロジーから何を引き継ぐか

問い2: AIは「何をしていい」か？ ← ガバナンスの設計
  例: 施設長が聞いた場合は自分の施設のデータだけ
     本部が聞いた場合は全施設のデータを見せる
  → AIが書き込み（更新・削除）までしていいかも含む

問い3: AIの答えは「どこまで信じていい」か？ ← 信頼度の設計
  例: 公式KPIの数値照会 → 高信頼度（セマンティック定義に基づく）
     「なぜ稼働率が下がったか？」の分析 → 中信頼度（AIの推論が入る）
  → ユーザーに信頼度レベルを表示する設計

問い4: AIの答えを「どう育てる」か？ ← フィードバックの設計
  例: 「AIの回答が間違っていた」→ フィードバック → 定義を修正 → 次から正確に
  → セマンティックモデルの継続的改善サイクル
```

### 技術選定の判断マトリクス

```
                        セマンティックレイヤー
                    DWH-Native    dbt MetricFlow    両方併用
                  ┌────────────┬───────────────┬──────────┐
Databricks       │ Unity Cat   │ dbt+Databricks│ ★推奨    │
                  │ + Genie    │ + Genie       │          │
                  ├────────────┼───────────────┼──────────┤
Snowflake        │ Semantic    │ dbt+Snowflake │ ★推奨    │
                  │ Views +    │ + Cortex      │          │
                  │ Cortex     │ Analyst       │          │
                  └────────────┴───────────────┴──────────┘

→ 「両方併用」が推奨: DWH-Nativeで権限制御、dbtでKPI定義のGit管理
→ PoCでは各パターンの精度・運用性を比較
```

### ロードマップ上の位置づけ

```
FY2026 1Q (PoC)
  └─ まず「4つの問い」に答えるPoC
      ├─ 問い1: セマンティックレイヤーの選定（dbt vs DWH-Native）
      ├─ 問い2: 権限設計の検証（AIが権限を正しく守れるか）
      └─ 問い3: 自然言語→SQL精度の計測

FY2026 2Q (要件定義)
  └─ 本番環境の詳細設計
      ├─ KPI定義のYAML移行計画（現行オントロジーから）
      ├─ 権限設計（行レベル + LLM経由制御）
      └─ コスト制御アーキテクチャ

FY2026 3Q-FY2027 (構築)
  └─ セマンティックレイヤー構築 + 問い4のフィードバック設計

2027/12 (リリース) → 2028/5 (介護システム刷新)
```

---

## まとめ: 読む順序

**Step 1**: このドキュメントのPart 1（3つの考え方）を理解 — 30分

**Step 2**: 必読資料の#1と#2を読む（レシピブックの思想とパターン）— 各30分

**Step 3**: Databricks派なら#3、Snowflake派なら#4を読む（具体的な実装）— 30分

**Step 4**: #5のdbt MetricFlowを読む（Foundryオントロジーの代替技術）— 30分

**Step 5**: Part 5のフレームワーク（4つの問い）を使って、PoC設計に着手
