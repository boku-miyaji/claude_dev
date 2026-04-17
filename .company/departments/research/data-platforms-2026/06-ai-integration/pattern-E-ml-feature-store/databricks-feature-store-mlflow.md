# Databricks Feature Store + MLflow 3.0 — Unity Catalog 統合ハンズオン

> **所要時間**: 70分 / **前提**: Databricks ワークスペース（Community Edition不可、Trial可）、第1弾でCSVロード済み / **ゴール**: Unity Catalog Feature Store で特徴量テーブルを作成し、FeatureLookup で学習データを自動構築、MLflow 3.0 LoggedModel でモデルを追跡、score_batch で推論、AutoML と手動モデルを比較する

## Databricks Feature Store とは何か

Databricks Feature Store は Unity Catalog に統合された特徴量管理基盤。2025年後半に「Feature Engineering in Unity Catalog」として再ブランディングされ、MLflow 3.0 の LoggedModel コンセプトと深く結合した。

核心的な違いは **FeatureLookup** の仕組み: 学習時に「この特徴量テーブルから、このキーで結合して、この列を使う」と宣言的に書くと、推論時にも **同じ結合ロジック** が自動適用される。Training-Serving Skew を仕組みで防ぐ。

もう1つの強みは **Unity Catalog のリネージ**: 特徴量テーブル → 学習データセット → モデル → 推論結果 の血統が自動追跡される。「このモデルはどの特徴量で学習されたか」が常に辿れる。

公式ドキュメント:
- Feature Engineering: https://docs.databricks.com/aws/en/machine-learning/feature-store/train-models-with-feature-store (2026-04-16参照)
- MLflow 3.0: https://docs.databricks.com/aws/en/mlflow/ (2026-04-16参照)
- LoggedModel: https://docs.databricks.com/aws/en/mlflow/models (2026-04-16参照)
- AutoML: https://docs.databricks.com/aws/en/machine-learning/automl/ (2026-04-16参照)
- score_batch: https://docs.databricks.com/aws/en/machine-learning/feature-store/automatic-feature-lookup (2026-04-16参照)

## アーキテクチャ

```
Unity Catalog
├── focus_you.raw
│   ├── diary_entries (Delta Table)
│   ├── emotion_analysis (Delta Table)
│   └── calendar_events (Delta Table)
│
├── focus_you.features         ← Feature Tables
│   ├── emotion_features       (Primary Key: entry_date)
│   └── calendar_features      (Primary Key: entry_date)
│
├── focus_you.models           ← Model Registry (MLflow 3.0)
│   └── mood_predictor
│       ├── Version 1 (手動XGBoost)
│       └── Version 2 (AutoML)
│
└── focus_you.inference
    └── mood_predictions       (score_batch の出力)

MLflow 3.0
├── Experiment: /focus-you/mood-prediction
│   ├── Run: manual-xgboost
│   │   └── LoggedModel → mood_predictor v1
│   └── Run: automl-best
│       └── LoggedModel → mood_predictor v2
```

## 事前準備

Databricks Notebook（Python）で:

```python
# ランタイム: Databricks Runtime 15.4 ML 以上を推奨
# Unity Catalog 対応ワークスペースが必要

import databricks.feature_engineering as fe
from databricks.feature_engineering import FeatureEngineeringClient, FeatureLookup
from pyspark.sql import functions as F
from pyspark.sql.window import Window
import mlflow

# Feature Engineering クライアント
fe_client = FeatureEngineeringClient()

# カタログとスキーマの準備
spark.sql("CREATE CATALOG IF NOT EXISTS focus_you")
spark.sql("CREATE SCHEMA IF NOT EXISTS focus_you.features")
spark.sql("CREATE SCHEMA IF NOT EXISTS focus_you.models")
spark.sql("CREATE SCHEMA IF NOT EXISTS focus_you.inference")

# MLflow 実験の設定
mlflow.set_experiment("/focus-you/mood-prediction")
```

## ハンズオン Step 1: Feature Table の作成（15分）

### 1-1. 感情特徴量テーブル

Feature Table は Unity Catalog の Delta Table に主キー制約を付けたもの。

```python
# diary_entries と emotion_analysis を結合して特徴量を計算
diary_df = spark.table("focus_you.raw.diary_entries")
emotion_df = spark.table("focus_you.raw.emotion_analysis")

# ウィンドウ関数で移動平均を計算
window_3d = Window.orderBy("entry_date").rowsBetween(-2, 0)
window_7d = Window.orderBy("entry_date").rowsBetween(-6, 0)

emotion_features = (
    diary_df
    .join(emotion_df, on="entry_date", how="left")
    .select(
        F.col("entry_date"),
        F.col("joy").alias("emotion_joy"),
        F.col("sadness").alias("emotion_sadness"),
        F.col("anger").alias("emotion_anger"),
        F.col("fear").alias("emotion_fear"),
        F.col("surprise").alias("emotion_surprise"),
        (F.col("sadness") + F.col("anger") + F.col("fear")).alias("emotion_stress"),
        F.avg("mood_score").over(window_3d).alias("mood_3day_avg"),
        F.avg("mood_score").over(window_7d).alias("mood_7day_avg"),
        (F.col("mood_score") - F.lag("mood_score", 1).over(Window.orderBy("entry_date"))).alias("mood_diff"),
        F.dayofweek("entry_date").alias("day_of_week"),
        F.when(F.dayofweek("entry_date").isin(1, 7), 1).otherwise(0).alias("is_weekend")
    )
)

# Feature Table として Unity Catalog に登録
fe_client.create_table(
    name="focus_you.features.emotion_features",
    primary_keys=["entry_date"],
    df=emotion_features,
    description="感情スコア、移動平均、曜日情報の特徴量テーブル"
)

print("Feature Table 'emotion_features' を作成しました")
emotion_features.display()
```

### 1-2. カレンダー特徴量テーブル

```python
calendar_df = spark.table("focus_you.raw.calendar_events")

# 翌日のカレンダー情報を前日の特徴量として集計
calendar_features = (
    calendar_df
    .withColumn("feature_date", F.date_sub("event_date", 1))
    .groupBy("feature_date")
    .agg(
        F.sum(F.when(F.col("category") == "work", 1).otherwise(0)).alias("next_day_work_count"),
        F.sum(F.when(F.col("category") == "social", 1).otherwise(0)).alias("next_day_social_count"),
        F.sum(F.when(F.col("category") == "health", 1).otherwise(0)).alias("next_day_health_count"),
        F.count("*").alias("next_day_total_events")
    )
    .withColumnRenamed("feature_date", "entry_date")
)

fe_client.create_table(
    name="focus_you.features.calendar_features",
    primary_keys=["entry_date"],
    df=calendar_features,
    description="翌日のカレンダー予定数の特徴量テーブル"
)

print("Feature Table 'calendar_features' を作成しました")
calendar_features.display()
```

### 1-3. Unity Catalog での確認

```sql
-- Databricks SQL で確認
DESCRIBE TABLE focus_you.features.emotion_features;

-- テーブルのプロパティに feature_store のメタデータが付与されている
SHOW TBLPROPERTIES focus_you.features.emotion_features;
```

## ハンズオン Step 2: FeatureLookup で Training Set を構築（15分）

FeatureLookup は「どのテーブルの、どのキーで結合して、どの列を取るか」を宣言する。

### 2-1. FeatureLookup の定義

```python
# spine: entry_date + 翌日のmood_score（ターゲット）
spine_df = (
    spark.table("focus_you.raw.diary_entries")
    .withColumn(
        "next_day_mood",
        F.lead("mood_score", 1).over(Window.orderBy("entry_date"))
    )
    .filter(F.col("next_day_mood").isNotNull())
    .select("entry_date", "next_day_mood")
)

# FeatureLookup: 学習時と推論時で同じ結合ロジックを保証
feature_lookups = [
    FeatureLookup(
        table_name="focus_you.features.emotion_features",
        lookup_key="entry_date",
        feature_names=[
            "emotion_joy", "emotion_sadness", "emotion_anger",
            "emotion_fear", "emotion_surprise", "emotion_stress",
            "mood_3day_avg", "mood_7day_avg", "mood_diff",
            "day_of_week", "is_weekend"
        ]
    ),
    FeatureLookup(
        table_name="focus_you.features.calendar_features",
        lookup_key="entry_date",
        feature_names=[
            "next_day_work_count", "next_day_social_count",
            "next_day_health_count", "next_day_total_events"
        ]
    )
]

# Training Set の作成
training_set = fe_client.create_training_set(
    df=spine_df,
    feature_lookups=feature_lookups,
    label="next_day_mood",
    exclude_columns=["entry_date"]  # 学習には使わない列
)

training_df = training_set.load_df()
print(f"Training data: {training_df.count()} rows")
training_df.display()
```

### 2-2. FeatureLookup の仕組み

```
spine_df (entry_date, next_day_mood)
    │
    ├── LEFT JOIN emotion_features ON entry_date
    │       → emotion_joy, emotion_sadness, ... mood_diff, is_weekend
    │
    └── LEFT JOIN calendar_features ON entry_date
            → next_day_work_count, next_day_social_count, ...

= Training DataFrame (15列 + label)
```

この結合ロジックが **モデルのメタデータに記録される**。推論時に score_batch を使うと、同じ結合が自動実行される。

## ハンズオン Step 3: MLflow 3.0 + XGBoost で学習（15分）

### 3-1. MLflow 3.0 の LoggedModel

MLflow 3.0 では `LoggedModel` が導入された。log_model() を呼ぶと LoggedModel が作成され、モデルのライフサイクル全体を追跡する。パラメータ、メトリクス、アーティファクト、使用した特徴量がすべて紐づく。

```python
from sklearn.ensemble import GradientBoostingRegressor
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import pandas as pd

# pandas に変換
train_pdf = training_df.toPandas()
X = train_pdf.drop(columns=["next_day_mood"])
y = train_pdf["next_day_mood"]

# MLflow 3.0 で学習を記録
with mlflow.start_run(run_name="manual-xgboost") as run:
    # XGBoost モデル
    model = XGBRegressor(
        n_estimators=100,
        max_depth=3,
        learning_rate=0.1,
        random_state=42
    )
    model.fit(X, y)

    # 予測と評価
    predictions = model.predict(X)
    mae = mean_absolute_error(y, predictions)
    r2 = r2_score(y, predictions)

    # メトリクス記録
    mlflow.log_param("model_type", "XGBRegressor")
    mlflow.log_param("n_estimators", 100)
    mlflow.log_param("max_depth", 3)
    mlflow.log_metric("mae", mae)
    mlflow.log_metric("r2", r2)
    mlflow.log_metric("training_rows", len(train_pdf))

    # Feature Engineering Client 経由でモデルを記録
    # FeatureLookup の情報がモデルに紐づく
    fe_client.log_model(
        model=model,
        artifact_path="mood_predictor",
        flavor=mlflow.sklearn,  # XGBoost は sklearn 互換
        training_set=training_set,
        registered_model_name="focus_you.models.mood_predictor"
    )

    print(f"MAE: {mae:.2f}")
    print(f"R2:  {r2:.3f}")
    print(f"Run ID: {run.info.run_id}")

    # 注意: 30行のデータでは過学習の可能性が非常に高い
    # R2 が 0.9 を超えていたら確実に過学習
```

### 3-2. LoggedModel の確認

```python
# MLflow 3.0: LoggedModel はモデルのライフサイクルを横断的に追跡
# run.info.run_id からモデル情報を取得
logged_model = mlflow.get_logged_model(run.info.run_id)
print(f"Model name: {logged_model.name}")
print(f"Creation time: {logged_model.creation_timestamp}")

# Unity Catalog Model Registry で確認
from mlflow import MlflowClient
client = MlflowClient()
model_version = client.get_latest_versions("focus_you.models.mood_predictor")[0]
print(f"Version: {model_version.version}")
print(f"Status: {model_version.status}")
```

### 3-3. 特徴量重要度の可視化

```python
import matplotlib.pyplot as plt

# XGBoost の特徴量重要度
importance = model.feature_importances_
feature_names = X.columns

fig, ax = plt.subplots(figsize=(10, 6))
sorted_idx = importance.argsort()
ax.barh(feature_names[sorted_idx], importance[sorted_idx])
ax.set_xlabel("Feature Importance")
ax.set_title("mood_score 予測の特徴量重要度")
plt.tight_layout()

# MLflow にプロットを記録
mlflow.log_figure(fig, "feature_importance.png")
plt.show()
```

## ハンズオン Step 4: score_batch で推論（10分）

score_batch は FeatureLookup の結合ロジックを **自動再現** して推論する。

```python
# 推論対象: 最新5日分の entry_date だけを渡す
inference_df = (
    spark.table("focus_you.raw.diary_entries")
    .orderBy(F.desc("entry_date"))
    .limit(5)
    .select("entry_date")
)

# score_batch: Feature Table から特徴量を自動取得して推論
# モデルに紐づいた FeatureLookup が自動適用される
scored_df = fe_client.score_batch(
    model_uri=f"models:/focus_you.models.mood_predictor/1",
    df=inference_df
)

scored_df.select("entry_date", "prediction").display()
```

score_batch の流れ:

```
inference_df (entry_date のみ)
    │
    ├── [自動] LEFT JOIN emotion_features ON entry_date
    ├── [自動] LEFT JOIN calendar_features ON entry_date
    │
    └── model.predict(結合済みデータ)
          │
          └── predictions (entry_date, prediction)
```

この「推論時に特徴量テーブルから自動取得」の仕組みが、Training-Serving Skew を防ぐ核心。

## ハンズオン Step 5: AutoML との比較（10分）

### 5-1. AutoML で自動学習

Databricks AutoML は特徴量エンジニアリング + モデル選択 + ハイパーパラメータチューニングを自動化する。

```python
from databricks import automl

# AutoML に training_df を渡す
# 内部で LightGBM, XGBoost, RandomForest, LinearRegression 等を試す
summary = automl.regress(
    dataset=training_df,
    target_col="next_day_mood",
    primary_metric="mae",
    timeout_minutes=10,          # 最大10分
    max_trials=20,               # 最大20回の試行
    experiment_name="/focus-you/mood-prediction-automl"
)

print(f"Best trial MAE: {summary.best_trial.metrics['val_mae']:.3f}")
print(f"Best model type: {summary.best_trial.model_description}")
```

### 5-2. AutoML のノートブック確認

```python
# AutoML は試行ごとにノートブックを自動生成する
# summary.best_trial.notebook_path にパスが入っている
print(f"Best trial notebook: {summary.best_trial.notebook_path}")

# AutoML が生成したコードを確認する:
# - 特徴量エンジニアリング（欠損値処理、エンコーディング等）
# - ハイパーパラメータ
# - 評価結果
```

### 5-3. 手動 vs AutoML の比較

```python
# 手動XGBoost と AutoML の結果を比較
print("=== 手動 XGBoost ===")
print(f"  MAE: {mae:.3f}")
print(f"  R2:  {r2:.3f}")
print()
print("=== AutoML Best ===")
print(f"  MAE: {summary.best_trial.metrics['val_mae']:.3f}")
print(f"  Model: {summary.best_trial.model_description}")
```

比較の観点:

| 観点 | 手動 XGBoost | AutoML |
|------|------------|--------|
| **学習時間** | 数秒 | 数分〜10分 |
| **精度** | パラメータ依存 | 多くの場合、手動と同等以上 |
| **特徴量エンジニアリング** | 自分で設計 | 自動（欠損値処理、one-hot等） |
| **再現性** | コードで完全再現 | 生成ノートブックで再現可 |
| **Feature Store 統合** | FeatureLookup で明示 | Training Set を渡せば自動 |
| **理解度** | 高い（自分で書く） | 中（生成コードを読む必要） |
| **30行での挙動** | 過学習しやすい | 交差検証で過学習を検出しやすい |

**結論**: 30行レベルでは手動の方が理解しやすい。100行以上になったら AutoML で探索 → 生成ノートブックを読んで理解 → 手動で改善、が実践的なワークフロー。

## Feature Table の更新パターン

### バッチ更新

```python
# 新しいデータが追加された場合、Feature Table を更新
new_emotion_features = (
    spark.table("focus_you.raw.diary_entries")
    .join(spark.table("focus_you.raw.emotion_analysis"), on="entry_date", how="left")
    # ... 同じ変換ロジック
)

# write_table で差分更新（merge モード）
fe_client.write_table(
    name="focus_you.features.emotion_features",
    df=new_emotion_features,
    mode="merge"  # 主キーで UPSERT
)
```

### Lakeflow Pipelines（旧 DLT）による自動更新

```python
# Lakeflow Pipelines を使うと、ソーステーブルの変更を検知して自動更新
# pipeline_notebook.py

import dlt

@dlt.table(
    name="emotion_features",
    comment="感情スコアの特徴量テーブル（自動更新）",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true"
    }
)
def compute_emotion_features():
    diary = dlt.read("diary_entries")
    emotion = dlt.read("emotion_analysis")
    # ... 特徴量計算ロジック
    return result
```

出典: https://docs.databricks.com/aws/en/delta-live-tables/ (2026-04-16参照)

## Online Table（リアルタイム推論用）

低レイテンシの推論が必要な場合、Feature Table を Online Table として公開できる。

```python
# Online Table の作成（Unity Catalog 経由）
# 内部的に Cosmos DB (Azure) / DynamoDB (AWS) にミラーリングされる
spark.sql("""
    CREATE ONLINE TABLE focus_you.features.emotion_features_online
    AS SELECT * FROM focus_you.features.emotion_features
""")
```

Online Table は Model Serving Endpoint と組み合わせて使う:

```
Client Request (entry_date)
    │
    └── Model Serving Endpoint
          │
          ├── [自動] Online Table から特徴量を取得（数ms）
          │       emotion_features_online → emotion_joy, ...
          │       calendar_features_online → next_day_work_count, ...
          │
          └── model.predict() → response (数ms)
```

出典: https://docs.databricks.com/aws/en/machine-learning/feature-store/automatic-feature-lookup (2026-04-16参照)

## MLflow 3.0 の新概念まとめ

### LoggedModel

```python
# MLflow 3.0 では log_model() が LoggedModel を返す
# LoggedModel はモデルのライフサイクル全体を追跡する永続的なオブジェクト

with mlflow.start_run() as run:
    # ログすると LoggedModel が作成される
    model_info = mlflow.sklearn.log_model(model, "model")

    # LoggedModel には以下が紐づく:
    # - パラメータ、メトリクス
    # - アーティファクト（モデルファイル、プロット）
    # - 入力データのスキーマ
    # - Feature Store の FeatureLookup 情報
    # - デプロイメント情報（Serving Endpoint）
```

### Deployment Jobs

```python
# MLflow 3.0 の Deployment Jobs:
# モデルをステージング → プロダクションに昇格させるワークフロー

from mlflow import MlflowClient
client = MlflowClient()

# ステージング → プロダクション
client.set_registered_model_alias(
    name="focus_you.models.mood_predictor",
    alias="production",
    version=1
)
```

出典: https://docs.databricks.com/aws/en/mlflow/models (2026-04-16参照)

## まとめ: Databricks Feature Store の手触り

**良い点**:
- **FeatureLookup の宣言的な結合**: 学習と推論で同じ結合ロジックが保証される。Training-Serving Skew がゼロ
- **Unity Catalog リネージ**: 特徴量 → モデル → 推論結果の血統が自動追跡。監査・デバッグに強い
- **MLflow 3.0 統合**: LoggedModel でモデルのライフサイクル全体を管理。Experiment Tracking → Model Registry → Serving が一気通貫
- **AutoML**: 手動で特徴量エンジニアリングを書かなくても、AutoML が探索してくれる。生成ノートブックで学べる
- **score_batch**: 推論時の特徴量取得を自動化。推論コードが極めてシンプル

**気になる点**:
- **学習コスト**: FeatureLookup / Unity Catalog / MLflow 3.0 / Lakeflow Pipelines と理解すべき概念が多い
- **Community Edition 非対応**: Unity Catalog が使えないため、Trial アカウントが必要
- **30行の限界**: AutoML の交差検証は30行だとスプリットが小さすぎて不安定
- **Online Table のコスト**: Cosmos DB / DynamoDB のミラーリングコストが別途発生

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Databricks Feature Engineering in Unity Catalog: Feature Table + FeatureLookup + score_batch の3点セット（https://docs.databricks.com/aws/en/machine-learning/feature-store/train-models-with-feature-store）
- MLflow 3.0 LoggedModel: log_model() で作成され、パラメータ・メトリクス・アーティファクト・Feature情報を横断追跡（https://docs.databricks.com/aws/en/mlflow/models）
- AutoML: 回帰・分類・時系列予測に対応。最適モデルの探索 + 生成ノートブック（https://docs.databricks.com/aws/en/machine-learning/automl/）
- Model Serving + Online Table: Feature Table を Online Table にミラーリングし、REST API で低レイテンシ推論（https://docs.databricks.com/aws/en/machine-learning/feature-store/automatic-feature-lookup）
- Lakeflow Pipelines: ソーステーブルの変更を検知して Feature Table を自動更新（https://docs.databricks.com/aws/en/delta-live-tables/）

### 2. 限界の明示

- **30行での学習**: AutoML の交差検証スプリットが極端に小さくなる（5-fold で1スプリット6行）。精度指標は参考値レベル
- **Community Edition**: Unity Catalog が使えないため、Feature Store のハンズオンには Trial アカウント（14日間無料）が必須
- **Online Table**: Preview / GA のステータスがクラウドプロバイダによって異なる。AWS では GA、Azure では一部 Preview（2026年4月時点）
- **AutoML の限界**: 30行ではモデル間の精度差が統計的に有意でない可能性が高い。「AutoML の体験」として割り切る
- **Lakeflow Pipelines のコスト**: Serverless モードだと DBU 単価が高い。小規模データでは手動更新で十分

### 3. 壁打ちモードへの導線

1. **「FeatureLookup は pandas の merge と何が違うか？」** --- pandas merge は「推論時に同じ merge を書き忘れる」リスクがある。FeatureLookup はモデルにロジックが埋め込まれるので忘れようがない
2. **「AutoML で生成されたノートブックをそのまま本番に使ってよいか？」** --- 教材としては優れるが、本番コードは手動で書き直すべき。AutoML の生成コードは「探索の記録」であり「保守するコード」ではない
3. **「Unity Catalog のリネージは、クライアントへの説明にどう使えるか？」** --- 「このモデルがどのデータで学習されたか」をGUIで見せられる。監査対応・ガバナンス説明に有効
4. **「Databricks と Snowflake、Feature Store はどちらが成熟しているか？」** --- Databricks は FeatureLookup / score_batch / Online Table / AutoML と体系的。Snowflake は Dynamic Table の自動リフレッシュが独自の強み。規模が大きいなら Databricks、SQL中心のチームなら Snowflake
5. **「LoggedModel を使うメリットをクライアントに30秒で説明するなら？」** --- 「モデルの『履歴書』が自動で作られます。どのデータで学習し、精度がどう変わったか、いつデプロイされたかが全部辿れます」
