# データ基盤プラットフォーム最新動向 (2025H2-2026Q1)

- ステータス: completed
- 作成日: 2026-04-01
- チーム: 技術調査

---

## 1. 公知情報ベースの分析

### Microsoft Fabric

**FabCon 2026 (2026年3月, Atlanta) 主要発表**
- 顧客数31,000超、MS史上最速成長のデータプラットフォーム
- **Fabric IQ**: セマンティックインテリジェンス層。全エンジン横断でデータの意味を理解
- **Fabric Data Agents**: GA。自律的にデータ操作を行うエージェント基盤
- **Fabric Graph**: スケーラブルなグラフDB機能を統合
- **Runtime 2.0** (Preview): Spark 4.x / Delta Lake 4.x / Scala 2.13 搭載
- [FabCon 2026 公式ハイライト](https://www.microsoft.com/en-us/microsoft-fabric/blog/2026/03/30/highlights-from-fabcon-and-sqlcon-2026-where-databases-and-fabric-come-together/) / [March Feature Summary](https://blog.fabric.microsoft.com/en-us/blog/fabric-march-2026-feature-summary?ft=All)

**OneLake Security**
- 数週間以内にGA予定 (2026年3月時点)。行/列/オブジェクトレベルのアクセス制御を統一モデルで提供
- Spark Notebook、Power BI、Data Agentを含む全アクセス経路で自動適用
- RLSとCLSは単一のOneLake Securityロール内で併用可能
- [OneLake Security Blog](https://blog.fabric.microsoft.com/en-us/blog/onelake-security-is-now-available-in-public-preview?ft=10-2025:date) / [RLS Docs](https://learn.microsoft.com/en-us/fabric/onelake/security/row-level-security)

**Copilot統合**
- 2025年4月30日以降、F2以上の全有料SKUでCopilot/AI機能が利用可能 (以前はF64+限定)
- Azure OpenAIバックエンドは米国4リージョン+EU1リージョン (France Central) に限定
- [Copilot SKU開放Blog](https://blog.fabric.microsoft.com/en/blog/copilot-and-ai-capabilities-now-accessible-to-all-paid-skus-in-microsoft-fabric?ft=03-2025:date)

**Databricksとの相互運用**
- **Unity Catalog Mirroring → Fabric**: GA。DatabricksのカタログをFabricから直接参照可能
- **Databricks → OneLake読み取り**: Public Preview (2025末)。Unity Catalog経由でOneLakeデータにアクセス
- **OneLakeへの書き込み**: タイムライン共有予定 (FabCon 2026で言及)
- Snowflake相互運用はGA済
- [Databricks Mirroring GA](https://blog.fabric.microsoft.com/en-us/blog/unified-by-design-mirroring-azure-databricks-unity-catalog-in-microsoft-fabric-now-generally-available?ft=All) / [Databricks Blog](https://www.databricks.com/blog/expanding-support-onelake-unity-catalog)

**成熟度**
- FabCon 2026ではPreview期の「ただし書き」がほぼ消失。本番ワークロードでの運用が一般化
- カスタムワークロードのPublish機能がGA (OneLakeストレージ、アイテムライフサイクル等が安定)
- 最大の課題は技術ではなく組織的準備 (データ品質、ガバナンス、運用モデル)
- [JourneyTeam: Promise to Maturity](https://www.journeyteam.com/resources/blog/from-promise-to-maturity-microsoft-fabric-insights-from-fabcon-2026/)

**日本市場の導入事例**
- **ヤマシタ**: 介護用品レンタル。全70拠点にシチズンデータサイエンティスト配置目標 — [事例](https://www.microsoft.com/ja-jp/customers/story/22430-yamashita-co-ltd-azure)
- **Sky**: 2025年8月本番運用開始。4ヶ月で100超のAI業務アイデア創出 — [事例](https://www.microsoft.com/ja-jp/customers/story/26026-sky-microsoft-fabric)
- **北國銀行/CCIグループ**: インフラ運用負担ほぼゼロ、パイプライン工数40-60%削減 — [事例](https://www.microsoft.com/ja-jp/customers/story/26013-the-hokkoku-bank-microsoft-fabric)
- 日立ソリューションズが導入支援サービスを2025年4月提供開始 — [プレスリリース](https://www.hitachi-solutions.co.jp/company/press/news/2025/0331.html)

**Direct Lake**
- 2種類に分岐: Direct Lake on OneLake / Direct Lake on SQL (2025年4月〜)
- F64でMax 1.5B行/25GBメモリ制限。実用上は約1.4億行x25列が目安
- Composite Semantic Model (DL + Importテーブル混在) がPublic Preview
- Parquet列指向 → VertiPaqエンジンでImport Modeに匹敵する速度
- [Direct Lake Docs](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview) / [Architecture Guide](https://community.fabric.microsoft.com/t5/Data-Engineering-Community-Blog/Designing-for-Direct-Lake-Architecture-Storage-Strategy-and/ba-p/5000453)

---

### 新興プラットフォーム

**Dremio**
- **Dremio Cloud** (2025年11月): 業界初の「Agentic Lakehouse」。AIエージェントが自律的に最適化
- **Open Catalog**: Apache Polarisベース。全アカウントにゼロ設定で組み込み済み
- **Autonomous Reflections / Iceberg Clustering / AI Semantic Search** (Iceberg Summit 2025発表)
- **STACKIT Dremio**: 欧州向けソブリンクラウド版、2026夏GA予定
- [Dremio Cloud発表](https://siliconangle.com/2025/11/10/dremio-cloud-debuts-agentic-data-lakehouse-operated-ai-agents/) / [Open Catalog Blog](https://datalakehousehub.com/blog/2026-03-dremio-open-catalog/)

**DuckDB**
- **v1.4.0 LTS** (2025年9月): 初のLTS版。2026年9月までサポート
- **v1.5.0 "Variegata"** (2026年3月): VARIANT型、GEOMETRY型、DuckLake 0.4、curl httpfsバックエンド
- v1.0比でTPC-H 40%改善、ClickBench 45.7%改善
- **MotherDuck**: AI Dives (自然言語で可視化作成)、MCP Server (Claude/ChatGPT/Cursorから直接クエリ)
- [DuckDB 1.5発表](https://duckdb.org/2026/03/09/announcing-duckdb-150) / [MotherDuck MCP](https://github.com/motherduckdb/mcp-server-motherduck)

**Apache Polaris**
- **2026年2月18日にTLP (Top Level Project) に昇格**。Apache Incubatorを卒業
- Iceberg REST API実装。Spark/Flink/Doris/StarRocks/Trino/Dremioと相互運用
- Icebergカタログの事実上の標準 (de facto standard) として位置づけ
- [TLP昇格発表](https://polaris.apache.org/blog/2026/02/19/apache-polaris-graduates-to-top-level-project/) / [Dremio Press](https://www.dremio.com/press-releases/apache-polaris-graduates-to-top-level-apache-project-establishing-the-open-catalog-standard-for-apache-iceberg/)

**Apache XTable (Incubating)**
- Iceberg/Hudi/Delta間の双方向メタデータ変換。CatalogSync (Glue/HMS) 対応
- Hudi 1.1のPluggable Table Format Frameworkと統合。Hudi → Iceberg変換がネイティブ化
- 継続的同期 (RunSync)、ロールバック同期をサポート
- [GitHub Releases](https://github.com/apache/incubator-xtable/releases) / [Hudi 2025 Review](https://hudi.apache.org/blog/2025/12/29/apache-hudi-2025-a-year-in-review/)

**StarRocks v4.0** (2025年10月)
- TPC-DS 1TBでYoY **60%高速化**。JSON型がファーストクラスに (3-15x高速化)
- Apache Iceberg: Hidden Partition、Compaction API、ネイティブ書き込み対応
- クラウドAPIコール最大90%削減 (ファイルバンドル/メタデータキャッシュ)
- CelerDataがStarOS + Multi-Warehouseをオープンソース化
- [StarRocks 4.0 Release](https://docs.starrocks.io/releasenotes/release-4.0/) / [CelerData Blog](https://celerdata.com/blog/starrocks-4.0-zero-compromise-60-faster)

**ClickHouse Cloud**
- 2025年: 277新機能、319パフォーマンス最適化、1,051バグ修正
- **BYOC** (Bring Your Own Cloud) AWS版GA。自社AWSアカウント内にデプロイ
- CDC: Postgres GA、MySQL Private Preview。Flink/Confluent公式コネクタ
- バックアップ6倍高速化、外部バックアップ (S3/GCS/Azure Blob) 対応
- **Langfuse買収** (LLMオブザーバビリティ)、**ネイティブPostgresサービス** 発表
- [2025 Roundup](https://clickhouse.com/blog/clickhouse-2025-roundup) / [Spring 2025](https://clickhouse.com/blog/whats-new-clickhouse-cloud-spring-2025)

**Firebolt**
- **FireScale** (2025年3月): 2500 QPS/120msレイテンシ。価格性能比でSnowflake比8x、Redshift比18x、BigQuery比90x
- **ClickBench 2026**: 10B行でClickHouse比3x高速/5x安価、100B行で2x高速/3x安価
- [FireScale発表](https://finance.yahoo.com/news/firebolt-introduces-firescale-benchmark-low-130300474.html) / [2026 Benchmark](https://www.firebolt.io/blog/benchmark-of-cloud-data-warehouses-2026)

---

## 2. 限界の明示

- Fabric日本市場の **実際の導入障壁** (ライセンス交渉、既存Snowflake/Databricksからの移行コスト) は非公開
- Direct Lakeの **大規模本番での安定性** (100億行規模) に関する独立したベンチマークは見つからず
- Fireboltのベンチマークは **自社実施** であり、第三者検証が必要
- StarRocks/CelerData Cloudの **日本リージョン展開・サポート体制** は未確認
- 各プラットフォームの **実際のTCO比較** (同一ワークロード) は公開情報では困難

## 3. 壁打ちモードへの導線

- 「現在のデータ基盤 (Snowflake? Databricks?) からFabricへの移行を検討する場合、最も重視する要素は何ですか? (コスト/ガバナンス/AI統合/既存投資の保護)」
- 「DuckDB/MotherDuckのMCP連携は、社内のAIエージェント基盤にどうフィットしますか?」
- 「Apache PolarisのTLP昇格を踏まえ、Icebergカタログ戦略の見直しは必要ですか?」
- 「StarRocks 4.0のIceberg書き込み対応は、リアルタイム分析のアーキテクチャにどう影響しますか?」

---

**結論**: Fabricは成熟期に入り日本導入事例も増加中。一方でオープンレイクハウス陣営 (Polaris TLP昇格、Dremio Open Catalog、StarRocks Iceberg対応) も急速に標準化が進んでおり、ベンダーロックイン回避の選択肢が充実してきた。

**ネクストアクション**: 対象PJのデータ基盤要件を明確化し、Fabric vs オープンレイクハウスの比較評価マトリクスを作成する。
