# Databricks ai_query() — バッチLLM推論ハンズオン

> **所要時間**: 60分 / **前提**: Databricks ワークスペース（Community Edition不可、Trial可）、第1弾でCSVロード済み / **ゴール**: ai_query() SQL関数で diary_entries 30行を一括処理。responseFormat による JSON Schema 強制を体験する

## ai_query() とは何か

`ai_query()` は Databricks の SQL 関数で、SQL の SELECT 文内から LLM を呼び出す。Snowflake の AI_COMPLETE に相当するが、Databricks の特徴は **responseFormat による出力スキーマの完全制御** と **外部モデル（GPT-4o, Claude）との統一インターフェース**。

2025年にGAし、2026年にかけてバッチ推論の自動並列化・リトライが強化された。「フルデータを1クエリで投入せよ。手動バッチ分割はするな」というのが公式の推奨。

公式ドキュメント: https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query (2026-04-15参照)
AI Functions 全体: https://docs.databricks.com/aws/en/large-language-models/ai-functions (2026-04-15参照)

## 関数一覧と使い分け

| 関数 | 用途 | Snowflake対応 |
|------|------|-------------|
| `ai_query('endpoint', prompt)` | 汎用LLM呼び出し | AI_COMPLETE |
| `ai_classify(text, labels)` | カテゴリ分類 | AI_CLASSIFY |
| `ai_extract(text, labels)` | 情報抽出 | AI_EXTRACT |
| `ai_summarize(text)` | 要約 | AI_SUMMARIZE_AGG (※集約版) |
| `ai_gen(prompt)` | テキスト生成 | AI_COMPLETE |
| `ai_similarity(text1, text2)` | 類似度 | AI_SIMILARITY |
| `ai_translate(text, to_lang)` | 翻訳 | - |
| `ai_fix_grammar(text)` | 文法修正 | - |
| `ai_mask(text, labels)` | PII マスキング | AI_REDACT |

`ai_query()` は汎用関数で、他のタスク特化関数でカバーできない処理に使う。最大の武器は **responseFormat**。

## 事前準備

```sql
-- Unity Catalog のカタログとスキーマ
USE CATALOG focus_you;
USE SCHEMA raw;

-- テーブル確認
SELECT * FROM diary_entries LIMIT 5;
```

## ハンズオン Step 1: ai_classify で感情分類（15分）

### 1-1. タスク特化関数で1行試す

```sql
SELECT
    entry_date,
    entry_text,
    ai_classify(entry_text, ARRAY('joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral')) AS emotion
FROM diary_entries
LIMIT 1;
```

`ai_classify` は文字列を返す（Snowflakeと異なりJSONではなくラベル直）。シンプルだがconfidence値は取れない。

### 1-2. ai_query + responseFormat で信頼度付き分類

confidence が欲しい場合は `ai_query` を使う:

```sql
SELECT
    entry_date,
    entry_text,
    ai_query(
        'databricks-claude-3-5-haiku',
        CONCAT(
            '以下の日記テキストの感情を分類してください。\n',
            'テキスト: ', entry_text
        ),
        responseFormat => 'STRUCT<label: STRING, confidence: DOUBLE>',
        modelParameters => named_struct(
            'temperature', CAST(0.0 AS DOUBLE),
            'max_tokens', CAST(100 AS INT)
        )
    ) AS emotion_result
FROM diary_entries
LIMIT 3;
```

ここが Databricks の真骨頂。`responseFormat` に `STRUCT` を指定すると、LLMの出力が **必ずそのスキーマに従うJSON** になる。パースの心配がない。

### 1-3. 全30行を一括処理

```sql
CREATE OR REPLACE TABLE diary_emotions AS
SELECT
    entry_date,
    entry_text,
    mood_score,
    ai_classify(
        entry_text,
        ARRAY('joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral')
    ) AS primary_emotion,
    CURRENT_TIMESTAMP() AS processed_at
FROM diary_entries;
```

**ポイント**: Databricks は自動で並列化する。30行なら数秒で完了。手動で LIMIT でバッチ分割する必要はない。

### 1-4. 結果確認

```sql
SELECT primary_emotion, COUNT(*) AS cnt
FROM diary_emotions
GROUP BY primary_emotion
ORDER BY cnt DESC;
```

## ハンズオン Step 2: ai_query + responseFormat でタグ抽出（15分）

### 2-1. 構造化抽出の威力

```sql
SELECT
    entry_date,
    entry_text,
    ai_query(
        'databricks-meta-llama-3-3-70b-instruct',
        CONCAT(
            '以下の日記からタグ、活動、活力レベルを抽出してください。\n',
            'タグは最大3つ。活力レベルはhigh/medium/lowのいずれか。\n\n',
            '日記: ', entry_text
        ),
        responseFormat => 'STRUCT<tags: ARRAY<STRING>, activity: STRING, energy_level: STRING>'
    ) AS extracted
FROM diary_entries
LIMIT 5;
```

`responseFormat` のネストに注目。`ARRAY<STRING>` でタグが配列として返り、後続処理でそのまま EXPLODE できる。

### 2-2. 全行処理 + フラット化

```sql
CREATE OR REPLACE TABLE diary_tags AS
SELECT
    entry_date,
    entry_text,
    ai_query(
        'databricks-meta-llama-3-3-70b-instruct',
        CONCAT(
            '以下の日記からタグ、活動、活力レベルを抽出してください。\n',
            'タグは最大3つ。活力レベルはhigh/medium/lowのいずれか。\n\n',
            '日記: ', entry_text
        ),
        responseFormat => 'STRUCT<tags: ARRAY<STRING>, activity: STRING, energy_level: STRING>'
    ) AS extracted,
    CURRENT_TIMESTAMP() AS processed_at
FROM diary_entries;

-- タグの集計
SELECT
    tag,
    COUNT(*) AS frequency
FROM diary_tags
LATERAL VIEW EXPLODE(extracted.tags) AS tag
GROUP BY tag
ORDER BY frequency DESC;
```

### 2-3. マネージドモデル vs 外部モデル

```sql
-- Databricksホストモデル（DBRX, Llama等）: プレフィックス 'databricks-'
SELECT ai_query('databricks-dbrx-instruct', 'Hello') AS dbrx_response;

-- 外部モデル（GPT-4o等）: Model Serving の External Model として事前登録が必要
-- 登録後は同じ ai_query で呼べる
SELECT ai_query('gpt-4o-endpoint', 'Hello') AS gpt4o_response;
```

外部モデルの登録:
```sql
-- Unity Catalog にエンドポイントとして登録（Workspace UI推奨）
-- SQL でも可能:
-- CREATE EXTERNAL MODEL gpt4o_endpoint
-- OPTIONS (provider = 'openai', model = 'gpt-4o', api_key = secret('scope', 'key'));
```

## ハンズオン Step 3: 月間要約（10分）

### 3-1. ai_summarize で簡易要約

```sql
-- 全テキストを結合して要約
WITH combined AS (
    SELECT CONCAT_WS('\n',
        COLLECT_LIST(CONCAT(entry_date, ': ', entry_text))
    ) AS all_entries
    FROM diary_entries
)
SELECT ai_summarize(all_entries) AS monthly_summary
FROM combined;
```

### 3-2. カスタムプロンプトで詳細分析

```sql
WITH combined AS (
    SELECT CONCAT_WS('\n',
        COLLECT_LIST(CONCAT(CAST(entry_date AS STRING), ': ', entry_text, ' (mood:', CAST(mood_score AS STRING), ')'))
    ) AS all_entries
    FROM diary_entries
)
SELECT ai_query(
    'databricks-claude-3-5-haiku',
    CONCAT(
        '以下は1ヶ月分の日記です。3つの観点で分析してください:\n',
        '1. 全体的な気分の傾向\n',
        '2. 気分が良かった日のパターン\n',
        '3. 気分が落ちた日のパターン\n\n',
        all_entries
    ),
    responseFormat => 'STRUCT<trend: STRING, positive_patterns: ARRAY<STRING>, negative_patterns: ARRAY<STRING>>'
) AS monthly_analysis
FROM combined;
```

`responseFormat` で構造化された分析結果が返る。これを後続のダッシュボードやアラートに直結できる。

## ハンズオン Step 4: インクリメンタル処理（10分）

### Delta Lake の MERGE INTO パターン

```sql
-- 結果テーブル
CREATE TABLE IF NOT EXISTS diary_analysis (
    entry_date DATE,
    entry_text STRING,
    primary_emotion STRING,
    tags ARRAY<STRING>,
    processed_at TIMESTAMP,
    model_used STRING
) USING DELTA;

-- MERGE: 未処理行だけ INSERT、処理済みは SKIP
MERGE INTO diary_analysis AS target
USING (
    SELECT
        entry_date,
        entry_text,
        ai_classify(entry_text, ARRAY('joy','sadness','anger','fear','surprise','neutral')) AS primary_emotion,
        ai_query(
            'databricks-meta-llama-3-3-70b-instruct',
            CONCAT('タグを3つ抽出: ', entry_text),
            responseFormat => 'STRUCT<tags: ARRAY<STRING>>'
        ).tags AS tags,
        CURRENT_TIMESTAMP() AS processed_at,
        'databricks-meta-llama-3-3-70b-instruct' AS model_used
    FROM diary_entries
) AS source
ON target.entry_date = source.entry_date
WHEN NOT MATCHED THEN INSERT *;

-- 処理結果の確認
SELECT COUNT(*) AS total, MAX(processed_at) AS last_processed FROM diary_analysis;
```

Delta Lake の MERGE INTO が冪等処理に自然にフィットする。Snowflake の `WHERE processed_at IS NULL` パターンより宣言的。

### Lakeflow Declarative Pipelines (旧 Delta Live Tables) との統合

プロダクションでは ai_query を Lakeflow Spark Declarative Pipelines に組み込むのが推奨:

```python
# Lakeflow Declarative Pipeline 定義
import dlt
from pyspark.sql.functions import expr

@dlt.table(
    comment="日記の感情分類結果"
)
def diary_emotions():
    return (
        dlt.read("diary_entries")
        .withColumn("emotion", expr("""
            ai_classify(entry_text, array('joy','sadness','anger','fear','surprise','neutral'))
        """))
    )
```

## ハンズオン Step 5: エラーハンドリングとモニタリング（10分）

### エラー行の特定

```sql
-- ai_query がエラーを返した行を確認
SELECT
    entry_date,
    entry_text,
    ai_query('databricks-claude-3-5-haiku', entry_text) AS result
FROM diary_entries
WHERE ai_query('databricks-claude-3-5-haiku', entry_text) IS NULL;
```

### レート制限の制御

```sql
-- max_requests_per_minute でスロットリング
SELECT ai_query(
    'databricks-claude-3-5-haiku',
    entry_text,
    modelParameters => named_struct(
        'max_tokens', CAST(200 AS INT)
    ),
    max_requests_per_minute => 60  -- 1分あたり最大60リクエスト
) AS result
FROM diary_entries;
```

### 使用量のモニタリング

```sql
-- system.billing テーブルでコスト確認
SELECT
    usage_date,
    sku_name,
    usage_quantity AS dbu_consumed,
    usage_unit
FROM system.billing.usage
WHERE sku_name LIKE '%FOUNDATION_MODEL%'
    AND usage_date >= CURRENT_DATE() - INTERVAL 1 DAY
ORDER BY usage_date DESC;
```

## まとめ: Databricks ai_query の手触り

**良い点**:
- **responseFormat が最強**: STRUCT でスキーマを強制できるので、JSON パース地獄がない
- **外部モデル統合**: GPT-4o、Claude、カスタムモデルを同じ ai_query で呼べる
- **Delta MERGE との親和性**: 冪等処理が宣言的に書ける
- **自動並列化**: フルデータ投入推奨。基盤が分割・リトライを管理
- **Lakeflow統合**: パイプラインに自然に組み込める

**気になる点**:
- **エンドポイント名の管理**: マネージドモデルは `databricks-` プレフィックスだが、外部モデルは自分で登録が必要。名前の一貫性は自分で管理
- **タスク特化関数の信頼度**: ai_classify はラベル文字列のみ返し、Snowflake のような confidence 値がない（ai_query + responseFormat で代替可能だが一手間増える）
- **Community Edition 不可**: ai_query は有料ワークスペースが必要。Trial で動くがリソース制限あり

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- ai_query は基盤が自動で並列化・リトライを管理。手動バッチ分割は非推奨（https://docs.databricks.com/aws/en/large-language-models/ai-query）
- responseFormat で STRUCT 型を指定するとJSON Schema強制。ネスト・配列も対応（https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query）
- Lakeflow Spark Declarative Pipelines（旧DLT）への統合が推奨ワークフロー（https://www.databricks.com/blog/introducing-simple-fast-and-scalable-batch-llm-inference-mosaic-ai-model-serving）
- Foundation Model Serving で DBU ベース課金。モデルごとのDBUレートは公式価格ページ参照（https://www.databricks.com/product/pricing）

### 2. 限界の明示

- **DBU単価の不透明さ**: DBU単位で課金されるが、1リクエストあたり何DBU消費されるかはモデル・入力量・並列度で変動。Snowflakeのトークン単価ほど直感的ではない
- **外部モデル登録の手間**: GPT-4oやClaudeを使うにはModel Servingに外部モデルとして登録が必要。APIキーの管理を含む
- **ai_classifyの信頼度なし**: ラベル文字列しか返らない。信頼度が欲しい場合はai_query + responseFormatで自作する必要がある
- **大量行のタイムアウト**: 10万行規模での実行時間はワークスペースのクラスタサイズとモデルのスループットに依存。個人Trialでの検証には限界がある

### 3. 壁打ちモードへの導線

1. **「responseFormat と Snowflake の AI_EXTRACT、どちらが使いやすいか？」** — スキーマ定義の書き味を比較。DatabricksはSQL型、SnowflakeはJSON記法
2. **「外部モデル（GPT-4o）とマネージドモデル（Llama）でai_classifyの精度差はあるか？」** — 同じ30行で比較実験すると面白い
3. **「Delta MERGE パターンをクライアントに説明するとき、何がポイントか？」** — 冪等性の価値を非エンジニアに伝える言葉を持つ
4. **「Lakeflow Pipeline に組み込むメリットを、バッチスクリプトとの対比で語れるか？」** — スケジュール実行・依存管理・エラーリカバリの自動化
