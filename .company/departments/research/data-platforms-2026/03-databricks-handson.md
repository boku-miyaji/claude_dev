# 03 Databricks ハンズオン（Free Edition）

> 所要時間: 約2.5時間 / 前提: `00-trial-and-pricing.md` で Free Edition サインアップ済み、ワークスペースが開ける状態

## このハンズオンのゴール

Snowflakeでやったのと **完全に同じユースケース** を Databricks Free Edition で実装する。
Snowflakeとの違いを肌で感じるのが目的。Notebook/PySpark/Delta/Unity Catalog/ai_query/AI/BI Dashboardを一通り触る。

## 前提の確認

- Free Edition はワークスペースが **1つだけ** プロビジョニング済み
- 左メニュー: `Workspace / Catalog / Compute / SQL Editor / Dashboards / Jobs & Pipelines / Experiments`
- **Serverless コンピュートのみ**使える（Classicは選択不可）

---

## ステップ0: Catalog と Schema を作る（5分）

左メニュー **SQL Editor** を開き、以下を Run:

```sql
-- Free Edition では 'workspace' カタログがデフォルトで用意されている
CREATE SCHEMA IF NOT EXISTS workspace.focus_you;
USE SCHEMA workspace.focus_you;
```

> Free Edition の Unity Catalog は `workspace` という単一カタログ。有償版は複数メタストア・複数カタログが切れる。

## ステップ1: INGEST — CSVをアップロード（15分）

### 方法A: UIで一気に（推奨）

1. 左メニュー **Catalog → workspace → focus_you** を開く
2. 右上「**Create → Table**」
3. 「Upload files to volume」を選択 → `diary_entries.csv` をドラッグ
4. **Create table from upload** で以下を設定:
   - Table name: `diary_entries`
   - **Infer column types** オン
   - Header row オン
5. Create Table
6. 同じ要領で `emotion_analysis.csv`, `calendar_events.csv`

### 方法B: Notebookから（Sparkの感覚を掴むならこっち）

左メニュー **Workspace → Create → Notebook**（名前 `focus_you_ingest`, 言語=Python, Serverless選択）。

```python
# まず UI で workspace.focus_you.raw_files という Volume を作っておく
# あるいは workspace.default.raw ボリュームに置く
# （Free Edition では /Volumes/workspace/... のパス形式）

# ローカルCSVをアップロード（Volumesビューで右クリック → Upload）後:
diary_df = spark.read.option("header", "true").option("inferSchema", "true") \
    .csv("/Volumes/workspace/default/raw/diary_entries.csv")

diary_df.write.mode("overwrite").saveAsTable("workspace.focus_you.diary_entries")

emotion_df = spark.read.option("header","true").option("inferSchema","true") \
    .csv("/Volumes/workspace/default/raw/emotion_analysis.csv")
emotion_df.write.mode("overwrite").saveAsTable("workspace.focus_you.emotion_analysis")

cal_df = spark.read.option("header","true").option("inferSchema","true") \
    .csv("/Volumes/workspace/default/raw/calendar_events.csv")
cal_df.write.mode("overwrite").saveAsTable("workspace.focus_you.calendar_events")
```

**検証（SQL Editorで）**:

```sql
SELECT COUNT(*) FROM workspace.focus_you.diary_entries;     -- 30
DESCRIBE EXTENDED workspace.focus_you.diary_entries;
-- "Provider: delta" になっているはず（Delta Lakeで保存される）
```

## ステップ2: TRANSFORM — 日次結合（20分）

SQL Editor で以下を Run:

```sql
CREATE OR REPLACE VIEW workspace.focus_you.daily_mood AS
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
FROM workspace.focus_you.diary_entries d
LEFT JOIN workspace.focus_you.emotion_analysis e
  ON d.entry_date = e.entry_date
LEFT JOIN (
  SELECT
    event_date,
    SUM(CASE WHEN category='work'     THEN 1 ELSE 0 END) AS work_count,
    SUM(CASE WHEN category='health'   THEN 1 ELSE 0 END) AS health_count,
    SUM(CASE WHEN category='social'   THEN 1 ELSE 0 END) AS social_count,
    SUM(CASE WHEN category='family'   THEN 1 ELSE 0 END) AS family_count,
    SUM(CASE WHEN category='personal' THEN 1 ELSE 0 END) AS personal_count
  FROM workspace.focus_you.calendar_events
  GROUP BY event_date
) c ON d.entry_date = c.event_date;

SELECT * FROM workspace.focus_you.daily_mood ORDER BY entry_date LIMIT 5;
```

## ステップ3: AGGREGATE — 週次PERMA+V（10分）

```sql
CREATE OR REPLACE VIEW workspace.focus_you.weekly_perma AS
SELECT
  DATE_TRUNC('week', entry_date)        AS week_start,
  ROUND(AVG(joy), 3)                    AS avg_joy,
  ROUND(AVG(mood_score), 2)             AS avg_mood,
  ROUND(AVG(joy) * AVG(mood_score), 3)  AS perma_v_proxy,
  SUM(work_events)                      AS total_work,
  SUM(health_events)                    AS total_health,
  SUM(social_events + family_events)    AS total_relationships
FROM workspace.focus_you.daily_mood
GROUP BY 1
ORDER BY 1;

SELECT * FROM workspace.focus_you.weekly_perma;
```

## ステップ4: VISUALIZE — AI/BI Dashboard（30分）

**AI/BI は2025年に Genie とともにGA**。Free Edition でも触れる。

1. 左メニュー **Dashboards → Create dashboard**
2. 名前: `focus_you`
3. **Data** タブで Dataset を追加:

```sql
-- Dataset 1: weekly_perma
SELECT * FROM workspace.focus_you.weekly_perma ORDER BY week_start;

-- Dataset 2: daily_mood
SELECT entry_date, joy, sadness, mood_score/10.0 AS mood_norm
FROM workspace.focus_you.daily_mood ORDER BY entry_date;
```

4. **Canvas** タブでウィジェットを追加:
   - Line chart: X=`week_start`, Y=`perma_v_proxy`
   - Line chart: X=`entry_date`, Y=`joy`, `sadness`, `mood_norm`
   - Counter: `SUM(total_work)` など
5. 右上で **Publish** → 共有用リンクが生成

### Genie セクション（自然言語BI、必ず触る）

1. ダッシュボードの上部から **+ Genie** を追加 or 左メニューから **Genie space**
2. Genie に `weekly_perma` と `daily_mood` を登録
3. 自然言語で質問:
   - 「週ごとのperma_v_proxyの推移を折れ線で見せて」
   - 「jbyが一番高かった日は？」
   - 「workの予定が多い週とmood_scoreの関係は？」
4. **Thinking steps** を開いて、Genie がどのテーブル・SQLを使ったかを確認（2025 の新機能）

## ステップ5: AI — ai_query で日本語要約（20分）

SQL Editor で:

```sql
-- 日本語要約（Foundation Model として databricks-meta-llama-3-3-70b-instruct を使用）
WITH all_text AS (
  SELECT array_join(collect_list(entry_text), ' / ') AS corpus
  FROM workspace.focus_you.diary_entries
)
SELECT ai_query(
  'databricks-meta-llama-3-3-70b-instruct',
  CONCAT(
    '以下は1ヶ月分の日記です。この期間の気分の傾向、ストレス源、回復のパターンを日本語で300字以内で要約してください。\n\n',
    corpus
  ),
  modelParameters => named_struct('max_tokens', 500, 'temperature', 0.5)
) AS summary
FROM all_text;
```

タスク別関数も試す:

```sql
-- ai_summarize（シンプル版）
SELECT ai_summarize(entry_text, 20) AS short_summary
FROM workspace.focus_you.diary_entries
LIMIT 5;

-- ai_classify でカテゴリ自動分類
SELECT
  entry_date,
  ai_classify(entry_text, ARRAY('work','social','health','family','personal')) AS category
FROM workspace.focus_you.diary_entries
LIMIT 10;
```

## ステップ5.5: Notebook で可視化（オプション、20分）

新規Notebookを作って:

```python
import pandas as pd
import matplotlib.pyplot as plt

weekly = spark.table("workspace.focus_you.weekly_perma").toPandas()
daily = spark.table("workspace.focus_you.daily_mood").toPandas()

fig, axes = plt.subplots(2, 1, figsize=(10, 8))
axes[0].plot(weekly["week_start"], weekly["perma_v_proxy"], marker="o")
axes[0].set_title("Weekly PERMA+V proxy")

axes[1].plot(daily["entry_date"], daily["joy"], label="joy")
axes[1].plot(daily["entry_date"], daily["sadness"], label="sadness")
axes[1].plot(daily["entry_date"], daily["mood_score"]/10, label="mood(norm)")
axes[1].legend()
axes[1].set_title("Daily emotions")

display(fig)
```

## 後片付け

- Serverless は idle で自動停止するので明示的な suspend は不要
- ただし **日次クォータ**を使い切ると翌日まで計算停止するので、長時間ループは避ける

## 気づきメモ用

- Snowflake の `COMPLETE` と Databricks の `ai_query` の **使用感の違い** は？
- `ai_summarize` / `ai_classify` のような **タスク別関数** の存在は便利？冗長？
- Genie の **Thinking steps** を見て、BIの自動化レベルをどう感じた？
- Delta Lake で保存されていることを、SQL Editor の `DESCRIBE EXTENDED` で意識できたか？

## 公知情報の限界

- Free Edition の**日次クォータの具体値**は公式に数値明記されていない時期あり。体感で触るしかない
- `ai_query` の **日本語出力品質** は Foundation Model 側の性能依存。Llama 3.3 70B は日本語可だがGPT-5/Claude系の方が自然な場合あり（外部モデル呼び出しは要 Mosaic AI Gateway 設定）
- Free Edition では **Mosaic AI Gateway** の一部機能、**モデルカスタマイズ**、**GPU training** は使えない
- Genie は日本語でも質問できるが、**テーブル名・カラム名が日本語**だと精度が落ちる体感報告あり

## 壁打ちモードへの導線

- 「**Spark/Notebook前提の世界観**は、SQL一本で来た Snowflake と比べてどう感じた？好みは？」
- 「**Unity Catalog** が提供する『catalog.schema.table』の3段階の意味を、クライアントに **一言で説明** できるか？」
- 「**Genie の Thinking steps** は、BI初心者のクライアント担当者に **どの程度の安心感** を与えるか？」
- 「**同じ ai_query** でも外部モデル（GPT-5等）を呼ぶなら、**Mosaic AI Gateway** の価値は？」

## 結論

- Databricks は「**SQLもできるNotebookの国**」。Snowflakeが「SQL Worksheetの国」なのと **入口の感覚が逆**
- Free Edition でも Genie / AI/BI / ai_query / Unity Catalog すべて触れる。**学習環境としては現時点で最強**（期限なし、クレカなし）
- **Spark/Delta の存在**を意識する場面が要所であり（`DESCRIBE EXTENDED`、`/Volumes/...` パス等）、Snowflakeより **"インフラが透けて見える"**

## ネクストアクション

- [ ] `05-comparison-reflection.md` の Databricks セクションに所感を3行書く
- [ ] ai_queryで使ったトークン数を意識する習慣をつける
- [ ] `04-fabric-handson.md` に進む

## 主要ソース（全て 2026-04-15 アクセス）

- [ai_query function | Databricks on AWS](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query)
- [ai_summarize function](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_summarize)
- [Enrich data using AI Functions](https://docs.databricks.com/aws/en/large-language-models/ai-functions)
- [What's new with Databricks Unity Catalog at Data + AI Summit 2025](https://www.databricks.com/blog/whats-new-databricks-unity-catalog-data-ai-summit-2025)
- [Databricks Free Edition limitations](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations)
- [Guide: Moving from Community Edition to Free Edition](https://community.databricks.com/t5/databricks-university-alliance/guide-and-best-practices-moving-from-community-edition-to-free/ta-p/129308)
