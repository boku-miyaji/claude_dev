# Snowflake Cortex Analyst ハンズオン

> 所要時間: 約60分 / 前提: 第1弾 `02-snowflake-handson.md` を終えて `FOCUS_YOU.RAW` / `FOCUS_YOU.MART` にデータがある状態

## このハンズオンのゴール

`FOCUS_YOU.MART` のテーブルに対して、**Cortex Analyst** を使って自然言語で問い合わせできる状態を作る。最終的には Streamlit in Snowflake から「先週ストレスが高かった日は？」と打って、SQL実行結果を返すチャットUIを動かす。

## Cortex Analyst とは（30秒で）

Snowflake が提供する Text-to-SQL マネージドサービス。**Semantic Model YAML** を一つ書いて Stage に上げるだけで、REST API 経由で自然言語問い合わせができるようになる。幻覚対策として「テーブル・カラムの意味情報」「Verified Query（人間が検証済みの参考クエリ）」を YAML に含められる。

👉 **驚きポイント**: Python もフロントエンドも書かず、YAML を1つ書くだけで動くこと。10年前に SSAS の Cube を作ったことがある人ほど、その軽さに驚く。

公式ドキュメント: [Cortex Analyst docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst) (accessed 2026-04-15)

---

## ステップ 0: Semantic Model 用の Stage を作る（5分）

Snowsight の SQL Worksheet で:

```sql
USE DATABASE FOCUS_YOU;
CREATE SCHEMA IF NOT EXISTS FOCUS_YOU.SEMANTIC;
CREATE STAGE IF NOT EXISTS FOCUS_YOU.SEMANTIC.MODELS
  DIRECTORY = (ENABLE = TRUE);
```

Stage はファイル置き場。Semantic Model YAML をここに置く。

## ステップ 1: Semantic Model YAML を書く（15分）

ローカルで `focus_you_semantic.yaml` を作成:

```yaml
name: focus_you_wellbeing
description: focus-you の感情分析・日記・カレンダーの統合セマンティックモデル。ユーザーの気分とスケジュールの関係を問い合わせるためのもの。

tables:
  - name: daily_mood
    description: 1日あたりの気分スコアと感情6軸、およびその日のカレンダーカテゴリ別予定数をまとめたマート。
    base_table:
      database: FOCUS_YOU
      schema: MART
      table: daily_mood_v
    dimensions:
      - name: entry_date
        description: 日記の対象日（DATE）
        expr: entry_date
        data_type: date
        unique: true
      - name: day_of_week
        description: 曜日（月〜日）
        expr: DAYNAME(entry_date)
        data_type: varchar
        sample_values: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      - name: is_weekend
        description: 週末フラグ
        expr: (DAYOFWEEK(entry_date) IN (0, 6))
        data_type: boolean

    measures:
      - name: mood_score
        description: 自己申告の気分スコア(1-10)。高いほど良い気分。
        expr: mood_score
        data_type: number
        default_aggregation: avg
      - name: joy
        description: 喜びスコア(0.0-1.0)。感情分析モデルによる推定値。
        expr: joy
        data_type: float
        default_aggregation: avg
      - name: stress_score
        description: ストレススコア。sadness + anger + fear の合計。0に近いほど穏やか。
        expr: (sadness + anger + fear)
        data_type: float
        default_aggregation: avg
      - name: work_events
        description: その日の仕事カテゴリの予定数
        expr: work_events
        data_type: number
        default_aggregation: sum

verified_queries:
  - name: stressful_days_last_week
    question: 先週ストレスが高かった日はいつですか？
    sql: |
      SELECT entry_date, (sadness + anger + fear) AS stress_score
      FROM FOCUS_YOU.MART.daily_mood_v
      WHERE entry_date >= DATEADD(day, -7, CURRENT_DATE())
      ORDER BY stress_score DESC
      LIMIT 3;
```

**ここで詰まりがち**: `daily_mood_v` は第1弾で作った結合ビュー。ない場合は以下で作る:

```sql
CREATE OR REPLACE VIEW FOCUS_YOU.MART.daily_mood_v AS
SELECT
  d.entry_date, d.entry_text, d.mood_score,
  e.joy, e.sadness, e.anger, e.fear, e.surprise, e.disgust,
  COALESCE(SUM(CASE WHEN c.category='work' THEN 1 ELSE 0 END), 0) AS work_events,
  COALESCE(SUM(CASE WHEN c.category='personal' THEN 1 ELSE 0 END), 0) AS personal_events,
  COALESCE(SUM(CASE WHEN c.category='health' THEN 1 ELSE 0 END), 0) AS health_events
FROM FOCUS_YOU.RAW.diary_entries d
LEFT JOIN FOCUS_YOU.RAW.emotion_analysis e ON d.entry_date = e.entry_date
LEFT JOIN FOCUS_YOU.RAW.calendar_events c ON d.entry_date = c.event_date
GROUP BY d.entry_date, d.entry_text, d.mood_score, e.joy, e.sadness, e.anger, e.fear, e.surprise, e.disgust;
```

## ステップ 2: YAML を Stage にアップロード（5分）

Snowsight の Data → Databases → FOCUS_YOU → SEMANTIC → Stages → MODELS を開き、右上の「+ Files」から `focus_you_semantic.yaml` をアップロード。

CLI派なら:
```sql
PUT file:///path/to/focus_you_semantic.yaml @FOCUS_YOU.SEMANTIC.MODELS AUTO_COMPRESS=FALSE;
```

確認:
```sql
LIST @FOCUS_YOU.SEMANTIC.MODELS;
```

## ステップ 3: REST API で問い合わせてみる（10分）

Cortex Analyst は REST API。一番速いのは Snowsight 内の Python Notebook から。

```python
import requests, json, os
from snowflake.snowpark.context import get_active_session

session = get_active_session()
token = session.connection.rest.token
host = session._conn._conn.host  # xxx.snowflakecomputing.com

payload = {
    "messages": [
        {"role": "user", "content": [{"type": "text", "text": "先週ストレスが高かった日は？"}]}
    ],
    "semantic_model_file": "@FOCUS_YOU.SEMANTIC.MODELS/focus_you_semantic.yaml",
}

r = requests.post(
    f"https://{host}/api/v2/cortex/analyst/message",
    headers={
        "Authorization": f'Snowflake Token="{token}"',
        "Content-Type": "application/json",
    },
    data=json.dumps(payload),
)
print(json.dumps(r.json(), indent=2, ensure_ascii=False))
```

レスポンスには:
- `text` 部: 回答の自然言語説明
- `sql` 部: 生成されたSQL
- 必要に応じて `suggestions` や `clarification`

生成された SQL を自分で実行して結果を確認する。

## ステップ 4: Streamlit in Snowflake でチャットUIを作る（20分）

Snowsight の左メニューから **Streamlit** → Create Streamlit App。以下を貼る（抜粋）:

```python
import streamlit as st
import requests, json
from snowflake.snowpark.context import get_active_session

session = get_active_session()
st.title("focus-you: 気分を自然言語で聞く")

if "messages" not in st.session_state:
    st.session_state.messages = []

for m in st.session_state.messages:
    with st.chat_message(m["role"]):
        st.markdown(m["content"])

if prompt := st.chat_input("例: 先週ストレスが高かった日は？"):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    token = session.connection.rest.token
    host = session._conn._conn.host
    r = requests.post(
        f"https://{host}/api/v2/cortex/analyst/message",
        headers={"Authorization": f'Snowflake Token="{token}"', "Content-Type": "application/json"},
        data=json.dumps({
            "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
            "semantic_model_file": "@FOCUS_YOU.SEMANTIC.MODELS/focus_you_semantic.yaml",
        }),
    )
    data = r.json()
    reply_text = ""
    for item in data.get("message", {}).get("content", []):
        if item.get("type") == "text":
            reply_text += item.get("text", "")
        elif item.get("type") == "sql":
            sql = item.get("statement", "")
            df = session.sql(sql).to_pandas()
            reply_text += f"\n\n**生成SQL**:\n```sql\n{sql}\n```\n\n"
            st.session_state.messages.append({"role": "assistant", "content": reply_text})
            with st.chat_message("assistant"):
                st.markdown(reply_text)
                st.dataframe(df)
            st.stop()

    st.session_state.messages.append({"role": "assistant", "content": reply_text})
    with st.chat_message("assistant"):
        st.markdown(reply_text)
```

実行して、チャット欄に「先週ストレスが高かった日は？」「3月で一番joyが高かった日は？」と打って試す。

## 試す質問リスト

1. "先週の joy スコアの平均は？"
2. "ストレスが高かった日を3つ教えて"
3. "気分が良かった週末は何をしていましたか？"
4. "3月で一番 joy が高かった日とその日の予定を教えて"
5. "ちょっと疲れた気がする日が多かった週は？" ← ask-back が出るか観察

## コスト

Cortex Analyst は **リクエスト数ベース課金**。2026年4月時点では1メッセージあたり Snowflake credits で課金。Warehouse compute も併用される（SQL実行分）。

正確な単価: [Snowflake Service Consumption Table](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf) を参照（月次更新）。

**節約Tips**:
- Verified Queries を充実させる → LLM が最初から正しいSQL を出す確率が上がる → リトライが減る
- Warehouse は XSMALL で `AUTO_SUSPEND = 30`
- 検証フェーズでは `CORTEX_ANALYST_USAGE_HISTORY` ビューを定期的に眺める

## 公知情報の限界

- Cortex Analyst の日本語精度は明示的に公表されていない。日本語での Verified Queries を増やしてテストする必要がある
- 複数テーブル結合を含む問いへの対応は YAML の `relationships` ブロック次第。本ハンズオンでは1テーブルで済むため未扱い
- マルチターン対話（前のターンを踏まえる）は2026年時点で部分的に対応。複雑な会話は Cortex Agents と組み合わせる方が安定する

## 壁打ちへの導線

- **YAML Semantic Model** と **Power BI Semantic Model**、どちらが現場で管理しやすいか
- Verified Queries を誰が書くか（データエンジニア？ 業務部門？）
- エンドユーザーが使う時、レスポンスの **「生成SQL」** を見せるべきか隠すべきか
- 監査ログの保存期間と、誰がレビューするか

## ネクストアクション

- [ ] YAML を拡張して `relationships` を試す（複数テーブル結合）
- [ ] `verified_queries` を5件に増やして幻覚率の変化を体感
- [ ] Cost Attribution で1問あたりの credit を実測し、`cost-comparison.md` に記録

---

**Sources (accessed 2026-04-15)**:
- [Cortex Analyst docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst)
- [Cortex Analyst tutorial](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst/tutorials/tutorial-1)
- [Snowflake Service Consumption Table](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf)
