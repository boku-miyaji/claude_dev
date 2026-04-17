# Snowflake Feature Store — Feature Store + ML ハンズオン

> **所要時間**: 70分 / **前提**: Snowflake アカウント（Trial可）、第1弾でCSVロード済み / **ゴール**: Snowpark ML Feature Store で特徴量を定義し、Dynamic Table で自動更新、XGBoost で翌日のmood_scoreを予測する

## Snowflake Feature Store とは何か

Snowflake Feature Store は Snowpark ML Python パッケージの一部。特徴量の定義・計算・管理をSnowflake内で完結させる。最大の特徴は **Dynamic Table** との統合: 特徴量の計算ロジックをSQLで書くと、Dynamic Table が指定したラグ（例: 1時間）で自動リフレッシュしてくれる。

「特徴量を定義したらあとは放っておいても最新に保たれる」という体験は、手動バッチジョブを書く世界から来ると新鮮。

公式ドキュメント:
- 概要: https://docs.snowflake.com/en/developer-guide/snowflake-ml/feature-store/overview (2026-04-15参照)
- Feature View: https://docs.snowflake.com/en/developer-guide/snowflake-ml/feature-store/feature-views (2026-04-15参照)
- Advanced Guide: https://www.snowflake.com/en/developers/guides/advanced-guide-to-snowflake-feature-store/ (2026-04-15参照)

## アーキテクチャ

```
Raw Tables (diary_entries, emotion_analysis, calendar_events)
    │
    └── Feature Store
          │
          ├── Entity: diary_day (entry_date)
          │
          ├── Feature View: emotion_features (Dynamic Table)
          │     joy, sadness, stress, mood_3day_avg, mood_diff ...
          │     TARGET_LAG = '1 hour'
          │
          ├── Feature View: calendar_features (Dynamic Table)
          │     work_count, social_count, is_weekend ...
          │
          └── Training Dataset
                │
                └── Snowpark ML (XGBoost)
                      │
                      └── Model Registry
                            └── mood_predictor_v1
```

## 事前準備

Snowflake Notebook（Snowsight）または Python ローカル環境で:

```python
# Snowpark ML のインストール（ローカルの場合）
# pip install snowflake-ml-python

from snowflake.snowpark import Session
from snowflake.ml.feature_store import FeatureStore, FeatureView, Entity
from snowflake.snowpark import functions as F

# セッション作成
session = Session.builder.configs({
    "account": "YOUR_ACCOUNT",
    "user": "YOUR_USER",
    "password": "YOUR_PASSWORD",
    "database": "FOCUS_YOU",
    "schema": "RAW",
    "warehouse": "COMPUTE_WH"
}).create()
```

## ハンズオン Step 1: Entity の定義（10分）

Entity は特徴量の「主キー」に相当する概念。focus-you の場合、「1日」が1つのEntityインスタンス。

```python
# Feature Store の初期化
fs = FeatureStore(
    session=session,
    database="FOCUS_YOU",
    name="FEATURE_STORE",
    default_warehouse="COMPUTE_WH"
)

# Entity の定義: 1日 = 1エンティティ
diary_day = Entity(
    name="DIARY_DAY",
    join_keys=["ENTRY_DATE"],
    desc="日記の1日を表すエンティティ"
)

fs.register_entity(diary_day)
print("Entity 'DIARY_DAY' を登録しました")
```

## ハンズオン Step 2: Feature View の定義（20分）

### 2-1. 感情特徴量

```python
# 感情関連の特徴量を計算するクエリ
emotion_features_df = session.sql("""
    SELECT
        d.entry_date AS ENTRY_DATE,
        d.mood_score,
        e.joy AS emotion_joy,
        e.sadness AS emotion_sadness,
        e.anger AS emotion_anger,
        e.fear AS emotion_fear,
        e.surprise AS emotion_surprise,
        (e.sadness + e.anger + e.fear) AS emotion_stress,
        -- 移動平均（直近3日）
        AVG(d.mood_score) OVER (
            ORDER BY d.entry_date
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS mood_3day_avg,
        -- 移動平均（直近7日）
        AVG(d.mood_score) OVER (
            ORDER BY d.entry_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS mood_7day_avg,
        -- 前日からの変化
        d.mood_score - LAG(d.mood_score, 1) OVER (ORDER BY d.entry_date) AS mood_diff,
        -- 曜日
        DAYOFWEEK(d.entry_date) AS day_of_week,
        CASE WHEN DAYOFWEEK(d.entry_date) IN (0, 6) THEN 1 ELSE 0 END AS is_weekend
    FROM diary_entries d
    LEFT JOIN emotion_analysis e ON d.entry_date = e.entry_date
""")

# Feature View の作成（Dynamic Table として管理される）
emotion_fv = FeatureView(
    name="EMOTION_FEATURES",
    entities=[diary_day],
    feature_df=emotion_features_df,
    refresh_freq="1 hour",  # Dynamic Table の TARGET_LAG
    desc="感情スコア、移動平均、曜日情報の特徴量"
)

emotion_fv = fs.register_feature_view(
    feature_view=emotion_fv,
    version="V1"
)
print("Feature View 'EMOTION_FEATURES' を登録しました")
```

### 2-2. カレンダー特徴量

```python
# 翌日のカレンダー情報を特徴量化
calendar_features_df = session.sql("""
    SELECT
        DATEADD('day', -1, c.event_date) AS ENTRY_DATE,  -- 翌日の予定を前日のfeatureとして
        COUNT(CASE WHEN c.category = 'work' THEN 1 END) AS next_day_work_count,
        COUNT(CASE WHEN c.category = 'social' THEN 1 END) AS next_day_social_count,
        COUNT(CASE WHEN c.category = 'health' THEN 1 END) AS next_day_health_count,
        COUNT(*) AS next_day_total_events
    FROM calendar_events c
    GROUP BY DATEADD('day', -1, c.event_date)
""")

calendar_fv = FeatureView(
    name="CALENDAR_FEATURES",
    entities=[diary_day],
    feature_df=calendar_features_df,
    refresh_freq="1 hour",
    desc="翌日のカレンダー予定数の特徴量"
)

calendar_fv = fs.register_feature_view(
    feature_view=calendar_fv,
    version="V1"
)
print("Feature View 'CALENDAR_FEATURES' を登録しました")
```

### 2-3. Feature View の確認

```python
# 登録済み Feature View の一覧
feature_views = fs.list_feature_views()
print(feature_views)

# 特徴量の中身を確認
emotion_data = fs.read_feature_view(emotion_fv)
emotion_data.show(10)
```

## ハンズオン Step 3: Training Dataset の生成（10分）

```python
from snowflake.ml.feature_store import FeatureViewSlice
import snowflake.snowpark.functions as F

# spine: 学習データの骨格（entry_date + 翌日の mood_score = ターゲット）
spine_df = session.sql("""
    SELECT
        entry_date AS ENTRY_DATE,
        LEAD(mood_score, 1) OVER (ORDER BY entry_date) AS next_day_mood
    FROM diary_entries
    WHERE LEAD(mood_score, 1) OVER (ORDER BY entry_date) IS NOT NULL
""")

# Feature View から特徴量を自動結合
training_dataset = fs.generate_training_set(
    spine_df=spine_df,
    features=[
        emotion_fv,     # 感情特徴量
        calendar_fv,    # カレンダー特徴量
    ],
    save_as="MOOD_PREDICTION_TRAINING_V1",
    spine_timestamp_col=None,  # point-in-time lookup が必要な場合に指定
    spine_label_cols=["NEXT_DAY_MOOD"]
)

# 確認
training_df = training_dataset.read.to_pandas()
print(f"Training data shape: {training_df.shape}")
print(training_df.head())
print(training_df.describe())
```

## ハンズオン Step 4: XGBoost で学習（15分）

### 4-1. Snowpark ML で学習

```python
from snowflake.ml.modeling.xgboost import XGBRegressor
from snowflake.ml.modeling.preprocessing import StandardScaler
from snowflake.ml.modeling.pipeline import Pipeline

# 特徴量とターゲットの分離
feature_cols = [
    'EMOTION_JOY', 'EMOTION_SADNESS', 'EMOTION_ANGER', 'EMOTION_FEAR',
    'EMOTION_SURPRISE', 'EMOTION_STRESS',
    'MOOD_3DAY_AVG', 'MOOD_7DAY_AVG', 'MOOD_DIFF',
    'DAY_OF_WEEK', 'IS_WEEKEND',
    'NEXT_DAY_WORK_COUNT', 'NEXT_DAY_SOCIAL_COUNT'
]
target_col = 'NEXT_DAY_MOOD'

# Snowpark DataFrame に変換
train_sp_df = session.create_dataframe(training_df)

# Pipeline: StandardScaler → XGBRegressor
pipeline = Pipeline(
    steps=[
        ("scaler", StandardScaler(
            input_cols=feature_cols,
            output_cols=feature_cols
        )),
        ("model", XGBRegressor(
            input_cols=feature_cols,
            label_cols=[target_col],
            output_cols=["PREDICTED_MOOD"],
            n_estimators=100,
            max_depth=3,
            learning_rate=0.1
        ))
    ]
)

# 学習
pipeline.fit(train_sp_df)

# 予測
predictions = pipeline.predict(train_sp_df)
predictions.select("ENTRY_DATE", "NEXT_DAY_MOOD", "PREDICTED_MOOD").show(10)
```

### 4-2. 精度評価

```python
from snowflake.ml.modeling.metrics import mean_absolute_error, r2_score

pred_df = predictions.to_pandas()

mae = abs(pred_df['NEXT_DAY_MOOD'] - pred_df['PREDICTED_MOOD']).mean()
print(f"MAE (Mean Absolute Error): {mae:.2f}")

# R2スコア
from sklearn.metrics import r2_score as sklearn_r2
r2 = sklearn_r2(pred_df['NEXT_DAY_MOOD'], pred_df['PREDICTED_MOOD'])
print(f"R2 Score: {r2:.3f}")

# 注意: 30行のデータでは過学習の可能性が高い
# これは「体験」が目的。本番精度は半年分のデータで再学習が必要
```

## ハンズオン Step 5: Model Registry に登録（10分）

```python
from snowflake.ml.registry import Registry

# Model Registry
registry = Registry(
    session=session,
    database_name="FOCUS_YOU",
    schema_name="MODELS"
)

# モデル登録
model_ref = registry.log_model(
    model=pipeline,
    model_name="MOOD_PREDICTOR",
    version_name="V1",
    comment="翌日のmood_scoreを予測するXGBoostモデル（30行で学習、体験用）",
    metrics={
        "mae": float(mae),
        "r2": float(r2),
        "training_rows": len(training_df)
    },
    sample_input_data=train_sp_df.select(feature_cols).limit(5)
)

print(f"モデル登録完了: {model_ref.model_name} / {model_ref.version_name}")

# 登録済みモデルの確認
models = registry.show_models()
print(models)
```

### 推論用のUDF

```python
# 登録したモデルを UDF として呼び出し可能にする
model_version = registry.get_model("MOOD_PREDICTOR").version("V1")

# 推論
new_data = session.sql("""
    SELECT * FROM TABLE(
        FOCUS_YOU.FEATURE_STORE.EMOTION_FEATURES_V1
    ) LIMIT 5
""")
result = model_version.run(new_data, function_name="predict")
result.show()
```

## Dynamic Table による自動リフレッシュ

Feature View を Dynamic Table で定義したので、ソーステーブルにデータが追加されると自動で特徴量が再計算される:

```sql
-- diary_entries に新しい日記を追加
INSERT INTO diary_entries VALUES ('2026-03-31', '月末。振り返りの時間を取った。', 7);

-- Dynamic Table が自動リフレッシュ（TARGET_LAG = 1 hour 以内）
-- 確認:
SELECT * FROM TABLE(FOCUS_YOU.FEATURE_STORE.EMOTION_FEATURES_V1)
WHERE ENTRY_DATE = '2026-03-31';
```

## 2026年の新機能: Iceberg 対応

```python
from snowflake.ml.feature_store import StorageConfig, StorageFormat

# Iceberg フォーマットでの保存（2026年新機能）
iceberg_fv = FeatureView(
    name="EMOTION_FEATURES_ICEBERG",
    entities=[diary_day],
    feature_df=emotion_features_df,
    refresh_freq="1 hour",
    storage_config=StorageConfig(
        storage_format=StorageFormat.ICEBERG,
        external_volume="my_iceberg_volume"
    ),
    desc="Iceberg形式の感情特徴量"
)
```

出典: https://docs.snowflake.com/en/en/release-notes/clients-drivers/snowpark-ml-2026 (2026-04-15参照)

## まとめ: Snowflake Feature Store の手触り

**良い点**:
- **Dynamic Table による自動リフレッシュ**: 特徴量がソースデータの変更に自動追従。バッチジョブの管理が不要
- **SQL完結の特徴量定義**: 複雑なPythonコード不要。ウィンドウ関数で移動平均が書ける
- **Snowpark ML との統合**: XGBoost / LightGBM がSnowflake内で動く。データ移動なし
- **Model Registry**: モデルのバージョン管理・メトリクス記録が組み込み

**気になる点**:
- **Snowflake閉じたエコシステム**: scikit-learn / PyTorch を使いたい場合、Snowpark の制約を受ける
- **Online Feature Store**: GA しているが、利用にはSnowflake以外のサービス（Redis互換）が必要
- **AutoML なし**: Databricks AutoML のような自動モデル選択はない
- **30行の限界**: Feature Store の真価は数百テーブル・数千特徴量の規模で発揮される。30行では「体験」レベル

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Snowflake Feature Store: Dynamic Table + Snowpark ML Python API（https://docs.snowflake.com/en/developer-guide/snowflake-ml/feature-store/overview）
- Feature View は Dynamic Table として実装。TARGET_LAG で自動リフレッシュ（https://docs.snowflake.com/en/developer-guide/snowflake-ml/feature-store/feature-views）
- 2026年に Iceberg 対応を追加。外部ストレージへの書き出しが可能に（https://docs.snowflake.com/en/en/release-notes/clients-drivers/snowpark-ml-2026）
- Advanced Guide（Quick Start 形式）（https://www.snowflake.com/en/developers/guides/advanced-guide-to-snowflake-feature-store/）

### 2. 限界の明示

- **30行での学習**: 過学習の可能性が非常に高い。R2スコアが高くても汎化性能は期待できない
- **Snowpark ML のモデル制約**: XGBoost / LightGBM / scikit-learn ベースのモデルは動くが、PyTorch / TensorFlow はサポート外（Snowpark Container Services が必要）
- **Online Feature Store**: 低レイテンシのリアルタイム推論に必要だが、構成がやや複雑
- **Point-in-time Join**: 時系列データでのリーク防止に必要だが、30行では効果が見えにくい

### 3. 壁打ちモードへの導線

1. **「Dynamic Table の自動リフレッシュは、cronジョブと何が違うか？」** — 宣言的 vs 命令的。Dynamic Table は「常に最新」を保証する思想
2. **「Feature Store をクライアントに提案する最低条件は？」** — 特徴量10個以上、MLモデル2つ以上、チーム2人以上（1人なら pandas で十分）
3. **「XGBoost の結果をどう解釈するか？」** — SHAP 値で特徴量重要度を説明。「joy が高い翌日は mood_score が上がる傾向」のような解釈
4. **「mood予測を focus-you の機能として実装するなら、UXはどうなるか？」** — 「明日の予測mood: 7.2」を表示するか、もっと穏やかな表現にするか
