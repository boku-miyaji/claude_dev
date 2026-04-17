# 技術スタック採用方針 — 補足資料: プラットフォーム技術評価

> 対象: 20260407_技術スタック採用方針_final.pptx の補足
> 位置づけ: §2.1 RFP評価観点に基づくプラットフォーム技術評価（軸1）
> ステータス: 最終報告用

---

## 1. 評価の構造: 技術選定とベンダー選定の分離

§2.1で設定した4要件×12評価観点を、プラットフォームの技術特性で評価できるもの（軸1）と、ベンダー提案に依存するもの（軸2）に分離して評価する。

```
§2.1 RFP評価観点（4要件 × 12評価観点）
              │
    ┌─────────┴─────────┐
    │                   │
 軸1: 技術選定         軸2: ベンダー選定
 プラットフォームの      ベンダーの提案力で
 技術特性で評価         評価
    │                   │
 本資料で評価           RFP回答で評価
 (別紙A-4/A-5)         (§2.2〜§2.5)
```

| 要件 | 評価観点 | 軸1: 技術選定 | 軸2: ベンダー選定 |
|------|---------|-------------|----------------|
| 要件1: コスト | 開発・運用コスト | ○ 課金モデルの構造 | ○ 金額試算 |
| | 透明性/予見可能性 | ○ コスト急増リスクの構造特性 | ○ データ量増加時の試算 |
| | 推進体制 | — | ◎ 全面ベンダー |
| 要件2: 移行確実性 | 移行実効性 | — | ◎ 全面ベンダー |
| | 資産継承性 | **◎ PySpark互換性** | ○ 書き換え方針 |
| | 移行安全性 | ○ 切り戻し機能 | ○ 移行計画 |
| 要件3: 運用・ガバナンス | 運用体制 | ○ 必要スキル・学習曲線 | ○ 支援体制 |
| | ガバナンス | **◎ 全面技術** | — |
| | セキュリティ | **◎ 全面技術** | — |
| 要件4: AI拡張性 | 属人化解消 | **◎ 全面技術** | — |
| | オープン性 | **◎ 全面技術** | — |
| | AI拡張性 | **◎ 全面技術** | — |

→ 以下は軸1（技術選定）の観点でDatabricks / Snowflake / AWS Nativeを比較する。

---

## 2. プラットフォーム技術評価

**前提:**
- Snowflakeは標準テーブル（マネージド）中心の構成で記載。Iceberg tables活用時はオープン性の評価が向上する
- PySpark 219本の互換性は技術仕様上の評価であり、代表ジョブでの実証は前提条件とする
- Foundry継続は「現状維持シナリオ」として比較の基準線に置く

### 要件1: 妥当で説明可能なコスト構造であること

| 評価観点 | Databricks | Snowflake | AWS Native | Foundry継続 |
|---------|-----------|-----------|------------|------------|
| **課金モデル** | DBU従量課金。コンピュート種別の選択に知識が必要 | クレジット従量課金。構成次第でコスト増リスク | 各サービスの従量課金合算。TCO見通しが複雑 | 定額ライセンス。機能過多の構成が継続 |
| **コスト透明性** | Cost Management UI + System TablesでSQL分析可。ただしDBU単価の開示が限定的 | Resource Monitor + Usage Views。アラート設定可 | Cost Explorer + 各サービスメトリクス。横断把握に工夫が必要 | Palantir社との交渉依存 |
| **コスト急増リスク** | DBU膨張（大量バッチ・ML job）、ストレージ膨張（VACUUM未設定時） | クレジット消費の急増（同時クエリ増加時）、周辺機能追加時 | 各サービスの個別膨張。見落としリスク | 定額のため急増リスクは低い。ただし削減もできない |

### 要件2: 開発・移行を確実に実現できること

| 評価観点 | Databricks | Snowflake | AWS Native | Foundry継続 |
|---------|-----------|-----------|------------|------------|
| **資産継承性（PySpark互換）** | **◎ デコレーター除去でほぼ動作。PySpark DataFrame APIがネイティブ対応** | △ Snowpark（Python）への書き直しが必要。DataFrame APIの互換性は限定的 | ○ Glue PySpark。一部互換だがGlue固有の制約（ジョブブックマーク等）あり | — 移行なし |
| **Tableau資産の継続利用** | ◎ Databricks SQL Warehouse経由で接続。SQL Serverless対応 | ◎ Snowflake Connector経由で接続。成熟した連携 | ○ Redshift/Athena経由で接続可 | ○ 独自BIからの移行が別途必要 |
| **切り戻し機能** | ◎ Delta Lake Time Travel（任意時点に復元可） | ◎ Time Travel（最大90日） | ○ S3バージョニング | — |
| **環境分離（dev/stg/prod）** | ◎ ワークスペース分離 + Repos統合 | ○ アカウント/スキーマ分離 | ○ 各サービスで個別に設計 | △ Foundryブランチ機能（完全な環境分離ではない） |

### 要件3: 運用継続性・ガバナンスを確保できること

| 評価観点 | Databricks | Snowflake | AWS Native | Foundry継続 |
|---------|-----------|-----------|------------|------------|
| **運用に必要なスキル** | SQL + Python + IaaC基礎。学習曲線は急だが到達点は高い | **SQL中心。学習曲線が最も緩やか**。運用設計上の作法はあるが比較的容易 | SQL + Python + AWS複数サービスの知識。習得コスト高 | 専用知識への依存が大きい。現状も属人化 |
| **統合カタログ** | **◎ Unity Catalog。2026: Governed Tags GA、Lakehouse Federation（外部DB統合管理）** | ○ Horizon。リネージ・データ品質を統合 | △ Glue Data Catalog + Lake Formation。2サービスの組み合わせ | ○ 統合されているが独自仕様 |
| **自動リネージ** | ◎ Unity Catalog Lineage（PySpark列レベル対応） | ○ Horizon Lineage | △ 限定的 | △ 自動リネージあるが独自形式 |
| **データ品質管理** | ◎ DLT Expectations + Workflows | ○ Tasks + Dynamic Tables | ○ Glue Data Quality（ML自動推奨） | ○ データコントラクトあり |
| **監査ログ** | ◎ System Tables（SQLで柔軟に分析可） | ◎ Access History + Query History | ○ CloudTrail + 各サービスログ | ○ 監査ログあり |
| **再実行・変更トレース・障害切り分け** | ◎ Lakeflow Jobsの統合管理。Git連携（Repos） | ○ Tasks + Git Integration | △ Step Functions / MWAA + 各サービスのログ | ○ 統合されているが独自 |
| **RLS・列マスク** | ◎ Unity Catalog。行フィルタ + 列マスキング | ◎ RLS + Dynamic Data Masking | ○ Lake Formation FGAC（read系中心。書き込み系はIAMベース） | ◎ Markings（タグ自動伝播）。ただし独自仕様 |
| **PII検出** | △ Presidio(OSS) or AWS Macie。別途導入必要 | ○ Cortex対応 | ○ AWS Macie | ○ 対応あり |

### 要件4: 将来のAI活用を阻害しない拡張性があること

| 評価観点 | Databricks | Snowflake | AWS Native | Foundry継続 |
|---------|-----------|-----------|------------|------------|
| **コーディングスキル不要のBI** | ◎ AI/BI Dashboards + Tableau | ◎ Snowsight + Tableau | ○ QuickSight + Tableau | ○ 独自UI。操作に専用知識が必要 |
| **自然言語→SQL分析** | ◎ AI-BI Genie（GA）。セマンティックモデルベース | ◎ Cortex Analyst（GA）+ Semantic Views（SQL GA 2026/3） | △ Amazon Q in QuickSight（限定的） | △ AIPあるがクローズド環境 |
| **オープンデータフォーマット** | **◎ Delta Lake + UniForm（Iceberg互換）。OSS中心** | 標準テーブル: △ 独自形式 / Iceberg tables利用時: ◎ | ○ Glue path: Iceberg v3 / Redshift query: v1/v2 | × 完全独自形式 |
| **ML実験管理** | **◎ MLflow ネイティブ統合。追加ライセンス不要** | △ Snowpark ML（限定的） | △ SageMaker（別サービス。追加コスト・追加学習） | △ なし |
| **ベクトル検索・非構造データ** | ◎ Volume + Vector Search | ○ Cortex Search（GA） | ○ S3 + Bedrock + OpenSearch | ○ 対応可だが活用度低 |
| **マルチモデル対応** | ◎ Bedrock + Model Serving | ◎ Cortex（Snowflake内完結） | ◎ Bedrock（最多モデル） | △ 独自環境 |
| **セマンティックレイヤー** | ◎ dbt Semantic Layer + AI-BI Genie | ◎ Cortex Analyst + Semantic Views | ○ dbt + Athena（統合体験なし） | △ オントロジー（独自形式） |

### 将来拡張性の補足: 3層の整理

将来拡張性の論点は以下の3層で整理する。本RFPでは(1)(2)を基本スコープに近い拡張候補、(3)を将来オプションとして提案依頼する。

| 層 | 扱う対象 | Databricks | Snowflake | Foundry |
|----|---------|-----------|-----------|---------|
| **(1) セマンティックレイヤー** | metrics / dimensions / relationships。KPI定義、自然言語分析の精度向上 | dbt Semantic Layer + AI-BI Genie | Semantic Views + Cortex Analyst | — |
| **(2) カタログ/ガバナンス** | メタデータ、タグ、リネージ、アクセス制御 | Unity Catalog（Governed Tags, Lakehouse Federation） | Horizon（Lineage, Data Quality） | Markings, 監査ログ |
| **(3) オントロジー/アクション連携** | objects / links / actions / workflows。業務オペレーションモデル | 直接対応なし（外部製品で補完可） | 直接対応なし | Palantir Ontology |

→ (1)(2)ではDatabricks/Snowflakeが急速に強化中。(3)の業務オペレーションモデルではFoundry型がなお先行。単純な優劣比較は困難であり、要求水準に応じてRFPでの提案を求める。

---

## 3. 技術評価の結論

SOMPOケアの要件を§2.1の評価観点で評価すると、Databricks と Snowflake は拮抗する。

| 要件 | 優位な基盤 | 根拠 |
|------|----------|------|
| 要件1: コスト | 引き分け | 両者とも従量課金。コスト構造の優劣はデータ量・利用パターンに依存 |
| 要件2: 移行確実性 | **Databricks** | PySpark 219本の互換性。Snowflakeは書き直し、AWS Nativeは一部制約 |
| 要件3: 運用・ガバナンス | **Snowflake**（運用）/ **Databricks**（ガバナンス） | 運用自走性はSnowflakeのSQL完結が優位。ガバナンスはUnity Catalogが優位 |
| 要件4: AI拡張性 | **Databricks** | MLflow統合、AI-BI Genie、Vector Search。AI統合が最も進んでいる |

> **結論として、SOMPOケアの要件をRFP基準で評価すると、Databricks と Snowflake は拮抗する。**
> **運用自走性では Snowflake が優位である一方、既存 PySpark 資産の移行工数が主要制約である場合、Databricks が優位となる。**
> **したがって本案件では、代表的な PySpark ジョブでの移行検証を前提条件として、Databricks を第一候補、Snowflake を対抗案とする整理が妥当である。**

### 前提条件（確認が必要）

| 前提 | 状況 | 結論への影響 |
|------|------|-----------|
| PySpark 219本の代表ジョブでの互換性実証 | 検証済み / 未検証 | 未検証の場合、結論は「検証結果を前提条件とする」に留まる |
| Foundry継続シナリオのコスト | 次回オーダーフォームの見積もり取得状況 | Foundryが大幅値下げした場合、移行の費用対効果が変わる |
| オントロジー的拡張の要求水準 | (1)セマンティックレイヤーで十分 / (3)まで必要 | (3)が必須の場合、いずれの基盤でも外部製品が必要 |

---

## 4. レイヤー別 技術スタック比較（別紙C-1準拠）

| レイヤー | Databricks推奨構成 | Snowflake構成 | AWS Native構成 |
|---------|------------------|-------------|---------------|
| ストレージ | S3 + Lakehouse | Snowflake内部（マネージド） | S3 |
| テーブルフォーマット | Delta Lake + UniForm（Iceberg互換） | 標準テーブル ※Iceberg tables選択可 | Iceberg（Glue: v3 / Redshift: v1-v2） |
| ガバナンス | Unity Catalog | Horizon | Glue Data Catalog + Lake Formation |
| オーケストレーション | Lakeflow Jobs（+ Airflow） | Tasks + Streams + Dynamic Tables | Step Functions / MWAA + Glue Jobs |
| データ変換 | PySpark + dbt Core | Snowpark + dbt Core | Glue PySpark + dbt Core |
| セマンティック | dbt + AI-BI Genie | Cortex Analyst + Semantic Views | dbt + Athena |
| BI / 分析 | Tableau + AI/BI Dashboards | Tableau + Snowsight | Tableau + QuickSight |

| 構成指標 | Databricks | Snowflake | AWS Native |
|---------|-----------|-----------|------------|
| コア製品数 | 3つで完結 | 3つで完結 | 6つ以上 |
| 統合UX | ◎ | ◎ | × |
| PySpark移行工数 | 最小（実証前提） | 大（書き直し） | 中（一部制約） |
| 運用スキル | SQL + Python + IaaC | SQL中心 | SQL + Python + AWS複数サービス |

---

*作成: 2026-04-09 | 技術スタック採用方針 別紙A-4/A-5 差し替え用*
