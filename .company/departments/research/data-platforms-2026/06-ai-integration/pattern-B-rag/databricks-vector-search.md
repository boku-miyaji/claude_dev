# Databricks Mosaic AI Vector Search ハンズオン

> 所要時間: 約60分 / 前提: Unity Catalog の `focus_you.default.diary_entries` が存在

## ゴール

**Delta Sync Index** を作り、Delta テーブルの更新を自動でベクトル化・追随させ、Python SDK から類似検索を実行する。最後に取得結果を `ai_query()` で要約する。

## Mosaic AI Vector Search とは

Databricks ネイティブの Vector 検索。**Delta Sync** モードが最大の特徴で、Delta テーブルに対してインデックスを貼ると、Delta 更新を継続的に検知して自動で embedding し直す。

2026年時点の主要モード:
- **Delta Sync Index**: Delta テーブル連動（推奨）
- **Direct Access Index**: 自分でベクトルを POST する（既存のベクトル資産を持ち込む時）

公式: [Mosaic AI Vector Search](https://learn.microsoft.com/en-us/azure/databricks/vector-search/vector-search) (accessed 2026-04-15)

---

## ステップ 0: Vector Search Endpoint を作る（5分）

UI: 左サイドバー → **Compute** → **Vector Search** → **Create**。

- **Endpoint name**: `focus-you-vs`
- **Endpoint type**: Standard（試用）

起動に数分かかる。

または SDK:
```python
from databricks.vector_search.client import VectorSearchClient
vsc = VectorSearchClient()
vsc.create_endpoint(name="focus-you-vs", endpoint_type="STANDARD")
```

## ステップ 1: ソーステーブルに Change Data Feed を有効化（5分）

Delta Sync は CDC (Change Data Feed) を使う:

```sql
ALTER TABLE focus_you.default.diary_entries
  SET TBLPROPERTIES (delta.enableChangeDataFeed = true);
```

`id` 列が無ければ追加:

```sql
-- diary_entries が entry_date を PK にしているなら OK だが、
-- Vector Search は BIGINT / STRING の primary key が必要
CREATE OR REPLACE TABLE focus_you.default.diary_entries_with_id AS
SELECT row_number() OVER (ORDER BY entry_date) AS id, *
FROM focus_you.default.diary_entries;

ALTER TABLE focus_you.default.diary_entries_with_id
  SET TBLPROPERTIES (delta.enableChangeDataFeed = true);
```

## ステップ 2: Delta Sync Index を作る（10分）

```python
from databricks.vector_search.client import VectorSearchClient

vsc = VectorSearchClient()

index = vsc.create_delta_sync_index(
    endpoint_name="focus-you-vs",
    source_table_name="focus_you.default.diary_entries_with_id",
    index_name="focus_you.default.diary_index",
    primary_key="id",
    embedding_source_column="entry_text",
    embedding_model_endpoint_name="databricks-bge-large-en",  # 内蔵
    pipeline_type="TRIGGERED",  # or CONTINUOUS
)
```

- `embedding_source_column`: Embed 対象
- `embedding_model_endpoint_name`: 内蔵モデルエンドポイント。日本語重視なら multilingual 系を別途 Serving 化
- `pipeline_type="TRIGGERED"`: 手動でトリガー。`CONTINUOUS` だと常時同期（コスト高）

初期 embedding が終わるまで数分。状態確認:

```python
index.describe()  # state が READY になるまで
```

👉 **驚きポイント**: Delta テーブルを指定するだけで、裏で embedding モデルが呼ばれ、ベクトルが計算され、インデックスが貼られる。手で embed API を叩く必要がない。

## ステップ 3: 類似検索（10分）

```python
results = index.similarity_search(
    query_text="プロジェクトで上司と衝突してどうにも気が晴れない",
    columns=["id", "entry_date", "entry_text", "mood_score"],
    num_results=5,
)

for row in results["result"]["data_array"]:
    print(row)
```

**ハイブリッド検索**（BM25併用）を使う場合:

```python
results = index.similarity_search(
    query_text="...",
    query_type="HYBRID",  # or "ANN"
    columns=["id", "entry_date", "entry_text", "mood_score"],
    num_results=5,
)
```

## ステップ 4: ai_query() で要約（10分）

Notebook SQL セル:

```sql
WITH similar_days AS (
  -- 実装上は上で取得した日付リストをパラメータ化して INSERT するか、
  -- Python 側で連結して以下のクエリを組み立てる
  SELECT entry_date, entry_text, mood_score
  FROM focus_you.default.diary_entries_with_id
  WHERE id IN (3, 15, 22, 8, 27)  -- Python から埋め込み
),
events_joined AS (
  SELECT s.entry_date, s.entry_text, s.mood_score,
         collect_list(c.event_title) AS events
  FROM similar_days s
  LEFT JOIN focus_you.default.calendar_events c
    ON s.entry_date = c.event_date
  GROUP BY s.entry_date, s.entry_text, s.mood_score
)
SELECT ai_query(
  'databricks-claude-haiku-4-5',
  concat(
    '以下の日々の共通点と、こういう気分の時に効きそうな過ごし方を3行で要約してください。\n',
    collect_list(
      concat(cast(entry_date AS string), ' mood=', cast(mood_score AS string),
             ' 予定=', array_join(events, ','), ' 日記=', entry_text)
    )[0]
  )
) AS summary
FROM events_joined;
```

実務では Python で prompt を組み立てて `ai_query()` を呼ぶ方が柔軟。

## コスト

- **Endpoint**: Standard エンドポイントは時間課金。不要時は削除
- **Embedding**: `databricks-bge-large-en` は内蔵で Pay-per-token
- **Serving**: 検索リクエストは低廉だが、Endpoint の **最小稼働費** がある点に注意

**節約Tips**:
- 試用は終わったら必ず `vsc.delete_endpoint("focus-you-vs")`
- `pipeline_type="TRIGGERED"` でインデックス再計算のタイミングを制御
- Free Edition では Vector Search Endpoint の選択肢と稼働時間に制約あり（サインアップ時に確認）

## 他2基盤との差分メモ

- **Delta Sync が最大の武器**: Delta テーブルを唯一の真実とする運用ではこれ以上ない選択肢
- **Embedding を自前にしやすい**: Model Serving に任意モデルを載せて endpoint を切り替えるだけ
- **Endpoint が先に立つ**: Snowflake/Fabric は "テーブルに紐づく" 発想、Databricks は "サービスインフラ" の発想

## 公知情報の限界

- 日本語 Embedding の内蔵オプションは限定的。multilingual モデルは自前で Serving 化が必要なことが多い
- Endpoint の SLA / レイテンシ分布の公表は限定的
- Free Edition の Vector Search 上限値は頻繁に変わる

## 壁打ちへの導線

- Unity Catalog ガバナンスを前提にした RAG と、外部 Vector DB ベースの RAG、どちらが監査対応しやすいか
- `CONTINUOUS` vs `TRIGGERED` の選択基準
- 多言語コーパスで内蔵モデルと multilingual-e5 を比較するなら、どう実験計画を立てるか

## ネクストアクション

- [ ] `TRIGGERED` と `CONTINUOUS` でコスト差を実測
- [ ] 内蔵モデルと multilingual-e5 の Recall@5 を日本語クエリで比較
- [ ] 類似検索結果を Agent Framework で Tool 化（パターンD）

---

**Sources (accessed 2026-04-15)**:
- [Mosaic AI Vector Search docs](https://learn.microsoft.com/en-us/azure/databricks/vector-search/vector-search)
- [Mosaic AI capabilities](https://docs.databricks.com/aws/en/generative-ai/guide/mosaic-ai-gen-ai-capabilities)
- [Foundation Model Serving pricing](https://www.databricks.com/product/pricing/foundation-model-serving)
