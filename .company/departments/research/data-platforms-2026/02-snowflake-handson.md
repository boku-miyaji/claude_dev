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

---

## 非構造化データハンズオン

> 所要時間: 約2時間（別ブロックとして独立して進めてもOK）/ focus-you とは別コンテキストで、**介護・医療現場の非構造化データ**を題材に同じ基盤を触る。
> **目的**: 「構造化データのDWH」の Snowflake が **PDF / 画像 / 音声** にどこまで踏み込めるようになったかを身体で確かめる。2024〜2026 で最も変わった領域。

### 題材の設定（3基盤共通）

介護・医療現場を想定した5種のサンプルを扱う。3つのハンズオン（Snowflake / Databricks / Fabric）で **同じファイル・同じ質問**を使い比較する。

| # | 種類 | サンプルファイル名 | 想定中身 |
|---|------|------------------|---------|
| ① | 契約書PDF | `contract-care-2026.pdf` | 利用者との介護サービス契約書（5ページ、表含む） |
| ② | 利用者の写真/画像 | `user-profile-001.jpg` | 顔写真 + IDカード風の書式（手書き署名あり） |
| ③ | カンファレンス音声 | `conference-2026-04-10.mp3` | ケアプラン会議の録音（30分、3名発話） |
| ④ | 手書きメモ画像 | `handwritten-memo-0412.png` | スタッフが書いた申し送りメモ（日本語混在） |
| ⑤ | 問い合わせメール長文 | `inquiry-email-0415.txt` | 家族からの苦情を含む長文（2500字）|

**注意**: 実データはPIIを含むため、ハンズオンでは **合成データ or 完全匿名化済みサンプル** を使う。サンプル生成スクリプトは `sample-data/synthetic-care-docs/` に配置予定（未作成なら、自前でダミーPDF・画像・録音を用意する）。

### ステップU0: 非構造化スキーマとステージを作る（5分）

既存の FOCUS_YOU データベースとは分離して運用する。本番でも **非構造化データは独立スキーマ+ステージ**にするのが定石（PII漏洩の影響範囲を限定）。

```sql
USE DATABASE FOCUS_YOU;
CREATE SCHEMA IF NOT EXISTS UNSTRUCTURED;
USE SCHEMA UNSTRUCTURED;

-- 内部ステージ（URL directory + server-side暗号化）
CREATE OR REPLACE STAGE docs_stage
  DIRECTORY = (ENABLE = TRUE)
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');

-- 解析結果を格納するテーブル
CREATE OR REPLACE TABLE parsed_documents (
  file_path      STRING,
  doc_type       STRING,           -- 'contract' | 'photo' | 'audio' | 'handwritten' | 'email'
  content        STRING,           -- マークダウンまたはプレーンテキスト
  metadata       VARIANT,          -- ページ数・表・画像など構造情報
  parsed_at      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE document_chunks (
  chunk_id       STRING,
  file_path      STRING,
  doc_type       STRING,
  chunk_text     STRING,
  chunk_vector   VECTOR(FLOAT, 1024),  -- Cortex EMBED_TEXT_1024 出力と合わせる
  created_at     TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
```

### ステップU1: INGEST — ステージへアップロード（10分）

#### UIで（推奨: 概念が見える）

1. Snowsight 左メニュー **Data → Databases → FOCUS_YOU → UNSTRUCTURED → Stages → DOCS_STAGE**
2. 右上「**+ Files**」ボタンでローカルから5ファイル全部を選択
3. アップ完了後、**Directory table** の更新:

```sql
ALTER STAGE docs_stage REFRESH;
SELECT RELATIVE_PATH, SIZE, LAST_MODIFIED FROM DIRECTORY(@docs_stage);
```

#### SnowSQL（CLI派）

```bash
PUT file:///path/to/contract-care-2026.pdf @docs_stage AUTO_COMPRESS=FALSE;
PUT file:///path/to/user-profile-001.jpg @docs_stage AUTO_COMPRESS=FALSE;
PUT file:///path/to/conference-2026-04-10.mp3 @docs_stage AUTO_COMPRESS=FALSE;
PUT file:///path/to/handwritten-memo-0412.png @docs_stage AUTO_COMPRESS=FALSE;
PUT file:///path/to/inquiry-email-0415.txt @docs_stage AUTO_COMPRESS=FALSE;

-- Directory table を更新
ALTER STAGE docs_stage REFRESH;
```

**検証**:

```sql
SELECT COUNT(*) FROM DIRECTORY(@docs_stage);   -- 5
```

### ステップU2: PARSE — Cortex AI Functionsで解析（30分）

Snowflake は 2025年に **AI_PARSE_DOCUMENT**（ドキュメント解析）、**AI_EXTRACT**（構造化抽出）、**AI_TRANSCRIBE**（音声→テキスト、2025-08 Preview）を出した。全てSQL関数として呼べる。

#### 2a. 契約書PDF → AI_PARSE_DOCUMENT（LAYOUTモード、GA）

```sql
-- LAYOUT モード: 表・見出し構造を保持してMarkdown出力
INSERT INTO parsed_documents(file_path, doc_type, content, metadata)
SELECT
  'contract-care-2026.pdf'                               AS file_path,
  'contract'                                             AS doc_type,
  result:content::STRING                                 AS content,
  OBJECT_CONSTRUCT('pages', result:metadata:pages)       AS metadata
FROM (
  SELECT AI_PARSE_DOCUMENT(
    TO_FILE('@docs_stage', 'contract-care-2026.pdf'),
    {'mode': 'LAYOUT', 'page_split': TRUE}
  ) AS result
);

-- 一括処理パターン（ステージ内の全PDFを処理）
SELECT
  RELATIVE_PATH,
  AI_PARSE_DOCUMENT(
    TO_FILE('@docs_stage', RELATIVE_PATH),
    {'mode': 'LAYOUT'}
  ) AS parsed
FROM DIRECTORY(@docs_stage)
WHERE RELATIVE_PATH ILIKE '%.pdf';
```

**モード比較**:
- `OCR`: テキストのみ抽出（高速・安価）
- `LAYOUT`: 表・見出し・読み順を保持（Markdown出力、RAG向き）

#### 2b. 手書きメモ画像 → AI_PARSE_DOCUMENT（画像対応、GA）

AI_PARSE_DOCUMENT は画像ファイル（PNG/JPEG）もOCR対象として受け付ける。

```sql
INSERT INTO parsed_documents(file_path, doc_type, content, metadata)
SELECT
  'handwritten-memo-0412.png',
  'handwritten',
  AI_PARSE_DOCUMENT(
    TO_FILE('@docs_stage', 'handwritten-memo-0412.png'),
    {'mode': 'LAYOUT'}
  ):content::STRING,
  OBJECT_CONSTRUCT('source', 'image-ocr');
```

#### 2c. 利用者写真・IDカード → AI_COMPLETE で Vision（GA）

顔写真のような「文書ではないが構造化したい」画像は **AI_COMPLETE にイメージを渡す**パターンが使える（2025 GA）。

```sql
-- Vision対応モデル（claude-4-5-sonnet 等）に画像とプロンプトを渡す
INSERT INTO parsed_documents(file_path, doc_type, content, metadata)
SELECT
  'user-profile-001.jpg',
  'photo',
  AI_COMPLETE(
    'claude-4-5-sonnet',
    PROMPT(
      '以下のIDカード画像から、氏名・生年月日・ID番号をJSON形式で抽出してください。判読不可能な項目は null としてください。: {0}',
      TO_FILE('@docs_stage', 'user-profile-001.jpg')
    )
  ),
  OBJECT_CONSTRUCT('source', 'vision-llm');
```

※`AI_COMPLETE` は旧 `SNOWFLAKE.CORTEX.COMPLETE` のGA版。画像入力は 2025 に正式サポート。

#### 2d. カンファレンス音声 → AI_TRANSCRIBE（Preview）

**注意: AI_TRANSCRIBE は 2025-08 時点で Preview**。GA 昇格前の可能性があるため本番採用は要確認。

```sql
-- 音声→テキスト（speakerDiarization オプションで話者識別も）
INSERT INTO parsed_documents(file_path, doc_type, content, metadata)
SELECT
  'conference-2026-04-10.mp3',
  'audio',
  result:text::STRING,
  OBJECT_CONSTRUCT('language', result:language, 'duration_sec', result:duration)
FROM (
  SELECT AI_TRANSCRIBE(
    TO_FILE('@docs_stage', 'conference-2026-04-10.mp3'),
    {'speakerDiarization': TRUE, 'language': 'ja'}
  ) AS result
);

-- 話者別チャンクで見たい場合
SELECT
  f.value:speaker::STRING  AS speaker,
  f.value:start_sec::FLOAT AS start_sec,
  f.value:end_sec::FLOAT   AS end_sec,
  f.value:text::STRING     AS utterance
FROM (
  SELECT AI_TRANSCRIBE(
    TO_FILE('@docs_stage', 'conference-2026-04-10.mp3'),
    {'speakerDiarization': TRUE, 'timestampGranularity': 'segment'}
  ) AS r
),
LATERAL FLATTEN(input => r:segments) f;
```

#### 2e. 問い合わせメール → そのままテキスト格納

メールは既にプレーンテキストなので、`GET` で中身を読んでINSERTするだけ。

```sql
-- ステージのテキストファイルを直接読む（CSVではないので RAW）
CREATE OR REPLACE FILE FORMAT txt_fmt TYPE=CSV FIELD_DELIMITER=NONE RECORD_DELIMITER=NONE;

INSERT INTO parsed_documents(file_path, doc_type, content, metadata)
SELECT
  'inquiry-email-0415.txt',
  'email',
  $1,
  OBJECT_CONSTRUCT('source', 'plain-text')
FROM @docs_stage/inquiry-email-0415.txt (FILE_FORMAT => 'txt_fmt');
```

**検証**:

```sql
SELECT doc_type, LENGTH(content) AS chars, parsed_at
FROM parsed_documents
ORDER BY doc_type;
-- 5種類全てが登録されていることを確認
```

### ステップU3: EMBED — ベクトル化（20分）

RAG のために、解析済みテキストを **1024次元ベクトル**に変換して保存する。長文はチャンク化する。

```sql
-- チャンク化（Snowflake 2025 GA: SPLIT_TEXT_RECURSIVE_CHARACTER）
INSERT INTO document_chunks(chunk_id, file_path, doc_type, chunk_text, chunk_vector)
SELECT
  CONCAT(file_path, '-chunk-', SEQ4())                       AS chunk_id,
  file_path,
  doc_type,
  chunk.value::STRING                                        AS chunk_text,
  SNOWFLAKE.CORTEX.EMBED_TEXT_1024(
    'snowflake-arctic-embed-l-v2.0',
    chunk.value::STRING
  )                                                          AS chunk_vector
FROM parsed_documents,
LATERAL FLATTEN(
  input => SNOWFLAKE.CORTEX.SPLIT_TEXT_RECURSIVE_CHARACTER(
    content, 'markdown', 800, 100  -- chunk_size=800, overlap=100
  )
) chunk;

-- 確認
SELECT doc_type, COUNT(*) AS chunk_count FROM document_chunks GROUP BY 1;
```

**モデル選定のコツ**:
- `snowflake-arctic-embed-l-v2.0` = Snowflake純正、多言語対応、1024次元
- `multilingual-e5-large` = 日本語含む多言語で実績
- `voyage-multilingual-2` = 業界評価高、ただしクレジット消費が大きめ

### ステップU4: SEARCH — RAGで問い合わせ（20分）

ベクトル類似度を使って「家族からの苦情に関連する過去文書」を取り出す。

```sql
-- 質問をベクトル化→コサイン類似度でトップ3を取得
WITH q AS (
  SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_1024(
    'snowflake-arctic-embed-l-v2.0',
    '家族から苦情が入った事案と、その際の対応方針を教えて'
  ) AS qvec
)
SELECT
  c.file_path,
  c.doc_type,
  c.chunk_text,
  VECTOR_COSINE_SIMILARITY(c.chunk_vector, q.qvec) AS similarity
FROM document_chunks c, q
ORDER BY similarity DESC
LIMIT 3;
```

#### Cortex Search Service（運用向け、GA）

毎クエリでベクトル計算するのは学習用にはよいが、本番では **Cortex Search Service** が推奨。増分インデックス・ハイブリッド検索（BM25+ベクトル）が自動管理される。

```sql
-- Search Service を作成（コストはサービス稼働時間で課金）
CREATE OR REPLACE CORTEX SEARCH SERVICE care_docs_search
  ON chunk_text
  ATTRIBUTES file_path, doc_type
  WAREHOUSE = COMPUTE_WH
  TARGET_LAG = '1 hour'
  EMBEDDING_MODEL = 'snowflake-arctic-embed-l-v2.0'
AS (
  SELECT chunk_id, file_path, doc_type, chunk_text
  FROM document_chunks
);

-- 検索（PythonやREST APIからも呼べるが、SQLからも可能）
SELECT PARSE_JSON(
  SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
    'care_docs_search',
    '{"query": "家族からの苦情と対応方針", "columns": ["file_path", "chunk_text"], "limit": 3}'
  )
):results;
```

### ステップU5: INFER — 解析済みテキストにLLMで抽出・要約（15分）

#### 5a. AI_EXTRACT で構造化抽出（2025-10 GA）

契約書から「利用者名・契約日・月額料金」を構造化データとして取り出す。

```sql
SELECT
  file_path,
  AI_EXTRACT(
    file => TO_FILE('@docs_stage', 'contract-care-2026.pdf'),
    responseFormat => [
      ['customer_name', '契約者（利用者本人）の氏名'],
      ['contract_date', '契約締結日 YYYY-MM-DD'],
      ['monthly_fee_jpy', '月額料金（円、整数）']
    ]
  ) AS extracted
FROM parsed_documents
WHERE doc_type = 'contract';
```

#### 5b. AI_COMPLETE でサマリ（RAG応答）

ステップU4の検索結果をプロンプトに埋め込む典型的なRAGパターン。

```sql
WITH retrieved AS (
  SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_1024(
    'snowflake-arctic-embed-l-v2.0',
    '家族から苦情が入った事案と、その際の対応方針を教えて'
  ) AS qvec
),
top3 AS (
  SELECT c.chunk_text
  FROM document_chunks c, retrieved
  ORDER BY VECTOR_COSINE_SIMILARITY(c.chunk_vector, retrieved.qvec) DESC
  LIMIT 3
),
context AS (
  SELECT LISTAGG(chunk_text, '\n---\n') WITHIN GROUP (ORDER BY chunk_text) AS ctx
  FROM top3
)
SELECT AI_COMPLETE(
  'claude-haiku-4-5',
  CONCAT(
    '以下の社内文書の抜粋を根拠として、家族からの苦情と対応方針を日本語で300字以内で要約してください。',
    '根拠に書かれていない情報は「資料外」と明記してください。\n\n',
    '--- 抜粋 ---\n', ctx
  )
) AS rag_answer
FROM context;
```

#### 5c. 感情分析（メール単位、タスク別関数）

```sql
SELECT
  file_path,
  AI_CLASSIFY(
    content,
    ['苦情', '問い合わせ', '感謝', '中立']
  ) AS email_category,
  SNOWFLAKE.CORTEX.SENTIMENT(content) AS sentiment_score
FROM parsed_documents
WHERE doc_type = 'email';
```

### 運用上の注意（介護・医療特有のリスク）

**非構造化データは構造化データの10倍リスクが高い。** 以下は必ず検討する。

| 観点 | 注意点 | Snowflake での対策 |
|------|--------|-------------------|
| **コスト** | AI_PARSE_DOCUMENT / AI_TRANSCRIBE はページ数・秒数課金。一括処理は意図せぬクレジット爆発の温床 | `CORTEX_AI_FUNCTIONS_USAGE_HISTORY` view で日次監視、`RESOURCE_MONITOR` で上限を設定 |
| **レイテンシ** | 音声30分で数十秒、大量PDFで分単位。同期クエリに組み込むとタイムアウト | 非同期ジョブ（Streams + Tasks）でバッチ化 |
| **権限** | ステージ・テーブルのRLSを忘れがち。解析結果テーブルに契約者名がそのまま入る | `CREATE ROW ACCESS POLICY` でスタッフロールに応じた行制限。stageは `DIRECTORY` 権限を分離 |
| **PIIマスキング** | OCR結果に個人名・保険番号がそのまま入る。それに気付かず BI に流すと漏洩 | `MASKING POLICY` + `AI_CLASSIFY` で「PII含有チャンク」にフラグを立て、マスクしてから表示 |
| **監査ログ** | 誰が AI_COMPLETE に何を渡したかを追えないと、事故後の検証ができない | `ACCESS_HISTORY` / `QUERY_HISTORY` を有効化。Cortex関数呼び出しは `CORTEX_AI_FUNCTIONS_USAGE_HISTORY` に記録される |

**介護・医療の非構造化データ固有の3大リスク**:
1. **PIIが意図せず解析結果に混入する** — 契約書から抽出した「customer_name」は本人特定情報。最初から別テーブルで暗号化保管し、ダッシュボード側ではIDのみ渡す設計にする
2. **ベクトル埋め込みが機密漏洩の新しい経路になる** — 同じ人物の複数文書から埋め込まれたベクトルは、原文を再現する攻撃手法（embedding inversion）の対象になる。ベクトルテーブルも `ROW ACCESS POLICY` 必須
3. **法定保管要件と基盤の物理配置** — 介護記録は「国内保管」を契約で要求される場合がある。Snowflake AWS リージョン選定（`ap-northeast-1` 東京）+ **Tri-Secret Secure** 対応の Business Critical 以上エディションを検討

### 気づきメモ用

- `AI_PARSE_DOCUMENT` のLAYOUTモードで **表** がどれくらい正確にMarkdown化されたか？
- `AI_TRANSCRIBE` の日本語品質は？話者識別はどれくらい信頼できるか？
- ベクトル検索と通常のSQL LIKE検索で、「苦情っぽい文書」のヒット率はどう違ったか？
- クレジット消費が一番多かった操作はどれ？次にやるなら何を削る？

### 公知情報の限界

- **AI_TRANSCRIBE は2025-08 Preview**。本稿執筆時点（2026-04）でGA昇格済みか要確認。関数シグネチャ・課金単位も変わる可能性あり
- **Cortex Search の課金モデル** は「sized warehouse」+「embedding cost」の2層。実コストは使用量で大きく変動
- **画像入力モデル一覧** はモデル側の対応に依存。`claude-4-5-sonnet`, `llama-3.2-vision-11b` 等は Vision対応だが、モデル可用性はアカウント設定に依存
- 日本語OCR精度の**公式ベンチはSnowflake側から未公開**。手書き日本語は Azure Document Intelligence や GCP Document AI と比較検証する価値がある

### 壁打ちモードへの導線

- 「**AI_PARSE_DOCUMENT → EMBED_TEXT → SEARCH → AI_COMPLETE** の4段は、**一つのSQLファイル**で読み通せた。これを Databricks / Fabric で再現した時、**どこが冗長**と感じそうか？」
- 「**音声→テキスト→要約**の一気通貫が SQLだけで書けることは、介護現場のどのユースケースに一番効くか？（例: カンファ議事録の自動化、苦情対応記録）」
- 「**Cortex Search Service** の `TARGET_LAG='1 hour'` という宣言的な鮮度指定は、**クライアントにどう説明すれば腹落ちする**か？」
- 「**PII混入チェック**を AI_CLASSIFY で自動化する場合、**false negative（見落とし）** のリスクを許容できるか？それとも決定的ルール（正規表現）併用が必要か？」

### 結論（非構造化データブロック）

- Snowflake は 2024 までは「構造化データのDWH」だったが、**2025で非構造化データ処理関数が全てSQL関数としてGA** になった。`AI_PARSE_DOCUMENT` / `AI_EXTRACT` / `EMBED_TEXT_1024` / `Cortex Search` / `AI_COMPLETE` が揃い、**一つのワークシートで完結する**
- 強みは **運用の簡潔さ**。ステージに置いて SQL 1本で解析・ベクトル化できる。PythonやSparkを書かなくてよい
- 弱みは **柔軟性とモデル多様性**。OSSモデルを自前ホストしたい / 特殊なOCRパイプラインを組みたい場合は Databricks の方が自由度が高い
- **介護・医療領域では「PIIマスキングと監査ログ」を最初から設計する**。関数が便利だからといって rawに流すと事故る

### 主要ソース（非構造化データブロック、全て 2026-04-19 アクセス）

- [AI_PARSE_DOCUMENT | Snowflake Documentation](https://docs.snowflake.com/en/sql-reference/functions/ai_parse_document)
- [Parsing documents with AI_PARSE_DOCUMENT | Snowflake Documentation](https://docs.snowflake.com/en/user-guide/snowflake-cortex/parse-document)
- [Aug 21, 2025: AI Parse Document layout mode (GA)](https://docs.snowflake.com/en/release-notes/2025/other/2025-08-21-aisql-ai-parse-document-layout-ga)
- [AI_EXTRACT | Snowflake Documentation](https://docs.snowflake.com/en/sql-reference/functions/ai_extract)
- [AI_TRANSCRIBE | Snowflake Documentation](https://docs.snowflake.com/en/sql-reference/functions/ai_transcribe)
- [Cortex AI Functions: Audio](https://docs.snowflake.com/en/user-guide/snowflake-cortex/ai-audio)
- [EMBED_TEXT_1024 (SNOWFLAKE.CORTEX) | Snowflake Documentation](https://docs.snowflake.com/en/sql-reference/functions/embed_text_1024-snowflake-cortex)
- [Vector Embeddings | Snowflake Documentation](https://docs.snowflake.com/en/user-guide/snowflake-cortex/vector-embeddings)
- [Cortex Search | Snowflake Documentation](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-overview)
- [Call Center Analytics with AI_TRANSCRIBE and Cortex Agents (Quickstart)](https://quickstarts.snowflake.com/guide/call_center_analytics_with_ai_transcribe_and_cortex_agents/index.html)
- [Getting Started with Multimodal Analysis on Snowflake Cortex AI](https://www.snowflake.com/en/developers/guides/getting-started-with-multimodal-analysis-on-snowflake-cortex/)

```yaml
# handoff
handoff:
  - to: 社長レビュー
    context: "非構造化データハンズオン（Snowflake編）を既存ハンズオンに追記。同じ題材（介護・医療5種）で Databricks / Fabric と比較可能"
    tasks:
      - "実際に Snowflake Trial アカウントで ステップU1→U5 を試す（2時間）"
      - "AI_TRANSCRIBE が GA 昇格しているか Snowsight のFeature Releases で確認"
      - "05-comparison-reflection.md に『非構造化データ』セクションを追加することを検討"
```
