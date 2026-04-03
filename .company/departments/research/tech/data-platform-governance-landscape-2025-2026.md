# データ基盤の運用設計・ガバナンス最新動向（2025-2026）

**ステータス**: completed  
**調査日**: 2026-04-01  
**調査チーム**: 技術調査

---

## 1. dbt 最新動向

- **dbt Core 1.9**（2024-12-09リリース）: `state:modified` セレクタ改善（未レンダリング設定値の比較で偽陽性排除）
- **dbt Core 1.10**（2025-06-16リリース）: 安定性・パフォーマンス改善
- **dbt Cloud**: Release Tracks（Latest/Compatible）導入。環境ベースのDeferral対応
- **Semantic Layer**: 新YAML仕様が策定。セマンティックモデルをモデルYAML内に埋め込む形式に変更し、YAML階層を削減。オープン標準としてFusionエンジンに統合。dbt Core 1.12で一般提供予定
- [dbt 2025 Release Notes](https://docs.getdbt.com/docs/dbt-versions/2025-release-notes) | [Semantic Layer Spec](https://docs.getdbt.com/blog/modernizing-the-semantic-layer-spec)

## 2. データコントラクト

- dbt model contractsはGA済み。モデルYAML内で `contract: {enforced: true}` を設定し、カラム名・型・制約をビルド時に検証
- **Gartner Hype Cycle for Data Management 2025** でデータコントラクトが新興メカニズムとして登場。AIワークロード・Data Mesh・スケール時の品質維持の文脈で構造的コンポーネントと位置付け
- 課題: ガバナンスの摩擦とデータ生産者の速度低下のバランス。全モデルに適用するのではなく、公開APIモデルに限定するのがベストプラクティス
- [dbt Model Contracts](https://docs.getdbt.com/docs/mesh/govern/model-contracts) | [Atlan - Data Contracts 2026](https://atlan.com/data-contracts/)

## 3. Unity Catalog OSS化

- **2024年6月** Databricksが OSS化発表。LF AI & Data Foundation配下でホスト
- **対応フォーマット**: Delta Lake, Iceberg, Hudi, Parquet, JSON, CSV。Iceberg REST Catalog・Hive Metastore標準に対応
- **支持企業**: AWS, Azure, GCP, NVIDIA, Salesforce, DuckDB, LangChain, dbt Labs, Fivetran等
- **コミュニティの懸念**: OSS版は商用版と機能差が大きい。DAIS 2025後もコア機能の充実が求められている（unitycatalog-aiよりコアUC優先の声）
- [Unity Catalog GitHub](https://github.com/unitycatalog/unitycatalog) | [Databricks Blog](https://www.databricks.com/blog/open-sourcing-unity-catalog)

## 4. FinOps for Data

- Flexera State of Cloud 2025: 84%の企業がクラウド支出管理に苦戦。72%が予算超過
- **FOCUS形式**: Databricksがプライベートプレビューで提供開始。Snowflakeは2026年提供予定。標準課金フォーマットによるツール横断分析が可能に
- **主要ツール**: Flexera（Chaos Genius買収、Agentic FinOps）、Keebo AI（Snowflake特化）、Finout（マルチクラウド統合）、Vantage（Datadog/Snowflake/Databricks統合）
- **トレンド**: ML+リアルタイムテレメトリによるAgentic FinOps（自動リサイズ・アイドル停止）が台頭
- [Flexera Agentic FinOps](https://www.flexera.com/blog/finops/agentic-finops-for-ai-autonomous-optimization-for-snowflake-databricks-and-ai-cloud-costs/) | [FinOps.org](https://www.finops.org/insights/finops-for-data-cloud-platforms/)

## 5. 医療・介護データのガバナンス（日本）

- **3年ごと見直し**: 2026年1月、個人情報保護委員会が「制度改正方針」を公表。2026年通常国会で改正法案提出見込み
- **主な改正方向**: 要配慮個人情報（病歴・診療情報等）の取得について、統計作成目的に限定し本人同意不要とする条件の緩和を検討。医療提供機関に学術研究例外を拡大する方向
- **現行ルール**: 診療録・介護記録の病歴、治療情報、健康診断結果、障害の事実等が要配慮個人情報。取得・第三者提供は原則本人同意必須
- [個人情報保護委員会 ガイダンス](https://www.ppc.go.jp/personalinfo/legal/iryoukaigo_guidance/) | [牛島総合 改正方針](https://www.ushijima-law.gr.jp/client-alert_seminar/client-alert/20260109appi/) | [BUSINESS LAWYERS](https://www.businesslawyers.jp/articles/1485)

## 6. CI/CD for Data

- **Databricks Asset Bundles (DABs)**: YAML宣言型でJobs/DLT/Notebooks等を定義。GitHub Actions + OIDCで PAT不要のセキュアデプロイが標準パターンに
- **dbt Slim CI**: `state:modified` で変更モデルのみビルド。環境ベースDeferralでprod manifestと比較。CI コスト90%以上削減の実績。`dbt sl validate --select state:modified+` でセマンティックノード検証も可能
- **dbt + DABs統合**: dbt transformationsをDABs内に含めてインフラをコード管理する手法が普及
- [Databricks CI/CD](https://docs.databricks.com/aws/en/dev-tools/ci-cd) | [dbt CI Jobs](https://docs.getdbt.com/docs/deploy/ci-jobs)

## 7. Lakehouse Federation 対応データソース

GA: MySQL, PostgreSQL, SQL Server, Amazon Redshift, Google BigQuery, Snowflake, Azure Synapse, Hive Metastore, **Teradata, Oracle**（2025年7月GA）。Salesforce Data Cloud も対応。今後もコネクタ拡大予定。
- [Databricks Lakehouse Federation](https://docs.databricks.com/aws/en/query-federation/) | [Federation GA Blog](https://www.databricks.com/blog/announcing-general-availability-lakehouse-federation)

## 8. Delta Lake 最新バージョン

- **Delta Lake 4.0**（2025年9月）: Delta Connect（Spark Connect対応）、Coordinated Commits（クロス環境安全書き込み）、Variant型、Identity Columns、Collations、Type Widening、VACUUM LITE、カタログ管理テーブル（プレビュー）
- **Delta Lake 4.1.0**（2026年3月）: 最新安定版
- [Delta Lake 4.0 Blog](https://delta.io/blog/2025-09-25-delta-lake-40/) | [Delta Lake 4.1.0](https://delta.io/blog/2026-03-01-delta-lake-4-1-0-released/)

## 9. Apache Iceberg V3

- V3仕様は**2025年に正式確定**。主要機能: Binary Deletion Vectors（行レベル更新の大幅高速化）、Default Column Values、Variant型、Row Lineage Tracking、Geospatial型、ナノ秒精度Timestamp
- **Iceberg 1.10.0**（2025年9月）: V3ネイティブ最適化、Spark 4.0互換
- **注意**: Athena, Trino, SnowflakeはV3未対応（2025時点）。Spark/Flinkが主要エンジンの場合にV3採用を推奨
- [Google OSS Blog - Iceberg V3](https://opensource.googleblog.com/2025/08/whats-new-in-iceberg-v3.html) | [Dremio - Iceberg V3](https://www.dremio.com/blog/apache-iceberg-v3/)

## 10. データメッシュ vs データレイクハウス

- **2025-2026の結論: 「対立」から「統合」へ**。Lakehouseが技術基盤（ストレージ・ACID・ガバナンス）、Meshが組織モデル（ドメイン所有・セルフサーブ）として補完関係に収束
- 2026年の主流パターン: Lakehouseストレージ + Fabricメタデータ + Meshオーナーシップの3層ハイブリッド
- Gartner 2025: 67%の企業で中央データチームが過負荷。分析リクエスト対応は平均34日（2020年の18日から悪化）
- [DZone - Lakehouse vs Mesh](https://dzone.com/articles/data-lakehouse-vs-data-mesh-rethinking-scalable-da) | [Engine Analytics 2026](https://engineanalytics.tech/data-mesh-vs-lakehouse-vs-data-fabric-which-architecture-wins-in-2026/)

---

## 限界の明示

- **未確認事項**: 各ツールの日本国内導入事例数、国内SIerの対応状況、価格改定の詳細
- **推測ラベル**: Iceberg V3のSnowflake対応時期は未公表（推測: 2026年後半）
- **精度向上に必要な情報**: 対象PJの具体的なデータ基盤構成（Databricks/Snowflake/BigQuery）、データ量規模、チーム体制

## 壁打ち用の問いかけ

1. 現在のデータ基盤はDelta Lake/Icebergどちらを主軸にしていますか？ UniFormでの相互運用も選択肢に入りますか？
2. dbt contractsの導入範囲は公開APIモデルに限定する方針ですか、それとも全モデルに適用しますか？
3. FinOpsの優先度はどの程度ですか？ FOCUS形式の標準化を待つか、先行して独自ダッシュボードを構築するか？
4. 医療・介護データを扱う場合、匿名加工情報 or 仮名加工情報のどちらのアプローチを検討していますか？
5. CI/CDはDABs + dbt Slim CIの組み合わせが有力ですが、既存のデプロイフローとの整合性はどうですか？

## 結論とネクストアクション

| 領域 | 推奨アクション |
|------|--------------|
| dbt | Semantic Layer新仕様への移行計画策定。dbt Core 1.12リリース時に対応 |
| データコントラクト | 公開モデルから段階導入。Gartnerの位置付けを社内説得材料に活用 |
| Unity Catalog OSS | 商用版との機能差を見極めつつ、マルチエンジン環境ならOSS版の検証開始 |
| FinOps | FOCUS形式対応を見据え、Finout/Vantage等のPoC実施 |
| 医療データ | 2026年改正法案の確定を注視。現行ガイダンスに基づく運用設計を先行 |
| CI/CD | DABs + GitHub Actions OIDC + dbt Slim CIの標準パイプライン構築 |
| テーブルフォーマット | Delta Lake 4.x + UniFormでIceberg互換を確保する戦略が安全 |
| アーキテクチャ | Lakehouse基盤 + Mesh原則のハイブリッドが2026年の主流。段階導入を推奨 |
