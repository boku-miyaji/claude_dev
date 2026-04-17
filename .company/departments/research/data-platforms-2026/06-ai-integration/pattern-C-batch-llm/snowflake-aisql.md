# Snowflake Cortex AISQL — バッチLLM推論ハンズオン

> **所要時間**: 60分 / **前提**: Snowflake アカウント（Trial可）、第1弾でCSVロード済み / **ゴール**: AI_COMPLETE, AI_CLASSIFY, AI_EXTRACT, AI_SUMMARIZE_AGG を使って diary_entries 30行を一括処理する

## Cortex AISQL とは何か

Cortex AISQL は Snowflake の SQL 内で LLM を呼び出すための関数群。2025年11月にGA。「SELECT文の中でAIを動かす」というコンセプトで、ETLパイプラインにLLMを自然に組み込める。

従来の方法（Python SDKでOpenAI APIを叩いてループ処理）と比べた最大の違いは:
- **並列化・リトライを Snowflake が管理**: ユーザーはSQLを書くだけ
- **データがSnowflake外に出ない**: PIIを含むデータでもガバナンスを維持
- **課金がトークンベース**: コンピュートクレジットではなくAIクレジット

公式ドキュメント: https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql (2026-04-15参照)

## 関数一覧と使い分け

| 関数 | 用途 | 入力 | 出力 | いつ使うか |
|------|------|------|------|----------|
| `AI_COMPLETE` | 汎用テキスト生成 | プロンプト + テキスト | 自由形式テキスト | タスク特化関数でカバーできないとき |
| `AI_CLASSIFY` | カテゴリ分類 | テキスト + カテゴリ配列 | カテゴリ名 + 信頼度 | 選択肢が有限のとき |
| `AI_EXTRACT` | 構造化データ抽出 | テキスト + スキーマ | JSON | テキストから特定フィールドを抜き出すとき |
| `AI_SUMMARIZE_AGG` | 複数行の集約要約 | テキスト列 (集約) | 要約テキスト | GROUP BY で複数行を1つの要約にまとめるとき |
| `AI_SENTIMENT` | 感情スコア | テキスト | -1.0 ~ 1.0 | ポジネガの数値が欲しいとき |
| `AI_FILTER` | フィルタリング | テキスト + 条件 | TRUE/FALSE | 自然言語条件でWHEREしたいとき |

**原則: タスク特化関数を先に検討する。AI_COMPLETE は最後の手段。** タスク特化関数は内部で最適モデルを選択し、プロンプトエンジニアリングも不要なことが多い。

## 事前準備

第1弾で diary_entries, emotion_analysis, calendar_events は既にロード済みの前提。まだの場合:

```sql
-- データベースとスキーマ
CREATE DATABASE IF NOT EXISTS FOCUS_YOU;
USE DATABASE FOCUS_YOU;
CREATE SCHEMA IF NOT EXISTS RAW;
USE SCHEMA RAW;

-- diary_entries テーブル
CREATE OR REPLACE TABLE diary_entries (
    entry_date DATE,
    entry_text VARCHAR,
    mood_score INT
);

-- CSVからロード（Snowsight の "Load Data" UIが最も簡単）
-- または stage 経由:
-- PUT file:///path/to/diary_entries.csv @~/staged;
-- COPY INTO diary_entries FROM @~/staged FILE_FORMAT = (TYPE = CSV SKIP_HEADER = 1);
```

## ハンズオン Step 1: AI_CLASSIFY で感情分類（15分）

### 1-1. まずは1行で試す

```sql
SELECT
    entry_date,
    entry_text,
    AI_CLASSIFY(
        entry_text,
        ['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral']
    ) AS emotion_result
FROM diary_entries
LIMIT 1;
```

結果は JSON オブジェクトで返る:

```json
{
  "label": "joy",
  "score": 0.87
}
```

ここで確認すること:
- `label` は指定したカテゴリ名のいずれかが返る
- `score` は信頼度（0-1）。0.5未満なら分類に自信がないことを示す
- 日本語テキストでも動作する（内部で多言語対応モデルが選択される）

### 1-2. 全30行を一括処理

```sql
-- 結果格納用テーブル
CREATE OR REPLACE TABLE diary_emotions AS
SELECT
    entry_date,
    entry_text,
    mood_score,
    AI_CLASSIFY(
        entry_text,
        ['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral']
    ) AS emotion_result,
    AI_CLASSIFY(
        entry_text,
        ['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral']
    ):label::VARCHAR AS primary_emotion,
    AI_CLASSIFY(
        entry_text,
        ['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral']
    ):score::FLOAT AS confidence,
    CURRENT_TIMESTAMP() AS processed_at
FROM diary_entries;
```

**注意**: 上記は emotion_result を3回呼んでいる（トークン3倍消費）。プロダクションではCTEを使う:

```sql
CREATE OR REPLACE TABLE diary_emotions AS
WITH classified AS (
    SELECT
        entry_date,
        entry_text,
        mood_score,
        AI_CLASSIFY(
            entry_text,
            ['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral']
        ) AS emotion_result
    FROM diary_entries
)
SELECT
    entry_date,
    entry_text,
    mood_score,
    emotion_result,
    emotion_result:label::VARCHAR AS primary_emotion,
    emotion_result:score::FLOAT AS confidence,
    CURRENT_TIMESTAMP() AS processed_at
FROM classified;
```

### 1-3. 結果を確認

```sql
SELECT primary_emotion, COUNT(*), AVG(confidence)
FROM diary_emotions
GROUP BY primary_emotion
ORDER BY COUNT(*) DESC;
```

期待される分布: joy が最多（ポジティブな日記が多い）、sadness と neutral が続く。

## ハンズオン Step 2: AI_EXTRACT でタグ抽出（15分）

### 2-1. スキーマ定義と実行

```sql
-- AI_EXTRACT: テキストから構造化データを抽出
SELECT
    entry_date,
    entry_text,
    AI_EXTRACT(
        entry_text,
        {
            'tags': 'この日記に関連するタグを3つまで。例: 運動, 仕事, 人間関係, 体調, 趣味, 家族, 学び',
            'activity': 'この日に行った主な活動を1つ',
            'energy_level': '活力レベル（high / medium / low）'
        }
    ) AS extracted
FROM diary_entries
LIMIT 5;
```

結果例:
```json
{
  "tags": ["仕事", "人間関係"],
  "activity": "上司と議論",
  "energy_level": "low"
}
```

### 2-2. 全行処理 + フラット化

```sql
CREATE OR REPLACE TABLE diary_tags AS
WITH extracted AS (
    SELECT
        entry_date,
        entry_text,
        AI_EXTRACT(
            entry_text,
            {
                'tags': 'この日記に関連するタグを3つまで。例: 運動, 仕事, 人間関係, 体調, 趣味, 家族, 学び',
                'activity': 'この日に行った主な活動を1つ',
                'energy_level': '活力レベル（high / medium / low）'
            }
        ) AS extracted_data
    FROM diary_entries
)
SELECT
    entry_date,
    entry_text,
    extracted_data,
    extracted_data:activity::VARCHAR AS main_activity,
    extracted_data:energy_level::VARCHAR AS energy_level,
    CURRENT_TIMESTAMP() AS processed_at
FROM extracted;
```

### 2-3. タグの集計

```sql
-- FLATTEN で配列を展開して集計
SELECT
    f.value::VARCHAR AS tag,
    COUNT(*) AS frequency
FROM diary_tags,
    LATERAL FLATTEN(input => extracted_data:tags) f
GROUP BY tag
ORDER BY frequency DESC;
```

## ハンズオン Step 3: AI_SUMMARIZE_AGG で月間要約（10分）

### 3-1. 全30行を1つの要約に

```sql
SELECT
    AI_SUMMARIZE_AGG(entry_text)
FROM diary_entries;
```

これだけで30日分の日記が1段落に要約される。AI_SUMMARIZE_AGG は集約関数なので GROUP BY と組み合わせられる:

```sql
-- 週ごとの要約
SELECT
    DATE_TRUNC('week', entry_date) AS week_start,
    AI_SUMMARIZE_AGG(entry_text) AS weekly_summary,
    AVG(mood_score) AS avg_mood
FROM diary_entries
GROUP BY DATE_TRUNC('week', entry_date)
ORDER BY week_start;
```

### 3-2. カスタムプロンプト付き要約（AI_COMPLETE）

AI_SUMMARIZE_AGG は便利だがプロンプトをカスタマイズできない。より詳細な指示を出すなら AI_COMPLETE:

```sql
WITH all_entries AS (
    SELECT LISTAGG(entry_date || ': ' || entry_text, '\n') 
           WITHIN GROUP (ORDER BY entry_date) AS combined
    FROM diary_entries
)
SELECT AI_COMPLETE(
    'claude-3-5-haiku',
    '以下は1ヶ月分の日記です。3つの観点で要約してください:
     1. 全体的な気分の傾向
     2. 気分が良かった日のパターン
     3. 気分が落ちた日のパターン
     
     日記:
     ' || combined
) AS monthly_analysis
FROM all_entries;
```

## ハンズオン Step 4: インクリメンタル処理パターン（10分）

プロダクションで最も重要なパターン。新しいデータが追加されたとき、処理済みの行を再処理しない:

```sql
-- Step 1: 処理結果テーブル（processed_at で冪等制御）
CREATE TABLE IF NOT EXISTS diary_analysis (
    entry_date DATE PRIMARY KEY,
    entry_text VARCHAR,
    primary_emotion VARCHAR,
    confidence FLOAT,
    tags VARIANT,
    processed_at TIMESTAMP,
    model_used VARCHAR DEFAULT 'cortex-ai-classify-v1'
);

-- Step 2: 未処理行だけ INSERT
INSERT INTO diary_analysis (entry_date, entry_text, primary_emotion, confidence, tags, processed_at)
WITH new_entries AS (
    SELECT d.entry_date, d.entry_text
    FROM diary_entries d
    LEFT JOIN diary_analysis a ON d.entry_date = a.entry_date
    WHERE a.entry_date IS NULL  -- まだ処理されていない行
),
classified AS (
    SELECT
        entry_date,
        entry_text,
        AI_CLASSIFY(
            entry_text,
            ['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral']
        ) AS emotion_result,
        AI_EXTRACT(
            entry_text,
            {'tags': '関連タグを3つまで'}
        ) AS tag_result
    FROM new_entries
)
SELECT
    entry_date,
    entry_text,
    emotion_result:label::VARCHAR,
    emotion_result:score::FLOAT,
    tag_result:tags,
    CURRENT_TIMESTAMP()
FROM classified;

-- Step 3: 何行処理されたか確認
SELECT COUNT(*) AS newly_processed
FROM diary_analysis
WHERE processed_at > DATEADD('minute', -5, CURRENT_TIMESTAMP());
```

## ハンズオン Step 5: エラーハンドリング（10分）

### TRY_ 版でエラーを NULL に変換

```sql
-- TRY_AI_COMPLETE: エラー時に NULL を返す（クエリ全体が失敗しない）
SELECT
    entry_date,
    TRY_AI_COMPLETE('claude-3-5-haiku', entry_text) AS result,
    CASE WHEN TRY_AI_COMPLETE('claude-3-5-haiku', entry_text) IS NULL
         THEN 'ERROR' ELSE 'OK' END AS status
FROM diary_entries;
```

### エラー行の再処理

```sql
-- NULL（エラー）行だけ再処理
UPDATE diary_analysis
SET
    primary_emotion = AI_CLASSIFY(entry_text, ['joy','sadness','anger','fear','surprise','neutral']):label::VARCHAR,
    confidence = AI_CLASSIFY(entry_text, ['joy','sadness','anger','fear','surprise','neutral']):score::FLOAT,
    processed_at = CURRENT_TIMESTAMP()
WHERE primary_emotion IS NULL;  -- 前回エラーだった行
```

## コスト確認

```sql
-- Cortex AI の使用量を確認（ACCOUNT_USAGE）
SELECT
    start_time,
    function_name,
    model_name,
    tokens_input,
    tokens_output,
    credits_used
FROM SNOWFLAKE.ACCOUNT_USAGE.CORTEX_FUNCTIONS_USAGE_HISTORY
WHERE start_time > DATEADD('hour', -1, CURRENT_TIMESTAMP())
ORDER BY start_time DESC;
```

2026年4月時点の参考単価（AIクレジット/100万トークン、edition非依存）:
- claude-3-5-haiku: ~0.25 credits/MT (入力), ~1.25 credits/MT (出力)
- llama3.1-8b: ~0.04 credits/MT
- AI_CLASSIFY/AI_EXTRACT(タスク特化): 内部モデル、概ね小モデル相当

出典: https://dataengineerhub.blog/articles/snowflake-cortex-cost-comparison (2026-04-15参照)

## まとめ: Snowflake Cortex AISQL の手触り

**良い点**:
- タスク特化関数（AI_CLASSIFY, AI_EXTRACT, AI_SUMMARIZE_AGG）が直感的。プロンプトを書かなくても動く
- TRY_ 版でエラーハンドリングが簡潔
- ACCOUNT_USAGE でコスト可視化が組み込み
- SQL完結。Python環境不要

**気になる点**:
- AI_COMPLETE のモデル名が Snowflake 独自表記（'claude-3-5-haiku' 等）。公式のモデル名と微妙に違うので確認が必要
- JSON出力の制御は AI_EXTRACT に頼る形。AI_COMPLETE で自由にJSON Schemaを指定する機能はDatabricksほど柔軟ではない
- 外部モデル（Azure OpenAI等）の統合は Cortex Functions の外部関数経由で可能だが、設定がやや複雑

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Cortex AISQL は2025年11月にGA。AI_COMPLETE, AI_CLASSIFY, AI_EXTRACT, AI_FILTER, AI_SENTIMENT, AI_SUMMARIZE_AGG 等を提供（https://docs.snowflake.com/en/release-notes/2025/other/2025-11-04-cortex-aisql-operators-ga）
- 2026年4月からAIクレジットがedition非依存化。Enterprise/Business Critical の割増がなくなった（https://medium.com/towards-data-engineering/breaking-down-snowflakes-ai-pricing-overhaul-credits-caching-and-cost-strategy-bde56f48f53f）
- Cortex AISQL は手動パイプラインの3-7倍高速（Snowflake公式ベンチマーク）（https://www.snowflake.com/en/blog/intelligent-governed-ai-at-scale/）
- TRY_ 版関数でエラーハンドリングが可能（https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql）

### 2. 限界の明示

- **単価の変動**: Snowflake は2026年Q1にモデルラインナップと単価を変更した。本ドキュメントの単価は2026-04-15時点。最新はACCOUNT_USAGEで実測すべき
- **モデル名の表記**: Snowflake独自のモデル名表記がある。公式ドキュメントのモデル一覧ページで都度確認が必要
- **大量行の挙動**: 30行では問題なく動くが、10万行で同じSQLを実行した場合の並列度・タイムアウト挙動は未検証
- **日本語精度**: 多言語対応だが、英語に比べて日本語のAI_CLASSIFY精度がどの程度かは公式ベンチマーク未公表

### 3. 壁打ちモードへの導線

1. **「AI_CLASSIFYの結果と既存のemotion_analysis.csvの値を突き合わせたら一致率はどのくらいか？」** — LLM分類とルールベース/別モデル分類の整合性を測る実験
2. **「AI_SUMMARIZE_AGGの要約を週次レポートにそのまま使えるか？」** — 要約品質の主観評価。カスタムプロンプト版との比較
3. **「Snowflake内で完結するメリットを、PIIを扱うクライアントにどう説明するか？」** — データ移動不要のガバナンス価値
4. **「AI_EXTRACTで抽出したタグの粒度は適切か？」** — タグ設計はドメイン知識が必要。LLMに任せきりで良いか
