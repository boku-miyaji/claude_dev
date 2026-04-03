# データ基盤プラットフォーム最新比較調査 (2025-2026)

- **ステータス**: completed
- **調査日**: 2026-04-01
- **PJ会社**: foundry (SOMPOケア新分析環境構築PJT)
- **調査チーム**: 技術調査

---

## 目次

1. [メジャープラットフォーム比較](#1-メジャープラットフォーム比較)
2. [新興・注目プラットフォーム](#2-新興注目プラットフォーム)
3. [技術比較マトリクス](#3-技術比較マトリクス)
4. [クラウド連携マトリクス](#4-クラウド連携マトリクス)
5. [データ基盤間の相互運用](#5-データ基盤間の相互運用)
6. [権限管理設計](#6-権限管理設計)
7. [加工コード管理（発散防止）](#7-加工コード管理発散防止)
8. [運用体制・FinOps](#8-運用体制finops)
9. [限界の明示](#9-限界の明示)
10. [壁打ち導線（SOMPOケアFoundry移行コンテキスト）](#10-壁打ち導線)

---

## 1. メジャープラットフォーム比較

### 1.1 Palantir Foundry

**現状と最新動向**

Palantir Foundryは依然として政府・防衛・大企業向けの統合データプラットフォームとして確固たるポジションを維持している。2025年には米国防総省、財務省、保健福祉省、BPなどのミッションクリティカル環境で稼働実績がある。

**Databricksとの戦略的提携（2025年3月発表）**

2025年3月、PalantirとDatabricksは戦略的プロダクトパートナーシップを発表した。主要な統合内容は以下の通り。

| 統合機能 | 詳細 |
|----------|------|
| **双方向データアクセス** | Databricks Unity Catalogを統一ガバナンスレイヤーとし、FoundryがDatabricksテーブルを「Virtual Tables」として直接登録。物理的なデータ移動なしにアクセス可能 |
| **External Pipelines** | Pipeline Builderからサードパーティコンピュートエンジン（Databricksが最初のプロバイダー）を利用可能。PythonトランスフォームやノーコードのPipeline Builder経由でDatabricksにコンピュートをプッシュダウン |
| **モデル連携** | Databricksで学習・登録されたモデルをFoundryのOntologyに直接登録し、運用アプリケーションにデプロイ可能 |

**移行時の課題**

- **独自Ontologyのロックイン**: ビジネス定義がプロプライエタリなOntologyに蓄積されており、移行コストが高い。データだけでなく「データの意味」も移行対象となる
- **セマンティックドリフトリスク**: 組織知識が定義やリレーションシップに内包されており、生データの移行だけでは不十分
- **プラットフォームエンジニアリング依存**: Ontologyベースシステムは専門エンジニアの維持が必要
- **高TCO**: ライセンスコストが高く、狭いユースケースでは費用対効果が低い

> ソース:
> - [Palantir-Databricks Partnership](https://www.databricks.com/company/newsroom/press-releases/palantir-and-databricks-announce-strategic-product-partnership)
> - [Palantir Partnerships](https://www.palantir.com/partnerships/databricks/)
> - [Palantir Foundry Alternatives 2026](https://www.digetiers-dap.com/post/palantir-foundry-alternatives)
> - [Palantir November 2025 Announcements](https://www.palantir.com/docs/foundry/announcements/2025-11)

---

### 1.2 Databricks

**Lakehouse アーキテクチャ**

Databricksは「Data Intelligence Platform」としてレイクハウスアーキテクチャを更に進化させている。2025年のData + AI Summitでは複数の重要な発表があった。

**Unity Catalog OSS化と進化**

| 機能 | ステータス | 詳細 |
|------|-----------|------|
| Iceberg REST Catalog API | GA（読み取り）/ Preview（書き込み） | 外部エンジン（Trino, Snowflake, Amazon EMR等）からUnity Catalog管理のIcebergテーブルへのアクセス |
| Iceberg Managed Tables | Public Preview | Liquid Clustering, Predictive Optimization, 外部エンジンとの完全統合 |
| Delta Lake UniForm | GA | Delta Lakeテーブルに対しIceberg/Hudiメタデータを自動生成。データの書き換え不要 |

**Serverless**

| 機能 | ステータス |
|------|-----------|
| Serverless SQL Warehouses | GA |
| Serverless Compute for Jobs | GA |
| JAR jobs on Serverless | GA |
| Serverless Workspaces | Public Preview |
| Declarative Pipelines (旧DLT) | GA（Serverless ETL） |

**AI/ML統合**

| 機能 | ステータス |
|------|-----------|
| Mosaic AI Vector Search | GA |
| Vector Search Reranker | GA |
| Mosaic AI Model Serving | GA |
| Mosaic AI Agent Framework | GA |

> ソース:
> - [Unity Catalog at Data + AI Summit 2025](https://www.databricks.com/blog/whats-new-databricks-unity-catalog-data-ai-summit-2025)
> - [Data + AI Summit 2025 Product Drops](https://www.flexera.com/blog/finops/databricks-data-ai-summit-2025/)
> - [Delta Lake UniForm GA](https://www.databricks.com/blog/delta-lake-universal-format-uniform-iceberg-compatibility-now-ga)
> - [Databricks Release Notes December 2025](https://docs.databricks.com/aws/en/release-notes/product/2025/december)

---

### 1.3 Snowflake

**Cortex AI**

Snowflakeは6,100以上のアカウントがCortex AIを利用してAIアプリケーションを構築している（2025年末時点）。

| 機能 | 詳細 |
|------|------|
| Cortex AISQL | マルチモーダルデータからのインサイト抽出、SQLベースのAIパイプライン構築 |
| ネイティブLLM | Anthropic Claude, OpenAI, Google, Meta, Mistral AIモデルをCortex内でネイティブ利用可能 |
| Anthropic提携 | 2億ドル規模の拡大パートナーシップ（2025年後半）。ClaudeがSnowflakeのネイティブ推論エンジンに |

**Apache Polaris（Iceberg）**

- Apache Polarisは2025年7月に1.0.0-incubatingをリリース、**2026年2月にApache Top-Level Projectに昇格**
- Snowflake管理のIcebergテーブルがApache Polaris互換のREST Catalog APIを公開
- 外部エンジン（Spark, Trino等）がSnowflake Icebergテーブルに直接アクセス可能
- Iceberg v3サポート（Read/Write）

**Snowpark Container Services (SPCS)**

| 項目 | 詳細 |
|------|------|
| 可用性 | AWS GA, Azure GA (2025/2), GCP GA (2025/8) |
| GPU対応 | 高メモリインスタンス、動的GPU割り当て |
| ワークロードモデル | 長時間サービス / バッチジョブ / SQL連携関数の3種 |
| MLモデルサーブ | SPCS Model ServingによるスケーラブルなCPU/GPU推論 |

> ソース:
> - [Snowflake Cortex AISQL](https://www.snowflake.com/en/news/press-releases/snowflake-introduces-cortex-aisql-and-snowconvert-ai-analytics-rebuilt-for-the-ai-era/)
> - [Snowflake Agentic AI](https://blocksandfiles.com/2025/11/05/snowflakes-agentic-ai-news-assault/)
> - [Apache Polaris Graduates](https://www.globenewswire.com/news-release/2026/02/19/3240735/0/en/apache-polaris-graduates-to-top-level-apache-project.html)
> - [SPCS Overview](https://docs.snowflake.com/en/developer-guide/snowpark-container-services/overview)
> - [SPCS 101](https://www.flexera.com/blog/finops/snowpark-container-services/)

---

### 1.4 Microsoft Fabric

**成熟度の変化**

FabCon 2026（2026年3月開催）では、Fabricの成熟度について顕著な変化が見られた。2025年時点ではワークロードやスケールに関する制約の注意書きが多かったが、2026年にはそれらがほぼ不要になった。**本番環境での大規模運用がワークアラウンドなしで可能なレベルに到達している**。

**OneLake**

| 機能 | ステータス | 詳細 |
|------|-----------|------|
| OneLake Security | Public Preview | レイクレベルの一元的データアクセス管理（行/列レベル制御） |
| Sparkノートブック、SQLエンドポイント、Excel Online、Direct Lakeセマンティックモデル | 自動セキュリティ適用 | OneLake Securityで設定したポリシーが自動的に各エンジンに適用 |
| ショートカット | GA | Azure, AWS, GCP, Oracle, SAP, Dataverse, Snowflake, Databricks等のデータをデータ移動なしに接続 |
| Catalog Mirroring | Preview | Unity CatalogのテーブルをOneLakeにショートカットとしてミラーリング |

**Direct Lake**

OneLakeアーキテクチャが有効化する機能。Delta Parquetファイルを直接OneLakeから読み取り、Power BIのインメモリエンジンへのインポートやリアルタイムクエリ実行を不要にする。

**Copilot統合**

- Copilotがレイクハウスレイヤーまで拡張され、OneLake上のテーブルに対する探索をサポート
- **全有料SKU（F64以上に限定されない）でFabric CopilotとAI機能が利用可能に**

**Databricksとの相互運用**

- Azure Databricksから OneLakeのネイティブ読み取りが Public Preview（2025年末〜2026年）
- DatabricksからOneLakeへの書き込み機能のタイムラインがFabCon 2026で公表予定
- Unity CatalogテーブルのCatalog Mirroringによるシームレスなデータ共有

> ソース:
> - [FabCon 2026 Insights](https://www.journeyteam.com/resources/blog/from-promise-to-maturity-microsoft-fabric-insights-from-fabcon-2026/)
> - [OneLake Security Preview](https://blog.fabric.microsoft.com/en-us/blog/onelake-security-is-now-available-in-public-preview)
> - [FabCon 2026 OneLake Updates](https://blog.fabric.microsoft.com/en-us/blog/fabcon-and-sqlcon-2026-whats-new-in-microsoft-onelake/)
> - [Microsoft + Databricks Interop](https://blog.fabric.microsoft.com/en-us/blog/microsoft-and-databricks-advancing-openness-and-interoperability-with-onelake)
> - [Fabric November 2025 Feature Summary](https://blog.fabric.microsoft.com/en-us/blog/fabric-november-2025-feature-summary)

---

## 2. 新興・注目プラットフォーム

### 2.1 Dremio

Apache Icebergエコシステムの中核プレイヤー。

| 項目 | 詳細 |
|------|------|
| **コアアーキテクチャ** | Apache Iceberg中心のレイクハウスエンジン |
| **Built-in Open Catalog** | 本番グレードのIcebergカタログ。自動パフォーマンス管理、Autonomous Reflections、タイムトラベル、ブランチング、フルDMLサポート |
| **Arrow Flight** | JDBC/ODBCの10-100倍高速なデータ転送 |
| **クラウド対応** | AWS, Azure, GCP（マネージドサービス） |
| **特徴** | セルフサービスデータ分析、データ仮想化に強み |

> ソース:
> - [Dremio Open Catalog](https://datalakehousehub.com/blog/2026-03-dremio-open-catalog/)
> - [2025 Year in Review](https://datalakehousehub.com/blog/2025-12-2025-year-in-review-iceberg-arrow-polaris-parquet/)

### 2.2 StarRocks / Apache Doris

両者はリアルタイム分析特化のMPPデータベース。元々同じコードベースから分岐。

| 比較項目 | StarRocks | Apache Doris |
|----------|-----------|--------------|
| **起源** | Dorisからフォーク（PMCメンバーが離脱） | 元のプロジェクト |
| **コード書き換え** | 元コードの約90%を書き換え | 元コードベースを継続発展 |
| **オプティマイザ** | 新規開発のCBO（Cost Based Optimizer） | CBOを導入 |
| **最新バージョン** | v4.0（2025年10月）: TPC-DSで前年比60%高速化 | 継続的なリリース |
| **Iceberg対応** | v4.0で大幅強化 | Iceberg読み取りサポート |
| **JSON処理** | ファーストクラスデータ型、3-15倍高速化 | JSONサポート |
| **プロトコル互換** | MySQL互換 | MySQL互換 |
| **適用領域** | 低レイテンシ分析、ダッシュボード、顧客向けアプリ | ログ分析、リアルタイムレポート |

> ソース:
> - [StarRocks 2025 Year in Review](https://www.starrocks.io/blog/starrocks-2025-year-in-review)
> - [StarRocks vs Doris Comparison](https://medium.com/starrocks-engineering/detailed-comparison-between-starrocks-and-apache-doris-81ddd34be527)
> - [OLAP databases 2026](https://www.tinybird.co/blog/best-database-for-olap)

### 2.3 DuckDB / MotherDuck

| 項目 | DuckDB | MotherDuck |
|------|--------|------------|
| **タイプ** | インプロセス分析DB（SQLite的位置づけ） | DuckDBのクラウドマネージド版 |
| **最新版** | v1.4.0 "Andium" | 継続的リリース |
| **主要機能** | AES-256-GCM暗号化、MERGE文、Iceberg書き込み、1TB/30秒処理 | Dual Execution（ローカル+クラウド）、AI Dives |
| **PostgreSQL統合** | pg_duckdb 1.0（PostgreSQLにOLAP分析追加） | PlanetScale Postgres統合（200倍高速化） |
| **空間処理** | R-tree インデックスで58倍高速化 | - |
| **AI統合** | - | Remote MCP Server、95%超のText-to-SQL精度 |
| **用途** | ローカル分析、CI/CDパイプライン、開発環境 | チーム分析、顧客向けアナリティクス |

> ソース:
> - [DuckDB Ecosystem March 2026](https://motherduck.com/blog/duckdb-ecosystem-newsletter-march-2026/)
> - [DuckDB Ecosystem January 2026](https://motherduck.com/blog/duckdb-ecosystem-newsletter-january-2026/)
> - [MotherDuck Architecture](https://motherduck.com/docs/concepts/architecture-and-capabilities/)

### 2.4 Apache XTable (Incubating)

| 項目 | 詳細 |
|------|------|
| **旧称** | OneTable |
| **機能** | Delta Lake / Iceberg / Hudi間のメタデータ変換（データコピー不要） |
| **方式** | 既存メタデータを読み取り、他フォーマットのメタデータを生成（`_delta_log`, `metadata`, `.hoodie`） |
| **最新機能** | CatalogSyncClient/CatalogSync インターフェース、Glue/HMSカタログ同期、継続同期（RunSync）、リストア/ロールバック同期 |
| **位置づけ** | フォーマットロックイン回避の保険的ツール。UniFormやネイティブIceberg対応の広がりにより、直接的な需要は限定的になりつつある |

> ソース:
> - [Apache XTable Official](https://xtable.apache.org/)
> - [XTable GitHub Releases](https://github.com/apache/incubator-xtable/releases)
> - [Dremio XTable Guide](https://www.dremio.com/blog/apache-xtable-converting-between-apache-iceberg-delta-lake-and-apache-hudi/)

### 2.5 その他注目プラットフォーム

| プラットフォーム | 特徴 | 2025-2026動向 |
|----------------|------|---------------|
| **ClickHouse Cloud** | 列指向OLAP、低レイテンシ。自己管理or Cloud版。フルテーブルスキャンや文字列操作に強い | SQL互換性が限定的、チューニングに専門知識必要。エンジニアリング主導のユースケース向き |
| **Firebolt** | ClickHouseフォーク、フルマネージドクラウドDWH。コンピュート・ストレージ分離 | 2026ベンチマークでClickHouseの約3倍高速（TPC-DS相当）。高カーディナリティ集計に強み |
| **Starburst / Trino** | クエリフェデレーション。複数データソースへのin-placeクエリ | Icebergとの統合深化。Databricks Unity CatalogのIceberg REST APIからのアクセスが可能に |

> ソース:
> - [Firebolt 2026 Benchmark](https://www.firebolt.io/blog/benchmark-of-cloud-data-warehouses-2026)
> - [ClickHouse Alternatives 2026](https://www.tinybird.co/blog/clickhouse-alternatives)
> - [Firebolt vs ClickHouse](https://www.firebolt.io/comparison/firebolt-vs-clickhouse)

---

## 3. 技術比較マトリクス

### 3.1 コンピュートモデル・課金体系

| プラットフォーム | コンピュートモデル | サーバーレス | 課金体系 | 月額目安（中規模） |
|----------------|------------------|-------------|---------|-----------------|
| **Databricks** | クラスタ/Serverless | GA | DBU単価 + クラウドインフラ（二重課金） | $15,000-25,000 |
| **Snowflake** | Virtual Warehouse | GA | Credit単価（$1.50-4.00）+ストレージ | $10,000-20,000 |
| **Fabric** | Capacity Unit | GA（一部） | 月額固定（F64: ~$5,000/月） | $5,000-15,000 |
| **Palantir Foundry** | 専用クラスタ | 非対応 | エンタープライズライセンス | 非公開（高額） |
| **Dremio** | クラスタ/Serverless | Preview | エンジン時間課金 | 要見積 |
| **StarRocks** | MPPクラスタ | 非対応（Cloud版あり） | ノード数/サイズ or マネージド課金 | 要見積 |
| **DuckDB/MotherDuck** | インプロセス/Cloud | MotherDuck: Yes | MotherDuck: ストレージ+コンピュート | $500-5,000 |

### 3.2 ストレージフォーマット

| プラットフォーム | ネイティブ | Iceberg | Delta Lake | Hudi |
|----------------|-----------|---------|------------|------|
| **Databricks** | Delta Lake | UniFormで読み取り公開 / Iceberg Managed Tables (Preview) | ネイティブ | UniFormで対応 |
| **Snowflake** | 独自（FDN） | Iceberg Tables GA + Polaris REST API | 読み取り可 | - |
| **Fabric** | Delta Lake (OneLake) | ショートカット経由 | ネイティブ | - |
| **Palantir Foundry** | 独自 | Databricks連携経由 | Databricks連携経由 | - |
| **Dremio** | - | ネイティブ（推奨） | 読み取り可 | 読み取り可 |
| **StarRocks** | 独自 | 読み取り（v4.0で強化） | 読み取り可 | 読み取り可 |
| **DuckDB** | - | 読み書き（v1.4.0） | 読み取り可 | - |

### 3.3 AI/ML統合度

| プラットフォーム | ネイティブML | LLM統合 | ベクトル検索 | 特記事項 |
|----------------|------------|---------|------------|---------|
| **Databricks** | Mosaic AI (GA) | Agent Framework, Model Serving | Vector Search (GA) + Reranker | 最も包括的。学習〜デプロイ〜モニタリングまで |
| **Snowflake** | Snowpark ML | Cortex AI（6,100+アカウント） | Cortex Search | Anthropic/OpenAIネイティブ統合 |
| **Fabric** | AzureML統合 | Copilot統合 | AI Skills (Preview) | Microsoft AIスタック全体との統合 |
| **Foundry** | AIP (Ontology統合) | AIP Logic (LLM推論) | - | Ontology × LLMの独自アプローチ |
| **Dremio** | - | - | - | 分析特化、ML機能は外部連携 |
| **DuckDB/MotherDuck** | - | MCP Server連携 | - | 軽量分析向け |

### 3.4 ガバナンス

| プラットフォーム | カタログ | 権限管理 | リネージ | データ品質 |
|----------------|---------|---------|---------|-----------|
| **Databricks** | Unity Catalog (OSS) | RBAC + 行/列レベル | テーブル/列レベル (GA) | Lakehouse Monitoring |
| **Snowflake** | Horizon Catalog + Polaris | RBAC + 行/列 + マスキング | Access History | Data Quality Monitoring |
| **Fabric** | OneLake Security | RBAC + 行/列レベル (Preview) | Purview統合 | Data Quality Rules |
| **Foundry** | Ontology | RBAC + オブジェクトレベル | パイプラインリネージ | 独自品質チェック |

### 3.5 オープン性・ロックイン度

| プラットフォーム | OSS貢献 | ロックイン度 | データポータビリティ |
|----------------|---------|------------|-------------------|
| **Databricks** | 高（Delta Lake, MLflow, Unity Catalog OSS） | 中（UniFormで軽減） | 高（Parquet + Delta/Iceberg） |
| **Snowflake** | 中（Polaris寄贈、Iceberg採用） | 中→低（Iceberg移行で改善中） | 中→高（Iceberg Tables GA） |
| **Fabric** | 低（Delta Lake採用だがMSエコシステム前提） | 高（Azure依存） | 中（Delta形式だがOneLake内） |
| **Foundry** | 低（プロプライエタリ） | **非常に高**（Ontology依存） | 低（独自フォーマット・セマンティクス） |
| **Dremio** | 高（Iceberg/Arrow/Polaris推進者） | 低 | 高（完全オープンフォーマット） |

---

## 4. クラウド連携マトリクス

### 4.1 クラウド対応状況

| プラットフォーム | AWS | Azure | GCP |
|----------------|-----|-------|-----|
| **Databricks** | ネイティブ（AWS上デプロイ） | ネイティブ（Azure Databricks） | ネイティブ（GCP上デプロイ） |
| **Snowflake** | ネイティブ | ネイティブ | ネイティブ |
| **Fabric** | ショートカットで接続 | **ネイティブ（Azure限定）** | ショートカットで接続 |
| **Foundry** | ネイティブデプロイ可 | ネイティブデプロイ可 | ネイティブデプロイ可 |
| **Dremio** | ネイティブ/マネージド | ネイティブ/マネージド | ネイティブ/マネージド |
| **StarRocks** | CelerData Cloud | マーケットプレイス | マーケットプレイス |
| **MotherDuck** | ネイティブ | Preview | Preview |

### 4.2 IAM/ID統合

| プラットフォーム | Azure AD (Entra ID) | AWS IAM | GCP IAM | Okta/SAML |
|----------------|--------------------|---------|---------|---------  |
| **Databricks** | ネイティブ (SCIM) | ネイティブ | ネイティブ | SAML/SCIM |
| **Snowflake** | ネイティブ (SCIM) | IAMフェデレーション | IAMフェデレーション | SAML/SCIM |
| **Fabric** | **完全ネイティブ** | - | - | Entra ID経由 |
| **Foundry** | SAML/SCIM | SAML/SCIM | SAML/SCIM | SAML/SCIM |

### 4.3 PrivateLink / VPC統合

| プラットフォーム | AWS PrivateLink | Azure Private Link | GCP Private Service Connect |
|----------------|----------------|--------------------|-----------------------------|
| **Databricks** | GA | GA | GA |
| **Snowflake** | GA | GA | GA |
| **Fabric** | Azure Private Link GA | **ネイティブ** | - |
| **Foundry** | サポート | サポート | サポート |
| **Dremio** | サポート | サポート | サポート |

### 4.4 マネージド vs セルフホスト

| プラットフォーム | マネージドサービス | セルフホスト |
|----------------|-----------------|------------|
| **Databricks** | フルマネージド（各クラウド） | 不可 |
| **Snowflake** | フルマネージド（各クラウド） | 不可 |
| **Fabric** | フルマネージド（Azure） | 不可 |
| **Foundry** | マネージド + オンプレ可 | 可能（Gov用途等） |
| **Dremio** | Dremio Cloud / セルフホスト | 可能 |
| **StarRocks** | CelerData Cloud / セルフホスト | 可能 |
| **DuckDB** | MotherDuck / ローカル | 可能（インプロセス） |

---

## 5. データ基盤間の相互運用

### 5.1 テーブルフォーマット間の相互運用

```
                    UniForm（自動メタデータ生成）
                   ┌─────────────────────────────┐
                   │                             │
              Delta Lake ◄──────────────────► Iceberg
                   │          XTable            │
                   │      （メタデータ変換）      │
                   └──────────► Hudi ◄──────────┘
```

| 方式 | 提供元 | 仕組み | 制約 |
|------|--------|--------|------|
| **Delta UniForm** | Databricks | Deltaテーブルに対しIceberg/Hudiメタデータを自動生成。単一コピーのParquetデータ | 書き込みはDelta側のみ。読み取り専用でIceberg互換 |
| **Apache XTable** | Apache (Incubating) | 既存メタデータを読み取り他フォーマットのメタデータを生成 | バッチ変換。リアルタイム同期は未対応 |
| **Iceberg REST Catalog** | 標準API | 各エンジンが共通APIでIcebergテーブルにアクセス | Iceberg中心のアプローチ |

**推測**: UniFormとIceberg REST Catalog APIの普及により、XTableの利用場面は主にHudiを含むレガシー環境の移行時に限定される方向にある。

### 5.2 Databricks <-> Snowflake データシェアリング

| 方式 | 詳細 |
|------|------|
| **Delta Sharing (Iceberg対応)** | DatabricksがIcebergフォーマットのDelta Sharingを発表。Snowflake側からIcebergテーブルとしてアクセス可能 |
| **Lakehouse Federation** | DatabricksからSnowflakeに対するフェデレーテッドクエリ（OAuth対応）。データ移動不要 |
| **Snowflake側からのアクセス** | Iceberg REST Catalog API経由でDatabricks Unity Catalogのテーブルを読み取り |

### 5.3 Fabric <-> Databricks 連携

| 方式 | ステータス | 詳細 |
|------|-----------|------|
| **OneLakeショートカット** | GA | DatabricksデータへのOneLakeからの参照（データ移動不要） |
| **Catalog Mirroring** | Preview | Unity CatalogテーブルをOneLakeにショートカットとしてミラーリング |
| **ネイティブOneLake読み取り** | Public Preview | DatabricksからOneLakeデータを直接読み取り |
| **OneLake書き込み** | 計画中 | DatabricksからOneLakeへの直接書き込み（FabCon 2026でタイムライン公表予定） |

### 5.4 Lakehouse Federation（Databricks）

Databricks Lakehouse Federationは以下のデータソースへのフェデレーテッドクエリをサポート。

- MySQL, PostgreSQL, Amazon Redshift, Snowflake, Microsoft SQL Server, Azure Synapse, Google BigQuery, 他のDatabricksワークスペース

> ソース:
> - [Lakehouse Federation](https://docs.databricks.com/aws/en/query-federation/)
> - [Federated Queries on Snowflake](https://docs.databricks.com/aws/en/query-federation/snowflake)
> - [Delta Sharing Iceberg](https://www.databricks.com/blog/announcing-first-class-support-iceberg-format-databricks-delta-sharing)
> - [Fabric + Databricks Interop](https://blog.fabric.microsoft.com/en-us/blog/microsoft-and-databricks-advancing-openness-and-interoperability-with-onelake)

---

## 6. 権限管理設計

### 6.1 権限モデルの比較

| プラットフォーム | 基本モデル | 行レベル | 列レベル | 動的マスキング | タグベースACL |
|----------------|-----------|---------|---------|--------------|-------------|
| **Databricks** | RBAC | GA | GA | GA | Unity Catalog Tags |
| **Snowflake** | RBAC + DAC | GA | GA | GA（動的データマスキング） | Tag-based Masking |
| **Fabric** | RBAC | Preview（OneLake Security） | Preview | Purview連携 | Sensitivity Labels |
| **Foundry** | RBAC（Ontologyオブジェクト単位） | オブジェクトレベル | オブジェクトレベル | 独自実装 | - |

### 6.2 IdP統合

全プラットフォームがSAML 2.0 / SCIM対応。Azure AD (Entra ID) / Okta / Ping Identity等の主要IdPと統合可能。Fabricは当然ながらEntra IDとの統合が最も深い。

### 6.3 介護・医療データ（要配慮個人情報）での設計パターン

**推奨アプローチ: RBAC + ABAC ハイブリッド**

医療・介護データを扱う場合、以下の階層的セキュリティが推奨される。

```
レイヤー1: RBAC（ベースライン）
  ├── 役割: データエンジニア / データアナリスト / 経営層 / 現場管理者
  └── 基本的なテーブル/ビューアクセス制御

レイヤー2: ABAC（動的制御）
  ├── ユーザー属性: 所属事業所、職種、資格
  ├── リソース属性: データ機密度（要配慮/一般/公開）
  ├── 環境属性: アクセス元ネットワーク、時間帯
  └── 例: 「介護事業所Aの管理者は、事業所Aの利用者データのみアクセス可」

レイヤー3: 行/列レベルセキュリティ
  ├── 行レベル: 事業所ID / 利用者担当者IDでフィルタ
  └── 列レベル: 氏名・住所等の要配慮項目をマスキング

レイヤー4: 動的データマスキング
  └── 分析用途では匿名化、運用用途ではフル表示
```

**要配慮個人情報の設計パターン**

| パターン | 実装方法 | 適用場面 |
|---------|---------|---------|
| **匿名化ビュー** | 要配慮列をハッシュ化/トークン化したビューを提供 | 分析・レポート用途 |
| **動的マスキング** | ユーザーロールに応じて同一テーブルの表示内容を変更 | 混在アクセス環境 |
| **データ分離** | 要配慮データを別スキーマ/テーブルに物理分離 | 規制遵守が最優先 |
| **監査ログ強化** | 全アクセスログを保持、定期レビュー | コンプライアンス |

> ソース:
> - [RBAC vs ABAC for Data Platforms](https://medium.com/@reliabledataengineering/rbac-vs-abac-for-data-platforms-what-actually-works-6386a8081144)
> - [Healthcare RBAC+ABAC](https://www.mdpi.com/1999-5903/17/6/262)
> - [RBAC vs ABAC Comparison](https://www.splunk.com/en_us/blog/learn/rbac-vs-abac.html)

---

## 7. 加工コード管理（発散防止）

### 7.1 ETLコード発散の典型的パターンとアンチパターン

| アンチパターン | 症状 | 対策 |
|-------------|------|------|
| **コピペETL** | 似たロジックが微妙に異なる形で増殖 | dbtモデルの共通化（マクロ/パッケージ） |
| **シャドウパイプライン** | 公式パイプライン外の非公式データ加工 | セルフサービス環境の提供 + ガバナンスレイヤー |
| **スキーマドリフト** | 上流変更が下流に伝播して障害 | データコントラクト + スキーマバリデーション |
| **環境間不整合** | dev/staging/prodでロジック不一致 | CI/CD + 環境分離 + dbt slim CI |
| **オーナー不明パイプライン** | 誰が管理しているか不明のジョブ | メタデータ管理 + オーナー必須タグ |

### 7.2 dbt によるモデル管理のベストプラクティス

```
models/
├── staging/          # ソースに最も近い層（1:1マッピング）
│   ├── stg_care_records.sql
│   └── stg_staff.sql
├── intermediate/     # ビジネスロジックの集約
│   ├── int_daily_care_summary.sql
│   └── int_staff_utilization.sql
├── marts/            # 消費者向け最終テーブル
│   ├── fct_care_events.sql
│   └── dim_facilities.sql
└── _sources.yml      # ソース定義 + freshness
```

**dbt データコントラクト**

dbt contracts はモデル出力がスキーマ・データ型・制約に合致するかを実体化前に検証する。違反時はdbt runが失敗する。

```yaml
models:
  - name: fct_care_events
    config:
      contract:
        enforced: true
    columns:
      - name: care_event_id
        data_type: string
        constraints:
          - type: not_null
          - type: unique
      - name: facility_id
        data_type: string
        constraints:
          - type: not_null
```

### 7.3 Gitフロー x データパイプラインの統合

```
feature branch
  ├── dbt model変更
  ├── CI: dbt build --select state:modified+ (slim CI)
  ├── CI: dbt test (単体テスト + データテスト)
  ├── CI: SQLFluff lint
  └── PR Review → merge to main

main branch
  ├── CD: dbt build (staging環境)
  ├── データ品質チェック
  └── 承認 → production deploy
```

### 7.4 メタデータ駆動開発（Metadata-driven ETL）

| 要素 | 実装 |
|------|------|
| **ソース定義** | YAML/JSONでソース接続・スキーマ・更新頻度を宣言的に定義 |
| **変換ルール** | テーブル定義に基づき変換ロジックを自動生成 |
| **カタログ連携** | Unity Catalog / Horizon Catalog と双方向同期 |
| **監視** | メタデータから自動的にデータ品質ルール・アラートを生成 |

### 7.5 データコントラクトの実装パターン

データコントラクトは、データプロデューサーとコンシューマー間のスキーマ・鮮度・信頼性に関する明示的な合意。

| レイヤー | ツール | 内容 |
|---------|--------|------|
| スキーマ契約 | dbt contracts / Protobuf / JSON Schema | 列名・型・制約の定義 |
| 品質契約 | dbt tests / Great Expectations / Soda | NULL率、値域、参照整合性 |
| SLA契約 | dbt source freshness / Airflow SLA | データ到着の遅延許容値 |
| セマンティック契約 | Semantic Layer (dbt Metrics) | ビジネス指標の定義 |

> ソース:
> - [dbt Data Contracts](https://medium.com/tech-with-abhishek/dbt-and-data-contracts-enabling-reliable-api-driven-analytics-e137f8a113b6)
> - [ETL Pipeline Best Practices](https://www.getdbt.com/blog/etl-pipeline-best-practices)
> - [Data Contracts Guide](https://soda.io/blog/guide-to-data-contracts)
> - [Data Integration 2025](https://www.getdbt.com/blog/data-integration)

---

## 8. 運用体制・FinOps

### 8.1 必要人材と体制（プラットフォーム別）

| プラットフォーム | 最小体制 | 推奨体制 | 必要スキル |
|----------------|---------|---------|-----------|
| **Databricks** | 2-3名 | 5-8名 | Spark/Python, Unity Catalog, MLOps, Terraform |
| **Snowflake** | 2-3名 | 4-6名 | SQL, dbt, Snowpark, FinOps |
| **Fabric** | 1-2名 | 3-5名 | Power BI, Spark, Azure管理 |
| **Foundry** | 3-5名（専門性要） | 5-10名 | Ontologyエンジニアリング, Palantir固有スキル |

**推測**: SOMPOケアの現行Foundry運用体制から他プラットフォームへ移行する場合、Foundry固有スキルからの転換期間（3-6ヶ月）とトレーニングコストを見込む必要がある。

### 8.2 コスト監視・最適化（FinOps）

| プラットフォーム | ネイティブFinOps機能 | サードパーティ連携 |
|----------------|--------------------|--------------------|
| **Databricks** | Account-level Usage Dashboard, Budgets API, Cost Alerts | Flexera, CloudHealth, Unravel |
| **Snowflake** | Resource Monitors, Usage Views, Cost Management UI | Keebo (自動最適化), Flexera, SELECT |
| **Fabric** | Capacity Metrics App, Azure Cost Management統合 | Azure Advisor |
| **Foundry** | 限定的（Palantir提供ダッシュボード） | - |

**コスト最適化の共通パターン**

1. **オートスケーリング/オートサスペンド**: アイドル時のコンピュート自動停止
2. **ストレージ最適化**: コンパクション、パーティショニング、キャッシュ戦略
3. **クエリ最適化**: クエリプラン分析、マテリアライズドビュー活用
4. **予約容量**: コミットメント割引（1年/3年）
5. **利用者別チャージバック**: 部門/チーム別のコスト可視化

### 8.3 障害対応・SLA設計

| 項目 | Databricks | Snowflake | Fabric |
|------|-----------|-----------|--------|
| **公表SLA** | 99.95% | 99.9%+ | Azure SLA準拠 |
| **DR** | マルチリージョンレプリケーション | データベースレプリケーション (GA) | OneLakeレプリケーション |
| **バックアップ** | Delta Time Travel (30日) | Time Travel + Fail-safe | Delta Time Travel |
| **モニタリング** | Databricks SQL Alerts, Workflows通知 | Alerts, Snowsight Dashboard | Azure Monitor統合 |

### 8.4 変更管理（パイプライン変更のデプロイメント）

| 要素 | 推奨パターン |
|------|------------|
| **バージョン管理** | Git（GitHub/GitLab）+ ブランチ戦略 |
| **CI/CD** | GitHub Actions / Azure DevOps / Databricks Asset Bundles |
| **テスト** | dbt test + カスタムデータ品質テスト + 統合テスト |
| **デプロイ** | Blue/Green or Rolling（ダウンタイムゼロ） |
| **ロールバック** | Delta/Iceberg Time Travel で即時復元 |
| **承認フロー** | PR Review → 自動テスト → 承認者レビュー → 本番デプロイ |

---

## 9. 限界の明示

### 確認できなかった点

| 項目 | 理由 | 精度向上に必要な情報 |
|------|------|---------------------|
| **Palantir Foundryの詳細ライセンス費用** | 非公開情報 | Palantir営業資料、現行契約条件 |
| **SOMPOケアの現行Foundry利用規模** | 非公開 | 現行の処理データ量、ユーザー数、パイプライン数 |
| **各プラットフォームの日本リージョン固有の制約** | 一部機能はUS-first | 各ベンダーの日本法人への確認 |
| **介護特有のデータモデル要件** | ドメイン固有知識が必要 | SOMPOケアの現行Ontologyモデル定義 |
| **RFI回答の各ベンダー提案内容** | 非公開 | RFI回答書 |
| **Fabricの介護・医療データでの実績** | 日本での大規模事例が限定的 | Microsoft Japan事例 |
| **FinOps詳細見積もり** | ワークロードプロファイル依存 | 現行の処理パターン、データ量、同時接続数 |

### 推測が含まれる部分

- **推測**: Foundryからの移行において、Ontologyのセマンティック再定義に3-6ヶ月のリスクバッファが必要
- **推測**: SOMPOケアの規模感ではDatabricks or Snowflakeが最有力候補。Fabricは Azure利用が前提の場合に検討対象
- **推測**: 介護データの要配慮個人情報対応では、Snowflakeの動的マスキング機能またはDatabricksの行/列レベルセキュリティが最も成熟

---

## 10. 壁打ち導線

### SOMPOケアのFoundry移行コンテキストでの示唆

**結論**: 2025-2026年のデータ基盤市場は「オープンフォーマット収束」と「AI統合競争」の2軸で急速に変化している。Foundryからの移行先としては、Databricks / Snowflake / Microsoft Fabricが三大候補であり、それぞれ明確なトレードオフがある。

| 観点 | Databricks | Snowflake | Fabric |
|------|-----------|-----------|--------|
| Foundry移行の容易さ | 中（提携あるが独自実装必要） | 中 | 中-低 |
| AI/ML統合 | 最も充実 | 充実（Cortex AI） | Azure AI統合 |
| オープン性 | 高 | 中→高 | 低（Azure依存） |
| TCO予測性 | 低（二重課金） | 中 | 高（固定容量） |
| 日本サポート | 強い | 強い | 最も強い |
| Ontology代替 | Unity Catalog + カスタム | Horizon + カスタム | Purview + カスタム |

### ネクストアクション

1. **RFP評価基準にオープンフォーマット対応を必須項目として含める** -- Iceberg/Deltaの読み書き能力は移行後の柔軟性を左右する
2. **Ontologyの棚卸し** -- 現行Foundryで構築されたOntologyの定義・関係性を文書化し、移行先での再実装計画を策定
3. **PoC設計では「権限管理 x 要配慮個人情報」シナリオを必須評価項目に** -- 介護データ特有の要件をベンダー間で比較
4. **FinOps見積もりのためのワークロードプロファイリング** -- 現行の処理パターンを定量化し、各プラットフォームでのTCO試算に使用

### 壁打ちの問いかけ例

- 「現行Foundryで最も価値を生んでいるOntologyのドメインはどこか。移行後もそのセマンティクスを維持する必要があるか？」
- 「SOMPOケアのクラウド戦略はAzure中心か、マルチクラウドか。Fabricが候補になるか否かはここで決まる」
- 「AI開発の『将来像』はどの程度具体的か。MLモデルの学習まで必要か、推論（LLM API呼び出し）で十分か」
- 「RFIでDatabricks/Snowflake/Fabric以外のベンダーから提案は来ているか。Dremioのような新興勢力は検討対象か」
- 「現行のデータパイプライン数と複雑度はどの程度か。dbt導入の妥当性判断に直結する」
- 「要配慮個人情報の現行管理方式は。Foundry独自の権限モデルから標準的なRBAC+ABACへの移行設計が必要になる」

---

## ソース一覧

### Palantir / Databricks提携
- [Palantir-Databricks Partnership Press Release](https://www.databricks.com/company/newsroom/press-releases/palantir-and-databricks-announce-strategic-product-partnership)
- [Palantir Partnerships Page](https://www.palantir.com/partnerships/databricks/)
- [Constellation Research Analysis](https://www.constellationr.com/blog-news/insights/databricks-palantir-forge-integration-pact)

### Databricks
- [Unity Catalog at Data + AI Summit 2025](https://www.databricks.com/blog/whats-new-databricks-unity-catalog-data-ai-summit-2025)
- [Data + AI Summit 2025 Product Drops](https://www.flexera.com/blog/finops/databricks-data-ai-summit-2025/)
- [Delta Lake UniForm GA](https://www.databricks.com/blog/delta-lake-universal-format-uniform-iceberg-compatibility-now-ga)
- [Lakehouse Federation](https://docs.databricks.com/aws/en/query-federation/)
- [Delta Sharing Iceberg Support](https://www.databricks.com/blog/announcing-first-class-support-iceberg-format-databricks-delta-sharing)

### Snowflake
- [Cortex AISQL Announcement](https://www.snowflake.com/en/news/press-releases/snowflake-introduces-cortex-aisql-and-snowconvert-ai-analytics-rebuilt-for-the-ai-era/)
- [Apache Polaris Graduates to TLP](https://www.globenewswire.com/news-release/2026/02/19/3240735/0/en/apache-polaris-graduates-to-top-level-apache-project.html)
- [SPCS Overview](https://docs.snowflake.com/en/developer-guide/snowpark-container-services/overview)
- [Snowflake BUILD 2025](https://www.flexera.com/blog/finops/snowflake-build-2025/)

### Microsoft Fabric
- [FabCon 2026 Maturity Insights](https://www.journeyteam.com/resources/blog/from-promise-to-maturity-microsoft-fabric-insights-from-fabcon-2026/)
- [OneLake Security Preview](https://blog.fabric.microsoft.com/en-us/blog/onelake-security-is-now-available-in-public-preview)
- [FabCon 2026 OneLake Updates](https://blog.fabric.microsoft.com/en-us/blog/fabcon-and-sqlcon-2026-whats-new-in-microsoft-onelake/)
- [Microsoft + Databricks Interop](https://blog.fabric.microsoft.com/en-us/blog/microsoft-and-databricks-advancing-openness-and-interoperability-with-onelake)

### 新興プラットフォーム
- [Dremio Open Catalog](https://datalakehousehub.com/blog/2026-03-dremio-open-catalog/)
- [StarRocks 2025 Year in Review](https://www.starrocks.io/blog/starrocks-2025-year-in-review)
- [DuckDB Ecosystem March 2026](https://motherduck.com/blog/duckdb-ecosystem-newsletter-march-2026/)
- [Apache XTable Official](https://xtable.apache.org/)
- [Firebolt 2026 Benchmark](https://www.firebolt.io/blog/benchmark-of-cloud-data-warehouses-2026)

### テーブルフォーマット相互運用
- [2025 Year in Review: Iceberg, Polaris, Parquet, Arrow](https://datalakehousehub.com/blog/2025-12-2025-year-in-review-iceberg-arrow-polaris-parquet/)
- [Iceberg vs Delta Lake vs Hudi Comparison](https://www.onehouse.ai/blog/apache-hudi-vs-delta-lake-vs-apache-iceberg-lakehouse-feature-comparison)

### 権限管理・ガバナンス
- [RBAC vs ABAC for Data Platforms](https://medium.com/@reliabledataengineering/rbac-vs-abac-for-data-platforms-what-actually-works-6386a8081144)
- [Healthcare RBAC+ABAC Research](https://www.mdpi.com/1999-5903/17/6/262)

### dbt・データコントラクト
- [dbt Data Contracts](https://medium.com/tech-with-abhishek/dbt-and-data-contracts-enabling-reliable-api-driven-analytics-e137f8a113b6)
- [ETL Pipeline Best Practices](https://www.getdbt.com/blog/etl-pipeline-best-practices)
- [Data Contracts Guide (Soda)](https://soda.io/blog/guide-to-data-contracts)

### コスト比較
- [Fabric vs Snowflake vs Databricks 2026](https://technoedgels.com/microsoft-fabric-vs-snowflake-vs-databricks-in-2026-the-complete-enterprise-comparison-for-architecture-ai-cost-governance-and-career-impact/)
- [Databricks vs Snowflake 2026](https://bigdataboutique.com/blog/databricks-vs-snowflake-2026-comparison-d731b5)

### Foundry移行
- [Palantir Foundry Alternatives 2026](https://www.digetiers-dap.com/post/palantir-foundry-alternatives)
- [Foundry Migration Challenges](https://www.trackmind.com/palantir-foundry-data-transformation-market-comparison/)
