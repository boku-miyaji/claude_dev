# LLM/AI基盤の設計に必要な知識体系

> 作成日: 2026-03-03 | 目的: Foundry移行先の新環境で「LLM/AI基盤」を正しく設計するために、何を読み・何を考えるべきかを整理する

---

## Part 1: まず押さえるべき「大きな考え方」3つ

細かい機能比較の前に、**設計判断の軸になる3つのパラダイム**を理解する必要がある。

### 考え方①: Compound AI System（複合AIシステム）

**一言で**: LLMは単体で使うものではない。複数のコンポーネントを組み合わせて「システム」として動かす。

```
❌ 古い考え方: 「どのLLMを使うか？」（モデル選定の話）
✅ 新しい考え方: 「LLMをどう組み合わせて、信頼できるシステムにするか？」

Compound AI System の構成要素:
┌─────────────────────────────────────────────────┐
│                                                 │
│  ユーザーの質問                                   │
│       │                                         │
│       ▼                                         │
│  [ルーター] → 質問の種類を判定                     │
│       │                                         │
│       ├→ [セマンティックレイヤー] → KPI定義を参照   │
│       ├→ [検索エンジン] → 関連データを取得          │
│       ├→ [LLM] → SQL生成 or 解釈                 │
│       ├→ [バリデーター] → 生成SQLの安全性チェック    │
│       └→ [キャッシュ] → 同じ質問の再利用           │
│                                                 │
│  → 最終回答（信頼度レベル付き）                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

**なぜ重要か**: RFIベンダーは「うちのLLM機能すごい」と言うが、実際に1,000施設×数千人が使うには**LLM単体ではなくシステム全体の設計**が必要。Databricks GenieもSnowflake Cortex Analystも、内部はCompound AI Systemになっている。

**参考資料**:
- [Databricks AI/BI Genie](https://docs.databricks.com/aws/en/genie/) — Compound AI Systemの実装例。複数のエージェントが協調して自然言語→SQL→結果を返す
- [Databricks AI/BI Genie Blog](https://www.databricks.com/blog/aibi-genie-now-generally-available) — Genieの内部アーキテクチャ詳細

---

### 考え方②: Semantic Layer（セマンティックレイヤー）= LLMと人間の「共通言語」

**一言で**: LLMにデータを触らせるなら、「稼働率とは何か」「離職率の計算式は何か」をコードで定義した層が必須。

```
❌ LLMに生テーブルを渡す
   → 「稼働率」の定義を知らないから、毎回違うSQLを生成する
   → ハルシネーションの温床

✅ セマンティックレイヤーを挟む
   → 「稼働率 = 入居者数 / 定員 × 100」がYAML/コードで定義済み
   → LLMはこの定義を参照してSQLを生成する
   → 誰が聞いても同じ答えが返る
```

**3つのアーキテクチャパターン**:

| パターン | 代表例 | 特徴 |
|---|---|---|
| **Warehouse-Native** | Snowflake Semantic Views, Databricks Unity Catalog | DWH内にセマンティック定義を保持。権限管理がシームレス |
| **Transformation-Layer** | dbt MetricFlow | コード（YAML）で定義。Git管理可能。DWH非依存 |
| **OLAP-Acceleration** | Cube.dev | キャッシュ層として動作。高速だがもう一層増える |

**2025-2026の動向**:
- dbt LabsがMetricFlowをApache 2.0でオープンソース化（Coalesce 2025）
- SnowflakeがOpen Semantic Interchange (OSI)を提唱 — ベンダー横断のメトリクス標準
- セマンティックレイヤー + LLMで**精度83%→99.8%**に向上するという報告あり

**なぜ重要か**: Foundryの「オントロジー」はまさにこのセマンティックレイヤーだった。移行先でこれを**ゼロから作り直す**ことになる。dbt MetricFlowかDWH-Nativeか、設計判断が必要。

**参考資料**:
- [Semantic Layer as Data Interface for LLMs (dbt Labs)](https://www.getdbt.com/blog/semantic-layer-as-the-data-interface-for-llms) — **最重要文献**。LLMにデータを触らせる際のセマンティックレイヤーの役割
- [Semantic Layer Architectures: MetricFlow vs Snowflake vs Databricks](https://www.typedef.ai/resources/semantic-layer-metricflow-vs-snowflake-vs-databricks) — 3パターンの比較
- [Semantic Layer 2025 in Review (AtScale)](https://www.atscale.com/blog/semantic-layer-2025-in-review/) — 業界全体の動向
- [Snowflake Cortex Analyst Semantic Model Spec](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst/semantic-model-spec) — YAML定義の具体例
- [How we design our semantic engine for LLMs (Wren AI)](https://medium.com/wrenai/how-we-design-our-semantic-engine-for-llms-84a00e6e3baa) — 設計思想の参考

---

### 考え方③: Governance as Code（ガバナンスの自動化）

**一言で**: LLM時代のガバナンスは「ルールブック」ではなく「コードで強制する仕組み」。

```
❌ 古い考え方: 「データ利用ルールを文書化して周知」
✅ 新しい考え方: 「ルールをコード/設定として実装し、技術的に破れなくする」

ガバナンスの3層:
┌─────────────────────────────────────────────┐
│ Layer 1: アクセス制御                         │
│   行レベルセキュリティ + カラムマスキング       │
│   → LLM経由でもユーザー権限を継承             │
├─────────────────────────────────────────────┤
│ Layer 2: セマンティック制御                    │
│   KPI定義の一元管理 + 変更承認フロー           │
│   → 「稼働率」の定義を勝手に変えられない       │
├─────────────────────────────────────────────┤
│ Layer 3: 実行制御                             │
│   クエリ複雑度制限 + コスト上限 + 監査ログ     │
│   → LLMが暴走しても被害を限定               │
└─────────────────────────────────────────────┘
```

**2026年のトレンド**:
- **AIエージェントのガードレール**: エージェントがデータを書き換える前のチェック機構
- **データコントラクト**: エージェントが「何を許されているか」を明文化
- **自動リネージ**: AIがどのデータを使ってどの結論に至ったかの追跡

**なぜ重要か**: 1,000施設の現場スタッフがLLMで自由に分析する世界では、「使い方を教育する」だけでは不十分。技術的に壊せない仕組みが必要。

**参考資料**:
- [2026 Predictions: Architecture, Governance, and AI Trends (Cloudera)](https://www.cloudera.com/blog/business/2026-predictions-the-architecture-governance-and-ai-trends-every-enterprise-must-prepare-for.html) — エンタープライズAIガバナンスの全体像
- [5 Data Infrastructure Shifts That Will Define Enterprise AI in 2026](https://techarena.ai/content/5-data-infrastructure-shifts-that-will-define-enterprise-ai-in-2026) — AIエージェントのガードレール設計
- [Unified AI and Semantic Reuse, Governed at Scale (2026)](https://www.strategysoftware.com/blog/january-2026-unified-ai-and-semantic-reuse-governed-at-scale) — ガバナンスとセマンティックレイヤーの統合

---

## Part 2: 具体的な技術選定で読むべき資料

### DWH/データ基盤 — Databricks vs Snowflake

本PJTでは Databricks (Deloitte/Fujitsu案) vs Snowflake (Hitachi案) が主な選択肢。

| 比較軸 | Databricks | Snowflake |
|---|---|---|
| LLM統合 | AI-BI Genie（Compound AI System） | Cortex Analyst + Cortex Code |
| セマンティックレイヤー | Unity Catalog（メタデータ管理） | Semantic Views（RBAC統合） |
| ガバナンス | Unity Catalog | Horizon（アクセスポリシー） |
| 自然言語→SQL | Genie（マルチエージェント） | Cortex Analyst（マルチLLM協調） |
| コスト体系 | DBU（演算単位課金） | クレジット（クエリ課金） |
| ML/AI | MLflow + Mosaic AI | Cortex ML + Snowpark |
| MCP対応 | あり | あり |

**読むべき資料**:
- [Databricks AI/BI Genie](https://docs.databricks.com/aws/en/genie/) — 自然言語分析の実装
- [Databricks AI/BI 2026 Updates](https://www.databricks.com/blog/whats-new-aibi-february-2026-roundup) — 最新機能（Inspect Mode, Agentic Dashboard等）
- [Snowflake Cortex Analyst](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst) — セマンティックモデルベースの自然言語SQL
- [Snowflake Cortex Code Guide (2026)](https://seemoredata.io/blog/snowflake-cortex-code-complete-guide-to-features-pricing-implementation-2026/) — エージェント構築・セマンティックビュー自動生成

---

### セマンティックレイヤー — dbt MetricFlow

Foundryオントロジーの移行先として**最有力**。

```yaml
# dbt MetricFlowの定義例
semantic_models:
  - name: facility_occupancy
    description: "施設稼働率"
    model: ref('fct_facility_daily')
    entities:
      - name: facility
        type: primary
        expr: facility_id
    measures:
      - name: occupancy_rate
        description: "稼働率 = 入居者数 / 定員 × 100"
        agg: derived
        expr: "resident_count / capacity * 100"
```

**読むべき資料**:
- [dbt Semantic Layer](https://docs.getdbt.com/docs/use-dbt-semantic-layer/dbt-sl) — 概要
- [MetricFlow (GitHub)](https://github.com/dbt-labs/metricflow) — OSS版のコードと仕様
- [Open Source MetricFlow Announcement (dbt Labs)](https://www.getdbt.com/blog/open-source-metricflow-governed-metrics) — Apache 2.0化の背景と設計思想

---

### MCP（Model Context Protocol）

LLMが外部データに安全にアクセスするためのプロトコル。2025-2026の**業界標準**になりつつある。

```
Claude / GPT / Gemini
       │
       ▼
   MCP Protocol
       │
       ├→ dbt Semantic Layer（KPI定義を取得）
       ├→ DWH（SQLを実行）
       ├→ データカタログ（テーブル情報を取得）
       └→ 権限チェック（ユーザー権限を確認）
```

**なぜ重要か**: 将来、社内でClaude DesktopやCursor等のLLMクライアントからデータにアクセスする際、MCPが標準的なインターフェースになる。RFP要件に入れるべき。

**読むべき資料**:
- [The Ultimate Guide to Semantic Layers for AI (PromptQL)](https://promptql.io/blog/the-ultimate-guide-to-semantic-layers-for-ai) — MCPとセマンティックレイヤーの関係
- dbt MCP Server（GA, Coalesce 2025） — dbtのセマンティックレイヤーをMCP経由でLLMに公開

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
| **CareBase移行パターン別検討** | データソース変更の影響。2028年の断絶リスク | ★★★ |
| **Foundry環境及び新環境要件** | 現行のオントロジー・権限構造の理解 | ★★★★ |

### 自チーム作成ドキュメント

| 資料 | 用途 |
|---|---|
| [06_rfi_ai_engineer_analysis.md](06_rfi_ai_engineer_analysis.md) | AIエンジニア視点での技術比較。パイプライン移行リスク |
| [07_llm_native_data_platform.md](07_llm_native_data_platform.md) | LLMネイティブ基盤の設計方針。ガバナンス・コスト管理 |

---

## Part 4: 外部で読むべき資料（優先度順）

### 必読（設計判断に直結）

| # | タイトル | 何がわかるか |
|---|---|---|
| 1 | [Semantic Layer as the Data Interface for LLMs (dbt Labs)](https://www.getdbt.com/blog/semantic-layer-as-the-data-interface-for-llms) | LLMにデータを触らせる際の**最も基本的な設計思想** |
| 2 | [Semantic Layer Architectures: MetricFlow vs Snowflake vs Databricks](https://www.typedef.ai/resources/semantic-layer-metricflow-vs-snowflake-vs-databricks) | 3つのアーキテクチャパターンの比較と選定基準 |
| 3 | [Databricks AI/BI Genie (公式Doc)](https://docs.databricks.com/aws/en/genie/) | Compound AI Systemの具体的な実装。PoC設計の参考 |
| 4 | [Snowflake Cortex Analyst (公式Doc)](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst) | セマンティックモデル定義の具体例。YAML仕様 |
| 5 | [Open Source MetricFlow (dbt Labs)](https://www.getdbt.com/blog/open-source-metricflow-governed-metrics) | Foundryオントロジーの代替として最有力の技術 |

### 推奨（視座を広げる）

| # | タイトル | 何がわかるか |
|---|---|---|
| 6 | [State of Data Mesh in 2026 (Thoughtworks)](https://www.thoughtworks.com/insights/blog/data-strategy/the-state-of-data-mesh-in-2026-from-hype-to-hard-won-maturity) | Data Meshの現実。ドメイン分散型データ管理の教訓 |
| 7 | [2026 Predictions: Architecture, Governance, AI (Cloudera)](https://www.cloudera.com/blog/business/2026-predictions-the-architecture-governance-and-ai-trends-every-enterprise-must-prepare-for.html) | エンタープライズAIガバナンスの2026年トレンド |
| 8 | [5 Data Infrastructure Shifts for Enterprise AI 2026](https://techarena.ai/content/5-data-infrastructure-shifts-that-will-define-enterprise-ai-in-2026) | AIエージェントのガードレール設計パターン |
| 9 | [Data Engineering Trends 2026 for AI-Driven Enterprises (Trigyn)](https://www.trigyn.com/insights/data-engineering-trends-2026-building-foundation-ai-driven-enterprises) | リアルタイムデータ処理とAIの統合 |
| 10 | [The Ultimate Guide to Semantic Layers for AI (PromptQL)](https://promptql.io/blog/the-ultimate-guide-to-semantic-layers-for-ai) | MCPとセマンティックレイヤーの連携パターン |

---

## Part 5: 「大きな考え方」のフレームワーク

### 設計判断フレームワーク: 4つの問い

新環境のLLM/AI基盤を設計する際、以下の4つの問いに答えられる状態を目指す:

```
問い1: LLMは「何を知っている」べきか？
  → セマンティックレイヤーの設計
  → KPI定義、テーブル関係、ビジネスルール
  → Foundryオントロジーから何を引き継ぐか

問い2: LLMは「何をしていい」か？
  → ガバナンスの設計
  → SELECT only? DDL/DMLも？
  → ユーザー権限の継承方法
  → コスト上限

問い3: LLMの答えは「どこまで信じていい」か？
  → 信頼度レベルの設計
  → 公式KPI（確定）vs アドホック分析（要検証）
  → LLM生成SQLの可視化・レビューフロー

問い4: LLMの答えを「どう育てる」か？
  → フィードバックループの設計
  → よくある質問の定型化
  → セマンティックモデルの継続的改善
  → 精度モニタリング
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
  └─ LLM/AI基盤の設計判断
      ├─ セマンティックレイヤーのアーキテクチャ選定
      ├─ 自然言語→SQL精度の比較検証
      └─ ガバナンス設計の骨子

FY2026 2Q (要件定義)
  └─ LLM/AI基盤の要件確定
      ├─ KPI定義のYAML移行計画（現行オントロジーから）
      ├─ 権限設計（行レベル + LLM経由制御）
      └─ コスト制御アーキテクチャ

FY2026 3Q-FY2027 (構築)
  └─ セマンティックレイヤー構築
      ├─ dbt MetricFlow or DWH-Nativeでメトリクス定義
      ├─ MCP対応
      └─ LLMエージェントのガードレール実装

2027/12 (リリース)
  └─ LLMネイティブ分析基盤の本番稼働

2028/5 (介護システム刷新)
  └─ 新データソースの自動連携
      └─ セマンティックレイヤーの拡張
```

---

## まとめ: 読む順序

**Step 1**: まずこのドキュメントのPart 1（3つの大きな考え方）を理解する

**Step 2**: 必読資料の#1と#2を読む（セマンティックレイヤーの基本思想とアーキテクチャパターン）

**Step 3**: Databricks派なら#3、Snowflake派なら#4を読む（具体的な実装）

**Step 4**: #5のdbt MetricFlow/OSS化を読む（Foundryオントロジーの代替技術）

**Step 5**: Part 5のフレームワーク（4つの問い）を使って、PoCの設計に落とし込む
