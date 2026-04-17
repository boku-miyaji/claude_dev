# Microsoft Fabric AI Functions — バッチLLM推論ハンズオン

> **所要時間**: 60分 / **前提**: Fabric ワークスペース（Trial可）、第1弾でCSVロード済み / **ゴール**: ai.generate_response, ai.classify, ai.extract を使って diary_entries 30行を一括処理。pandas拡張方式とNotebook方式の両方を体験する

## Fabric AI Functions とは何か

Fabric AI Functions は Microsoft Fabric のノートブックやデータウェアハウスから LLM を呼び出すための関数群。裏側は Azure OpenAI のモデル（GPT-4o / GPT-4o-mini）が動いている。ユーザーは Azure OpenAI のサブスクリプションやAPIキーを意識する必要がない。Fabric のキャパシティ（CU）から消費される。

Snowflake/Databricks との最大の違いは **2つの呼び出し方** があること:
1. **pandas 拡張方式**: Notebook 内で `import fabric.functions as ai` してDataFrameに適用
2. **DW SQL方式**: Fabric Data Warehouse から SQL関数として呼ぶ（Preview）

2026年3月にGA拡張。マルチモーダル対応（画像・PDF分類）もPreviewで追加された。

公式ドキュメント:
- 概要: https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/overview (2026-04-15参照)
- pandas版: https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/pandas/generate-response (2026-04-15参照)
- DW SQL版(Preview): https://learn.microsoft.com/en-us/fabric/data-warehouse/ai-functions (2026-04-15参照)

## 関数一覧と使い分け

| 関数 | 用途 | pandas | DW SQL | Snowflake対応 |
|------|------|--------|--------|-------------|
| `ai.generate_response` | 汎用テキスト生成 | GA | Preview | AI_COMPLETE |
| `ai.classify` | カテゴリ分類 | GA | Preview | AI_CLASSIFY |
| `ai.extract` | 情報抽出 | GA | Preview | AI_EXTRACT |
| `ai.summarize` | 要約 | GA | Preview | AI_SUMMARIZE_AGG |
| `ai.sentiment` | 感情分析 | GA | Preview | AI_SENTIMENT |
| `ai.similarity` | 類似度 | GA | Preview | AI_SIMILARITY |
| `ai.translate` | 翻訳 | GA | Preview | - |

**DW SQL版は2026-04-15時点でPreview**。安定運用にはpandas方式を推奨。ただしDW SQL版も使えるケースが増えている。

## 事前準備

Fabric Notebook を新規作成:

```python
# Lakehouse からデータ読み込み
df = spark.sql("SELECT * FROM lakehouse.diary_entries").toPandas()
print(f"行数: {len(df)}")
df.head()
```

## ハンズオン Step 1: ai.classify で感情分類（15分）

### 1-1. pandas 方式で1行試す

```python
import fabric.functions as ai

# 1行テスト
test_text = df.iloc[0]['entry_text']
print(f"入力: {test_text}")

# ai.classify: テキストとラベル配列を渡す
result = ai.classify(
    df.head(1),
    column='entry_text',
    categories=['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral']
)
print(result)
```

結果は DataFrame の新しいカラムとして返る。カテゴリ名が文字列で入る。

### 1-2. 全30行を一括処理

```python
# 全行に感情分類を適用
df_emotions = ai.classify(
    df,
    column='entry_text',
    categories=['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral'],
    output_column='primary_emotion'
)

# 結果確認
print(df_emotions[['entry_date', 'entry_text', 'primary_emotion']].head(10))

# 分布
print(df_emotions['primary_emotion'].value_counts())
```

**ポイント**: pandas の DataFrame 操作そのもの。SQL を知らなくても使える。データサイエンティストのワークフローに自然に溶け込む。

### 1-3. DW SQL方式（Preview）

```sql
-- Fabric Data Warehouse から実行
SELECT
    entry_date,
    entry_text,
    ai_classify(
        entry_text,
        'joy,sadness,anger,fear,surprise,neutral'
    ) AS primary_emotion
FROM diary_entries
LIMIT 5;
```

DW SQL版はSnowflakeの AI_CLASSIFY と似た構文。ただしPreviewなので利用可能リージョンに制限がある。

## ハンズオン Step 2: ai.extract でタグ抽出（15分）

### 2-1. 構造化抽出

```python
# ai.extract: テキストから指定フィールドを抽出
df_extracted = ai.extract(
    df,
    column='entry_text',
    fields={
        'tags': 'この日記に関連するタグを3つまで。例: 運動, 仕事, 人間関係, 体調, 趣味, 家族, 学び',
        'activity': 'この日に行った主な活動を1つ',
        'energy_level': '活力レベル（high / medium / low）'
    }
)

print(df_extracted[['entry_date', 'tags', 'activity', 'energy_level']].head(10))
```

### 2-2. タグの集計

```python
import pandas as pd

# tags列をリストとして展開して集計
all_tags = []
for _, row in df_extracted.iterrows():
    if isinstance(row['tags'], list):
        all_tags.extend(row['tags'])
    elif isinstance(row['tags'], str):
        # カンマ区切りの場合
        all_tags.extend([t.strip() for t in row['tags'].split(',')])

tag_counts = pd.Series(all_tags).value_counts()
print(tag_counts.head(10))
```

### 2-3. カスタム指示付き抽出

```python
# ai.generate_response: より自由度の高い指示
df_custom = ai.generate_response(
    df,
    column='entry_text',
    instructions="""
    以下の日記テキストを分析し、以下の形式でJSON を返してください:
    {
        "key_insight": "この日の一番重要な気づき",
        "social_interaction": true/false,
        "productivity": "high/medium/low"
    }
    """,
    output_column='analysis'
)

print(df_custom[['entry_date', 'analysis']].head(5))
```

## ハンズオン Step 3: ai.summarize で月間要約（10分）

### 3-1. 全体要約

```python
# 全テキストを結合して要約
combined_text = '\n'.join(
    f"{row['entry_date']}: {row['entry_text']}"
    for _, row in df.iterrows()
)

# ai.summarize は DataFrame に対して動作するので、1行のDFを作る
summary_df = pd.DataFrame({'text': [combined_text]})
result = ai.summarize(summary_df, column='text', output_column='summary')
print(result['summary'].iloc[0])
```

### 3-2. 週ごとの要約

```python
# 週ごとにグループ化して要約
df['week'] = pd.to_datetime(df['entry_date']).dt.isocalendar().week

weekly_texts = df.groupby('week').apply(
    lambda g: '\n'.join(g['entry_text'])
).reset_index()
weekly_texts.columns = ['week', 'combined_text']

weekly_summaries = ai.summarize(
    weekly_texts,
    column='combined_text',
    output_column='weekly_summary'
)
print(weekly_summaries[['week', 'weekly_summary']])
```

### 3-3. カスタム分析（ai.generate_response）

```python
analysis_df = pd.DataFrame({'text': [combined_text]})
result = ai.generate_response(
    analysis_df,
    column='text',
    instructions="""
    以下は1ヶ月分の日記です。3つの観点で分析してください:
    1. 全体的な気分の傾向
    2. 気分が良かった日のパターン  
    3. 気分が落ちた日のパターン
    結論を200文字以内でまとめてください。
    """,
    output_column='monthly_analysis'
)
print(result['monthly_analysis'].iloc[0])
```

## ハンズオン Step 4: インクリメンタル処理パターン（10分）

### Lakehouse Delta テーブルでの冪等処理

```python
from pyspark.sql.functions import current_timestamp, col, lit

# 結果テーブルの作成（初回のみ）
spark.sql("""
    CREATE TABLE IF NOT EXISTS lakehouse.diary_analysis (
        entry_date DATE,
        entry_text STRING,
        primary_emotion STRING,
        tags STRING,
        processed_at TIMESTAMP,
        model_used STRING
    ) USING DELTA
""")

# 未処理行の取得
existing = spark.sql("SELECT entry_date FROM lakehouse.diary_analysis").toPandas()
existing_dates = set(existing['entry_date'].astype(str))

new_entries = df[~df['entry_date'].astype(str).isin(existing_dates)]
print(f"未処理行: {len(new_entries)}")

if len(new_entries) > 0:
    # AI処理
    processed = ai.classify(
        new_entries,
        column='entry_text',
        categories=['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral'],
        output_column='primary_emotion'
    )
    
    processed = ai.extract(
        processed,
        column='entry_text',
        fields={'tags': 'タグを3つまで'},
        output_column='tags'  
    )
    
    # Spark DataFrame に変換して保存
    processed['processed_at'] = pd.Timestamp.now()
    processed['model_used'] = 'fabric-ai-functions-gpt4o-mini'
    
    spark_df = spark.createDataFrame(
        processed[['entry_date', 'entry_text', 'primary_emotion', 'tags', 'processed_at', 'model_used']]
    )
    spark_df.write.mode("append").saveAsTable("lakehouse.diary_analysis")
    
    print(f"{len(new_entries)} 行を処理・保存しました")
else:
    print("新しい行はありません")
```

### MERGE INTO パターン（Spark SQL）

```python
# MERGE INTO で冪等性を確保（Databricksと同じ構文）
spark.sql("""
    MERGE INTO lakehouse.diary_analysis AS target
    USING lakehouse.diary_entries_processed AS source
    ON target.entry_date = source.entry_date
    WHEN NOT MATCHED THEN INSERT *
""")
```

## ハンズオン Step 5: カスタマイズと設定（10分）

### モデルの指定

```python
# デフォルトは GPT-4o-mini。GPT-4o を使いたい場合:
from fabric.functions import FabricAIFunctionsConfig

config = FabricAIFunctionsConfig(
    model="gpt-4o",  # or "gpt-4o-mini"（デフォルト）
    temperature=0.0,
    max_tokens=500
)

df_result = ai.classify(
    df,
    column='entry_text',
    categories=['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral'],
    config=config,
    output_column='emotion'
)
```

### エラーハンドリング

```python
# 行レベルのエラーハンドリング
try:
    result = ai.generate_response(
        df,
        column='entry_text',
        instructions='感情を分析してください',
        output_column='analysis'
    )
    # エラー行の確認（NaN/None になる）
    error_rows = result[result['analysis'].isna()]
    print(f"エラー行: {len(error_rows)}")
except Exception as e:
    print(f"全体エラー: {e}")
```

### Spark での大規模処理

30行はpandasで十分だが、大規模データはSparkで:

```python
from pyspark.sql.functions import pandas_udf
import pandas as pd

@pandas_udf("string")
def classify_emotion(texts: pd.Series) -> pd.Series:
    """Spark UDF でバッチ処理"""
    df_input = pd.DataFrame({'text': texts})
    result = ai.classify(
        df_input,
        column='text',
        categories=['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral'],
        output_column='emotion'
    )
    return result['emotion']

# Spark DataFrame に適用
spark_df = spark.table("lakehouse.diary_entries")
spark_df = spark_df.withColumn("emotion", classify_emotion(col("entry_text")))
spark_df.show()
```

## Fabric AI Functions の消費（CU）

Fabric AI Functions の消費は Fabric Capacity Unit (CU) で計測される。2026年3月以降、Capacity Metrics App で AI Functions の消費が独立した操作として表示されるようになった。

確認方法:
1. Fabric Admin Portal → Capacity Metrics App
2. 「AI Functions」フィルタで絞り込み
3. 時間帯別・ワークスペース別の消費量を確認

出典: https://blog.fabric.microsoft.com/en-US/blog/29826/ (2026-04-15参照)

## まとめ: Fabric AI Functions の手触り

**良い点**:
- **pandasネイティブ**: データサイエンティストのワークフローに完全にフィット。SQLを知らなくても使える
- **APIキー不要**: Azure OpenAIのサブスクリプションもキーも不要。Fabricキャパシティから自動消費
- **Power BI連携**: 処理結果をそのまま Power BI Semantic Model に渡せる。レポート化が最短
- **マルチモーダル対応**: 画像やPDFの分類もPreviewで追加（2026年3月）

**気になる点**:
- **モデル選択肢が限定的**: Azure OpenAI の GPT-4o / GPT-4o-mini のみ。Llama や Claude は使えない
- **DW SQL版はPreview**: SQL完結で使いたい場合、まだ安定性に不安がある
- **responseFormat相当がない**: Databricksのように出力スキーマを型レベルで強制する仕組みがない。ai.extract で代替するが、自由度は劣る
- **コスト可視化がやや遅い**: Capacity Metrics App での確認にタイムラグがある

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Fabric AI Functions は2026年3月にGA拡張。マルチモーダル対応もPreviewで追加（https://blog.fabric.microsoft.com/en-US/blog/29826/）
- pandas拡張とDW SQL関数の2つの呼び出し方を提供（https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/overview）
- ai.classify の使い方（https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/pandas/classify）
- ai.generate_response でカスタム指示付きテキスト生成（https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/pandas/generate-response）
- Capacity Metrics App で AI Functions の消費が独立表示（2026年3月〜）（https://blog.fabric.microsoft.com/en-in/blog/fabric-march-2026-feature-summary）

### 2. 限界の明示

- **DW SQL版の安定性**: Preview段階。pandas方式のほうが信頼性が高い
- **モデルの制約**: GPT-4o / GPT-4o-mini のみ。Snowflake（Claude, Llama）やDatabricks（DBRX, Llama, GPT-4o）に比べて選択肢が狭い
- **CU消費の見積もり**: AI Functions のCU消費レートは公式にはあまり詳細に公表されていない。実測での確認が必要
- **日本語の精度比較**: GPT-4o-mini の日本語分類精度は Snowflake（Claude Haiku）や Databricks（Llama 70B）と比較してどうか、公式ベンチマークなし

### 3. 壁打ちモードへの導線

1. **「pandas方式とSQL方式、クライアントにはどちらを勧めるか？」** — チームのスキルセット（Pythonメイン vs SQLメイン）で判断が分かれる
2. **「Power BI連携のメリットは具体的に何秒短縮するか？」** — Snowflake/Databricks だと中間CSVエクスポートが必要になる場面を特定
3. **「モデル選択肢がGPT-4o系のみというのは制約か強みか？」** — 選択肢が少ない＝迷わない＝運用が楽、という観点もある
4. **「Fabric AI Functions を使うべきクライアントの特徴は？」** — Microsoft 365ベースの組織、Power BI が既に浸透、Azure OpenAI を別途契約したくない
