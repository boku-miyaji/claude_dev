# 04 Microsoft Fabric ハンズオン

> 所要時間: 約3時間（Fabric はUIが広いので前2つより長め）/ 前提: `00-trial-and-pricing.md` でF2 Capacity or 試用が確保できている状態

## このハンズオンのゴール

SnowflakeとDatabricksで作ったものと **同じユースケース** を Fabric の **Lakehouse + Notebook + Direct Lake Semantic Model + Power BI Report + AI Functions** で実装する。Fabric最大の売りである「OneLake に全ワークロードが集まる」体験を身体に通す。

## 前提の確認

- <https://app.fabric.microsoft.com/> にログイン済み
- 左下の **Workspace selector** で新規 Workspace `focus-you-learn` を作成（Capacity は F2 or Trial を割当）
- 上部エクスペリエンス切替: **Data Engineering / Data Science / Data Warehouse / Power BI / Real-Time Intelligence** 等 → 今回は Data Engineering から始める

---

## ステップ0: Lakehouse を作る（10分）

1. 右上 **+ New → Lakehouse**
2. 名前: `focus_you_lh`
3. 作成すると **Lakehouse explorer** が開く。左に `Tables / Files` の2フォルダ構造

> OneLake のすべては裏側で **Delta Lake** に統一されている。Tables に置けば自動でDeltaテーブルとして認識される。

## ステップ1: INGEST — CSVをアップロード（20分）

### UIでアップロード

1. Lakehouse explorer 左サイドバーの **Files** を右クリック → **Upload → Upload files**
2. `diary_entries.csv`, `emotion_analysis.csv`, `calendar_events.csv` を全部選択してアップ
3. アップ完了後、各 CSVファイルを右クリック → **Load to Tables → New table**
4. テーブル名をそれぞれ `diary_entries`, `emotion_analysis`, `calendar_events`
5. Load 実行 → Tables フォルダ配下に **Delta テーブル** として現れる

**検証（エクスペリエンスを SQL analytics endpoint に切り替え）**:

Lakehouse explorer の右上ドロップダウンで **SQL analytics endpoint** に切替、SQL Editor で:

```sql
SELECT COUNT(*) FROM diary_entries;     -- 30
SELECT COUNT(*) FROM emotion_analysis;  -- 30
SELECT COUNT(*) FROM calendar_events;   -- 34
```

## ステップ2: TRANSFORM — Notebook + PySpark（25分）

1. Workspace 画面上部から **+ New → Notebook**
2. 名前: `focus_you_transform`
3. 右サイドパネルの **Lakehouse** に `focus_you_lh` をマウント（**重要**: これを忘れると spark.table が失敗する）
4. 以下を貼って実行:

```python
from pyspark.sql.functions import col, date_trunc, avg, sum as spark_sum, when, coalesce, lit, round as spark_round

# テーブル読み込み（マウント済みLakehouseなら短縮名で可）
diary   = spark.table("diary_entries")
emotion = spark.table("emotion_analysis")
cal     = spark.table("calendar_events")

# カレンダーをカテゴリ別にpivot
cal_agg = cal.groupBy("event_date").pivot("category").count().fillna(0)
cal_agg = cal_agg.withColumnRenamed("event_date", "cal_date")

# 日次に結合
daily = (diary
    .join(emotion, "entry_date", "left")
    .join(cal_agg, diary.entry_date == cal_agg.cal_date, "left")
    .drop("cal_date")
)

# Delta テーブルに書き出し
daily.write.mode("overwrite").option("mergeSchema", "true").saveAsTable("daily_mood")

display(daily.limit(5))
```

SQL でも書ける（同じ結果を `daily_mood_sql` に保存）:

```python
spark.sql("""
  CREATE OR REPLACE TABLE daily_mood_sql AS
  SELECT d.*, e.joy, e.sadness, e.anger, e.fear, e.surprise, e.disgust,
         c.work, c.health, c.social, c.family, c.personal
  FROM diary_entries d
  LEFT JOIN emotion_analysis e USING (entry_date)
  LEFT JOIN (
    SELECT event_date,
      SUM(CASE WHEN category='work' THEN 1 ELSE 0 END) AS work,
      SUM(CASE WHEN category='health' THEN 1 ELSE 0 END) AS health,
      SUM(CASE WHEN category='social' THEN 1 ELSE 0 END) AS social,
      SUM(CASE WHEN category='family' THEN 1 ELSE 0 END) AS family,
      SUM(CASE WHEN category='personal' THEN 1 ELSE 0 END) AS personal
    FROM calendar_events GROUP BY event_date
  ) c ON d.entry_date = c.event_date
""")
```

## ステップ3: AGGREGATE — 週次PERMA+V（10分）

同じNotebookで:

```python
spark.sql("""
  CREATE OR REPLACE TABLE weekly_perma AS
  SELECT
    date_trunc('week', entry_date) AS week_start,
    ROUND(AVG(joy), 3)             AS avg_joy,
    ROUND(AVG(mood_score), 2)      AS avg_mood,
    ROUND(AVG(joy)*AVG(mood_score), 3) AS perma_v_proxy,
    SUM(COALESCE(work, 0))         AS total_work,
    SUM(COALESCE(health, 0))       AS total_health,
    SUM(COALESCE(social, 0) + COALESCE(family, 0)) AS total_relationships
  FROM daily_mood
  GROUP BY 1
  ORDER BY 1
""").show()
```

## ステップ4: VISUALIZE — Direct Lake Semantic Model + Power BI（40分）

**Fabric の真骨頂**。OneLake の Delta を **コピー・スケジュール更新なしで** Power BI が直接クエリする仕組み。

1. Workspace に戻る
2. 上部 **+ New → Semantic model (Direct Lake)**
3. Lakehouse `focus_you_lh` を選択
4. テーブルを選ぶ: `daily_mood`, `weekly_perma`, `calendar_events`
5. **Create**
6. 作成された Semantic model を開き **+ New measure** で KPI を定義（任意）:

```dax
Avg PERMA+V = AVERAGE('weekly_perma'[perma_v_proxy])
Total Work Events = SUM('daily_mood'[work])
```

7. 右上 **Create report** → Power BI デザイナーが開く
8. ビジュアルを組む:
   - Line chart: Axis = `week_start`, Values = `perma_v_proxy`
   - Line chart: Axis = `entry_date`, Values = `joy`, `sadness`, `mood_score`
   - Card: `Avg PERMA+V`
9. 保存 → Workspace に `focus_you_report` として現れる

> Direct Lake は **Import mode の速さ**と **DirectQuery の鮮度** の良いとこ取り、が売り文句。物理的には Delta を Power BI エンジンが直接メモリマップする。

## ステップ5: AI — AI Functions（20分）

Fabric の AI Functions は **タスク別関数** 主体。Notebookから（Data Science エクスペリエンス推奨）:

```python
# Python版 AI Functions（Fabric Notebook内蔵）
import pandas as pd

diary_pdf = spark.table("diary_entries").toPandas()

# 感情分析
diary_pdf["sentiment"] = diary_pdf["entry_text"].ai.analyze_sentiment()

# カテゴリ分類
diary_pdf["auto_category"] = diary_pdf["entry_text"].ai.classify(
    labels=["work", "social", "health", "family", "personal"]
)

# 要約
corpus = " / ".join(diary_pdf["entry_text"].tolist())
summary = pd.Series([corpus]).ai.generate_response(
    instructions="以下は1ヶ月分の日記です。気分の傾向、ストレス源、回復のパターンを日本語で300字以内で要約してください。"
)[0]
print(summary)

display(spark.createDataFrame(diary_pdf))
```

SQL版 AI Functions（Data Warehouse / SQL endpoint で）:

```sql
-- Fabric Data Warehouse の組み込みAI関数
SELECT
  entry_date,
  AI_GENERATE_TEXT(
    'この日記を20字以内で要約してください: ' + entry_text
  ) AS short_summary
FROM diary_entries;
```

※関数名は Fabric のリリースで変動。2026-04時点では `ai.generate_response`（Python側）、Warehouse側は組み込みAI関数群（Preview→GA移行中）。最新は公式ドキュメント参照。

## ステップ5.5: Copilot と Data Agent（オプション、20分）

1. Power BI Report を開いた状態で右上 **Copilot** アイコン
2. 「このレポートの気分傾向を要約して」「workが多い週の特徴を教えて」等を自然言語で質問
3. Workspace から **+ New → Data agent** で focus_you Lakehouse を対象にエージェント化し、Teams/Copilot Studio 経由で呼び出せるようにする（F2以上で可能）

## ステップ6: Real-Time Intelligence（スキップ推奨）

本ユースケースはバッチなので触らなくて良い。存在だけ認識: **Eventstream → Eventhouse (KQL) → Activator** のリアルタイム系列がFabricの別軸として存在する。

## 後片付け（最重要）

**F2 Capacity を使っている場合、必ず Pause する**:

1. Azure Portal → Fabric Capacity リソース
2. **Pause** をクリック
3. 次回使う時は **Resume**

pause 忘れが最大の事故源。リマインダー必須。

## 気づきメモ用

- Semantic Model → Report の流れは、Snowflake Chart / Databricks AI/BI と比べてどう？
- OneLake に全部集まる感覚は実感できた？
- Copilot の日本語品質は？
- AI Functions（タスク別）と ai_query（汎用）の **設計思想の違い** をどう感じた？

## 公知情報の限界

- Fabric AI Functions の **関数シグネチャは Preview→GA 移行中**。2026-04時点と3ヶ月後で変わる可能性がある
- **Direct Lake のパフォーマンス** は「Import並み」と公式は謳うが、実データ量と Capacity サイズによる。F2 で大規模データは無理
- **Real-Time Intelligence** と Synapse Real-Time Analytics の移行状況は途中段階。本番採用判断は要注意
- Fabric の**セキュリティモデル**（Purview統合、ワークスペース権限、RLS）はこのハンズオンでは触っていない。案件では必須の領域

## 壁打ちモードへの導線

- 「**OneLake に全部集まる** 体験は、理屈通りに便利だったか？ それとも **Lakehouse / Warehouse / KQL Database** の違いを意識せざるを得なかったか？」
- 「**Direct Lake Semantic Model → Power BI Report** の流れは、自分が普段使っている Supabase+React の **データ→UI** と比べて、認知負荷はどちらが高いか？」
- 「**Copilot** は社内非技術者に **刺さると思うか**？ どのレベルの質問までなら任せられそうか？」
- 「**MS365を全社展開している日本企業** にこの体験を見せたら、彼らは何に一番惹かれるか？（推測でも良い）」

## 結論

- Fabric は「**広くて迷いやすい**」が、**OneLake + Direct Lake + Power BI** の一直線ルートが最大の売り
- Snowflake・Databricksが『データ基盤』なのに対し、**Fabric は『分析スイート』**。守備範囲が広いぶん、どこから入るかで体験が変わる
- 個人学習の**難易度は3基盤中最高**（UIの広さ + 試用制限 + Capacity pause運用）。代わりに **Power BI 親和性**という他2社にない決定的強みがある

## ネクストアクション

- [ ] F2 Capacity が Pause されていることを Azure Portal で確認
- [ ] `05-comparison-reflection.md` の Fabric セクション＋3基盤比較セクションを埋める
- [ ] 全ハンズオン完了を秘書に報告して壁打ちセッションを設定

## 主要ソース（全て 2026-04-15 アクセス）

- [What is Microsoft Fabric - Microsoft Fabric | Microsoft Learn](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview)
- [Transform and Enrich Data with AI Functions](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/overview)
- [AI Functions (Preview) - Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-warehouse/ai-functions)
- [Fabric November 2025 Feature Summary](https://blog.fabric.microsoft.com/en-us/blog/fabric-november-2025-feature-summary)
- [Fabric January 2026 Feature Summary](https://blog.fabric.microsoft.com/en-us/blog/fabric-january-2026-feature-summary)
- [Overview of Copilot in Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/copilot-fabric-overview)
- [Fabric trial capacity](https://learn.microsoft.com/en-us/fabric/fundamentals/fabric-trial)
- [Understand Microsoft Fabric Licenses](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)

---

## 非構造化データハンズオン

> 所要時間: 約2.5時間（独立したブロック）/ Snowflake・Databricks編と**同じ5種の題材**を使って、**OneLake Files + AI Functions（マルチモーダル）+ Data Agent** で Fabric流の実装を体験する。
> **目的**: 「OneLakeに全部集めて、Fabric AI Functions とPower BIで一気通貫」という Fabric の世界観を、非構造化データで確かめる。Azure AI Foundry / Azure OpenAI との連携の面白さも触る。

### 題材の設定（3基盤共通）

介護・医療現場を想定した5種のサンプル。Snowflake・Databricks編と**完全に同じファイル**を使う。

| # | 種類 | サンプルファイル名 | 想定中身 |
|---|------|------------------|---------|
| ① | 契約書PDF | `contract-care-2026.pdf` | 利用者との介護サービス契約書（5ページ、表含む） |
| ② | 利用者の写真/画像 | `user-profile-001.jpg` | 顔写真 + IDカード風の書式（手書き署名あり） |
| ③ | カンファレンス音声 | `conference-2026-04-10.mp3` | ケアプラン会議の録音（30分、3名発話） |
| ④ | 手書きメモ画像 | `handwritten-memo-0412.png` | スタッフが書いた申し送りメモ（日本語混在） |
| ⑤ | 問い合わせメール長文 | `inquiry-email-0415.txt` | 家族からの苦情を含む長文（2500字）|

### ステップU0: Lakehouse Files フォルダを整える（5分）

既存の `focus_you_lh` Lakehouse を使い回す。**Files** 配下に専用フォルダを作る。

1. Lakehouse explorer で **Files** を右クリック → **New subfolder** → `care_docs`
2. 同様に `care_parsed`（解析結果の一時格納用JSON置き場）を作る
3. **Tables** 配下には後でDeltaテーブルを作成

> Fabric は OneLake = Delta Lake なので、構造化はTables、非構造化はFilesに置く。Snowflake の Stage / Databricks の Volume に相当するのがFabric の Files。

### ステップU1: INGEST — OneLake Files にアップロード（10分）

#### UIで

1. Lakehouse explorer の **Files / care_docs** を右クリック → **Upload → Upload files**
2. 5ファイル全部をドラッグ
3. 完了後:

```python
# Notebook で確認（PySpark）
files_path = "Files/care_docs"
display(mssparkutils.fs.ls(files_path))
```

#### ABFS / OneLake API経由（CI/CD向け）

```python
# OneLake は ABFS URL で一意にアクセスできる
onelake_url = "abfss://<workspace>@onelake.dfs.fabric.microsoft.com/<lakehouse>.Lakehouse/Files/care_docs/"
display(mssparkutils.fs.ls(onelake_url))
```

### ステップU2: PARSE — AI Functions マルチモーダル + Azure Document Intelligence（40分）

Fabric の非構造化データ解析は **2つのルート**がある:

| ルート | 状態 | 使い分け |
|-------|------|---------|
| **Fabric AI Functions マルチモーダル** | Preview（2026-03〜）| PDF/画像をAI Functions で直接扱う。手軽 |
| **Azure AI Document Intelligence** | GA | 精度重視。エンタープライズ帳票処理の定石 |

介護・医療の文書なら **まずAI Functionsで試し、精度不足ならDocument Intelligenceに乗り換える**方針が現実的。

#### 2a. 契約書PDF + 手書きメモ → AI Functions（Preview）

Fabric AI Functions は 2026-03 から **マルチモーダル入力**（画像・PDF）をサポート（Preview）。ポイントは `column_type="path"` で **ファイルパスを渡せる**こと。

```python
# Data Science Notebook（Fabric Runtime 1.3以上）
%pip install -q openai

import synapse.ml.aifunc as aifunc
import pandas as pd

# aifunc.load でフォルダ一括ロード（新機能）
df = aifunc.load(
    folder_path="Files/care_docs",
    prompt="この書類から、利用者氏名・契約日・月額料金・緊急連絡先をJSON形式で抽出してください"
)
# df は file_path, extracted_json 等の構造化カラムを持つ

display(df)

# 個別に詳細抽出したい場合
paths_df = pd.DataFrame({
    "file_path": aifunc.list_file_paths("Files/care_docs")
})

# ai.summarize をファイルパス入力で
paths_df["summary"] = paths_df["file_path"].ai.summarize(column_type="path")

# ai.extract で構造化
paths_df["entities"] = paths_df["file_path"].ai.extract(
    "customer_name", "contract_date", "monthly_fee_jpy",
    column_type="path"
)

display(paths_df)
```

**SQL版AI Functions（Data Warehouse エクスペリエンス）**:

Fabric Data Warehouse にも AI Functions があるが、**マルチモーダル対応は現状 Python/pandas 経由が主流**。テキスト部分のみなら SQL で:

```sql
-- SQL endpoint から（Data Warehouse item 内）
-- 先にテキスト化済みなら AI Functions をSQL関数として使える
SELECT
  file_path,
  AI_SUMMARIZE(content) AS summary
FROM care_parsed_texts;
-- AI_SUMMARIZE / AI_CLASSIFY / AI_GENERATE_RESPONSE 等が SQL関数として提供（GA移行中）
```

#### 2b. 利用者写真 → ai.generate_response に画像パス渡し

マルチモーダル AI Functions は画像もPDFと同じパターンで扱える。

```python
photo_paths = pd.DataFrame({
    "file_path": ["Files/care_docs/user-profile-001.jpg"]
})

photo_paths["id_info"] = photo_paths["file_path"].ai.generate_response(
    "このIDカード画像から氏名・生年月日・ID番号をJSONで抽出してください。判読不可なら null",
    column_type="path"
)

display(photo_paths)
```

#### 2c. カンファレンス音声 → Azure AI Speech（外部呼び出し）

**Fabric AI Functions は2026-04時点で音声入力をサポートしていない**（画像・PDF・テキストのみ）。音声は **Azure AI Speech** を Notebookから呼ぶのが定石。

```python
# 事前準備: Azure AI Speech リソースを Azure Portal で作成し、キーを取得
import azure.cognitiveservices.speech as speechsdk

speech_key = mssparkutils.credentials.getSecret("azure-ai-kv", "speech-key")
speech_region = "japaneast"

speech_config = speechsdk.SpeechConfig(subscription=speech_key, region=speech_region)
speech_config.speech_recognition_language = "ja-JP"

# OneLake Files から音声を一旦ローカルに（Fabric 上の一時領域）
local_path = "/tmp/conference.mp3"
mssparkutils.fs.cp("Files/care_docs/conference-2026-04-10.mp3", f"file:{local_path}")

audio_config = speechsdk.audio.AudioConfig(filename=local_path)
transcriber = speechsdk.transcription.ConversationTranscriber(
    speech_config=speech_config, audio_config=audio_config
)

# 話者識別付き文字起こし（Diarization）
transcripts = []
def on_transcribed(evt):
    transcripts.append({
        "speaker": evt.result.speaker_id,
        "text": evt.result.text,
        "offset_sec": evt.result.offset / 1e7
    })

transcriber.transcribed.connect(on_transcribed)
transcriber.start_transcribing_async().get()
# ...（非同期処理、完了待ち）

transcript_df = pd.DataFrame(transcripts)
spark.createDataFrame(transcript_df).write.mode("overwrite").saveAsTable("care_audio_transcripts")
```

**代替案**: **OpenAI Whisper API を Azure OpenAI** 経由で呼び、AI Functions の `model` configuration で統合する。Mosaic AI Gateway 的な一元管理は **Microsoft Foundry のHub** でサポートされつつある。

#### 2d. 問い合わせメール → そのままテーブル化

```python
# テキストファイルをそのまま読む
email_df = spark.read.option("wholetext", "true").text("Files/care_docs/inquiry-email-0415.txt")
email_df = email_df.withColumn("file_path", lit("inquiry-email-0415.txt")) \
                   .withColumn("doc_type", lit("email")) \
                   .withColumnRenamed("value", "content")

email_df.write.mode("append").saveAsTable("parsed_documents")
```

#### 2e. 解析結果を Delta テーブルに統合

```python
# 各ソースをUNIONして1つのDeltaテーブルに
spark.sql("""
  CREATE OR REPLACE TABLE parsed_documents AS
  SELECT file_path, 'contract' AS doc_type, summary AS content, current_timestamp() AS parsed_at
  FROM contract_parsed
  UNION ALL
  SELECT file_path, 'photo', id_info, current_timestamp() FROM photo_parsed
  UNION ALL
  SELECT file_path, 'audio', concat_ws(' / ', collect_list(text)) OVER (), current_timestamp()
  FROM care_audio_transcripts
  UNION ALL
  SELECT file_path, 'handwritten', summary, current_timestamp() FROM memo_parsed
  UNION ALL
  SELECT file_path, 'email', content, current_timestamp() FROM email_parsed
""")
```

### ステップU3: EMBED — ai.embed でベクトル化（20分）

Fabric AI Functions は **`ai.embed`** を提供。デフォルトモデルは Azure OpenAI の `text-embedding-3-large` 相当（設定で変更可）。

```python
import synapse.ml.aifunc as aifunc
from pyspark.sql.functions import expr, posexplode, col, concat, lit

parsed = spark.table("parsed_documents").toPandas()

# チャンク化
from langchain.text_splitter import RecursiveCharacterTextSplitter
splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)

chunks = []
for _, row in parsed.iterrows():
    for i, chunk in enumerate(splitter.split_text(row["content"] or "")):
        chunks.append({
            "chunk_id": f"{row['file_path']}-{i}",
            "file_path": row["file_path"],
            "doc_type": row["doc_type"],
            "chunk_text": chunk
        })

chunks_df = pd.DataFrame(chunks)

# 埋め込み（Fabric AI Functions: ai.embed）
chunks_df["chunk_vector"] = chunks_df["chunk_text"].ai.embed()

display(chunks_df.head())

# Delta テーブルに保存
spark.createDataFrame(chunks_df).write.mode("overwrite").saveAsTable("document_chunks")
```

**PySpark版**（大規模向け・分散処理）:

```python
chunks_spark = spark.createDataFrame(chunks_df[["chunk_id", "file_path", "doc_type", "chunk_text"]])

embeddings = chunks_spark.ai.embed(input_col="chunk_text", output_col="chunk_vector")
embeddings.write.mode("overwrite").saveAsTable("document_chunks")
```

### ステップU4: SEARCH — Azure AI Search 連携 or OneLake 上で類似度計算（30分）

Fabric は自前のVector Search エンジンを持たない。**2つの選択肢**がある:

| 方法 | 特徴 |
|------|------|
| **Azure AI Search** 連携（推奨） | Fabric Lakehouse に直接Indexer を向けられる。GA |
| **SQL + UDFで類似度計算** | Capacity内で完結。小規模向け |

#### 4a. OneLake 内でコサイン類似度（小規模向け・Notebookで完結）

```python
from pyspark.sql.functions import udf, col
from pyspark.sql.types import FloatType
import numpy as np

# 質問を埋め込み
query = "家族から苦情が入った事案と、その際の対応方針を教えて"
q_vec_df = pd.DataFrame({"q": [query]})
q_vec_df["q_vec"] = q_vec_df["q"].ai.embed()
q_vec = q_vec_df["q_vec"].iloc[0]

@udf(FloatType())
def cosine_sim(v):
    if v is None:
        return 0.0
    a = np.array(v, dtype=np.float32)
    b = np.array(q_vec, dtype=np.float32)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))

top3 = (
    spark.table("document_chunks")
    .withColumn("similarity", cosine_sim(col("chunk_vector")))
    .orderBy(col("similarity").desc())
    .limit(3)
)

display(top3)
```

#### 4b. Azure AI Search Indexer で Lakehouse を索引化（本番向け）

1. Azure Portal で **Azure AI Search** リソースを作成（Standard S1 以上推奨）
2. Fabric OneLake を Data Source に追加（Managed identity で認証）
3. **OneLake files indexer** で `document_chunks` の Delta テーブルを自動索引化
4. `chunk_vector` を **HNSW アルゴリズム**で検索

```python
# Azure AI Search クライアントを Notebook から
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential

search_endpoint = "https://<your-search>.search.windows.net"
search_key = mssparkutils.credentials.getSecret("azure-ai-kv", "search-key")

client = SearchClient(
    endpoint=search_endpoint,
    index_name="care-docs-index",
    credential=AzureKeyCredential(search_key)
)

# 質問ベクトル検索
from azure.search.documents.models import VectorizedQuery

vector_query = VectorizedQuery(
    vector=q_vec, k_nearest_neighbors=3, fields="chunk_vector"
)

results = client.search(
    search_text=None, vector_queries=[vector_query],
    select=["chunk_id", "file_path", "chunk_text"]
)

for r in results:
    print(r["file_path"], "--", r["chunk_text"][:100])
```

### ステップU5: INFER — AI Functions でRAG応答 + Fabric Data Agent（25分）

#### 5a. ai.generate_response でRAG応答

```python
# 検索トップ3（上のtop3 DataFrame）の chunk_text を連結してプロンプトに
top3_pdf = top3.toPandas()
context = "\n---\n".join(top3_pdf["chunk_text"].tolist())

answer_df = pd.DataFrame({
    "ctx": [context]
})

answer_df["rag_answer"] = answer_df["ctx"].ai.generate_response(
    instructions=(
        "以下の社内文書の抜粋を根拠として、家族からの苦情と対応方針を"
        "日本語で300字以内で要約してください。根拠外の情報は「資料外」と明記。"
    )
)

print(answer_df["rag_answer"].iloc[0])
```

#### 5b. SQL版 AI Functions（Data Warehouse内で）

```sql
-- Fabric Data Warehouse の SQL AI 関数（GA移行中）
SELECT
  file_path,
  AI_GENERATE_RESPONSE(
    content,
    '以下の日記を20字以内で要約してください'
  ) AS short_summary,
  AI_CLASSIFY(
    content,
    JSON_ARRAY('苦情', '問い合わせ', '感謝', '中立')
  ) AS email_category
FROM parsed_documents
WHERE doc_type = 'email';
```

#### 5c. Fabric Data Agent（GA）

**Fabric Data Agent は 2026 GA**。社内ユーザーが Teams / Copilot から自然言語で問い合わせできるようにする。

1. Workspace で **+ New → Data agent**
2. 名前: `care-docs-agent`
3. Data sources として `parsed_documents`, `document_chunks`, `care_audio_transcripts` を登録
4. **Instructions** に「介護サービスの利用者ドキュメントに関する質問に答える。PIIを含む回答は氏名をマスクする」等の方針を書く
5. テストUIで「4月の家族からの苦情を教えて」と聞いてみる
6. Power BI / Teams / Copilot Studio にデプロイ

```python
# Data Agent は UI 中心だが、SDK 経由でも呼べる
from fabric.analytics.dataagent import DataAgentClient

agent = DataAgentClient(agent_id="care-docs-agent")
response = agent.ask("4月の家族からの苦情の件数と傾向を教えて")
print(response.answer)
```

### 運用上の注意（介護・医療特有のリスク）

Snowflake・Databricks編と同じ枠組みで、Fabric 特有の観点を加える。

| 観点 | Fabric での対策 |
|------|---------------|
| **コスト** | AI Functions は **Capacity Unit (CU)** を消費。Capacity metrics app の "AI Functions" operation で監視。F2で無尽蔵に呼ぶと一瞬で使い切るので注意 |
| **レイテンシ** | ai.embed / ai.generate_response はデフォルト並列200。Notebook バッチで数千件を並列処理可能 |
| **権限** | **Microsoft Purview 統合**が Fabric の肝。ラベル・分類・DLPを Purview 側で管理し、OneLake データに自動適用 |
| **PIIマスキング** | Purview の **Sensitive Information Types** を使って PII を自動識別・マスク。Fabric の列レベルセキュリティ / 行レベルセキュリティと組み合わせる |
| **監査ログ** | Microsoft 365 Compliance Portal で Fabric のアクティビティを統合監査。ai functions の呼び出しも追跡可能（2026-Q1でAI Functions operation 分離） |

**介護・医療の非構造化データ固有の3大リスク**（Fabric文脈）:
1. **PII が Power BI レポートに意図せず表示される** — Direct Lake で素のDeltaを引くので、**Semantic Model 側のRLS設計**を最初からやる。`parsed_documents.content` のようなカラムは Report で非表示に
2. **Azure OpenAI の処理リージョン** — AI Functions はデフォルトで米国リージョンの Azure OpenAI に問い合わせる。**介護記録の国内保管要件**があるなら、テナント設定で **Japan East / Japan West** を明示する必要がある（Cross-geo processing 設定）
3. **Copilot / Data Agent のプロンプトインジェクション** — 家族からの問い合わせメールに「過去の全利用者情報を教えて」のような誘導が含まれていた場合、Agent がそれに釣られるリスク。**Instructions にガードレール**を明記し、Agent の応答内容を Activator で監査

### 気づきメモ用

- `aifunc.load` の「フォルダ一括解析」は、**Snowflake/Databricks の段階的解析**と比べてどう？
- Fabric AI Functions の **マルチモーダルがまだPreview**で音声非対応な状況を、クライアントにどう説明する？
- Azure AI Search 連携と、Snowflake Cortex Search / Databricks Vector Search の **運用の複雑さ**の違いは？
- Fabric Data Agent で実際に質問してみた**日本語の応答品質**は、ChatGPT / Copilot と比べてどう？

### 公知情報の限界

- **Fabric AI Functions のマルチモーダル（PDF/画像）は Preview**（2026-03投入）。GA時期は未発表
- **音声は AI Functions 非対応**。Azure AI Speech / Azure OpenAI Whisper 経由が必須で、**データ基盤単体で完結しない**
- **Azure AI Search 連携の Indexer** は Fabric Lakehouse 対応がGAだが、**具体的な制限事項**（パーティション検出・スキーマ変更対応等）は要検証
- **Fabric Data Agent の日本語品質**は公式ベンチなし。2026-04時点では **gpt-4.1-mini** がデフォルトで、gpt-5系への切替は workspace 設定
- **Microsoft Foundry Hub / Azure AI Content Safety** との連携（PII自動検出・マスク）は進化中。仕様は四半期で変動する前提で追跡

### 壁打ちモードへの導線

- 「**OneLake + AI Functions + Azure AI Search + Data Agent** の **4階建て** は、**Snowflake/Databricks の1プラットフォーム完結** と比べて認知負荷が高いか？それとも **Azure 既存投資があれば当然**か？」
- 「**介護・医療領域で Purview のラベル管理** をクライアントがどこまで運用できるか？Purview 未導入企業に推すのは現実的か？」
- 「**Fabric Data Agent** を Teams に組み込めるメリットは、SOMPOケアのような **Teams ヘビーユーザー企業**にどう響くか？」
- 「**音声処理が Fabric 単体で閉じない事実**（Azure AI Speech 併用必須）は、**案件提案での不利**になるか、**むしろエコシステム連携の強み**として語れるか？」

### 結論（非構造化データブロック）

- Fabric は **「エコシステム連携で勝つ」** 戦略。AI Functions は手軽だが、**音声・Vector Search・Data Intelligence** は Azure 既存サービスに接続する前提
- **Purview との統合ガバナンス**は Snowflake Horizon / Databricks Unity Catalog にない差別化要素。介護・医療のような **規制業種**では決定打になりうる
- **Data Agent / Copilot** は非技術者向けのリーチで他2社を圧倒する。ただし **日本語品質・プロンプトインジェクション対策**は実運用前に検証必須
- **OneLake に集まる** 思想は現実的に機能するが、**音声処理・Vector Search は外に出る**ため、厳密には「全部OneLake」ではない。**「Azure全体で一貫する」**と説明した方が正確

### 主要ソース（非構造化データブロック、全て 2026-04-19 アクセス）

- [Transform and Enrich Data with AI Functions - Microsoft Fabric | Microsoft Learn](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/overview)
- [Use multimodal input with AI functions - Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/multimodal-overview)
- [Unlock insights from images and PDFs with multimodal support in Fabric AI functions (Preview)](https://blog.fabric.microsoft.com/en-us/blog/unlock-insights-from-images-and-pdfs-with-multimodal-support-in-fabric-ai-functions-preview/)
- [Fabric AI Functions Enhancements (Generally Available)](https://blog.fabric.microsoft.com/en-US/blog/29826/)
- [Fabric data agent creation - Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent)
- [Give your AI agent the keys to OneLake: OneLake MCP (GA)](https://blog.fabric.microsoft.com/en-US/blog/give-your-ai-agent-the-keys-to-onelake-onelake-mcp-generally-available)
- [Use ai.extract with pandas - Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/pandas/extract)
- [Microsoft Fabric AI Document Intelligence for Enterprise Data Strategy](https://www.techment.com/blogs/microsoft-fabric-ai-document-intelligence/)
- [Azure AI Speech - Speaker diarization](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/conversation-transcription)
- [FABCON 2026: Microsoft Fabric's Agentic Era](https://kanerika.com/blogs/fabcon-2026-microsoft-fabric-updates/)

```yaml
# handoff
handoff:
  - to: 社長レビュー
    context: "非構造化データハンズオン（Fabric編）を既存ハンズオンに追記。Snowflake編・Databricks編と同じ題材（介護・医療5種）で比較可能。3ファイルセットで比較反省（05-comparison-reflection.md）に進める"
    tasks:
      - "F2 Capacity で ステップU0→U5 を試す（2.5時間）"
      - "AI Functions マルチモーダル（画像/PDF）が介護現場帳票でどこまで使えるか検証"
      - "Purview ラベル + Fabric ガバナンスの連携を Data Agent で試す"
      - "3基盤の非構造化データ対応を 05-comparison-reflection.md で総括する"
```
