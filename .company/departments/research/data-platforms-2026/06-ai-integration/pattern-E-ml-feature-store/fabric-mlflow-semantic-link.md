# Microsoft Fabric SemPy + MLflow — Semantic Link で Power BI と ML を橋渡し

> **所要時間**: 60分 / **前提**: Microsoft Fabric ワークスペース（Trial可）、第1弾でCSVロード済み / **ゴール**: SemPy (Semantic Link) で Power BI Semantic Model をpandasに読み込み、Semantic Propagation を体験し、Lakehouse テーブルを Feature Store 代わりに使って MLflow でモデルを学習・登録する

## Semantic Link (SemPy) とは何か

Semantic Link は Microsoft Fabric 固有の機能で、Power BI の Semantic Model（旧: Dataset）と Synapse Data Science を橋渡しする。核心は `fabric.read_table()`: Power BI のテーブルをそのまま pandas DataFrame（正確には FabricDataFrame）として読み込める。

「Power BI で定義したメジャーやリレーションシップを、Python のデータサイエンスワークフローでも使える」という発想。BI チームが作った定義をデータサイエンティストが再実装する必要がなくなる。

Snowflake / Databricks には直接対応する機能がない。Fabric 固有の強み。

公式ドキュメント:
- Semantic Link 概要: https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-overview (2026-04-16参照)
- SemPy API: https://learn.microsoft.com/en-us/python/api/semantic-link-sempy/sempy.fabric (2026-04-16参照)
- Semantic Propagation: https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-semantic-propagation (2026-04-16参照)
- Semantic Functions: https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-semantic-functions (2026-04-16参照)
- Read/Write Power BI Python: https://learn.microsoft.com/en-us/fabric/data-science/read-write-power-bi-python (2026-04-16参照)

## アーキテクチャ

```
Power BI Semantic Model ("focus-you-model")
├── Tables
│   ├── diary_entries (entry_date, entry_text, mood_score)
│   ├── emotion_analysis (entry_date, joy, sadness, anger, fear, surprise)
│   └── calendar_events (event_date, title, category)
├── Relationships
│   ├── diary_entries[entry_date] → emotion_analysis[entry_date]
│   └── diary_entries[entry_date] → calendar_events[event_date]
└── Measures
    ├── avg_mood = AVERAGE(diary_entries[mood_score])
    └── stress_index = AVERAGE(emotion_analysis[sadness] + emotion_analysis[anger])
        │
        │ fabric.read_table() / fabric.evaluate_measure()
        ▼
Fabric Notebook (Python)
├── FabricDataFrame (pandas + semantic metadata)
│   ├── .semantic_info → 列のデータカテゴリ、型情報
│   └── .semantic_functions → is_holiday(), is_weekend() 等
│
├── 特徴量計算 (pandas / PySpark)
│   └── emotion_features, calendar_features
│
├── MLflow + scikit-learn / XGBoost
│   └── mood_predictor model
│
└── Lakehouse Delta Table に保存
    └── feature_tables/emotion_features
```

## 事前準備

### Power BI Semantic Model の準備

Fabric ワークスペースに Power BI Semantic Model が必要。Lakehouse のテーブルから自動生成するのが最も簡単:

```
1. Fabric ワークスペース → Lakehouse を開く
2. diary_entries, emotion_analysis, calendar_events が Lakehouse テーブルにある
3. Lakehouse の「SQL エンドポイント」→ 「既定のセマンティックモデル」が自動作成される
4. Power BI で開いてリレーションシップを定義
```

### Notebook での SemPy セットアップ

```python
# Fabric Runtime 1.2+ なら SemPy はプリインストール済み
# 最新版に更新する場合:
# %pip install -U semantic-link

import sempy.fabric as fabric
from sempy.fabric import FabricDataFrame
import pandas as pd
import mlflow
```

## ハンズオン Step 1: fabric.read_table() で Semantic Model を読む（10分）

### 1-1. テーブルの読み込み

```python
# Power BI Semantic Model からテーブルを読み込む
# XMLA read-only が有効である必要がある（Fabric Trial ではデフォルト有効）

# Semantic Model 名を指定
SEMANTIC_MODEL = "focus-you-model"

# diary_entries を FabricDataFrame として取得
diary_fdf = fabric.read_table(
    dataset=SEMANTIC_MODEL,
    table_name="diary_entries"
)

print(type(diary_fdf))  # <class 'sempy.fabric.FabricDataFrame'>
print(f"Shape: {diary_fdf.shape}")
diary_fdf.head()
```

FabricDataFrame は pandas DataFrame のサブクラス。pandas の全操作が使える上に、Semantic Model のメタデータ（データカテゴリ、リレーションシップ等）が付与されている。

### 1-2. 他テーブルも読み込み

```python
emotion_fdf = fabric.read_table(SEMANTIC_MODEL, "emotion_analysis")
calendar_fdf = fabric.read_table(SEMANTIC_MODEL, "calendar_events")

print(f"diary:    {diary_fdf.shape}")
print(f"emotion:  {emotion_fdf.shape}")
print(f"calendar: {calendar_fdf.shape}")
```

### 1-3. メジャーの評価

Power BI で定義したメジャーを Python から呼び出せる:

```python
# Semantic Model のメジャーを評価
result = fabric.evaluate_measure(
    dataset=SEMANTIC_MODEL,
    measure="avg_mood",
    groupby_columns=["diary_entries[entry_date]"]
)
print(result)
# → entry_date ごとの avg_mood が返る

# 複合メジャーも同様
stress_result = fabric.evaluate_measure(
    dataset=SEMANTIC_MODEL,
    measure="stress_index"
)
print(f"Overall stress index: {stress_result.iloc[0, 0]:.3f}")
```

この `evaluate_measure()` が Semantic Link の核心の1つ。BI チームが定義した KPI を、データサイエンティストがそのまま使える。再実装不要。

## ハンズオン Step 2: Semantic Propagation（10分）

Semantic Propagation は FabricDataFrame に付与されたメタデータ（データカテゴリ等）がデータ操作を通じて伝播する仕組み。

### 2-1. セマンティック情報の確認

```python
# FabricDataFrame にはセマンティック情報が自動付与されている
# 列のデータカテゴリ、型、リレーションシップ情報

# セマンティック情報を表示
print(diary_fdf.sempy.metadata)

# entry_date が Date 型であることが伝播
# mood_score が数値型であることが伝播
```

### 2-2. Semantic Functions

FabricDataFrame には Semantic Functions が自動で利用可能になる。データカテゴリに応じて適用可能な関数が変わる:

```python
# entry_date 列が Date カテゴリの場合
# is_holiday() が自動で使えるようになる

# 日付列に対するセマンティック関数
diary_fdf["is_holiday"] = diary_fdf["entry_date"].sempy.is_holiday(country="JP")
diary_fdf["is_weekend"] = diary_fdf["entry_date"].dt.dayofweek.isin([5, 6]).astype(int)

print(diary_fdf[["entry_date", "is_holiday", "is_weekend"]].head(10))
```

### 2-3. データ品質の検証

```python
from sempy.fabric import FabricDataFrame

# Semantic Model のリレーションシップに基づくデータ品質チェック
# 例: diary_entries と emotion_analysis のリレーションシップが成立しているか

validation = fabric.list_relationships(SEMANTIC_MODEL)
print(validation)

# 関数的依存性の検証
# entry_date → mood_score が一対一であるか等
```

出典: https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-validate-data (2026-04-16参照)

## ハンズオン Step 3: 特徴量の計算と Lakehouse 保存（15分）

Fabric には明示的な「Feature Store」製品がない。代わりに Lakehouse の Delta Table を特徴量テーブルとして使い、Semantic Model をメタデータ層として活用する。

### 3-1. 感情特徴量

```python
import numpy as np

# pandas 操作で特徴量を計算
# FabricDataFrame は pandas DataFrame のサブクラスなのでそのまま使える

emotion_features = diary_fdf.merge(emotion_fdf, on="entry_date", how="left")

# 移動平均
emotion_features["mood_3day_avg"] = emotion_features["mood_score"].rolling(3, min_periods=1).mean()
emotion_features["mood_7day_avg"] = emotion_features["mood_score"].rolling(7, min_periods=1).mean()

# 前日差分
emotion_features["mood_diff"] = emotion_features["mood_score"].diff()

# 複合ストレス指標
emotion_features["emotion_stress"] = (
    emotion_features["sadness"] +
    emotion_features["anger"] +
    emotion_features["fear"]
)

# 曜日
emotion_features["day_of_week"] = pd.to_datetime(emotion_features["entry_date"]).dt.dayofweek
emotion_features["is_weekend"] = emotion_features["day_of_week"].isin([5, 6]).astype(int)

print(f"Emotion features shape: {emotion_features.shape}")
emotion_features.head()
```

### 3-2. カレンダー特徴量

```python
# 翌日の予定数を前日の特徴量として計算
calendar_fdf["feature_date"] = pd.to_datetime(calendar_fdf["event_date"]) - pd.Timedelta(days=1)

calendar_features = (
    calendar_fdf
    .groupby("feature_date")
    .agg(
        next_day_work_count=("category", lambda x: (x == "work").sum()),
        next_day_social_count=("category", lambda x: (x == "social").sum()),
        next_day_health_count=("category", lambda x: (x == "health").sum()),
        next_day_total_events=("category", "count")
    )
    .reset_index()
    .rename(columns={"feature_date": "entry_date"})
)

print(f"Calendar features shape: {calendar_features.shape}")
calendar_features.head()
```

### 3-3. Lakehouse に保存（Feature Table 代わり）

```python
# Spark DataFrame に変換して Lakehouse の Delta Table として保存
# これが「Feature Store の代わり」になる

spark_emotion = spark.createDataFrame(emotion_features)
spark_emotion.write.format("delta").mode("overwrite").saveAsTable(
    "focus_you_lakehouse.feature_tables.emotion_features"
)

spark_calendar = spark.createDataFrame(calendar_features)
spark_calendar.write.format("delta").mode("overwrite").saveAsTable(
    "focus_you_lakehouse.feature_tables.calendar_features"
)

print("特徴量テーブルを Lakehouse に保存しました")
```

### Semantic Model vs Feature Store

| Feature Store の機能 | Snowflake | Databricks | Fabric (SemPy + Lakehouse) |
|---|---|---|---|
| 特徴量の保存 | Dynamic Table | Unity Catalog Delta Table | Lakehouse Delta Table |
| 特徴量の定義（メタデータ） | Entity + Feature View | Feature Table + PK | Semantic Model のテーブル定義 |
| 自動更新 | TARGET_LAG | Lakeflow Pipelines | Fabric Pipeline / Notebook Schedule |
| 学習時の自動結合 | generate_training_set | FeatureLookup | 手動 merge（pandas / Spark） |
| 推論時の自動取得 | - | score_batch | 手動取得 |
| ビジネスロジックの再利用 | - | - | evaluate_measure() で Power BI メジャー利用 |

Fabric の強みは「Power BI のメジャーやリレーションシップをそのまま ML で使える」こと。弱みは「Feature Store としての自動化（自動結合、score_batch 相当）がない」こと。

## ハンズオン Step 4: MLflow で学習（15分）

### 4-1. 学習データの構築

```python
from sklearn.model_selection import cross_val_score
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, r2_score

# 特徴量の結合
features = emotion_features.merge(calendar_features, on="entry_date", how="left")

# ターゲット: 翌日の mood_score
features["next_day_mood"] = features["mood_score"].shift(-1)
features = features.dropna(subset=["next_day_mood"])

# 特徴量列
feature_cols = [
    "joy", "sadness", "anger", "fear", "surprise",
    "emotion_stress", "mood_3day_avg", "mood_7day_avg", "mood_diff",
    "day_of_week", "is_weekend",
    "next_day_work_count", "next_day_social_count"
]

# 欠損値を埋める（calendar がない日がある）
X = features[feature_cols].fillna(0)
y = features["next_day_mood"]

print(f"Training data: {len(X)} rows, {len(feature_cols)} features")
```

### 4-2. MLflow で学習を記録

```python
# Fabric の MLflow は自動構成済み
# mlflow.set_experiment() は不要（ノートブックに紐づく実験が自動作成）

with mlflow.start_run(run_name="xgboost-sempy") as run:
    model = XGBRegressor(
        n_estimators=100,
        max_depth=3,
        learning_rate=0.1,
        random_state=42
    )
    model.fit(X, y)

    predictions = model.predict(X)
    mae = mean_absolute_error(y, predictions)
    r2 = r2_score(y, predictions)

    mlflow.log_param("model_type", "XGBRegressor")
    mlflow.log_param("n_estimators", 100)
    mlflow.log_param("feature_source", "SemPy + Lakehouse")
    mlflow.log_metric("mae", mae)
    mlflow.log_metric("r2", r2)
    mlflow.log_metric("training_rows", len(X))

    # モデルを登録
    mlflow.sklearn.log_model(
        model,
        artifact_path="mood_predictor",
        registered_model_name="mood_predictor"
    )

    print(f"MAE: {mae:.2f}")
    print(f"R2:  {r2:.3f}")
    print(f"Run ID: {run.info.run_id}")
```

### 4-3. PREDICT() 関数での推論

Fabric では SQL の `PREDICT()` 関数で MLflow モデルを呼び出せる:

```sql
-- Fabric SQL エンドポイントで実行
SELECT
    entry_date,
    PREDICT('mood_predictor', *) AS predicted_mood
FROM focus_you_lakehouse.feature_tables.emotion_features
ORDER BY entry_date DESC
LIMIT 5;
```

出典: https://learn.microsoft.com/en-us/fabric/data-science/model-scoring-predict (2026-04-16参照)

## SemPy 独自の強み: Power BI との双方向連携

### 分析結果を Power BI に書き戻す

```python
# 予測結果を Lakehouse に保存 → Power BI で可視化
prediction_df = features[["entry_date"]].copy()
prediction_df["predicted_mood"] = predictions
prediction_df["actual_mood"] = y.values
prediction_df["error"] = abs(prediction_df["actual_mood"] - prediction_df["predicted_mood"])

spark_predictions = spark.createDataFrame(prediction_df)
spark_predictions.write.format("delta").mode("overwrite").saveAsTable(
    "focus_you_lakehouse.predictions.mood_predictions"
)

# → Power BI の Semantic Model にこのテーブルを追加
# → ダッシュボードで「予測 vs 実績」のチャートを作成
```

### Semantic Link Labs（コミュニティ拡張）

```python
# semantic-link-labs は Microsoft 公式の早期アクセスパッケージ
# 追加の分析機能が利用できる
# %pip install semantic-link-labs

import sempy_labs as labs

# ワークスペース内のセマンティックモデル一覧
models = labs.list_semantic_models()
print(models)

# モデルのドキュメント自動生成
# labs.generate_model_documentation(SEMANTIC_MODEL)
```

出典: https://github.com/microsoft/semantic-link-labs (2026-04-16参照)

## まとめ: Fabric SemPy の手触り

**良い点**:
- **fabric.read_table() の手軽さ**: Power BI のテーブルが1行で pandas に。データの「どこにあるか」を気にしなくてよい
- **evaluate_measure() でビジネスロジック再利用**: BI チームが定義した KPI をそのまま ML に使える。再実装のリスクゼロ
- **FabricDataFrame**: pandas と完全互換。学習コストがほぼない
- **Semantic Propagation**: データのメタデータが操作を通じて伝播。データカテゴリに応じた関数が自動で使える
- **Power BI 双方向連携**: 分析結果を Lakehouse に書き戻し → Power BI で可視化。BI と DS のループが閉じる
- **PREDICT() 関数**: SQL から MLflow モデルを呼べる。エンジニアリング不要

**気になる点**:
- **Feature Store がない**: FeatureLookup / score_batch 相当の自動結合・自動取得がない。手動 merge が必要
- **Training-Serving Skew の防止が手動**: 学習時と推論時で同じ特徴量計算を保証する仕組みがない。コードの共通化は開発者の責任
- **XMLA の制約**: fabric.read_table() は XMLA 経由。大規模テーブル（100万行超）では Spark の直接読み込みの方が高速
- **Semantic Functions の限界**: is_holiday() 等はプリセットのみ。カスタムの Semantic Function は定義できない
- **Fabric Trial の制約**: F2 容量（2 CU）のため、大規模な ML ワークロードは遅い

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Semantic Link (SemPy): Power BI Semantic Model と Synapse Data Science を橋渡し。FabricDataFrame で pandas + メタデータ（https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-overview）
- fabric.read_table(): XMLA 経由で Semantic Model のテーブルを FabricDataFrame に読み込み（https://learn.microsoft.com/en-us/fabric/data-science/read-write-power-bi-python）
- Semantic Propagation: FabricDataFrame のメタデータがデータ操作を通じて伝播（https://learn.microsoft.com/en-us/fabric/data-science/semantic-link-semantic-propagation）
- evaluate_measure(): Power BI メジャーを Python から評価（https://learn.microsoft.com/en-us/python/api/semantic-link-sempy/sempy.fabric）
- Semantic Link Labs: Microsoft 公式の早期アクセス拡張（https://github.com/microsoft/semantic-link-labs）
- Fabric MLflow: モデルの追跡・登録・PREDICT() 関数での推論（https://learn.microsoft.com/en-us/fabric/data-science/model-scoring-predict）
- Fabric February 2026 Update: NotebookUtils + Semantic Link の API 拡張（https://blog.fabric.microsoft.com/en-us/blog/fabric-february-2026-feature-summary/）

### 2. 限界の明示

- **Feature Store の不在**: Fabric には「Feature Store」製品がない。Lakehouse テーブル + Semantic Model で代替するが、Databricks の FeatureLookup / score_batch のような自動化は期待できない
- **Training-Serving Skew**: 学習と推論で同じ変換を適用する仕組みが組み込まれていない。開発者がコードを共通化する必要がある
- **XMLA の制約**: fabric.read_table() は XMLA read-only が必要。Premium / Fabric 以外のワークスペースでは利用不可
- **30行の限界**: Semantic Link の真価は「BI チームが作った数百のメジャーをそのまま ML に使う」規模で発揮される。30行 / 数テーブルでは恩恵が薄い
- **Semantic Functions**: プリセットのみ（is_holiday 等）。カスタム関数の定義は不可（2026年4月時点）

### 3. 壁打ちモードへの導線

1. **「fabric.read_table() と Spark の直接読み込み、いつどちらを使うか？」** --- 行数が10万以下で Semantic Model のメタデータが欲しいなら read_table。大規模データは Spark 直読み
2. **「evaluate_measure() の実用的なユースケースは？」** --- BI チームが定義した「顧客LTV」「チャーン率」等のメジャーを、ML の特徴量としてそのまま使う。再実装による計算差異がゼロ
3. **「Feature Store なしで Training-Serving Skew をどう防ぐか？」** --- 特徴量計算のコードを Python パッケージ化し、学習と推論の両方で import して使う。テストで同値性を検証
4. **「SemPy を使うクライアントの条件は？」** --- Power BI を既に使っており、BI チームとデータサイエンティストが分かれている組織。Power BI を使っていないなら SemPy のメリットは薄い
5. **「Fabric の ML は Databricks / Snowflake に対してどうポジショニングするか？」** --- Power BI エコシステムとの統合が圧倒的な差別化要因。ML 単体の機能ではDatabricksが上だが、BI + ML の統合体験では Fabric が優れる
