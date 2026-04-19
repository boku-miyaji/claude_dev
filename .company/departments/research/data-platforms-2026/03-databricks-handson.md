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

---

## 非構造化データハンズオン

> 所要時間: 約2時間（独立したブロック）/ Snowflake編と**同じ5種の題材**を使って、Databricks 側の**Volume + ai_parse_document + Vector Search + ai_query**の流れを体験する。
> **目的**: Lakehouse = 「ファイルもテーブルも同じ場所に置く」という思想が、非構造化データでどう効くかを確かめる。Spark/Notebookが前提の世界観との相性を感じる。

### 題材の設定（3基盤共通）

介護・医療現場を想定した5種のサンプル。Snowflake編と**完全に同じファイル**を使う。

| # | 種類 | サンプルファイル名 | 想定中身 |
|---|------|------------------|---------|
| ① | 契約書PDF | `contract-care-2026.pdf` | 利用者との介護サービス契約書（5ページ、表含む） |
| ② | 利用者の写真/画像 | `user-profile-001.jpg` | 顔写真 + IDカード風の書式（手書き署名あり） |
| ③ | カンファレンス音声 | `conference-2026-04-10.mp3` | ケアプラン会議の録音（30分、3名発話） |
| ④ | 手書きメモ画像 | `handwritten-memo-0412.png` | スタッフが書いた申し送りメモ（日本語混在） |
| ⑤ | 問い合わせメール長文 | `inquiry-email-0415.txt` | 家族からの苦情を含む長文（2500字）|

**注意**: 実データはPIIを含むため、ハンズオンでは **合成データ or 完全匿名化済みサンプル** を使う。

### ステップU0: Volume を作る（5分）

Databricks の Unity Catalog では、非構造化ファイルは **Volume** に置く（`Table` は構造化専用）。
Volume のパスは `/Volumes/<catalog>/<schema>/<volume>/...` という統一形式。

```sql
-- SQL Editor で
USE SCHEMA workspace.focus_you;

CREATE VOLUME IF NOT EXISTS care_docs
  COMMENT 'Unstructured care documents (PDF/image/audio/text)';

-- 解析結果を格納するDeltaテーブル
CREATE TABLE IF NOT EXISTS parsed_documents (
  file_path      STRING,
  doc_type       STRING,
  content        STRING,
  metadata       MAP<STRING, STRING>,
  parsed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) USING DELTA;

-- チャンク + 埋め込みテーブル（Vector Search Index のソース）
CREATE TABLE IF NOT EXISTS document_chunks (
  chunk_id       STRING NOT NULL,
  file_path      STRING,
  doc_type       STRING,
  chunk_text     STRING,
  chunk_vector   ARRAY<FLOAT>,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) USING DELTA
TBLPROPERTIES (delta.enableChangeDataFeed = true);  -- Vector Search が同期で必要
```

> `enableChangeDataFeed = true` は **Mosaic AI Vector Search の Delta Sync Index を作る前提条件**。後で CDC ベースで自動同期される。

### ステップU1: INGEST — Volume にアップロード（10分）

#### UI派

1. 左メニュー **Catalog → workspace → focus_you → Volumes → care_docs**
2. 右上「**Upload to this volume**」
3. 5ファイル全部をドラッグ

#### Python/Notebook派

```python
import shutil, os

# ローカルの5ファイルを Volume にコピー（Notebook内）
SRC = "/path/to/local"
DST = "/Volumes/workspace/focus_you/care_docs"

for f in ["contract-care-2026.pdf", "user-profile-001.jpg",
          "conference-2026-04-10.mp3", "handwritten-memo-0412.png",
          "inquiry-email-0415.txt"]:
    shutil.copy(f"{SRC}/{f}", f"{DST}/{f}")

# 確認
display(dbutils.fs.ls(DST))
```

#### 検証

```sql
SELECT COUNT(*) FROM READ_FILES(
  '/Volumes/workspace/focus_you/care_docs',
  format => 'binaryFile'
);  -- 5
```

### ステップU2: PARSE — ai_parse_document で解析（30分）

Databricks は 2025-11 に **`ai_parse_document`** を Public Preview で投入（GA は 2026-05 予定）。**Snowflake の AI_PARSE_DOCUMENT と正面から競合する関数**。

#### 2a. PDF + 手書きメモ画像 → ai_parse_document（Public Preview）

`READ_FILES` で binary として読み込み、`ai_parse_document` に渡す。返り値は VARIANT で、`document.pages[].elements[]` に構造化されている。

```sql
-- 単発：contract-care-2026.pdf を解析
SELECT ai_parse_document(content, map('version', '2.0')) AS parsed
FROM READ_FILES(
  '/Volumes/workspace/focus_you/care_docs/contract-care-2026.pdf',
  format => 'binaryFile'
);

-- 一括：ステージ全体の PDF+画像 を解析して parsed_documents に格納
INSERT INTO parsed_documents(file_path, doc_type, content, metadata)
SELECT
  path                                            AS file_path,
  CASE
    WHEN path ILIKE '%.pdf' THEN 'contract'
    WHEN path ILIKE '%handwritten%' THEN 'handwritten'
    WHEN path ILIKE '%profile%' THEN 'photo'
  END                                             AS doc_type,
  -- pages[].elements[] から text のみ連結
  CAST(
    array_join(
      transform(
        ai_parse_document(content, map('version', '2.0')):document:pages,
        page -> array_join(
          transform(page:elements, e -> COALESCE(e:content::STRING, '')),
          '\n'
        )
      ),
      '\n\n---page---\n\n'
    ) AS STRING
  )                                               AS content,
  map(
    'source', 'ai_parse_document',
    'version', '2.0'
  )                                               AS metadata
FROM READ_FILES(
  '/Volumes/workspace/focus_you/care_docs',
  format => 'binaryFile'
)
WHERE path ILIKE '%.pdf' OR path ILIKE '%.png' OR path ILIKE '%.jpg';
```

#### 2b. 利用者写真 → ai_query with Vision Foundation Model

Vision対応のFoundation Modelエンドポイント（例: `databricks-claude-sonnet-4`）に画像を渡して情報抽出する。画像は **base64エンコード**してプロンプトに含める。

```python
# PySpark Notebookで
from pyspark.sql.functions import expr, col, base64, lit

img_df = (
    spark.read.format("binaryFile")
    .load("/Volumes/workspace/focus_you/care_docs/user-profile-001.jpg")
    .withColumn("b64", base64(col("content")))
)

result = img_df.select(
    lit("user-profile-001.jpg").alias("file_path"),
    lit("photo").alias("doc_type"),
    expr("""
      ai_query(
        'databricks-claude-sonnet-4',
        named_struct(
          'messages', array(named_struct(
            'role', 'user',
            'content', array(
              named_struct('type', 'text', 'text', 
                'このIDカード画像から氏名・生年月日・ID番号をJSONで抽出してください。判読不可能な項目はnull。'),
              named_struct('type', 'image_url',
                'image_url', named_struct('url', concat('data:image/jpeg;base64,', b64)))
            )
          ))
        )
      )
    """).alias("content")
)

result.write.mode("append").saveAsTable("workspace.focus_you.parsed_documents")
```

> **注意**: Vision対応モデルのエンドポイント名は workspace 設定で変わる。`databricks-claude-sonnet-4` / `databricks-llama-3-2-vision` など。`SELECT * FROM system.ai.foundation_models` で確認できる。

#### 2c. カンファレンス音声 → ai_query + Whisper V3

Databricks は **OpenAI Whisper V3 Large** を Marketplace 経由で Model Serving endpointとしてデプロイできる。**ネイティブなSQL関数はまだ無い**が、Whisper をデプロイ済みなら `ai_query` で呼べる。

```python
# 事前準備: Marketplace から Whisper V3 Large をインストール
# → Catalog → Marketplace → "Whisper-V3-Model" を取得
# → system.ai.whisper_v3_large として Serving endpoint を作成

# Notebook で音声を bytes 化して ai_query に渡す
import base64

with open("/Volumes/workspace/focus_you/care_docs/conference-2026-04-10.mp3", "rb") as f:
    audio_bytes = f.read()

audio_b64 = base64.b64encode(audio_bytes).decode()

# SQL版
transcription_df = spark.sql(f"""
  SELECT ai_query(
    'whisper_v3_endpoint',
    named_struct('audio', '{audio_b64}', 'language', 'ja', 'task', 'transcribe')
  ) AS transcript
""")

display(transcription_df)
```

**代替案**: Databricks ネイティブに固執しない場合、**Azure AI Speech** や **OpenAI Whisper API** を外部呼び出しで `ai_query` 経由にする方が実用的（Mosaic AI Gateway に登録して一元管理）。

#### 2d. 問い合わせメール → テキストそのまま

```sql
INSERT INTO parsed_documents(file_path, doc_type, content, metadata)
SELECT
  path        AS file_path,
  'email'     AS doc_type,
  CAST(content AS STRING) AS content,
  map('source', 'plain-text')
FROM READ_FILES(
  '/Volumes/workspace/focus_you/care_docs/inquiry-email-0415.txt',
  format => 'text',
  wholeText => true
);
```

**検証**:

```sql
SELECT doc_type, LENGTH(content) AS chars FROM parsed_documents ORDER BY doc_type;
```

### ステップU3: EMBED — Foundation Model で埋め込み（20分）

Databricks には **Foundation Model APIs** に埋め込みモデルが用意されている（`databricks-bge-large-en`, `databricks-gte-large-en` 等）。
日本語を扱う場合は **多言語対応の GTE Multilingual** もしくは **外部モデル経由（OpenAI text-embedding-3-large等）**が実務的に有利。

```python
# PySpark でチャンク化 + 埋め込み
from pyspark.sql.functions import expr, udf, col, posexplode
from pyspark.sql.types import ArrayType, StringType
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)

@udf(ArrayType(StringType()))
def chunk_text(text):
    return splitter.split_text(text or "")

parsed = spark.table("workspace.focus_you.parsed_documents")

chunks = (
    parsed
    .withColumn("chunks", chunk_text(col("content")))
    .select(
        col("file_path"), col("doc_type"),
        posexplode("chunks").alias("pos", "chunk_text")
    )
    .withColumn("chunk_id", expr("concat(file_path, '-', pos)"))
)

# 埋め込み（ai_query でバッチ推論）
chunks_with_vec = chunks.withColumn(
    "chunk_vector",
    expr("ai_query('databricks-gte-large-en', chunk_text)")
)

chunks_with_vec.write.mode("overwrite").saveAsTable("workspace.focus_you.document_chunks")
```

**SQL-onlyで書きたい場合**（Databricks Runtime 15.3+）:

```sql
-- Spark Python UDFを使わず、ai_query をSQLだけで呼ぶ
CREATE OR REPLACE TABLE workspace.focus_you.document_chunks AS
SELECT
  concat(file_path, '-', pos)                                       AS chunk_id,
  file_path,
  doc_type,
  chunk_text,
  ai_query('databricks-gte-large-en', chunk_text)                   AS chunk_vector,
  current_timestamp()                                               AS created_at
FROM (
  SELECT
    file_path, doc_type,
    posexplode(split(content, '\\n\\n')) AS (pos, chunk_text)
  FROM workspace.focus_you.parsed_documents
)
WHERE length(chunk_text) > 20;
```

### ステップU4: SEARCH — Mosaic AI Vector Search（30分）

Mosaic AI Vector Search は **Delta Sync Index**（Delta の変更を自動反映）と **Direct Access Index**（API push）の2方式。介護ドキュメントは前者が運用が楽。

```sql
-- エンドポイント作成（一度だけ）
-- Vector Search UI: Compute → Vector Search → Create endpoint
-- ここでは SQL から叩けないので UI か REST API で。

-- Delta Sync Index を作る（UI: Catalog → document_chunks → Create → Vector search index）
-- 設定:
--   Endpoint: shared-vs-endpoint
--   Source column: chunk_text
--   Embedding: databricks-gte-large-en (Managed embeddings = 自動計算)
--   Primary key: chunk_id
```

Index ができたら、SQL関数 `vector_search` で検索できる（**Public Preview**）。

```sql
-- 質問に近いチャンクをトップ3取得（ANN）
SELECT
  chunk_id, file_path, doc_type, chunk_text,
  search_score
FROM vector_search(
  index => 'workspace.focus_you.document_chunks_idx',
  query_text => '家族から苦情が入った事案と、その際の対応方針',
  num_results => 3
);

-- ハイブリッド検索（キーワード+ベクトル）
SELECT *
FROM vector_search(
  index => 'workspace.focus_you.document_chunks_idx',
  query_text => '家族からの苦情',
  query_type => 'HYBRID',
  num_results => 5
);
```

### ステップU5: INFER — ai_query で抽出・要約（15分）

#### 5a. 構造化抽出（AI Functions）

Databricks には `ai_extract` 関数がある（2025 Preview→GA移行中）。契約書から項目を取り出す:

```sql
SELECT
  file_path,
  ai_extract(
    content,
    array('customer_name', 'contract_date', 'monthly_fee_jpy')
  ) AS extracted
FROM workspace.focus_you.parsed_documents
WHERE doc_type = 'contract';
```

※`ai_extract` は **汎用テキスト抽出関数**。PDF/画像を直接渡したい場合は先に `ai_parse_document` でテキスト化しておく。

#### 5b. RAG応答（検索結果をプロンプトに注入）

```sql
WITH retrieved AS (
  SELECT chunk_text, search_score
  FROM vector_search(
    index => 'workspace.focus_you.document_chunks_idx',
    query_text => '家族からの苦情と対応方針',
    num_results => 3
  )
),
context AS (
  SELECT array_join(collect_list(chunk_text), '\n---\n') AS ctx
  FROM retrieved
)
SELECT
  ai_query(
    'databricks-meta-llama-3-3-70b-instruct',
    concat(
      '以下の社内文書抜粋を根拠として、家族からの苦情と対応方針を日本語で300字以内で要約してください。',
      '根拠に書かれていない情報は「資料外」と明記してください。\n\n',
      '--- 抜粋 ---\n', ctx
    ),
    modelParameters => named_struct('max_tokens', 500, 'temperature', 0.3)
  ) AS rag_answer
FROM context;
```

#### 5c. 感情分析 + カテゴリ分類（タスク別関数）

```sql
SELECT
  file_path,
  ai_analyze_sentiment(content)                                        AS sentiment,
  ai_classify(content, array('苦情', '問い合わせ', '感謝', '中立'))     AS email_category,
  ai_summarize(content, 50)                                            AS short_summary
FROM workspace.focus_you.parsed_documents
WHERE doc_type = 'email';
```

### 運用上の注意（介護・医療特有のリスク）

**Snowflake編と同じ5観点+3大リスク**に加え、Databricks 特有の考慮点を挙げる。

| 観点 | Databricks での対策 |
|------|-------------------|
| **コスト** | `ai_parse_document` は Token/Page 課金。**Batch Inference** ジョブ化して夜間バッチに回すのが定石。Vector Search endpoint は稼働時間課金（shared endpoint で抑える） |
| **レイテンシ** | PySpark + Notebook のバッチなら30分PDF1000件も回せる。同期レイテンシは Model Serving の provisioned throughput で改善 |
| **権限** | Unity Catalog の **ABAC**（属性ベース）が2025 GA。`file_path`や `doc_type` 属性を使って行・列マスキング可能。Volume のパスごとに権限を切れる |
| **PIIマスキング** | Lakebridge / **Unity Catalog Tag + Mask function** で自動マスキング。`parsed_documents` のチャンクテーブルには **PII タグ**を付与し、分析クエリから自動除外 |
| **監査ログ** | Unity Catalog の **Audit Logs** と **System Tables**（`system.access.audit`）でAI関数呼び出しも可視化できる |

**介護・医療の非構造化データ固有の3大リスク**（Databricks文脈）:
1. **PIIが Volume にそのまま残る** — ステージと違い Volume は「ファイルのまま保持」するため、原本を後から検索されるリスクが残る。**処理後は原本を別バケットにアーカイブして Volume から消す**運用を設計
2. **Vector Search Index がバックアップされない** — インデックス自体は再構築可能だが、元の Delta テーブルを削除したら復元困難。**Delta のタイムトラベル（最短7日）** を意識
3. **Cross-workspace access** — エンタープライズでは複数workspaceがあり、Delta Sharing や Unity Catalog federation で非構造化データが意図せぬ場所で参照されるリスク。**external location の権限を固め**、Delta Sharing 対象から `care_docs` Volume を明示的に除外

### 気づきメモ用

- `ai_parse_document` の Snowflake 版 `AI_PARSE_DOCUMENT` との **コード量・書きやすさの違い**は？
- Vector Search は `CREATE CORTEX SEARCH SERVICE` の**宣言的1文**と比べて、**UI + Endpoint + Index** の3段構えをどう感じた？
- Whisper を自分で Model Serving にデプロイする手間は、Snowflake の `AI_TRANSCRIBE` 1行と比べて?
- `ai_query` の **引数にstructを渡す**パターン（Vision/Audio）は、SQL に馴染むか・違和感か？

### 公知情報の限界

- **ai_parse_document は Public Preview**（2025-11 投入、GA は 2026-05予定）。本稿執筆時点（2026-04）では Preview のため、**本番採用前にSLA・サポート状況を確認**
- **vector_search 関数も Public Preview**。SQL連携は新しく、挙動の細部は変動中
- **Whisper の正式な「SQL関数」は存在しない**（2026-04時点）。`ai_query` + Model Serving 経由。Snowflake の `AI_TRANSCRIBE` のような1行関数と比べて**やや手数が多い**
- **日本語埋め込み品質** は `databricks-gte-large-en` でも許容範囲だが、**GPT/Voyage系**の方が自然な順位付けになる体感報告あり
- Free Edition では **一部のFoundation Modelエンドポイント（Claude等）** が使えない可能性。`system.ai.foundation_models` で確認

### 壁打ちモードへの導線

- 「**Snowflake の SQL一本完結** と **Databricks の Notebook + SQL混在**、**介護現場のIT担当者**にはどちらを勧める？その理由は？」
- 「Mosaic AI の `vector_search` がPreviewである事実を**クライアントにどう説明**するか？本番採用の判断基準は？」
- 「**Whisper を自前デプロイ**する自由度と、**Snowflake AI_TRANSCRIBE 1行**の手軽さ、**SOMPOケア規模**の案件ならどちらが適切か？」
- 「**Delta Lake のタイムトラベル** は PII 削除要件（例: GDPR 右忘却）とどう整合させる？」

### 結論（非構造化データブロック）

- Databricks は **非構造化データの「自由度」で勝つ**。`ai_parse_document` / `ai_query` は万能だが、**組み合わせて使う前提**でSnowflakeのような「1関数で全部」の体験にはならない
- **Foundation Model の選択肢が最も広い**。Whisper・Claude・Llama・独自モデル全てに `ai_query` でアクセスできる。Mosaic AI Gateway で統制も取れる
- **Vector Search が GA**（Index自体）なのは強いが、SQL関数 `vector_search` は Preview。本番採用は段階的に
- 介護・医療領域では、**Unity Catalog の ABAC + System Audit Tables** が差別化要素。Snowflake の Horizon Catalog / Fabric の Purview統合と並ぶ、**企業ガバナンスの要**

### 主要ソース（非構造化データブロック、全て 2026-04-19 アクセス）

- [ai_parse_document function | Databricks on AWS](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document)
- [Databricks fires back at Snowflake with SQL-based AI document parsing | InfoWorld](https://www.infoworld.com/article/4089186/databricks-fires-back-at-snowflake-with-sql-based-ai-document-parsing.html)
- [AI Parse Document pricing | Databricks](https://www.databricks.com/product/pricing/ai-parse)
- [ai_query function | Databricks on AWS](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query)
- [ai_extract function | Databricks on AWS](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_extract)
- [vector_search function | Databricks on AWS](https://docs.databricks.com/aws/en/sql/language-manual/functions/vector_search)
- [Mosaic AI Vector Search | Databricks on AWS](https://docs.databricks.com/aws/en/vector-search/vector-search)
- [Create vector search endpoints and indexes](https://docs.databricks.com/aws/en/vector-search/create-vector-search)
- [Query a vector search index](https://docs.databricks.com/aws/en/vector-search/query-vector-search)
- [Whisper V3 Model (Databricks Marketplace)](https://marketplace.databricks.com/details/1eceaa77-6b60-42f0-9809-ceccf1b237f5/Databricks_Whisper-V3-Model)
- [Streamline Customer Call Center Transcripts Analytics with Mosaic AI Batch Inference](https://community.databricks.com/t5/technical-blog/streamline-customer-call-center-transcripts-analytics-with/ba-p/101689)
- [Document Intelligence on Databricks (2025-2026)](https://www.latentview.com/blog/document-intelligence-on-databricks-2025-2026-what-to-use-when-and-why/)

```yaml
# handoff
handoff:
  - to: 社長レビュー
    context: "非構造化データハンズオン（Databricks編）を既存ハンズオンに追記。Snowflake編と同じ題材（介護・医療5種）で比較可能"
    tasks:
      - "Databricks Free Edition で ステップU0→U5 を試す（2時間）"
      - "ai_parse_document / vector_search の GA 状況を Release Notes で確認"
      - "Whisper V3 Model が Free Edition で Serving endpoint デプロイ可能か検証"
```
