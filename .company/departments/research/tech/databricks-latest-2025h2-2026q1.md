# Databricks 最新動向レポート（2025年後半〜2026年Q1）

**調査日**: 2026-04-01 | **ステータス**: completed | **調査チーム**: 技術調査

---

## 1. Data + AI Summit 2025 主要発表

**日程**: 2025年6月9-12日 / Moscone Center, San Francisco / 参加者22,000+名

| 発表内容 | 状態 | 概要 |
|----------|------|------|
| **Agent Bricks** | Beta | ノーコードでAIエージェントを設計・ベンチマーク・デプロイ。合成データ自動生成+タスク認識ベンチマーク |
| **Lakebase** | Public Preview | Neon技術ベースのフルマネージドPostgres互換OLTPデータベース。コンピュート/ストレージ分離 |
| **MLflow 3.0** | GA | GenAI特化に再設計。エージェント監視、プロンプトバージョニング、クロスプラットフォームトレーシング |
| **AI/BI Genie** | GA | 自然言語クエリによるインサイト取得 |
| **Mosaic AI Gateway** | GA | AI全サービスの統一エントリポイント。ガバナンス・使用量ログ・制御を集約 |
| **Storage-Optimized Vector Search** | 発表 | 数十億ベクトル対応、従来比7x低コスト |
| **Lakeflow** | GA | エンドツーエンドのデータエンジニアリングソリューション |
| **Serverless GPU** | Beta | サーバーレスプラットフォームにGPUサポート追加 |
| **Databricks Apps** | 発表 | データ/AIアプリのサーバーレス構築・スケーリング基盤 |
| **Unity Catalog Metrics** | Public Preview | AWS/Azure/GCP対応、2025夏GA予定 |

Sources: [Databricks Summit Announcements](https://www.databricks.com/events/dataaisummit-2025-announcements), [Flexera Summit Recap](https://www.flexera.com/blog/finops/databricks-data-ai-summit-2025/), [Qubika Summary](https://qubika.com/blog/announcements-databricks-data-ai-2025/)

---

## 2. Unity Catalog 最新状況

- **OSS版**: Apache 2.0ライセンスで公開済み。OpenAPI仕様ベース、Hive Metastore API + Iceberg REST Catalog API互換
- **Iceberg REST Catalog API**: **Public Preview**（DBR 16.4 LTS以上）。外部IcebergエンジンからのR/Wが可能。2026年2月時点でもGA未到達
- **Managed Iceberg Tables**: **Public Preview**（DBR 16.4 LTS以上）
- **Unity Catalog Metrics**: Public Preview → 2025夏GA予定

**限界**: Iceberg REST Catalog APIのGA時期は公式未発表。本番ワークロードでの利用はPreview前提のリスク評価が必要。

Sources: [Unity Catalog公式](https://www.unitycatalog.io/), [Iceberg Access Docs](https://docs.databricks.com/aws/en/external-access/iceberg), [OSS発表ブログ](https://www.databricks.com/blog/open-sourcing-unity-catalog)

---

## 3. Serverless 展開状況

| ワークロード | 状態 | 備考 |
|-------------|------|------|
| **SQL Warehouses** | **GA（先行）** | 25%性能改善が自動適用。追加設定不要 |
| **Notebooks** | **GA** | 2024 Summit発表、Azure 2025年2月GA。環境v5対応（DBR 17.0相当） |
| **Jobs/Workflows** | **GA** | 同上。短時間ワークロードで25%+コスト削減 |
| **DLT/Pipelines** | **GA** | Lakeflow Declarative Pipelinesとして提供 |
| **GPU Compute** | **Beta** | 2025 Summit発表 |

**価格**: Serverless DBU料金にインフラコストが包含（別途VM/EC2課金なし）。プロモーション割引あり（Jobs/Pipelines 50%、Notebooks 30%、2025年4月末まで）。

Sources: [Serverless GA発表](https://www.databricks.com/blog/announcing-general-availability-serverless-compute-notebooks-workflows-and-delta-live-tables), [コスト削減ブログ](https://www.databricks.com/blog/cost-savings-serverless-compute-notebooks-jobs-and-pipelines)

---

## 4. Mosaic AI 最新

| コンポーネント | 状態 | 詳細 |
|---------------|------|------|
| **Agent Framework** | GA | エージェント構築・評価・デプロイの統合フレームワーク |
| **Agent Bricks** | Beta | ノーコードエージェント最適化。合成データ+自動ベンチマーク |
| **Vector Search** | GA + 新版 | Storage-Optimized版が7x低コスト、数十億ベクトル対応 |
| **Model Serving** | GA | エージェント、GenAI、古典MLモデルのデプロイ対応 |
| **AI Gateway** | GA | 全AIサービスの統一ゲートウェイ |
| **MLflow 3.0** | GA | GenAI特化再設計、Databricks外エージェントも監視可能 |

**推測**: Rerankerの単独GA発表は確認できず。Vector Search内の機能として統合されている可能性が高い。

Sources: [Mosaic AI Summit発表](https://www.databricks.com/blog/mosaic-ai-announcements-data-ai-summit-2025), [Agent Bricks PR](https://www.prnewswire.com/news-releases/databricks-launches-agent-bricks-a-new-approach-to-building-ai-agents-302478829.html)

---

## 5. Delta Lake UniForm

- **GA時期**: 2024年6月にGA到達（Iceberg互換）
- **仕組み**: Delta Lake書き込み時にIcebergメタデータを自動生成。データコピー不要
- **制約**: **読み取り専用** — Icebergクライアントからの書き込みは不可（Delta/Spark経由のみ）
- **対応フォーマット**: Delta Lake, Apache Iceberg（Apache Hudi対応は"coming soon"のまま）
- **Delta Lake 4.0**（2025年9月）: Coordinated Commits（マルチエンジン書き込み）、Variant型、カタログ管理テーブル追加

Sources: [UniForm GA発表](https://www.databricks.com/blog/delta-lake-universal-format-uniform-iceberg-compatibility-now-ga), [UniForm Docs](https://docs.databricks.com/aws/en/delta/uniform)

---

## 6. Lakeflow (旧DLT)

- **名称変更**: Delta Live Tables (DLT) → **Lakeflow Spark Declarative Pipelines (SDP)**
- **移行**: 不要。既存コードはそのまま動作。SKUは引き続き"DLT"プレフィックス
- **GA**: 2025年にLakeflow全体としてGA
- **新機能**: 宣言的パイプライン記述（SQL/Python）、拡張インジェスト機能、Apache Spark Declarative Pipelinesとの相互運用

Sources: [DLT→Lakeflow説明](https://docs.databricks.com/aws/en/ldp/where-is-dlt), [Lakeflow新機能](https://www.databricks.com/blog/whats-new-lakeflow-declarative-pipelines-july-2025), [Lakeflow GA記事](https://tecyfy.com/blog/databricks-lakeflow-ga-2025-goodbye-dlt-hello-unified-data-engineering)

---

## 7. Databricks-Palantir 提携

- **発表日**: 2025年3月13日
- **内容**: Palantir AIP + Databricks Data Intelligence Platformの統合
- **技術的統合**: Unity Catalog（Delta Sharing経由）+ Palantirマルチモーダルセキュリティ。PalantirのOntology System + Databricksの処理スケール
- **ターゲット**: 政府機関（DOGE関連の効率化文脈あり）+ 民間企業
- **実績**: 100+社が既に両技術を併用中
- **背景**: Palantirの政府系実績を活用し、Databricksの連邦政府ビジネスを拡大する狙い

Sources: [公式PR](https://www.databricks.com/company/newsroom/press-releases/palantir-and-databricks-announce-strategic-product-partnership), [Axios報道](https://www.axios.com/2025/03/13/databricks-palantir-trump-doge), [100+社ブログ](https://www.databricks.com/blog/beyond-partnership-how-100-customers-are-already-transforming-business-databricks-and-palantir)

---

## 8. 価格・コスト

| コンピュートタイプ | Premium DBU単価/時 | 備考 |
|-------------------|-------------------|------|
| All-Purpose | $0.55 | 対話的開発向け |
| Jobs | $0.30 | 本番バッチ向け |
| Jobs Light | $0.22 | 軽量ジョブ |
| Serverless SQL | $0.70 | インフラ込み |

- **Commit割引**: DBCU 1-3年前払いで**最大37%オフ**
- **Serverless**: インフラコスト込みの単一DBU料金。プロモーション割引（Jobs 50%、Notebooks 30%）は2025年4月末終了
- **注意**: Serverlessは便利だがDBU単価が高いため、長時間稼働ワークロードではクラシックコンピュートの方が安価になるケースあり

Sources: [Databricks Pricing](https://www.databricks.com/product/pricing), [Flexera Pricing Guide](https://www.flexera.com/blog/finops/databricks-pricing-guide/), [Dawiso解説](https://www.dawiso.com/glossary/databricks-pricing-explained-real-cost-breakdown-for-2025)

---

## 9. 日本市場

- **リージョン**: 東京リージョン（AWS/Azure）で稼働中
- **成長**: 「最も急成長している市場の一つ」と公式発表。日本人員を倍増計画
- **カントリーマネージャー**: 笹利文（Toshifumi Sasa）を任命
- **導入企業**: AEON、ANA、ブリヂストン、コスモエネルギーHD、コニカミノルタ、ネットワンシステムズ、ルネサスエレクトロニクス
- **注目事例**: SMBC — 20+基幹系システムをAzure Databricksへ移行。GenAI活用のデータ基盤構築
- **パートナー**: Accenture + Databricksが2026年3月にAIアプリ/エージェント導入加速を発表

Sources: [日本成長PR](https://www.databricks.com/company/newsroom/press-releases/databricks-announces-record-growth-japan-fueled-enterprise-ai-boom), [人員倍増PR](https://www.databricks.com/company/newsroom/press-releases/databricks-plans-double-its-local-headcount-japan-support-business), [SMBC事例](https://www.databricks.com/dataaisummit/session/japanese-mega-banks-journey-modern-genai-powered-governed-data-platform)

---

## 10. コミュニティの声

**賞賛点**: 統合プラットフォームとしての完成度、年100+機能リリースの革新速度、Unity Catalog OSS化の姿勢、PeerSpot平均8.2/10

**不満点**: 価格の高さ（特にServerless長時間利用）、学習曲線の急さ、PySpark関連の情報不足、非技術者への敷居の高さ

**推測**: Reddit r/databricksは公式コミュニティ化（20K+メンバー）しており、率直な批判が出にくい構造になっている可能性あり。

Sources: [Reddit戦略分析](https://foundationinc.co/lab/databricks-reddit-strategy), [PeerSpotレビュー](https://www.peerspot.com/products/databricks-reviews), [Collectivレビュー](https://gocollectiv.com/blog/databricks-2026-review-pros-cons-and-verdict/)

---

## 調査の限界

1. **Serverlessプロモーション終了後の実勢価格**が不明（2025年4月以降の正式価格改定の有無）
2. **Iceberg REST Catalog APIのGA時期**は未公表。PJ判断にはDatabricks営業への確認推奨
3. **Reranker単体のGA状況**は公式ソースで確認不可
4. **日本リージョンでのServerless GPU対応時期**は未確認
5. Reddit/X上の生の批判的意見は、公式コミュニティ化により収集が困難

## 壁打ち用の問いかけ

- 「UniFormのIceberg読み取り専用制約は、想定しているデータアーキテクチャで問題になりますか？」
- 「Serverless vs クラシックコンピュートの損益分岐点は、対象ワークロードの稼働パターンでどこになりそうですか？」
- 「Palantir連携は国内案件に関係しますか？ それとも海外政府系が中心？」
- 「Unity Catalog OSS版を自社管理で使う想定はありますか？ それともDatabricks Managed前提？」

## 結論とネクストアクション

Databricksは2025年後半〜2026年Q1にかけて、**エージェントAI（Agent Bricks）とサーバーレス全面展開**を2大軸に進化している。Unity CatalogのOSS化とIceberg互換性強化により、ベンダーロックイン懸念の緩和を図りつつ、Palantir連携で政府系市場を開拓中。日本市場では大手企業の採用が加速しており、SMBCの大規模移行事例が象徴的。

**ネクストアクション**:
1. 具体的なPJ要件があれば、該当機能のGA/Preview状況を踏まえたリスク評価を実施
2. 価格最適化が必要なら、ワークロードパターンに基づくServerless vs Classic試算を作成
3. 日本市場の競合（Snowflake Japan等）との比較が必要なら別途調査
