# Snowflake 最新動向レポート (2025H2 - 2026Q1)

**調査日**: 2026-04-01 | **ステータス**: completed | **チーム**: 技術調査

---

## 1. Cortex AI 最新状況

- **Cortex AI Functions** が2025年11月にGA。AI_CLASSIFY, AI_TRANSCRIBE, AI_EMBED, AI_SIMILARITY等をSQL内で直接実行可能 ([Snowflake公式](https://www.snowflake.com/en/product/features/cortex/))
- **Cortex Agents** も2025年11月GA。構造化+非構造化データを横断するオーケストレーション ([Coefficient](https://coefficient.io/saas-ai-tools/snowflake-ai-features))
- **ネイティブLLM統合**: Claude (Anthropic), GPT-5.2 (OpenAI), Llama系 (Meta), Mistral が利用可能 ([GPT-5.2発表](https://www.snowflake.com/en/blog/announcing-openai-snowflake-cortex-ai/))
- **利用アカウント数**: 週次で9,100超アカウントがCortex利用。AI関連ワークロードは前四半期比200%超成長 ([VentureBeat](https://venturebeat.com/data/enterprise-data-infrastructure-proves-resilient-as-snowflakes-32-growth-defies-tech-slowdown-fears))
- **Cortex Code**: 2025年11月ローンチ以降、4,400人超の新規ユーザー。dbt/Airflow対応CLI版を展開 ([Snowflake Cortex Code](https://www.snowflake.com/en/product/features/cortex-code/))

## 2. Apache Polaris

- **TLP昇格**: 2026年2月18日にApache Top Level Projectに正式昇格 ([公式ブログ](https://polaris.apache.org/blog/2026/02/19/apache-polaris-graduates-to-top-level-project/))
- **規模**: incubation期間中に6リリース、約100名のコントリビューター、2,800超のPRをクローズ ([GlobeNewswire](https://www.globenewswire.com/news-release/2026/02/19/3240735/0/en/apache-polaris-graduates-to-top-level-apache-project.html))
- **REST Catalog API**: Apache Iceberg REST Catalog仕様のベンダー中立実装。Spark, Flink, Trino, Dremio, StarRocks, Doris等から利用可能 ([Dremio](https://www.dremio.com/press-releases/apache-polaris-graduates-to-top-level-apache-project-establishing-the-open-catalog-standard-for-apache-iceberg/))
- **意義**: ベンダーロックインの解消。Icebergカタログのデファクト標準として確立

## 3. Snowpark Container Services (SPCS)

- **全クラウドGA完了**: AWS (2024), Azure (2025年2月GA), GCP (2025年8月GA) ([Azure GA](https://docs.snowflake.com/en/release-notes/2025/other/2025-02-03-na-spcs-azure-ga), [GCP GA](https://docs.snowflake.com/en/release-notes/2025/other/2025-08-01-spcs-google-cloud-ga))
- **GPU対応**: AWS/AzureでGPUコンピュートプール利用可。GCPではGPU未対応 ([Flexera](https://www.flexera.com/blog/finops/snowpark-container-services/))
- **Streamlit container runtime**: 2026年3月GA。SPCSコンピュートプール上で動作しGPUアクセス可能 ([Snowflake Docs](https://docs.snowflake.com/en/release-notes/2026/other/2026-03-09-sis-container-runtime-ga))

## 4. Iceberg Tables

- **GA済み**: 2024年6月GA後、2025-2026で大幅成熟 ([DataEngineer Hub](https://dataengineerhub.blog/articles/snowflake-managed-iceberg-tables-complete-guide-2026))
- **外部エンジンアクセス**: Horizon Iceberg REST Catalog API経由でSpark/Trino等から読み書き可能 ([Snowflake Docs](https://docs.snowflake.com/en/user-guide/tables-iceberg-query-using-external-query-engine-snowflake-horizon))
- **双方向Write GA**: 外部エンジンからの書き込みが2025年10月17日GA ([Write GA](https://docs.snowflake.com/en/release-notes/2025/other/2025-10-17-iceberg-external-writes-cld-ga))
- **課金**: 外部エンジンアクセスの課金は2026年中頃開始予定 ([Snowflake Engineering](https://www.snowflake.com/en/engineering-blog/bidirectional-interoperability-iceberg-snowflake-horizon-catalog/))

## 5. Horizon ガバナンス

- **5本柱**: RBAC、自動分類タグ付け、マスキング/行レベルポリシー、リネージ追跡、Data Metric Functions ([Atlan](https://atlan.com/know/data-governance/snowflake-horizon-101/))
- **プライバシー機能**: Synthetic Data Generation、Differential Privacy Policies ([Snowflake Horizon](https://www.snowflake.com/en/product/features/horizon/))
- **Data Clean Rooms**: 2026年1月に更新リリース。生データを公開せず複数組織間で分析可能 ([DCR更新](https://docs.snowflake.com/en/release-notes/2026/other/2026-01-15-dcr))
- **AI_REDACT**: PII自動検出・マスキング機能がGA

## 6. Anthropicとの提携

- **発表日**: 2025年12月3日。複数年$200M規模の契約 ([Snowflake公式](https://www.snowflake.com/en/news/press-releases/snowflake-and-anthropic-announce-200-million-partnership-to-bring-agentic-ai-to-global-enterprises/), [Anthropic公式](https://www.anthropic.com/news/snowflake-anthropic-expanded-partnership))
- **内容**: Claude Sonnet 4.5がSnowflake Intelligenceを駆動。Claude Opus 4.5もマルチモーダル分析に利用可能 ([TechCrunch](https://techcrunch.com/2025/12/04/anthropic-signs-200m-deal-to-bring-its-llms-to-snowflakes-customers/))
- **規模感**: 12,600超のグローバル顧客にClaude提供。既に数千の顧客が月間数兆トークンをCortex AI経由で処理 ([TechTarget](https://www.techtarget.com/searchdatamanagement/news/366635815/Snowflake-Anthropic-boost-partnership-with-200M-commitment))
- **フォーカス**: 規制産業（金融、ヘルスケア、ライフサイエンス）でのエージェンティックAI展開

## 7. Cortex Analyst vs Databricks AI-BI Genie

| 観点 | Snowflake Cortex Analyst | Databricks AI-BI Genie |
|------|-------------------------|----------------------|
| アプローチ | セマンティックモデル(YAML) + SQL生成 | Unity Catalog Metric Views + 自然言語 |
| UI | Streamlit統合（自前構築が必要） | スタンドアロンUI + API |
| カスタマイズ | YAML定義ベースの厳密なガバナンス | チャット型の漸進的トレーニング |
| 強み | 安全・ガバナンス重視、既存BI統合 | モデル訓練・FT等のエンジニアリング志向 |
| 最新 | Snowflake Intelligence (2025/8 PP) | Agent Bricks (タスク記述ベースのAgent定義) |

([Medium比較](https://medium.com/@nair.g.deepa/the-future-of-ai-bi-snowflake-cortex-analyst-vs-databricks-genie-6b65073a43c6), [B EYE](https://b-eye.com/blog/databricks-vs-snowflake-guide/))

**推測**: Snowflakeは「ビジネスユーザーがすぐ使えるAI」、Databricksは「エンジニアが作り込むAI」という棲み分けが継続。

## 8. 価格・コスト

- **Credit単価**: オンデマンド $2-4/credit、年間契約 $1.50-2.50/credit。エディション・リージョン・クラウドで変動 ([Qrvey](https://qrvey.com/blog/snowflake-pricing/))
- **ストレージ**: US AWS約$23/TB/月。非USリージョンは10-30%プレミアム ([Flexera](https://www.flexera.com/blog/finops/snowflake-storage-costs/))
- **エグレス**: 同一リージョン内は無料。クロスリージョン/クロスクラウドはTB単位課金 ([Mammoth](https://mammoth.io/blog/snowflake-pricing/))
- **Cortex AIコスト注意**: 単一クエリで$5Kに達した事例あり。2026年3月にCortex AI Functions費用監視機能がGA ([SeeMore Data](https://seemoredata.io/blog/snowflake-cortex-ai/), [Snowflake Docs](https://docs.snowflake.com/en/release-notes/2026/other/2026-02-25-ai-functions-cost-management))
- **2025-2026で大幅な価格改定の公式発表はなし**

## 9. 日本市場

- **東京オフィス**: 10名→200名規模に急成長 ([AIM Research](https://aimresearch.co/generative-ai/snowflake-ramps-up-apj-expansion-with-local-strategies-and-gen-ai-focus))
- **JPXI提携**: JPX Market Innovation & Researchと優先パートナーシップ。2025年3月にJ-Quants ProデータセットをSnowflake上で提供開始 ([BusinessWire](https://www.businesswire.com/news/home/20250203189695/en/JPXI-and-Snowflake-Enter-Partnership-to-Expand-Japan-Market-Data-Access))
- **Industry Days 2025 Japan**: 日本向け業界特化イベントを開催 ([Snowflake](https://www.snowflake.com/events/industry-days-2025-japan/))
- **仮説**: 金融・製造業を中心に国内導入が加速中。ただし具体的な導入企業数の公開情報は限定的。

## 10. コミュニティの声・不満点

- **コスト予測困難**: 従量課金で請求額が予測しにくい。年間契約は実使用と乖離リスクあり ([Revefi](https://www.revefi.com/blog/common-snowflake-problems))
- **Cortex AIの高額リスク**: 大規模LLM呼び出しで想定外の高額請求 ([SeeMore Data](https://seemoredata.io/blog/snowflake-cortex-ai/))
- **PySpark非互換**: Snowpark ConnectでSpark互換性改善もRDD API未サポート、UDFの型変換差異あり ([Snowflake Docs](https://docs.snowflake.com/en/developer-guide/snowpark-connect/snowpark-connect-compatibility))
- **AI/ML**: Databricks比でモデル訓練・FT機能が弱い。Snowflakeは「消費型AI」志向で「構築型AI」にはDatabricksに分がある
- **GCPでGPU未対応**: SPCSのGPU利用はAWS/Azureのみ

---

## 限界の明示

- Cortex AI利用アカウント数（9,100超）はプレスリリース・決算発表ベース。実際のアクティブ利用率は不明
- 日本国内の具体的導入企業名・事例数は公開情報が限定的
- 価格変更は非公開の個別契約条件に依存する部分が大きく、公開情報では捕捉しきれない
- コミュニティの不満はReddit/X等の定性情報であり、統計的な裏付けはない

## 壁打ちモードへの導線

以下の問いを深掘りすると、より精度の高い分析が可能です:

1. 「Cortex AI vs Databricks AI-BI、クライアントの業種・規模からどちらが適合するか？」
2. 「Iceberg + Polaris構成で、既存のDWH/ETLパイプラインからの移行コストはどの程度か？」
3. 「Anthropic提携の$200Mは、自社のLLM利用戦略にどう影響するか？」
4. 「SPCS GPU非対応(GCP)が、マルチクラウド戦略にどう影響するか？」
5. 「日本市場でのJPXI提携は、金融データ活用PJにどう活かせるか？」

## 結論・ネクストアクション

**結論**: Snowflakeは2025H2-2026Q1で「データウェアハウス」から「AIデータプラットフォーム」への転換を加速。Cortex AI GA、Anthropic $200M提携、Polaris TLP昇格、Iceberg双方向Write GAが主要マイルストーン。一方、AI/ML構築面ではDatabricksに対して追随ポジションが継続。

**ネクストアクション**:
- 特定PJへの適用を検討する場合、Cortex Analyst/Intelligence のPoC設計を推奨
- コスト管理が懸念なら、2026年3月GAの費用監視機能の導入を優先
- Iceberg戦略を採るなら、Polaris REST Catalog経由のマルチエンジン構成を検証
