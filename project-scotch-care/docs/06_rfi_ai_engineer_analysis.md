# RFI技術分析: AIエンジニア視点

> 作成日: 2026-03-03 | 視点: AIエンジニアとして各提案の技術的実現性・拡張性・落とし穴を評価

---

## 1. 最重要の技術判断: 「何を基盤に据えるか」

RFI回答を全部読んで最初に感じたのは、**各社が「自分たちの得意なレイヤー」を中心に据えている**ということ。だが本PJTの技術的な核心は以下の順番で重い。

```
重要度: ETL/パイプライン移行 >>> DWH選定 >> BI選定 > AI/ML拡張
```

BIツール比較に引っ張られがちだが、**Foundryの真の価値はパイプラインオーケストレーション**にある。BI層は正直どのツールでも置き換え可能だが、ETL層の移行を失敗するとプロジェクト全体が頓挫する。

---

## 2. Foundryからの移行: 技術的に何が難しいか

### 2-1. Foundry（Palantir）の技術特性

Foundryは単なるBIツールではない。以下の機能が**密結合**で提供されている:

- **データ統合（Pipeline Builder）**: PySpark/Java/SQLベースのETLジョブ。GUI + コードのハイブリッド
- **オントロジー**: データ間の関係をグラフ構造で定義（RDBのスキーマとは異なる概念）
- **ブランチング**: Gitライクなデータバージョニング（テスト/本番のデータ分離）
- **Contour/Slate**: 分析UI + アプリケーションビルダー
- **Actions/Workflows**: トリガーベースの自動化

### 2-2. 移行の技術的リスクマップ

| Foundry機能 | 移行先候補 | 難易度 | 根拠 |
|---|---|---|---|
| **PySparkパイプライン** | Glue Spark Job / Databricks Notebook | **高** | コード自体は移植可能だが、Foundry固有API（@transform decorator等）の書き換えが必要。パイプライン間の依存関係グラフの再構築が最大の工数 |
| **オントロジー** | 該当なし（再設計必須） | **最高** | Foundry独自概念。RDBスキーマ + Data Catalog + Graph DBで代替するしかない。**どのベンダーもこの課題に言及していない** |
| **データブランチング** | Delta Lake / Iceberg + Git連携 | **中** | Delta LakeのTime TravelやIcebergのSnapshot機能で部分的に代替可能だが、Foundryほどの柔軟性はない |
| **Contour（分析UI）** | Tableau / QuickSight / Power BI | **低** | ダッシュボード再作成は工数は掛かるが技術的には容易 |
| **Actions/Workflows** | Step Functions / Airflow / Databricks Workflows | **中** | ジョブオーケストレーションの再設計。現行のトリガー条件・スケジュールの棚卸が前提 |

**最大の盲点: オントロジー移行**。RFI回答5社すべてがこの問題を直接的に扱っていない。富士通のみが「現行エンジニアが在籍」と言っているが、オントロジーの再設計方針には触れていない。ここは**RFP時に明確に問うべき**。

### 2-3. 各ベンダーのFoundry移行対応力（辛口評価）

| ベンダー | PySparkパイプライン | オントロジー | ブランチング | 総合 |
|---|---|---|---|---|
| **デロイト** | Glue Spark JobまたはDatabricks Notebook。Foundry→Glue移行性が「高い」と自ら記載。具体的にGlue Python Shell/Spark Jobの使い分けまで提示 | 未言及 | Delta Lake Time Travel | **B+** |
| **富士通** | DI BasicのDatabricks Notebookで移行。**現行エンジニアが在籍**という唯一のアドバンテージ | 未言及だが内部知見あり | Databricks | **A-**（人依存リスク） |
| **日立** | HULFT Square → Snowflakeのフロー。だが**PySparkコードはそのまま移行できない**。SQLベースに書き直す必要がある | 未言及 | Snowflake Time Travel | **C+** |
| **PwC** | Glue → Redshift。方向性は妥当だがFoundry固有の移行知見は見えない | 未言及 | なし | **B-** |
| **Salesforce** | Tableau Prep（GUI ETL）。**PySpark移行は完全にスコープ外** | 未言及 | なし | **D**（ETL層はBIベンダーのスコープ外） |

---

## 3. データパイプラインアーキテクチャの評価

### 3-1. 各社の提案するデータフロー

**デロイト（Databricks案）**:
```
データソース → S3(Raw) → Delta Lake Bronze → Silver → Gold → BI
                              ↑ Lakeflow/DLT                ↑
                              Databricks Workflows          AI-BI Genie
                              Unity Catalog ──────────────→ MLflow
```

**技術的評価**: Medallionアーキテクチャ（Bronze/Silver/Gold）は現在のデータエンジニアリングの**デファクト標準**。Delta Live Tables（DLT）でパイプライン品質チェックが宣言的に書ける。Unity CatalogによるデータリネージもFoundryのパイプライン可視性に近い体験を提供できる。**最も技術的に筋が良い**。

**日立システムズ（Snowflake案）**:
```
データソース → HULFT Square(No-Code ETL) → Snowflake → Tableau/PowerBI
                                              ↑
                                         TASK + DAG
                                         Cortex AI
```

**技術的評価**: Snowflakeの TASK/DAGによるパイプラインは**SQLベース**であり、PySpark資産を持つ本PJTでは書き直しコストが発生する。一方、HULFT Squareのノーコードは非エンジニアでも扱える利点があり、**内製化フェーズでは強い**。Snowflakeのauto-suspend/auto-resumeは本当に運用が楽。ニアゼロメンテナンスの主張は技術的に妥当。

**デロイト（AWS Native案）**:
```
データソース → S3 → Glue(ETL) → Redshift → QuickSight
                      ↑                      ↑
                   DataBrew(No-Code)      SageMaker/Bedrock
                   Glue Catalog
```

**技術的評価**: AWS Nativeはベンダーロックインに見えるが、実はGlue/Redshift/S3の組み合わせは**AWSから出る時も比較的移行しやすい**（S3は事実上の標準、Glue JobのPySparkコードは可搬）。ただしQuickSightはBIとしての表現力がTableauに大幅に劣る。

**富士通（DI Basic）**:
```
データソース → DI Basic(Databricks + dbt Core + Aurora + Kafka) → Tableau/PowerBI
                              ↑
                         テンプレート適用
                         Kozuchi(GenAI)
```

**技術的評価**: dbt Coreの採用は注目すべき。dbtはSQL-firstのtransformationツールで、**テスト・ドキュメント・バージョン管理がコードとして一体化**する。ただしdbt Coreの学習曲線はそこそこある。Kafkaが入っているのは**ストリーミング対応**（ナースコールのリアルタイム分析等）を見据えているからだろう。テンプレートベースの「開発50%削減」は典型的な営業トークだが、dbtのモデルテンプレートは実際にある程度の再利用が効く。

### 3-2. パイプラインアーキテクチャの推奨

**結論: Databricks Medallion（Bronze/Silver/Gold）+ dbt Coreの組み合わせが最適**

理由:
1. PySpark資産の最も自然な移行先がDatabricks
2. dbtによるtransformation層の標準化はテスト・ドキュメント・CI/CDを一体化
3. Unity CatalogがFoundryのデータリネージ機能を代替
4. Delta Lakeのオープンフォーマットでベンダーロックイン回避
5. ML Flowとの統合でAI/MLパイプラインもカバー

**これを提案に含んでいるのはデロイト（Databricks案）と富士通（DI Basic）**のみ。

---

## 4. AI/ML拡張性の技術評価

### 4-1. 各社のAI/ML提案の「本気度」判定

| ベンダー | 予測AI | 生成AI | MLOps | 本気度 |
|---|---|---|---|---|
| **デロイト** | SageMaker/Databricks ML | Bedrock/Dify/MosaicML/AI-BI Genie | MLflow + Databricks Model Serving | **本気**。具体的なユースケース（需要予測、感情分析、FAQ改善、退院サマリー生成）まで記載。Agentic AIのマルチエージェント構成図まで提示 |
| **富士通** | DI Basic AutoML / Kozuchi | Kozuchi（独自GenAI） | DI Basic内蔵 | **中程度**。AutoMLは提供するが、具体的な介護ユースケースへの適用例が薄い |
| **日立** | DataRobot / Snowflake Cortex AI | Cortex Copilot / Cortex Analyst | DataRobot MLOps | **実用的**。DataRobotのAutoMLは導入障壁が低い。Snowflake Cortex AIも急速に進化中 |
| **PwC** | Step3で将来検討 | Step3で将来検討 | なし | **後回し**。初期フェーズではAI機能を含めない方針 |
| **Salesforce** | Data 360 Model Builder（松のみ） | Tableau Pulse / Tableau Agent | Einstein Studio | **松プラン限定**。梅/竹ではAI機能なし。BYOM with SageMakerは面白いがData 360前提 |

### 4-2. 介護ドメインで実際に価値のあるAI/MLユースケース

RFI回答から読み取れる提案と、実現可能性を技術的に評価:

**短期（1年以内）で実現可能**:
1. **施設KPIの異常検知** — 稼働率・人員配置の閾値アラート → Tableauの条件付きアラートで十分。AIは不要
2. **ナースコールパターン分析** — 時系列クラスタリングで頻出パターン抽出 → Databricks ML / DataRobot AutoMLで実現可能
3. **定型レポート自動生成** — ダッシュボードサマリーの自然言語化 → Tableau Pulse / AI-BI Genie / Cortex Analystで実現

**中期（1-2年）で実現可能**:
4. **ケア記録のテキスト分析** — 感情分析・キーワード抽出・傾向把握 → Bedrock/Cortex AI + 介護用語辞書のファインチューニングが必要
5. **体調変化の予測** — バイタルデータの時系列予測 → 要データ品質確認。データが揃えばLSTM/Transformerで実現可能
6. **RAGベースのケア知識検索** — ケアマニュアル・過去事例からの知見検索 → Vector DB + LLM。技術的には確立されている

**長期（2年以上）/ 要研究**:
7. **個別ケア最適化（CMCの核心）** — 個人に最適なケアプランの推薦 → **これが最も難しい**。因果推論が必要で、ランダム化比較試験なしでは効果検証が困難
8. **Agentic AI** — デロイトが提示したStage4。業務自動化まで行くには、介護業務プロセス全体のデジタル化が前提

### 4-3. AI/MLアーキテクチャの推奨

```
                  ┌─────────────────────────┐
                  │   Feature Store         │
                  │  (Databricks/Snowflake) │
                  └──────┬──────────────────┘
                         │
  ┌──────────┐    ┌──────▼──────┐    ┌───────────────┐
  │ 構造化データ │───▶│ ML Pipeline │───▶│ Model Registry│
  │(DWH/Lake) │    │ (MLflow)    │    │ (MLflow)      │
  └──────────┘    └──────┬──────┘    └───────┬───────┘
                         │                    │
  ┌──────────┐    ┌──────▼──────┐    ┌───────▼───────┐
  │非構造化データ│───▶│ LLM/GenAI   │───▶│ Model Serving │
  │(テキスト等)│    │(Bedrock/    │    │ (Endpoint)    │
  └──────────┘    │ Cortex AI)  │    └───────┬───────┘
                  └─────────────┘            │
                                      ┌──────▼──────┐
                                      │ BI/アプリ    │
                                      │(Tableau等)  │
                                      └─────────────┘
```

**重要**: Feature StoreとModel Registryの存在が見落とされている。どのベンダーも「AIモデルを作れます」とは言うが、**モデルのバージョン管理・A/Bテスト・再学習パイプライン（MLOps）**まで含めた提案はデロイト（MLflow）のみ。

---

## 5. データガバナンス・品質管理

### 5-1. 現行の課題（ヒアリングから確認済み）

- DB命名規則の形骸化
- マスタデータのシステム間不整合
- データ構造/分析知見の属人化
- 過去データとの不整合
- 監査ログ未整備

### 5-2. 各社のガバナンス提案

| ベンダー | Data Catalog | Data Lineage | Data Quality | MDM |
|---|---|---|---|---|
| **デロイト** | Unity Catalog / Glue Catalog | Unity Catalog内蔵 | Delta Live Tables Expectations | なし |
| **富士通** | Unity Catalog（DI Basic内蔵） | Unity Catalog | なし | なし |
| **日立** | Snowflake内蔵メタデータ | HULFT Squareフロー可視化 | なし | なし |
| **PwC** | Amazon DataZone推奨 | DataZone内蔵 | なし | **あり（唯一）** |
| **Salesforce** | Data 360ガバナンス（松のみ） | Data 360（松のみ） | なし | なし |

### 5-3. 技術的に必要なガバナンス要件

Foundryの最大の強みの一つは**データリネージの自動追跡**。移行先でこれを失うと、「どのデータがどこから来て、どう加工されたか」が再びブラックボックス化する。

**最低限必要**:
1. **カラムレベルリネージ**: テーブル単位ではなくカラム単位で追跡。Unity Catalog / DataZoneで可能
2. **データ品質チェックの自動化**: パイプラインの各ステージで品質ルールを定義。DLT ExpectationsまたはGreat Expectations（OSS）
3. **メタデータ管理**: テーブル定義・カラム説明・オーナー情報。Data Catalogで管理
4. **アクセス制御+監査ログ**: 行レベルセキュリティ + 誰がいつ何にアクセスしたか。全社で必須

**MDMについて**: PwCのみが提案しているが、介護業務システムリプレース（2028/5）でマスタ構造が変わる可能性がある。**今の段階でMDMに大きな投資をするのはリスクが高い**。まずはData Catalogでメタデータを整理し、MDMは2028年以降に検討が妥当。

---

## 6. 技術選定で確認すべきこと（AIエンジニア視点）

### 6-1. PoCで必ず検証すべき技術項目

| # | 検証項目 | なぜ重要か | 検証方法 |
|---|---|---|---|
| T1 | **PySparkパイプラインの移行工数** | Foundry→新環境の最大リスク。実際に1本移行して工数を実測 | 現行パイプラインの中から代表的なもの（中程度の複雑さ）を1本選び、PoC環境で再実装 |
| T2 | **ETLジョブの実行パフォーマンス** | 現行と同等以上のバッチ処理速度が必要 | 同一データ・同一処理で現行Foundryと新環境の処理時間を比較 |
| T3 | **データリネージの再現性** | Foundryのリネージ機能を失うと運用崩壊 | Unity Catalog or DataZoneで、パイプライン全体のカラムレベルリネージが可視化できるか |
| T4 | **行レベルセキュリティ** | 介護記録は要配慮個人情報。施設ごとにアクセス制限が必須 | 施設A/B/Cのテストデータを用意し、ユーザーAには施設Aのデータのみ見えることを確認 |
| T5 | **非構造化データのLLM処理** | ケア記録テキストの分析はAI活用の核心 | 実際のケア記録（匿名化済）を入力し、感情分析/要約/キーワード抽出の精度を評価 |
| T6 | **BI表現の再現度** | 現行4アプリのダッシュボードを新BIツールで再現できるか | 施設運営モニターのダッシュボードを実データで再現し、表現力・操作性を施設長に評価してもらう |

### 6-2. RFPに盛り込むべき技術仕様

```yaml
# RFP技術仕様（案）

data_pipeline:
  must:
    - PySpark互換のジョブ実行環境
    - GUIベースのジョブ作成（ノーコード/ローコード）
    - ジョブスケジューリング（cron + イベントトリガー）
    - パイプライン依存関係の可視化
    - テスト環境と本番環境の分離
  should:
    - Data Quality Check（宣言的ルール定義）
    - CI/CDパイプライン対応（Git連携）
    - ストリーミング対応（ナースコールリアルタイム分析用）

data_storage:
  must:
    - S3互換のデータレイク
    - 列指向フォーマット（Parquet/ORC）
    - ACID トランザクション
    - Time Travel（過去データ参照）
  should:
    - Open Table Format（Delta Lake / Iceberg）
    - コンピュート・ストレージ分離（コスト最適化）

data_governance:
  must:
    - カラムレベルのデータリネージ
    - 行レベルセキュリティ
    - 監査ログ（アクセス・変更履歴）
    - メタデータ管理（テーブル/カラム定義）
  should:
    - データ品質ダッシュボード
    - データ分類（個人情報タグ付け）

ai_ml:
  must:
    - Python実行環境（Jupyter互換）
    - 主要MLライブラリ対応（scikit-learn, XGBoost, LightGBM）
  should:
    - AutoML機能
    - LLM/GenAI API連携（Bedrock / OpenAI等）
    - Model Registry（バージョン管理）
    - Feature Store
  want:
    - Vector DB（RAG用）
    - Model Serving（リアルタイム推論エンドポイント）
    - A/Bテスト基盤

bi_analytics:
  must:
    - 定型ダッシュボード（フィルター/ドリルダウン）
    - モバイル対応（施設での閲覧）
    - 行レベルセキュリティとの連動
    - アラート通知（閾値超過時）
  should:
    - セルフサービスBI（非エンジニアがダッシュボード作成）
    - 自然言語でのデータ問い合わせ
    - 埋め込み分析（既存業務アプリへの統合）
```

---

## 7. 技術アーキテクチャの推奨案

### 7-1. 推奨構成

```
┌─────────────────────────────────────────────────────┐
│                    AWS環境                           │
│                                                     │
│  ┌───────────┐  ┌─────────────────────────────────┐ │
│  │ データソース │  │      Databricks on AWS          │ │
│  │           │  │                                 │ │
│  │ ・業務DB   │──▶│  S3 (Data Lake)                │ │
│  │ ・ケア記録  │  │    ├─ Bronze (Raw)              │ │
│  │ ・バイタル  │  │    ├─ Silver (Cleansed)         │ │
│  │ ・ナースコール│ │    └─ Gold (Aggregated)         │ │
│  │ ・IoTセンサー│ │                                 │ │
│  └───────────┘  │  dbt Core (Transformation)      │ │
│                 │  DLT (Pipeline Quality)         │ │
│                 │  Unity Catalog (Governance)     │ │
│                 │  MLflow (ML Pipeline)           │ │
│                 │                                 │ │
│                 └──────────┬──────────────────────┘ │
│                            │                        │
│                 ┌──────────▼──────────────┐         │
│                 │       Tableau Cloud      │         │
│                 │  (Private Connect経由)   │         │
│                 │  ・定型ダッシュボード      │         │
│                 │  ・セルフサービスBI       │         │
│                 │  ・Tableau Pulse (AI)    │         │
│                 └─────────────────────────┘         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ AI/GenAI (将来拡張)                          │   │
│  │  ・Amazon Bedrock (LLM)                     │   │
│  │  ・OpenSearch (Vector DB for RAG)           │   │
│  │  ・SageMaker (カスタムモデルが必要な場合)     │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 7-2. なぜこの構成か

| 選択 | 理由 |
|---|---|
| **Databricks on AWS** | PySpark資産の自然な移行先。Delta Lake（オープンフォーマット）でロックイン回避。Unity Catalogが Foundryのリネージ機能を代替。SOMPOグループがAWS前提なので「on AWS」 |
| **dbt Core** | Transformationのテスト・ドキュメント・バージョン管理を標準化。OSSで ロックインなし。富士通が唯一提案しているが、Databricks案にも組み合わせ可能 |
| **Tableau Cloud** | SOMPOグループに既存導入実績。BIとしての表現力・ユーザーコミュニティが 最も充実。Private ConnectでAWS環境とセキュア接続。Gartner 14年連続Leader |
| **Bedrock（将来）** | AWS Nativeの LLMサービス。Claude/Llama等のモデル選択が可能。ケア記録のテキスト分析・RAGに将来活用 |

### 7-3. この構成が対応できないもの（正直に）

- **ノーコードETL**: Databricksはコードファーストが基本。HULFT Squareのようなドラッグ&ドロップではない。DLTのGUIモードやdbt CloudのUIである程度は補えるが、完全なノーコードではない
- **ニアゼロメンテナンス**: Snowflakeほどの「放置しても動く」感はDatabricksにはない。クラスター管理・コスト最適化には一定のスキルが必要
- **即座のAutoML**: DataRobotほどの「ボタン一つでモデル作成」は標準では提供されない。ML Flowを使うにはある程度のMLエンジニアリング知識が必要

→ **これらの弱点を補うために、初期フェーズではデロイトまたは富士通の技術支援が必須**

---

## 8. SOMPOグループ技術戦略との整合

### 8-1. 確認が取れている情報

- **Gemini Enterprise PoC**: 進行中 → Google系AI の方向性があるならBedrock一本槍は危険
- **AI-Readyデータプラットフォーム（FY2026）**: 技術選定未確認 → **ここがDatabricksかSnowflakeかで全体の推奨が変わる**
- **グループ顧客共通基盤（2026/10〜）**: SOMPOケアのデータが含まれるなら、新分析環境からのデータ連携設計が必要

### 8-2. 技術方針確認前に決めてはいけないこと

**グループのAI-Readyプラットフォームの技術スタックが判明するまで、DWH/Data Lake製品の最終選定は保留すべき**。

もしグループがDatabricksを採用するなら → 本PJTもDatabricksが整合
もしグループがSnowflakeを採用するなら → 日立システムズ案が浮上
もしグループがAWS Nativeなら → デロイトAWS案が最適

**PoC段階では「複数のDWH候補で検証する」設計にすべき。ETLとBIは先に決められるが、DWH層だけはグループ方針を待つ価値がある。**

---

## 9. 技術的な「地雷」リスト

RFIを読んで見つけた、各社が言わない/気づいていない技術リスク:

### 地雷1: Foundryオントロジーの消失
Foundryのオントロジーは「データ間の意味的関係」を保持する。これを失うと、新環境では単なるテーブル群になり、**ドメイン知識がコードやドキュメントに散逸**する。→ 移行前にオントロジー定義を棚卸し、ERD+Data Catalog+ドキュメントとして外部化する作業が必須

### 地雷2: Tableau Viewerライセンスの爆発
介護施設の現場スタッフ全員にViewerを配布するとライセンス数が数千に。**本当に全員がTableauを直接見る必要があるか？** 施設単位で数名が見てPDF/画像で共有する運用のほうがコスト合理的な場合がある

### 地雷3: リアルタイム要件の隠れた存在
ナースコール分析は「根因分析」と書かれているが、**リアルタイムアラートが必要なら**バッチ処理前提のアーキテクチャでは対応不可。Kafka/Kinesis等のストリーミング層が必要になる（富士通のみKafkaを含む）

### 地雷4: 介護業務システムリプレース（2028/5）によるデータソース断絶
新分析環境のETLパイプラインが現行業務システムのDB/APIに依存する形で構築された場合、2028/5のリプレースで**全パイプラインの書き直し**が発生する。→ ETL層にデータソースの抽象化レイヤー（API Gateway / Ingestion Layer）を設ける設計が必要

### 地雷5: Gemini PoC とLLM方針の不整合
SOMPOグループがGemini（Google）でPoCしているのに、新分析環境がAWS Bedrock（Anthropic/Meta等）前提で構築されると、**グループのLLM方針と矛盾**する可能性。→ LLM層は特定プロバイダに依存しないAPI抽象化（LiteLLM等）を採用すべき

---

## 10. 今後のアクション（技術者として）

### 即座にやるべきこと
1. **Foundryパイプラインの棚卸**: 全パイプラインのリスト化（本数・複雑度・依存関係・使用API）
2. **オントロジー定義の外部化**: ER図 + データ辞書としてドキュメント化
3. **現行データ量の実測**: テーブル別のレコード数・サイズ・更新頻度

### RFPに反映すべきこと
1. Foundryパイプライン移行の**具体的方法論**を要求（「対応可能」ではなく、実際の移行手順を書かせる）
2. PoCでの**パイプライン移行工数の実測**を必須項目にする
3. **データリネージの再現**をPoC評価項目に含める
4. **DWH層は2案提示**を許可し、グループ方針確定後に最終決定する設計にする

### PoCの技術評価基準
```
Pass/Fail:
  - [ ] PySparkパイプラインが動作するか
  - [ ] 行レベルセキュリティが機能するか
  - [ ] カラムレベルリネージが可視化されるか

定量評価:
  - パイプライン移行工数（人日/パイプライン）
  - バッチ処理時間（現行比）
  - ダッシュボード表示速度
  - ストレージコスト（GB単価）
  - コンピュートコスト（ジョブ実行単価）

定性評価:
  - 開発体験（IDE/Notebook使いやすさ）
  - 運用監視のしやすさ
  - ドキュメント・コミュニティの充実度
  - 日本語サポートの質
```
