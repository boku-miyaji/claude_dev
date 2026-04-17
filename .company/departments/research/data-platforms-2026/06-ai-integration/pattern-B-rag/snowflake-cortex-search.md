# Snowflake Cortex Search ハンズオン

> 所要時間: 約45分 / 前提: `FOCUS_YOU.RAW.diary_entries` が存在

## このハンズオンのゴール

Cortex Search サービスを `diary_entries` の `entry_text` に対して作成し、**ハイブリッド検索（BM25 + ベクトル）** で「今日と似た気分の日を5件」を引く。取得した日付を使って予定との相関を `AI_COMPLETE` で要約する。

## Cortex Search とは（30秒で）

「テーブルを指定するだけでハイブリッド検索サービスが立ち上がる」マネージド機能。2026年時点で:

- **ハイブリッド標準**: BM25 とベクトル検索を組み合わせたスコアリング
- **自動同期**: ベーステーブルの更新を `TARGET_LAG` 設定で追随
- **複数カラム検索**（2026年3月GA）: 1つのサービスで複数の検索対象カラムを持てる ([release note](https://docs.snowflake.com/en/en/release-notes/2026/other/2026-03-12-recent-cortex-search), 2026-04-15)
- **Attributes**: フィルタ用のカラムを同梱できる（"この日付より新しい" など）

公式: [Cortex Search](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-overview) (accessed 2026-04-15)

---

## ステップ 1: サービスを作る（10分）

```sql
USE ROLE ACCOUNTADMIN;
USE DATABASE FOCUS_YOU;
USE SCHEMA RAW;

CREATE OR REPLACE CORTEX SEARCH SERVICE diary_search
  ON entry_text
  ATTRIBUTES entry_date, mood_score
  WAREHOUSE = COMPUTE_WH
  TARGET_LAG = '5 minutes'
  AS (
    SELECT entry_text, entry_date, mood_score
    FROM diary_entries
  );
```

- `ON entry_text`: 検索対象のテキストカラム
- `ATTRIBUTES`: 検索結果と一緒に返ってくる（＆フィルタに使える）カラム
- `TARGET_LAG`: ベーステーブル更新を追いかける目標ラグ
- `WAREHOUSE`: 初期インデックス作成に使う Warehouse

サービス作成後、ステータス確認:

```sql
DESCRIBE CORTEX SEARCH SERVICE diary_search;
SHOW CORTEX SEARCH SERVICES;
```

**indexing_state** が `READY` になるまで1-2分。

👉 **驚きポイント**: Embedding モデル選定も Index 構築も自分で書かない。`CREATE CORTEX SEARCH SERVICE` の1コマンドで BM25 + ベクトルのハイブリッドが立ち上がる。

## ステップ 2: Python から検索する（15分）

Snowsight の Python Notebook で:

```python
from snowflake.snowpark.context import get_active_session
from snowflake.core import Root

session = get_active_session()
root = Root(session)

svc = (
    root
    .databases["FOCUS_YOU"]
    .schemas["RAW"]
    .cortex_search_services["DIARY_SEARCH"]
)

query = "プロジェクトで上司と衝突して、どうにも気が晴れない"

resp = svc.search(
    query=query,
    columns=["entry_text", "entry_date", "mood_score"],
    limit=5,
)
for row in resp.results:
    print(row["entry_date"], "mood:", row["mood_score"])
    print("  ", row["entry_text"][:80])
```

出力例:
```
2026-03-03 mood: 3
   プロジェクトの方向性で上司と意見が割れた。もやもやが残る。
2026-03-15 mood: 4
   プレゼン前日。資料の方向性が決まらず消耗。...
```

## ステップ 3: フィルタと併用（5分）

`ATTRIBUTES` を使った絞り込み:

```python
resp = svc.search(
    query=query,
    columns=["entry_text", "entry_date", "mood_score"],
    filter={"@lte": {"mood_score": 5}},  # mood_score が5以下
    limit=5,
)
```

**注意**: フィルタ構文は Snowflake Python SDK 固有。JSON リクエスト直接送信時も同じ形式。

## ステップ 4: 取得結果を LLM に要約させる（15分）

取得した日付で `calendar_events` と JOIN し、`AI_COMPLETE` に流す:

```python
dates = [row["entry_date"] for row in resp.results]
date_list = ", ".join([f"'{d}'" for d in dates])

# その日の予定を取得
events_df = session.sql(f"""
    SELECT event_date, event_title, category
    FROM FOCUS_YOU.RAW.calendar_events
    WHERE event_date IN ({date_list})
    ORDER BY event_date
""").to_pandas()

# コンテキスト作成
context_parts = []
for row in resp.results:
    d = row["entry_date"]
    events_on_day = events_df[events_df["EVENT_DATE"] == d]
    events_str = ", ".join(events_on_day["EVENT_TITLE"].tolist()) or "予定なし"
    context_parts.append(f"- {d} (mood={row['mood_score']}): {row['entry_text'][:60]}  予定: {events_str}")

context = "\n".join(context_parts)

prompt = f"""以下は、ある人が「{query}」という気持ちになっていた過去の日とその予定です。

{context}

これらの日々の共通点と、こういう気分の時に取ると効きそうな過ごし方を、やさしい口調で3行で要約してください。"""

result = session.sql(f"""
    SELECT AI_COMPLETE('claude-haiku-4-5', $${prompt}$$) AS summary
""").collect()

print(result[0]["SUMMARY"])
```

## コスト

Cortex Search のコスト構造は **3層**:

1. **サービスサイズ**: インデックスストレージ (GB/month)
2. **検索クエリ**: クエリあたり credits
3. **同期 compute**: ベーステーブルが更新された時の再インデックス

**focus-you 30日分（約3KB）** のような小さなコーパスでは月数円程度で収まるが、スケール後は要注意。正確な単価は [Snowflake Service Consumption Table](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf) を確認。

**節約Tips**:
- `TARGET_LAG` を長めに（5分→1時間）すると同期 compute が減る
- 不要になったサービスは `DROP CORTEX SEARCH SERVICE` で確実に削除
- フィルタで検索範囲を絞ると検索 credit が減る

## 他2基盤との差分メモ

- **ハイブリッド標準**: Snowflake は最初からBM25＋ベクトル。Databricks はベクトル中心でBM25併用はセルフサービス
- **セットアップの短さ**: `CREATE CORTEX SEARCH SERVICE` 1文で動くのは3基盤中最速
- **Embedding を選べない**: 内蔵モデル固定。ドメイン特殊語には弱い可能性

## 公知情報の限界

- 内蔵 Embedding モデルの日本語性能は未公表
- 複数カラム検索（2026年3月GA）の内部スコアリング詳細は未公開
- 超大規模（1億行超）での性能劣化カーブは公式ベンチマークなし

## 壁打ちへの導線

- Snowflake だけで RAG が完結するなら、Pinecone を入れる案件はどんな時か
- `TARGET_LAG` を短くしたい要件（リアルタイムRAG）はどんな業種で出るか
- Cortex Search と Cortex Analyst を Cortex Agents から **両方 tool として使う** のがパターンDでの本命

## ネクストアクション

- [ ] `diary_entries` を追加して自動同期の挙動を観察
- [ ] 同じクエリを英語と日本語で投げて精度差を測る
- [ ] 検索 credits を ACCOUNT_USAGE で確認し `cost-comparison.md` に記録

---

**Sources (accessed 2026-04-15)**:
- [Cortex Search overview](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-overview)
- [CREATE CORTEX SEARCH SERVICE](https://docs.snowflake.com/en/sql-reference/sql/create-cortex-search)
- [Cortex Search Mar 2026 updates](https://docs.snowflake.com/en/en/release-notes/2026/other/2026-03-12-recent-cortex-search)
- [Snowflake Service Consumption Table](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf)
