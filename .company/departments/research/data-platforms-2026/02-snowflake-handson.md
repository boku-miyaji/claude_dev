# 02 Snowflake ハンズオン

> 所要時間: 約2.5時間 / 前提: `00-trial-and-pricing.md` でサインアップ済み、Snowsight が開ける状態

## このハンズオンのゴール

focus-you のサンプルCSV3本を Snowflake に取り込み、SQL と Cortex AI で「日次感情×予定」の集計→要約→可視化までを **Snowsight Worksheet + Notebook + Streamlit** で一気通貫する。

## 前提の確認

- Snowsight にログインすると左メニューに「Data / SQL Worksheets / Notebooks / Streamlit / AI & ML」等がある
- 右上で **Role = ACCOUNTADMIN** を選択（学習用途）
- 右上で **Warehouse = COMPUTE_WH** を選択。`AUTO_SUSPEND=60` になっているか確認: 以下SQLを叩く

```sql
ALTER WAREHOUSE COMPUTE_WH SET AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
```

---

## ステップ0: データベース・スキーマを作る（5分）

SQL Worksheet に貼って全部Run。

```sql
CREATE DATABASE IF NOT EXISTS FOCUS_YOU;
CREATE SCHEMA IF NOT EXISTS FOCUS_YOU.RAW;
CREATE SCHEMA IF NOT EXISTS FOCUS_YOU.MART;

USE DATABASE FOCUS_YOU;
USE SCHEMA RAW;

-- ① 日記
CREATE OR REPLACE TABLE diary_entries (
  entry_date DATE,
  entry_text STRING,
  mood_score INT
);

-- ② 感情分析結果
CREATE OR REPLACE TABLE emotion_analysis (
  entry_date DATE,
  joy FLOAT, sadness FLOAT, anger FLOAT,
  fear FLOAT, surprise FLOAT, disgust FLOAT
);

-- ③ カレンダー
CREATE OR REPLACE TABLE calendar_events (
  event_date DATE,
  event_title STRING,
  category STRING
);
```

## ステップ1: INGEST — CSVをアップロード（15分）

Snowsight 左メニューの **Data → Databases → FOCUS_YOU → RAW → diary_entries** を開く。

1. テーブル詳細画面右上「**Load Data**」ボタン
2. ローカルから `sample-data/diary_entries.csv` を選択
3. **File format = CSV / Skip header = 1 / Field delimiter = ,**
4. **Load** 押下 → 内部ステージ経由でテーブルに取り込まれる
5. 同じ要領で `emotion_analysis.csv`, `calendar_events.csv` をそれぞれ対応テーブルに

※CLI派なら SnowSQL の `PUT file://... @%tablename;` → `COPY INTO ...` でもOK。学習用にはUIの方が概念が見える。

**検証**:

```sql
SELECT COUNT(*) FROM diary_entries;       -- 30
SELECT COUNT(*) FROM emotion_analysis;    -- 30
SELECT COUNT(*) FROM calendar_events;     -- 34
```

## ステップ2: TRANSFORM — 日次で結合（20分）

MARTスキーマに日次ビューを作る。

```sql
USE SCHEMA FOCUS_YOU.MART;

CREATE OR REPLACE VIEW daily_mood AS
SELECT
  d.entry_date,
  d.entry_text,
  d.mood_score,
  e.joy, e.sadness, e.anger, e.fear, e.surprise, e.disgust,
  COALESCE(c.work_count, 0)     AS work_events,
  COALESCE(c.health_count, 0)   AS health_events,
  COALESCE(c.social_count, 0)   AS social_events,
  COALESCE(c.family_count, 0)   AS family_events,
  COALESCE(c.personal_count, 0) AS personal_events
FROM FOCUS_YOU.RAW.diary_entries d
LEFT JOIN FOCUS_YOU.RAW.emotion_analysis e
  ON d.entry_date = e.entry_date
LEFT JOIN (
  SELECT
    event_date,
    SUM(CASE WHEN category='work'     THEN 1 ELSE 0 END) AS work_count,
    SUM(CASE WHEN category='health'   THEN 1 ELSE 0 END) AS health_count,
    SUM(CASE WHEN category='social'   THEN 1 ELSE 0 END) AS social_count,
    SUM(CASE WHEN category='family'   THEN 1 ELSE 0 END) AS family_count,
    SUM(CASE WHEN category='personal' THEN 1 ELSE 0 END) AS personal_count
  FROM FOCUS_YOU.RAW.calendar_events
  GROUP BY event_date
) c ON d.entry_date = c.event_date
ORDER BY d.entry_date;

SELECT * FROM daily_mood LIMIT 5;
```

## ステップ3: AGGREGATE — 週次 PERMA+V 代理スコア（10分）

> PERMA+V: ポジティブ心理学の幸福モデル。ここでは簡易版として **joy平均 × mood_score平均** を使う。

```sql
CREATE OR REPLACE VIEW weekly_perma AS
SELECT
  DATE_TRUNC('week', entry_date)        AS week_start,
  ROUND(AVG(joy), 3)                    AS avg_joy,
  ROUND(AVG(mood_score), 2)             AS avg_mood,
  ROUND(AVG(joy) * AVG(mood_score), 3)  AS perma_v_proxy,
  SUM(work_events)                      AS total_work,
  SUM(health_events)                    AS total_health,
  SUM(social_events + family_events)    AS total_relationships
FROM FOCUS_YOU.MART.daily_mood
GROUP BY 1
ORDER BY 1;

SELECT * FROM weekly_perma;
```

## ステップ4: VISUALIZE — Snowflake Notebook + Chart（20分）

1. Snowsight 左メニュー **Notebooks → + Notebook**
2. 新規Notebook名 `focus_you_analysis`、Warehouse=COMPUTE_WH、Database/Schema = FOCUS_YOU.MART
3. SQLセルを追加してこう書く:

```sql
SELECT * FROM weekly_perma;
```

4. 実行後、セル結果の右側に **Chart** タブ。X軸=WEEK_START, Y軸=PERMA_V_PROXY でライン
5. もう1つセル追加:

```sql
SELECT entry_date, joy, sadness, mood_score/10.0 AS mood_norm
FROM FOCUS_YOU.MART.daily_mood
ORDER BY entry_date;
```

6. Chart で line 3本（joy / sadness / mood_norm）を同じ軸に

※2025年以降は Snowflake Notebooks の本体は Workspaces 内に統合されている。旧UIは **Legacy Notebooks** と呼ばれる。

## ステップ5: AI — Cortexで日本語要約（20分）

Cortex の `COMPLETE` 関数を使う。**小さいモデル（claude-haiku-4-5 等）** を指定してクレジット節約。

```sql
-- 全日記を1つの文字列に連結
WITH all_text AS (
  SELECT LISTAGG(entry_text, ' / ') WITHIN GROUP (ORDER BY entry_date) AS corpus
  FROM FOCUS_YOU.RAW.diary_entries
)
SELECT SNOWFLAKE.CORTEX.COMPLETE(
  'claude-haiku-4-5',
  CONCAT(
    '以下は1ヶ月分の日記です。この期間の気分の傾向、ストレス源、回復のパターンを日本語で300字以内で要約してください。',
    '\n\n',
    corpus
  )
) AS summary
FROM all_text;
```

タスク別関数（AISQL）も試す価値あり:

```sql
-- 日記1件ずつを自動分類（work/social/health/family/personal）
SELECT
  entry_date,
  SNOWFLAKE.CORTEX.CLASSIFY_TEXT(
    entry_text,
    ['work','social','health','family','personal']
  ) AS category_json
FROM FOCUS_YOU.RAW.diary_entries
LIMIT 10;

-- 感情分析（英語モデルが中心なので参考値として）
SELECT
  entry_date,
  SNOWFLAKE.CORTEX.SENTIMENT(entry_text) AS sentiment_score
FROM FOCUS_YOU.RAW.diary_entries
LIMIT 10;
```

## ステップ5.5: Streamlit in Snowflake（オプション、30分）

1. Snowsight 左メニュー **Streamlit → + Streamlit App**
2. 名前 `focus_you_dashboard`、Warehouse、Database/Schema 選択
3. エディタに以下を貼る:

```python
import streamlit as st
from snowflake.snowpark.context import get_active_session

session = get_active_session()
st.title("focus-you 感情ダッシュボード")

weekly = session.sql("SELECT * FROM FOCUS_YOU.MART.weekly_perma").to_pandas()
st.subheader("週次 PERMA+V 代理スコア")
st.line_chart(weekly.set_index("WEEK_START")["PERMA_V_PROXY"])

daily = session.sql("""
  SELECT entry_date, joy, sadness, mood_score
  FROM FOCUS_YOU.MART.daily_mood ORDER BY entry_date
""").to_pandas()
st.subheader("日次 joy / sadness / mood_score")
st.line_chart(daily.set_index("ENTRY_DATE"))

st.subheader("AI要約")
if st.button("日記を要約"):
    result = session.sql("""
        WITH all_text AS (
          SELECT LISTAGG(entry_text, ' / ') WITHIN GROUP (ORDER BY entry_date) AS corpus
          FROM FOCUS_YOU.RAW.diary_entries
        )
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
          'claude-haiku-4-5',
          CONCAT('以下の日記を日本語で300字以内で要約してください: ', corpus)
        ) AS summary FROM all_text
    """).collect()
    st.write(result[0]["SUMMARY"])
```

4. **Run** で Streamlit アプリがSnowflake内部で起動

## 後片付け（必須）

```sql
ALTER WAREHOUSE COMPUTE_WH SUSPEND;
```

Streamlit / Notebook を閉じても Warehouse が動き続けているとクレジット消費するため必ず SUSPEND。

## 気づきメモ用（自由記述）

- SQLだけでAI要約まで完結したか？
- UIで引っかかった場所は？
- Cortex のモデル切替（`llama3.1-8b`等）で結果は変わる？
- クレジット消費が思ったより多い/少ない箇所は？

## 公知情報の限界

- `CLASSIFY_TEXT` / `SENTIMENT` の**日本語精度は公式ベンチなし**。英語中心モデルが多いため、実利用では自前プロンプト + COMPLETE の方が安定することもある
- Streamlit in Snowflake のGA化は進んだが、**外部npmパッケージの利用制限**が残っており、UIライブラリは限定的
- Cortex の料金は **credits per 1K tokens** で公開されているが、**モデル別の実質コスト**は使ってみないと見えない

## 壁打ちモードへの導線

- 「Worksheet / Notebook / Streamlit の **3つのUI** のうち、どれが**自分の手に一番馴染んだ**か？それはなぜ？」
- 「**Cortex COMPLETE の日本語出力品質**を、**自分のSupabase Edge Function経由GPT-4**と比較したらどうだったか？」
- 「クライアントに **SQLだけでAIができる**と売るとしたら、**どのタイプの組織**に一番刺さりそうか？」
- 「この体験を **Databricks Notebook** と比較する前に、今の自分は『Snowflake的な世界観』をどう言語化できるか？」

## 結論

- Snowflake の世界観は「**SQL Worksheet が全ての中心**」。INGEST→TRANSFORM→AI→VIZ がすべて **1つのタブで完結** する体験は独特
- 詰まりポイントは少ない代わりに、**Notebook / Streamlit の柔軟性** は Databricks より一段下（体感）
- **Cortex のSQL関数は想像以上にシンプル**で、AI/LLM を知っている社長なら違和感なく入れる

## ネクストアクション

- [ ] `05-comparison-reflection.md` の Snowflake セクションに所感を3行書く
- [ ] Warehouseを確実に SUSPEND したことを確認
- [ ] `03-databricks-handson.md` に進む

## 主要ソース（全て 2026-04-15 アクセス）

- [COMPLETE (SNOWFLAKE.CORTEX) | Snowflake Documentation](https://docs.snowflake.com/en/sql-reference/functions/complete-snowflake-cortex)
- [Snowflake Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql)
- [Feature updates in 2025](https://docs.snowflake.com/en/release-notes/feature-releases-2025)
- [Sentiment Analysis Using Snowflake Cortex AI on Iceberg Tables (Quickstart)](https://quickstarts.snowflake.com/guide/cortex_ai_sentiment_iceberg/)
- [Trial accounts | Snowflake Documentation](https://docs.snowflake.com/en/user-guide/admin-trial-account)
