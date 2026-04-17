# Sケア レビュー結果 対応方針

> 対象: 2026-04-09 レビュー結果フィードバック会の指摘事項
> 用途: ラップアップ会での議論ベース → 月曜最終打ち合わせまでの対応整理
> ステータス: draft v2（議事録反映 + ファクトチェック済み + レビュー反映）

---

## 1. レビューで出た指摘の整理（議事録ベース）

### 指摘A: Databricksの評価がRFPの基準と揃っていない（石郷岡氏）

> 「なんでデータブリックスっていうのが優位性が高いのかってところを、RFPに書いてある基準に照らし合わせてちゃんと評価した方がいい」
> 「若干評価項目違ってるんで、RFPのそこに照らし合わせたときにわかりづらい」

**問題の本質:**
- 技術スタック採用方針の評価項目（4原則・8評価観点）と、RFPの評価観点（5つの目指す姿 × 評価項目）が一致していない
- 技術スタック側で「Databricksだから◎」としている項目が、RFPの評価基準とどう対応するかがわからない
- → Databricks推奨の根拠がRFPの土俵で語られていない

**対応:**
- RFPの評価観点（川田さんがマッピング表で整理した5つの目指す姿 × 評価項目）をベースに、Databricks/Snowflake/AWS Nativeを比較する
- 技術スタック採用方針の独自評価ではなく、RFPで使う評価基準で評価する

### 指摘B: 技術評価とベンダー評価を二軸で分けろ（石郷岡氏）

> 「ちゃんと技術的なところで評価した上であとはベンダーをどうするかって評価をして、二軸で評価しないと、ちょっとごっちゃになっちゃう」

**対応:**
- 軸1: プラットフォーム評価（Databricks vs Snowflake vs AWS Native）— RFPの評価基準で
- 軸2: ベンダー評価（富士通 vs デロイト vs 日立 vs PwC）— 実装力・体制・コストで

### 指摘C: オントロジー的な拡張性の情報が欲しい（柴田氏・竹森氏）

> 柴田氏: 「オントロジー的な発想の製品もいくつかあるっていう情報をぜひいただきたい」
> 竹森氏: 「将来の拡張性について提案してくださいっていう形のRFPにしてほしい」

**対応（合意済み）:**
- RFPに「将来の拡張性」をオプション提案として依頼するページを追加（川田さん対応表明済み）
- コストは基本部分と拡張部分を分離して提示させる（山口氏）
- 外部製品の情報を資料に追加（森田さん対応表明済み）

### 指摘D: セマンティックレイヤーの段階的導入の展開（山本氏）

> 「セマンティックレイヤーのところ、AI連携を見据えて段階的に導入というところ、展開をいただければ」

### その他

- **リスク提示の要請（山本氏）**: RFPにプロジェクトリスク提示を追加
- **セールスフォース除外（了承済み）**: ベンダーロックインの観点
- **データ移行範囲（山口氏）**: ローデータ全量で記載。眠りSCANは量次第
- **来週月曜が最終打ち合わせ**

---

## 2. 対応として必要なこと

### 対応1: プラットフォーム比較表（RFPの5分類に揃える）

#### A. RFP「5つの目指す姿」に揃えたプラットフォーム比較

**注記:**
- Snowflakeは「標準テーブル中心」の構成で記載。Snowflake公式では Iceberg tables は「自分で管理する外部クラウドストレージ上の既存データレイク向け」の選択肢、Horizon Catalog はデータ発見・ガバナンスのカタログ層。Iceberg/Horizon活用時はストレージ・フォーマット・ロックイン回避の評価が変わるため、各行で前提を明示
- PySpark互換性は「デコレーター除去でほぼ動作」が技術的前提だが、代表ジョブでの実証は**未検証**。RFPでの検証を必須条件とする
- 各基盤のコスト数値はRFI回答ベースであり、RFPでの精査が必要

| RFPの目指す姿 | RFP評価観点 | 優先度 | Databricks | Snowflake（標準テーブル前提） | AWS Native | Foundry継続 |
|-------------|-----------|--------|-----------|--------------------------|------------|------------|
| **1. コスト最適化** | | | | | | |
| | ストレージ管理 | 必須 | Delta Lake + VACUUM + Predictive Optimization | 自動管理。ユーザー操作不要 | S3 + ライフサイクルポリシー | 自動管理だが全機能分のコスト含む |
| | 年間ランニングコスト | 必須 | DBU従量課金。DeloitteRFI試算: 年$1,500-3,000万。DBU単価の開示をRFPで要求すべき | クレジット従量課金。同等規模で同程度。周辺機能追加でコスト増リスク | 各サービス従量課金合算。TCO見通しが複雑 | 定額ライセンス。更新時も同等額。OverStack解消不可 |
| | TCO管理・透明性 | 必須 | Cost Management UI + System Tables | Resource Monitor + Usage Views | Cost Explorer + 各サービスメトリクス | Palantir社との交渉依存 |
| | **既存ETLコード移植** | 推奨 | ◎ PySpark互換（※代表ジョブでの実証が前提） | △ Snowpark書き直し。工数大 | ○ Glue PySpark。一部制約あり | — |
| | Foundryデータ移行 | 重要 | ○ Delta Lake形式で取り込み | △ Parquet変換が必要 | ○ S3経由 | — |
| **2. 運用安定化・持続可能性** | | | | | | |
| | **運用体制（2名自走）** | 必須 | ○ SQL+Python。IaaC知識も必要 | **◎ SQL中心。学習曲線が最も緩やか** | △ 複数サービスの知識が必要 | × 専用知識への依存が大きい |
| | 監査ログ・コンプライアンス | 必須 | ◎ System Tables | ◎ Access History | ○ CloudTrail + 各サービス | ○ 監査ログあり |
| | データ品質管理 | 必須 | ◎ DLT Expectations | ○ Tasks + Dynamic Tables | ○ Glue Data Quality | ○ データコントラクトあり |
| | リネージ（ブラックボックス防止） | 必須 | ◎ Unity Catalog Lineage | ○ Horizon Lineage | △ Glue Data Catalog（限定的） | △ 自動リネージあるが独自形式 |
| | Git連携 | 必須 | ◎ Repos統合 | ○ Git Integration | ○ GitHub連携 | △ 独自バージョン管理 |
| | データ移行安全性・切り戻し | 必須 | ◎ Delta Lake タイムトラベル | ◎ Time Travel（最大90日） | ○ S3バージョニング | — |
| **3. ガバナンス強化** | | | | | | |
| | 統合カタログ | 必須 | ◎ Unity Catalog（2026: Governed Tags GA） | ○ Horizon | △ Glue Data Catalog + Lake Formation（2サービス） | ○ 統合されているが独自仕様 |
| | セキュリティ（RLS・列マスク） | 必須 | ◎ Unity Catalog RLS + 列マスク | ◎ RLS + Dynamic Data Masking | ○ Lake Formation FGAC（read系中心。書き込み系はIAMベース） | ◎ Markings。ただし独自仕様 |
| | BI利便性（Tableau資産） | 必須 | ◎ Tableau連携 + AI/BI Dashboards | ◎ Tableau連携 + Snowsight | ○ Tableau連携 + QuickSight | ○ 独自BI |
| **4. 現場主導でのデータ活用** | | | | | | |
| | コーディング不要のBI | 必須 | ◎ AI/BI Dashboards + Tableau | ◎ Snowsight + Tableau | ○ QuickSight + Tableau | ○ 独自UI。操作に専用知識が必要 |
| | セルフサービス分析 | 必須 | ◎ SQL Editor + AI-BI Genie（GA） | ◎ Snowsight + Cortex Analyst（GA） | △ Athena + Amazon Q in QuickSight | △ オントロジーでノーコード分析は可だが活用度低 |
| **5. 将来拡張性** | | | | | | |
| | オープンデータフォーマット | 必須 | ◎ Delta Lake + UniForm（Iceberg互換） | 標準テーブル: △ 独自形式 / Iceberg tables利用時: ◎ | ○ Glue path: Iceberg v3 / Redshift query: v1/v2 | × 独自形式 |
| | (a) セマンティックレイヤー | 重要 | ◎ dbt + AI-BI Genie | ◎ Cortex Analyst + Semantic Views（SQL GA 2026/3） | ○ dbt + Athena | △ 独自形式 |
| | (b) カタログ/ガバナンス拡張 | 重要 | ◎ Lakehouse Federation（外部DB統合管理） | ○ Horizon + Iceberg | △ Glue Data Catalog | ○ 統合されているが独自 |
| | (c) オントロジー/アクション連携 | 将来 | △ 直接対応なし。外部製品（Timbr等）との組合せ | △ 直接対応なし。外部製品との組合せ | △ 直接対応なし | **◎ ネイティブ対応。ただし独自形式でロックイン** |
| | ML実験管理 | 重要 | ◎ MLflow ネイティブ統合 | △ Snowpark ML（限定的） | △ SageMaker（別サービス） | △ なし |
| | 非構造データ対応 | 重要 | ◎ Volume + Vector Search | ○ Cortex Search（GA） | ○ S3 + Bedrock | ○ 対応可だが活用度低 |
| | マルチモデル対応 | 重要 | ◎ Bedrock + Model Serving | ◎ Cortex（Snowflake内完結） | ◎ Bedrock | △ 独自環境 |

**将来拡張性の「オントロジー」整理（3層分離）:**

| 層 | 何を扱うか | Databricks | Snowflake | Foundry |
|----|----------|-----------|-----------|---------|
| **(a) セマンティックレイヤー** | metrics / dimensions / relationships。KPI定義、自然言語→SQL精度向上 | dbt Semantic Layer + AI-BI Genie | Semantic Views + Cortex Analyst | — |
| **(b) カタログ/ガバナンス** | メタデータ管理、リネージ、タグ、アクセス制御 | Unity Catalog（Governed Tags, Lakehouse Federation） | Horizon（Lineage, Data Quality） | Markings, 監査ログ |
| **(c) オントロジー/アクション連携** | objects / links / actions / workflows。業務オペレーションモデル | 直接対応なし（外部: Timbr, Stardog等で補完可） | 直接対応なし | **Palantir Ontology（objects + links + actions）** |

→ Foundryのオントロジーは(c)の運用モデル寄りであり、Databricks/Snowflakeの(a)(b)とは本来別概念。
→ semantic layerではDatabricks/Snowflakeが急速に強化中。業務オブジェクト+actionを含む運用モデルではFoundry型がなお先行。単純な優劣比較は困難。
→ RFPでは(1)(2)を基本スコープに近い拡張候補、(3)を将来オプションとして提案依頼する。

#### B. レイヤー別 技術スタック比較（別紙C-1の構成に準拠）

| レイヤー | Databricks推奨構成 | Snowflake構成（標準テーブル前提） | AWS Native構成 | Foundry現行 |
|---------|------------------|-------------------------------|---------------|------------|
| **ストレージ** | S3 + Lakehouse | Snowflake内部ストレージ（マネージド） | S3 | Foundry内部ストレージ |
| **テーブルフォーマット** | Delta Lake + UniForm（Iceberg互換） | 標準テーブル（独自形式）※Iceberg tables選択時はオープン化 | Iceberg（Glue path: v3 / Redshift: v1-v2）/ Parquet | 独自形式 |
| **ガバナンス** | Unity Catalog | Horizon | Glue Data Catalog + Lake Formation | 独自（Markings等） |
| **オーケストレーション** | Lakeflow Jobs（+ Airflow） | Tasks + Streams + Dynamic Tables | Step Functions / MWAA + Glue Jobs | 独自ワークフロー |
| **データ変換** | PySpark + dbt Core | Snowpark + dbt Core | Glue PySpark + dbt Core | 独自パイプライン |
| **セマンティック** | dbt Metric Views + AI-BI Genie | Cortex Analyst + Semantic Views | dbt + Athena | オントロジー |
| **BI / 分析** | Tableau + AI/BI Dashboards | Tableau + Snowsight | Tableau + QuickSight | 独自BI |

| 構成指標 | Databricks | Snowflake | AWS Native |
|---------|-----------|-----------|------------|
| コアとなる製品数 | 3つ | 3つ | 6つ以上 |
| 統合UX | ◎ | ◎ | × |
| PySpark移行工数 | 最小（※実証前提） | 大（書き直し） | 中（一部制約） |
| 運用に必要なスキル | SQL + Python + IaaC基礎 | **SQL中心** | SQL + Python + AWS複数サービス |

#### C. RFP基準による評価結果

> SOMPOケアの要件をRFP基準で評価すると、Databricks と Snowflake は拮抗する。
> 運用自走性では Snowflake が優位である一方、既存 PySpark 資産の移行工数が主要制約である場合、Databricks が優位となる。
>
> したがって本案件では、**代表的な PySpark ジョブでの移行検証を前提条件として、Databricks を第一候補、Snowflake を対抗案とする整理**が妥当である。
>
> その根拠は一般論としての優位性ではなく、既存PySpark資産219本の移行工数を最小化できる可能性と、Unity Catalog / AI-BI を含む将来拡張性にある。
>
> RFPでは、Databricksを推奨基盤として示しつつ、同等要件を満たせる構成であれば他基盤も可とする（v0.4のA案に相当）。

**未確定の前提条件（月曜までに方針を確認）:**
- PySpark 219本の代表ジョブでの互換性実証: 検証済み / 未検証
- Foundry継続シナリオのコスト: 次回オーダーフォームの見積もり取得状況
- オントロジー的拡張の要求水準: (a)セマンティックレイヤーで十分 / (c)まで必要

---

### 対応2: 意思決定の二軸構造の明示

```
┌──────────────────────────────────────────────────┐
│  軸1: プラットフォーム選定（技術評価）              │
│  RFPの5つの目指す姿で Databricks / Snowflake /    │
│  AWS Native を比較                                │
│  → 推奨: PySpark互換性の実証を前提にDatabricksを  │
│     第一候補。Snowflakeを対抗案として保持          │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│  軸2: ベンダー選定（実装力評価）← RFPで実施       │
│  選定された基盤を前提として、誰と組むか           │
│  評価軸:                                         │
│   ・Foundry移行の実績・知見                       │
│   ・運用自走支援の体制・ロードマップ               │
│   ・コスト提案の具体性・透明性                    │
│   ・必要スキルセット・想定体制                    │
│   ・プロジェクトリスクの提示（山本氏追加要望）     │
└──────────────────────────────────────────────────┘
```

### 対応3: 将来拡張性のRFP組み込み

**3層分離に基づくRFP依頼:**

> 将来拡張性の論点は、(1) セマンティックレイヤー、(2) カタログ/ガバナンス、(3) オントロジー/アクション連携の3層に分けて整理する。本RFPでは、(1)を基本スコープの拡張候補、(3)を将来オプションとして提案依頼する。これにより、Foundryのオントロジーと、Databricks/Snowflakeのセマンティック機能を混同せず比較できる。

**RFPに追加するページ（川田さん対応表明済み）:**

```
■ 将来拡張性に関する提案のお願い

【基本スコープ内】
(1) セマンティックレイヤー: KPI定義のコード管理、AI連携を見据えた段階的導入
(2) カタログ/ガバナンス: 統合カタログ、リネージ、アクセス制御

【オプション提案（コスト分離して提示）】
(3) オントロジー/アクション連携:
    ・データ間の関係性をノーコードで探索・分析できる仕組み
    ・将来のAI × データ連携を見据えた拡張設計
    ・外部製品の活用も含めた提案
```

**柴田氏が求めるオントロジー的製品の情報（森田さん調査予定）:**
- **Timbr**: SQLベースのオントロジー。ゼロコピーでDWH上に構築可。Foundry Ontologyに最も近い思想
- **Stardog**: RDF/SPARQLベースのナレッジグラフ。規制産業向け
- **dbt Semantic Layer (Metricflow)**: metrics/dimensionsの標準定義。AI-BI Genieと連携
- **Databricks AI-BI Genie + Semantic Models**: 自然言語→SQL。セマンティックモデルベース
- **Snowflake Cortex Analyst + Semantic Views**: 同上。Snowflake内で完結

### 対応4: セマンティックレイヤー段階的導入（山本氏要望）

```
Phase 1: 移行時（基本スコープ内）
  既存KPI定義をdbt modelsとして再定義（SQL/YAML）
  Unity Catalogへのメタデータ登録
  → 「KPIの定義は何か」「データはどこにあるか」が標準形式で管理される

Phase 2: 運用安定化後（拡張候補）
  AI-BI Genie / Cortex Analyst との接続
  自然言語での問い合わせ（「先月の転倒件数が多い施設は？」）
  → SQLを書かなくてもデータに質問できる環境

Phase 3: 本格AI活用（将来オプション）
  非構造データ（介護記録テキスト）との統合
  ベクトル検索、重度化予測等のMLモデル
```

---

## 3. ラップアップ会での確認事項

**Q1: PySpark互換性の実証状況**
- 219本の代表ジョブで動作確認は取れているか？
- 未検証なら「実証を前提条件とする」旨を資料に明記
- → 結論の強度がここで決まる

**Q2: RFP評価基準との対応確認**
- 対応1-Aの5分類でRFPの評価基準とのズレがないか
- 「運用安定化」と「ガバナンス」を分けたが、川田さんのマッピング表との整合

**Q3: オントロジーの要求水準**
- (a) セマンティックレイヤー（KPI定義・自然言語分析）で十分か
- (c) オントロジー/アクション連携（Foundry的な運用モデル）まで必要か
- → RFPへの組み込み方が変わる

**Q4: 月曜までの作業分担**

| 対応 | 内容 | 担当案 | 期限 |
|------|------|--------|------|
| 対応1 | プラットフォーム比較表（RFP 5分類ベース） | 宮路 | 月曜AM |
| 対応2 | 二軸構造の図示 | 宮路 or 川田 | 月曜AM |
| 対応3 | RFPにオプション提案ページ + オントロジー製品情報 | 川田 + 森田 | 月曜AM |
| 対応4 | セマンティックレイヤー段階的導入の展開 | 宮路 | 月曜AM |
| 追加 | RFPにリスク提示文言 + データ移行範囲記載 | 川田 | 月曜AM |
| **PPTX-1** | **Slide 23-24: PF比較の評価軸をRFP 5分類に揃える** | 宮路 | 月曜AM |
| **PPTX-2** | **Slide 24 結論: 「最有力候補」→「実証前提で第一候補、Snowflake対抗案」に修正** | 宮路 | 月曜AM |
| **PPTX-3** | **Slide 9の前に二軸構造（技術選定→ベンダー選定）を1枚追加** | 宮路 or 川田 | 月曜AM |
| **PPTX-4** | **Slide 28: タイトルを「セマンティックレイヤーの導入方針」に変更、3層分離を補記** | 宮路 | 月曜AM |
| **PPTX-5** | **Slide 30 メリット2: 「ツール数最小」→「3つで完結する構成」に表現修正** | 宮路 | 月曜AM |
| **PPTX-6** | **Slide 25: Snowflakeを基盤として選ぶシナリオは別論点である旨を注記** | 宮路 | 月曜AM |

---

## 別紙: 参考情報

### 製品特性の比較（データ統合プラットフォーム製品の比較.xlsxベース）

| ＃ | 比較ポイント | Databricks | Snowflake |
|----|-----------|-----------|-----------|
| 1 | 製品の出自 | エンジニアリングPaaS出発→機能補完 | DWH SaaS出発→周辺拡充 |
| 2 | 想定利用者 | データエンジニア・ML/AIエンジニア中心 | データサイエンティスト・アナリスト中心 |
| 3 | 対応データ形式 | 構造・非構造の両方。Volume + Vector Search | 構造化データに重き。Cortex Searchで非構造化を強化中 |
| 4 | 基本機能 | 高度なオプション。コードベース | DWHが強固。周辺は統合体験が相対的に弱かったが急速に改善中 |
| 5 | コスト構造 | DBU従量課金。コンピュート選択に知識が必要 | クレジット従量課金。構成次第でコスト増 |
| 6 | パフォーマンス | データ量増加ほど恩恵大 | 高速だがデータ量増加でコスパ懸念あり |
| 7 | セットアップ | 複雑（IaaC前提）。PaaS思想 | 簡単（GUI/IaaC）。SaaS思想 |
| 8 | 運用 | 学習曲線的。インフラ知識必要 | 運用設計上の作法はあるが比較的容易 |
| 9 | 利用の学習曲線 | 初期ハードル高→超えればシンプルに推移 | 初期容易。高度化で機能面の制約あり |
| 10 | 技術スタック | オープン技術中心 | 固有技術中心だがオープン標準への対応を強化中 |
| 11 | コミュニティ | 日本語コミュニティは発展途上 | 日本人コミュニティ活発。国内導入実績多数 |

### 2026年最新動向

| 製品 | 動向 | 出典の留意点 |
|------|------|------------|
| Databricks | Revenue Run-Rate $54億（2026/2発表、+65%超） | run-rate（年換算の推計値）であり通期実績売上ではない |
| Snowflake | FY2026通期売上 $46.8億（+29%） | FY2026=2026/1期末。通期実績 |
| Databricks | Unity Catalog Governed Tags GA（2026/3）、Lakehouse Federation（GA） | 公式リリースノート確認済み |
| Snowflake | Semantic Views: 2025-04 Preview、標準SQL query 2026-03 GA。Snowflake Intelligence: 2025-11 GA。Cortex Analyst: 自然言語→SQLの中核機能として利用可能 | Cortex AnalystのGA日は一次ソースで要確認。日付まで断定する場合は出典を付けること |
| AWS | Glue 5.1: Iceberg 1.10.0対応。Glue 5.0: Iceberg 1.7.1。Redshift: query path v1/v2、write path v2条件付き | Redshiftのv3対応は未確認。Glue path と Redshift path を分けて記述する必要あり |
| AWS | Zero-ETL: Aurora→Redshiftはほぼリアルタイム、DynamoDB→Redshiftは15〜30分間隔の増分レプリケーション | 一律「リアルタイム」は過大。Lake Formation FGACはread系中心、Iceberg DMLはIAM permissions only |

### 市場・エコシステム参考情報

| 観点 | Databricks | Snowflake | AWS Native |
|------|-----------|-----------|------------|
| SOMPOグループ基盤との整合 | AWS上に構築可 | AWS上に構築可 | AWSネイティブ |
| 日本国内の導入実績 | エンタープライズ中心に拡大中 | 国内導入実績多数。コミュニティ活発 | 国内実績多数 |
| ベンダーロックインリスク | 低（Delta Lake=OSS） | 中（Iceberg対応で改善中） | 中（AWS固有だが標準準拠） |
| 人材の採用・育成 | Python/Spark人材 | SQL人材。人材プールが最も広い | AWS認定人材多数 |

---

*作成: 2026-04-09 | v2: レビュー反映（RFP 5分類分離、結論の適正化、Snowflake標準テーブル明記、オントロジー3層分離、表現是正、本文/別紙分離）*
