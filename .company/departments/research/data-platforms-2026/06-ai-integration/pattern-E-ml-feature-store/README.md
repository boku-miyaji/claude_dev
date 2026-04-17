# パターン E: Feature Store + ML — 構造化特徴量でモデル学習

> **ゴール**: diary_entries / emotion_analysis / calendar_events から特徴量を設計し、「翌日の mood_score を予測する」小さなMLモデルを3基盤で学習する。LLM時代にFeature Storeが必要な理由を体感する。

## このパターンの肝

パターンA-Dは「LLMに自然言語で何かやらせる」話だった。パターンEは逆で、**構造化された数値特徴量でテーブルベースの機械学習（XGBoost等）をやる**。

「LLMがあれば古典的MLは要らないのでは？」という疑問は正当。しかし2026年現在、以下の理由でFeature Store + テーブルMLは依然として必要:

1. **数値予測にはLLMより古典MLが優れる**: mood_scoreのような連続値予測は、XGBoost/LightGBMが精度・速度・コストすべてで勝つ
2. **Training-Serving Skew の防止**: 学習時と推論時で同じ特徴量変換を適用するために、Feature Storeが「特徴量の一元管理所」になる
3. **リアルタイム推論**: LLMは数秒かかるが、テーブルMLは数ミリ秒で推論できる。ユーザー体験に直結
4. **コスト**: 10万行の推論コストはLLM（$100-1000）vs ML（$0.01以下）で桁違い

Feature Store の本質は「**特徴量の定義と計算を一度書いたら、学習でも推論でも同じ値が使える**」こと。

## LLM vs ML の使い分け

| ユースケース | LLM | ML (Feature Store) | 理由 |
|---|---|---|---|
| 日記テキストの感情分類 | 最適 | 不向き | 自然言語理解が必要 |
| 日記テキストの要約 | 最適 | 不可 | テキスト生成タスク |
| 翌日の mood_score 予測 | 過剰 | **最適** | 構造化数値の回帰問題 |
| 曜日別の気分パターン検出 | 過剰 | **最適** | 集計+パターン認識 |
| ストレス悪化のアラート | 過剰 | **最適** | 閾値ベースのリアルタイム判定 |
| 類似日記の検索 | 最適 | 代替可 | ベクトル検索 vs 特徴量距離 |

**ルール: 入力が構造化データで、出力が数値やカテゴリなら、まずMLを検討する。LLMは最後の手段。**

## Feature Store の必要性

### Training-Serving Skew とは

学習時: `mood_score_3day_avg = (7+4+3)/3 = 4.67`（3日分のデータで計算）
推論時: `mood_score_3day_avg = (8+7+?)/2 = 7.5`（最新2日分しかない）

→ 学習時と推論時で「3日平均」の計算方法が微妙にずれる。これが **Training-Serving Skew** で、モデルの精度劣化の最大の原因。

Feature Store はこの問題を解決する:
1. 特徴量の計算ロジックを **一箇所で定義**
2. 学習時: Feature Store から特徴量を取得して学習
3. 推論時: Feature Store から同じロジックで計算された最新の特徴量を取得して推論
4. 計算ロジックが常に同一 → Skew がゼロ

### 3基盤のFeature Store比較

| 軸 | Snowflake Feature Store | Databricks Feature Store | Fabric (SemPy + MLflow) |
|---|---|---|---|
| **特徴量の保存先** | Dynamic Table (自動リフレッシュ) | Unity Catalog Delta Table | Lakehouse Delta Table / Power BI Semantic Model |
| **Entity（エンティティ）** | Python API で定義 | Unity Catalog の Table + PrimaryKey | 手動定義（Semantic Model のEntity） |
| **特徴量計算** | Snowpark Python / SQL | Spark / pandas | PySpark / pandas / SemPy |
| **自動更新** | Dynamic Table の TARGET_LAG | Lakeflow Pipelines / Workflow | Fabric Pipeline / Notebook Schedule |
| **学習との統合** | Snowpark ML (XGBoost, LightGBM等) | MLflow 3.0 + scikit-learn / XGBoost / AutoML | MLflow + scikit-learn / SynapseML |
| **Model Registry** | Snowflake Model Registry | Unity Catalog Model Registry (MLflow 3) | Fabric Model Registry (MLflow) |
| **推論** | Snowpark UDF / Model Serving | Model Serving Endpoint (REST API) | PREDICT() / Fabric Endpoint |
| **オンライン特徴量** | Online Feature Store (Redis互換) | Online Table (Cosmos DB ベース) | - (直接的な対応なし) |
| **一番の強み** | Dynamic Table で特徴量が自動リフレッシュ | Unity Catalog 統合で血統（lineage）が完全追跡 | Power BI Semantic Model を特徴量源として流用 |
| **一番の弱み** | エコシステムが Snowflake 閉じ | 学習コストが高い | Feature Store としての機能は限定的 |

出典:
- Snowflake: https://docs.snowflake.com/en/developer-guide/snowflake-ml/feature-store/overview (2026-04-15参照)
- Databricks: https://docs.databricks.com/aws/en/machine-learning/feature-store/train-models-with-feature-store (2026-04-15参照)
- Fabric: https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-overview (2026-04-15参照)

## focus-you の予測タスク

### 目標: 翌日の mood_score を予測

入力特徴量:
- **当日の感情スコア**: joy, sadness, anger, fear, surprise
- **直近3日のmood平均**: mood_score の移動平均
- **曜日**: 月〜日（one-hot encoding）
- **カレンダー情報**: 翌日の予定カテゴリ数（work, social, health, personal）
- **前日との差分**: mood_score の日次変化

出力: 翌日の `mood_score` (1-10の回帰)

### 特徴量一覧

| 特徴量名 | 計算方法 | 型 | 説明 |
|---------|---------|------|------|
| `emotion_joy` | emotion_analysis.joy | FLOAT | 当日のjoyスコア |
| `emotion_sadness` | emotion_analysis.sadness | FLOAT | 当日のsadnessスコア |
| `emotion_stress` | sadness + anger + fear | FLOAT | 複合ストレス指標 |
| `mood_3day_avg` | AVG(mood_score) OVER (3日) | FLOAT | 直近3日の気分平均 |
| `mood_7day_avg` | AVG(mood_score) OVER (7日) | FLOAT | 直近7日の気分平均 |
| `mood_diff` | mood_score - LAG(mood_score) | INT | 前日からの変化 |
| `day_of_week` | DAYOFWEEK(entry_date) | INT | 曜日（0=日, 6=土） |
| `is_weekend` | day_of_week IN (0, 6) | BOOL | 週末フラグ |
| `next_day_work_count` | COUNT(work events) | INT | 翌日の仕事予定数 |
| `next_day_social_count` | COUNT(social events) | INT | 翌日の社交予定数 |

## ハンズオン手順（概要）

| 基盤 | ファイル | 所要時間 |
|------|---------|---------|
| Snowflake | `snowflake-feature-store.md` | 70分 |
| Databricks | `databricks-feature-store-mlflow.md` | 70分 |
| Fabric | `fabric-mlflow-semantic-link.md` | 60分 |

推奨順: Databricks（Feature Store + MLflow の統合が最も体系的）→ Snowflake（Dynamic Table による自動更新が面白い）→ Fabric（SemPyのユニークなアプローチを体験）

## 設計論点（プロダクション目線）

### 特徴量の鮮度

- **バッチ**: 1日1回更新。翌朝の予測に前日までのデータを使う
- **ニアリアルタイム**: 数分〜数時間ごとに更新。日記を書いたらすぐ特徴量が更新される
- **リアルタイム**: 推論時に最新データから特徴量を計算。レイテンシは増えるが最新

focus-you の場合、日記は1日1回書くのでバッチで十分。ただし「日記を書いた直後に明日の気分予測を表示する」ならニアリアルタイムが必要。

### モデルの再学習

- **頻度**: データが30日分ならモデルの精度は低い。半年分溜まったら再学習する価値がある
- **トリガー**: 予測精度が閾値を下回ったら自動再学習（Model Monitoring）
- **A/Bテスト**: 新旧モデルを同時に動かして比較

### 教材化の観点

パターンEは「LLM万能主義への反論」として教材価値が高い:
- **5分ミニ教材**: 「mood予測: LLMに聞くと3秒・$0.01、XGBoostなら3ms・$0.00001」のコスト比較
- **驚きポイント**: 30行でもXGBoostが動いて予測値を出す瞬間（精度は低いが「動く」体験が重要）

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Snowflake Feature Store: Dynamic Table + Snowpark ML。2026年にIceberg対応を追加（https://docs.snowflake.com/en/developer-guide/snowflake-ml/feature-store/overview）
- Databricks Feature Store: Unity Catalog統合 + MLflow 3.0。FeatureLookup で自動結合。LoggedModel で再現性強化（https://docs.databricks.com/aws/en/machine-learning/feature-store/train-models-with-feature-store）
- Fabric SemPy: Power BI Semantic Model を特徴量源として利用するユニークなアプローチ（https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-overview）
- MLflow 3.0: Databricks と Fabric の両方で利用可能。モデルの追跡・評価・デプロイの標準（https://docs.databricks.com/aws/en/mlflow/）

### 2. 限界の明示

- **30行のデータ量**: 機械学習モデルを本気で学習するには少なすぎる。ここでの学習は「体験」目的で、精度は期待できない
- **Feature Store の必要性**: 30行ではFeature Storeを使わなくてもpandas DataFrame で十分。Feature Store の価値は100テーブル・100特徴量以上の規模で顕在化する
- **オンラインFeature Store**: Snowflake / Databricks ともGA・Previewの段階があり、個人トライアルでの検証には制約がある
- **Fabric のFeature Store**: Fabric には明示的な「Feature Store」製品がない。SemPy + Lakehouse で代替するが、他2基盤ほど体系的ではない

### 3. 壁打ちモードへの導線

1. **「LLM時代になぜFeature Storeが生き残るのか？をクライアントに30秒で説明するなら？」** — コスト・速度・再現性の3軸で、構造化データの予測にはMLが合理的
2. **「focus-you で本当にmood予測が欲しいユーザーがいるか？」** — 予測されること自体が不快に感じるユーザーもいる。UX設計の問題
3. **「Feature Store を導入すべきクライアントの基準は？」** — 特徴量が10個以上、MLモデルが3つ以上、チームが2人以上ならFeature Storeの導入効果が見える
4. **「AutoML とFeature Store は競合するか？」** — AutoMLは特徴量エンジニアリングも自動化するが、Feature Store の「管理された特徴量の再利用」とは補完関係
5. **「予測精度が30行だと低いことをどう説明するか？」** — 「30行は体験用。半年分のデータで再学習すると精度はこのくらい上がる見込み」と伝える
