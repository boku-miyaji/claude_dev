# 01 概念・アーキテクチャ比較

> 手を動かす前の地図。3基盤の「思想の違い」を先に頭に入れておくと、ハンズオン中に「あ、これが例の〇〇か」と繋がる。

## 用語の前提（AI/LLMは知っているがDWH/BIは初めての社長向け）

| 用語 | ざっくり意味 |
|------|------------|
| **DWH (Data Warehouse)** | 構造化データ専門の倉庫。SQL特化。Snowflake の出自 |
| **Data Lake** | 生データをそのまま置く場所。S3/ADLS/GCSが実体。ファイル中心 |
| **Lakehouse** | DWHの「SQLの速さ・ガバナンス」とLakeの「何でも置ける柔軟さ」を統合しようという思想。Databricks の出自 |
| **Delta Lake / Iceberg / Hudi** | Lakehouse を実現するオープンテーブルフォーマット。Parquetファイルに「トランザクション・スキーマ進化・タイムトラベル」を足すメタデータ層 |
| **カタログ** | テーブル・カラム・権限・リネージの管理台帳。ガバナンスの中心 |
| **コンピュートとストレージの分離** | 「計算用の仮想マシン群」と「データ置き場」を別々にスケールできる設計。クラウドDWHの基本 |
| **クレジット / DBU / CU** | 各社の課金単位。時間×性能で算出される |
| **セマンティックモデル** | BIツール側の「論理的な業務モデル」。物理テーブルとビジネス用語（売上、利益率など）を繋ぐ層。Power BIの肝 |

## 3基盤の思想差（ざっくり一枚）

```
Snowflake    "SQLで全部やる DWH → AIを足した"
             強み: 運用の楽さ、SQL体験の統一感
             
Databricks   "ノートブック + Spark → 後からSQL/BIを足した"
             強み: ML/AI、大規模データ処理、オープン性
             
Fabric       "Power BI + OneLake に Synapse/Data Factory を統合"
             強み: MS365連携、非エンジニア対応、一元購買
```

## 観点別 比較表

### (1) 生い立ち・思想

| 観点 | Snowflake | Databricks | Microsoft Fabric |
|------|-----------|-----------|------------------|
| ルーツ | クラウドネイティブDWH（2012-） | Apache Spark商用化 + Lakehouse提唱（2013-） | Power BI + Synapse + Data Factory を統合した新ブランド（2023 GA、2024本格化） |
| コアの思想 | 「SQLひとつで分析が完結する世界」 | 「ノートブックからデータ・ML・AIまで全部やる」 | 「OneLake という1つのレイクに全員集まる」 |
| 主戦場 | 中〜大企業の分析基盤統合 | データサイエンス／ML／AI先進企業 | MS365・Azureを既に使う企業 |

### (2) ストレージ形式

| 観点 | Snowflake | Databricks | Microsoft Fabric |
|------|-----------|-----------|------------------|
| デフォルト | 独自マイクロパーティション（FDN） | **Delta Lake**（Parquet + トランザクションログ） | **Delta Lake**（OneLake上） |
| オープンフォーマット対応 | Iceberg Tables（GA）、Iceberg REST Catalog経由でUnity Catalogとも連携可 | Delta 4.0 + Iceberg REST API GA（2025） | OneLake = すべてDelta。Iceberg は Shortcut 経由で読める |
| 差分 | 独自→Icebergへ橋渡し中 | Delta本家。Iceberg互換も拡充 | MS版の Delta 実装。Snowflake ⇔ Fabric 双方向 Iceberg 読み書き Preview（2025-11）|

### (3) コンピュートとカタログ

| 観点 | Snowflake | Databricks | Microsoft Fabric |
|------|-----------|-----------|------------------|
| コンピュート単位 | Virtual Warehouse（T-shirt size: XS〜6XL） | Cluster（Classic / Serverless）+ SQL Warehouse | Capacity (F2〜F2048)、すべての機能で共有 |
| Serverless | SQL/Snowpark/Cortexすべて対応 | SQL/Notebook/Pipeline/GPU(Beta)対応 | 基本すべて Serverless 前提 |
| カタログ | **Horizon Catalog**（2024登場、ガバナンス統合） | **Unity Catalog**（Metrics GA、Iceberg REST GA、Delta Sharing拡大） | **OneLake + Purview統合**（企業のPurview資産と連携） |

### (4) AI/ML統合（2025-2026 最大の差別化ポイント）

| 観点 | Snowflake | Databricks | Microsoft Fabric |
|------|-----------|-----------|------------------|
| ブランド | **Cortex AI** | **Mosaic AI** | **Copilot + AI Functions** |
| LLM呼び出し | `SNOWFLAKE.CORTEX.COMPLETE('claude-haiku-4-5', prompt)` のSQL関数 | `ai_query('endpoint-name', prompt)` / `ai_summarize(text)` のSQL関数 | `ai.generate_response()`, `ai.analyze_sentiment()`, `ai.classify()` 等のタスク別関数 |
| エージェント | Cortex Agents / Cortex Analyst（自然言語BI） | Genie（自然言語BI、GA） / Agent Framework | Fabric Data Agents（Copilot Studio連携） |
| ノートブック | Snowflake Notebooks（Workspaces内、旧は Legacy Notebooks） | 本家Notebook（歴史的優位） | Fabric Notebooks（Synapse系譜） |
| ML基盤 | Snowpark ML / Container Services | Mosaic AI Model Serving（GPT-5, Claude 4.5, Gemini 2.5 Pro等もHost）、Gateway、Fine-tuning | Azure ML統合、SynapseML |
| 提供モデル | Claude, Llama, Mistral, Reka, Snowflake Arctic | 上記全部 + DBRX, Qwen3, 外部モデル経由 | Azure OpenAI（GPT-4/5系）中心 |

### (5) 料金モデル

| 観点 | Snowflake | Databricks | Microsoft Fabric |
|------|-----------|-----------|------------------|
| 単位 | **クレジット**（秒課金）+ ストレージ | **DBU**（Databricks Unit、秒課金）+ クラウドVM代 | **CU（Capacity Unit）時間課金**、OneLake storageは別 |
| 最小利用単位 | Warehouse XS = 1クレジット/時 | Serverless DBU は従量 | F2 = 約$0.35/時 |
| Pause運用 | `AUTO_SUSPEND` 秒単位で自動停止 | Serverless は idle で自動停止 | Portal で手動 Pause（起動中のみ課金） |
| 予測しやすさ | 中（クエリで変動） | 中（同上） | **高**（F2を契約した時間だけ。予算コントロールしやすい） |
| AI機能の課金 | Cortex は専用 credits 消費 + 使用量は `CORTEX_AI_FUNCTIONS_USAGE_HISTORY` で可視化（2025）| Mosaic AI は Serving 従量＋Gateway 統合コスト | Copilot は F64 → F2以上に拡大（2025-04） |

### (6) 得意／不得意

| 観点 | Snowflake | Databricks | Microsoft Fabric |
|------|-----------|-----------|------------------|
| 得意 | ・SQLでのアドホック分析<br>・BI連携の安定感<br>・運用の楽さ<br>・データマーケットプレイス | ・大規模ETL/Spark<br>・ML/AI本気ユースケース<br>・オープン標準<br>・コード第一主義の組織 | ・Power BI既存投資の活用<br>・非技術者への普及<br>・Teams/Excelからのシームレス利用<br>・調達の一本化 |
| 不得意 | ・超巨大な非構造データ処理（Sparkほど得意じゃない）<br>・独自性が強くロックイン感 | ・学習コストの高さ（Spark/Notebook前提）<br>・SQLオンリー派には過剰 | ・新興基盤ゆえの安定性<br>・MS以外のエコシステム統合は弱い<br>・個人試用の難しさ |

### (7) 企業タイプ別フィット（推測含む）

| 企業タイプ | 第一候補 | 理由 |
|----------|---------|------|
| MS365全社展開・Excel文化が強い日本の中堅企業 | **Fabric** | 購買・認証・BIが既存MS資産で完結 |
| データサイエンス組織が先にある、ML重視のスタートアップ | **Databricks** | Notebook/ML文化と親和 |
| SQL分析組織が成熟し「とりあえず統合DWHを」という大企業 | **Snowflake** | 運用の楽さ、SQL人材の豊富さ |
| 基幹系をAWS、分析もAWSで完結させたい企業 | Snowflake or Databricks on AWS | Fabricは相性×（Azure前提） |
| AI/LLM活用を経営テーマとして掲げた企業 | **Databricks or Snowflake Cortex** | どちらもLLM関数が成熟。要件次第 |

## 公知情報の限界

- **実運用コスト比較**は公式公開情報だけでは困難。3基盤とも「同じワークロード」の公式ベンチが存在しない（ベンダー自社調査のみ）
- **日本企業のリアルな採用比率**は IDC/Gartner の有料レポートでないと分からない。肌感では大企業はSnowflake寄り、スタートアップはDatabricks寄り、MS依存組織はFabric検討、だが定量データなし
- **AI機能のSQL関数名は半年で変わる可能性がある**。Snowflake は 2025-10〜2026-01 に AI Functions 群を GA 昇格させたが、関数シグネチャは今後も改定見込み
- **Fabric と Snowflake の Iceberg 双方向** は Preview（2025-11時点）。本番採用判断には早い

## 壁打ちモードへの導線

- 「自分が **数字で**この表を裏付けるとしたら、どの情報を社長自身で確認したいか？」（→ クライアント案件ではここの裏取りが価値になる）
- 「**Snowflakeの独自ストレージ** と **Delta/Icebergのオープン性** は、5年後どちらが勝っていると思うか。なぜ？」
- 「**OneLakeの一元化思想** は **既存のS3/ADLSで散らかっているデータ** に対して現実的に機能するか？」
- 「**Cortex / Mosaic AI / Copilot** のどれが、**自分が今focus-youでやりたいAI機能**に一番近いか？」

## 結論

- 3基盤は「**同じ機能リストをどう並べるか**」ではなく「**どこから来たか**」で思想が決まる
- Snowflake は **SQLで統一**、Databricks は **Notebookで統一**、Fabric は **OneLakeで統一** 。この3種の「統一軸」が各社の答え
- DXコンサル案件では「クライアントの既存資産・人材・文化」から逆算して1つ選ぶ。表の「企業タイプ別フィット」を叩きに壁打ちする

## ネクストアクション

- [ ] この表を見ながら `02-snowflake-handson.md` に入る
- [ ] ハンズオン中、「思想差」を感じた瞬間に `05-comparison-reflection.md` に1行メモ
- [ ] 表の「推測」「仮説」欄を、実際に触った後に自分の言葉で書き直す

## 主要ソース（全て 2026-04-15 アクセス）

- [Snowflake Feature updates in 2025](https://docs.snowflake.com/en/release-notes/feature-releases-2025)
- [Snowflake Cortex AI Functions documentation](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql)
- [What's new with Databricks Unity Catalog at Data + AI Summit 2025](https://www.databricks.com/blog/whats-new-databricks-unity-catalog-data-ai-summit-2025)
- [Databricks ai_query function](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query)
- [What is Microsoft Fabric - Overview](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview)
- [Microsoft Fabric November 2025 Feature Summary](https://blog.fabric.microsoft.com/en-us/blog/fabric-november-2025-feature-summary)
- [Fabric AI Functions](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/overview)
- [FabCon 2025 agentic capabilities](https://www.microsoft.com/en-us/microsoft-fabric/blog/2025/03/31/fabcon-2025-fueling-tomorrows-ai-with-new-agentic-capabilities-and-security-innovations-in-fabric/)
