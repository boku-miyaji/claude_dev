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
