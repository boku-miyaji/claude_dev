# Snowflake Cortex Agents — AI Agent ハンズオン

> **所要時間**: 70分 / **前提**: Snowflake アカウント（Trial可）、Cortex Analyst / Cortex Search の基本理解（パターンA/Bで触った前提） / **ゴール**: Cortex Agents で Analyst + Search + UDF を統合し、「今週のハイライトをSlack風に」を実現する

## Cortex Agents とは何か

Cortex Agents は Snowflake のオーケストレーション層。Cortex Analyst（構造化データへのText-to-SQL）と Cortex Search（非構造化データへのRAG検索）を **ツール** として持ち、ユーザーの意図に応じて自動的にルーティングする。さらに UDF / Stored Procedure を **カスタムツール** として追加できる。

ユーザーから見ると「Snowflake内のデータに何でも聞ける単一のエンドポイント」。裏側ではLLMが「この質問はAnalyst（SQL）で答えるべきか、Search（RAG）で答えるべきか」を判断してツールを選んでいる。

公式ドキュメント:
- 概要: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents (2026-04-15参照)
- 設定と操作: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-manage (2026-04-15参照)
- Getting Started: https://www.snowflake.com/en/developers/guides/getting-started-with-cortex-agents/ (2026-04-15参照)

## アーキテクチャ

```
ユーザー ──→ Cortex Agent API
                │
                ├── Cortex Analyst (構造化データ)
                │     └── Semantic Model (YAML)
                │           └── diary_entries, emotion_analysis, calendar_events
                │
                ├── Cortex Search (非構造化データ)
                │     └── Search Service
                │           └── diary_entries.entry_text (全文検索+ベクトル検索)
                │
                └── Custom Tools (UDF / Stored Procedure)
                      └── format_slack_message() 等
```

## 事前準備（20分）

### Step 0-1: Cortex Analyst のセマンティックモデル

パターンAで作成済みの場合はスキップ。未作成の場合:

```yaml
# semantic_model.yaml — Stageにアップロード
name: focus_you_model
tables:
  - name: diary_entries
    base_table: FOCUS_YOU.RAW.DIARY_ENTRIES
    columns:
      - name: entry_date
        description: 日記の日付
        data_type: DATE
      - name: entry_text
        description: 日記の本文テキスト
        data_type: VARCHAR
      - name: mood_score
        description: 気分スコア（1=最悪、10=最高）
        data_type: INT
  - name: emotion_analysis
    base_table: FOCUS_YOU.RAW.EMOTION_ANALYSIS
    columns:
      - name: entry_date
        description: 分析対象の日付
        data_type: DATE
      - name: joy
        description: 喜びスコア（0.0-1.0）
        data_type: FLOAT
      - name: sadness
        description: 悲しみスコア（0.0-1.0）
        data_type: FLOAT
      - name: anger
        description: 怒りスコア（0.0-1.0）
        data_type: FLOAT
      - name: fear
        description: 恐れスコア（0.0-1.0）
        data_type: FLOAT
      - name: surprise
        description: 驚きスコア（0.0-1.0）
        data_type: FLOAT
      - name: primary_emotion
        description: 主要感情ラベル
        data_type: VARCHAR
  - name: calendar_events
    base_table: FOCUS_YOU.RAW.CALENDAR_EVENTS
    columns:
      - name: event_date
        description: イベントの日付
        data_type: DATE
      - name: event_title
        description: イベント名
        data_type: VARCHAR
      - name: category
        description: カテゴリ（work/social/health/personal）
        data_type: VARCHAR
```

```sql
-- Stageにアップロード
PUT file:///path/to/semantic_model.yaml @FOCUS_YOU.RAW.MODELS;
```

### Step 0-2: Cortex Search Service の作成

パターンBで作成済みの場合はスキップ:

```sql
CREATE OR REPLACE CORTEX SEARCH SERVICE diary_search
  ON entry_text
  ATTRIBUTES entry_date, mood_score
  WAREHOUSE = COMPUTE_WH
  TARGET_LAG = '1 hour'
  AS (
    SELECT entry_date, entry_text, mood_score
    FROM FOCUS_YOU.RAW.DIARY_ENTRIES
  );
```

### Step 0-3: カスタムツール用 UDF

```sql
-- Slack風メッセージフォーマッター
CREATE OR REPLACE FUNCTION format_slack_message(
    highlights ARRAY,
    period VARCHAR
)
RETURNS VARCHAR
LANGUAGE PYTHON
RUNTIME_VERSION = '3.11'
HANDLER = 'format_message'
AS $$
def format_message(highlights: list, period: str) -> str:
    lines = [f":star: *{period} のハイライト*\n"]
    for i, h in enumerate(highlights, 1):
        lines.append(f"{i}. {h}")
    lines.append(f"\n:chart_with_upwards_trend: 計 {len(highlights)} 件のハイライト")
    return '\n'.join(lines)
$$;

-- テスト
SELECT format_slack_message(
    ARRAY_CONSTRUCT('朝ランで気分リセット (mood: 8)', '難問が解けた (mood: 8)'),
    '今週'
);
```

## ハンズオン Step 1: Cortex Agent の作成（15分）

### 1-1. Agent を作成

```sql
CREATE OR REPLACE CORTEX AGENT focus_you_agent
  USING (
    -- ツール1: Cortex Analyst (構造化データへのSQL)
    CORTEX_ANALYST(
      SEMANTIC_MODEL => '@FOCUS_YOU.RAW.MODELS/semantic_model.yaml'
    ),
    -- ツール2: Cortex Search (非構造化データへのRAG)
    CORTEX_SEARCH(
      SEARCH_SERVICE => 'FOCUS_YOU.RAW.DIARY_SEARCH'
    ),
    -- ツール3: カスタムUDF
    TOOL(
      FUNCTION => 'FOCUS_YOU.RAW.FORMAT_SLACK_MESSAGE',
      DESCRIPTION => 'ハイライトをSlack風のメッセージにフォーマットする'
    )
  )
  COMMENT = 'focus-you日記データに関する質問に答えるAgent';
```

### 1-2. Agent への問いかけ（REST API）

```python
# Python SDK で Agent を呼ぶ
import snowflake.connector
from snowflake.core import Root

conn = snowflake.connector.connect(
    account='YOUR_ACCOUNT',
    user='YOUR_USER',
    password='YOUR_PASSWORD',
    database='FOCUS_YOU',
    schema='RAW'
)

root = Root(conn)

# Agent にメッセージを送る
response = root.databases["FOCUS_YOU"].schemas["RAW"].cortex_agents["FOCUS_YOU_AGENT"].send_message(
    messages=[{
        "role": "user",
        "content": "今週のハイライトをSlack風にまとめて"
    }]
)

print(response.content)
```

### 1-3. cURL での呼び出し

```bash
curl -X POST \
  "https://<account>.snowflakecomputing.com/api/v2/cortex/agents/FOCUS_YOU.RAW.FOCUS_YOU_AGENT:run" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "今週のハイライトをSlack風にまとめて"}
    ],
    "stream": false
  }'
```

## ハンズオン Step 2: ツールルーティングの観察（15分）

### 2-1. 構造化データへの問い → Analyst が選ばれる

```
問い: 「3月で mood_score が一番高かった日はいつ？」
→ Agent は Cortex Analyst を選択
→ SQL: SELECT entry_date, mood_score FROM diary_entries 
        WHERE mood_score = (SELECT MAX(mood_score) FROM diary_entries)
→ 回答: 3月8日と3月28日 (mood_score: 9)
```

### 2-2. テキスト検索 → Search が選ばれる

```
問い: 「運動した日の日記を探して」
→ Agent は Cortex Search を選択
→ entry_text に「ラン」「運動」「汗」を含む日記をベクトル検索
→ 回答: 3月4日「朝のランで気分がリセットされた」、3月21日「運動して汗をかいた」
```

### 2-3. 複合タスク → 両方のツールが使われる

```
問い: 「mood_score が 8 以上の日に何をしてたか、カレンダーの予定と合わせて教えて」
→ Agent は Cortex Analyst で diary_entries と calendar_events を JOIN
→ 必要に応じて Cortex Search でテキスト検索も補完
→ 回答: mood_score 8以上の日は10日間あり、social カテゴリのイベントがある日が多い
```

### 2-4. 曖昧な問い → Agent の対応を観察

```
問い: 「最近ちょっと疲れてる感じなんだけど」
→ Agent はどう反応するか？
  パターン1: 「最近」の定義を確認するclarification
  パターン2: 直近7日で mood_score が低い日を検索して提示
  パターン3: Cortex Search で「疲れ」「消耗」に類似する日記を検索
```

## ハンズオン Step 3: カスタムツールの活用（10分）

```python
# Slack風フォーマットの指示
response = root.databases["FOCUS_YOU"].schemas["RAW"].cortex_agents["FOCUS_YOU_AGENT"].send_message(
    messages=[{
        "role": "user",
        "content": "今週 mood_score が 7 以上の日をハイライトとして、Slack風メッセージにして"
    }]
)

# Agent が:
# 1. Cortex Analyst で mood_score >= 7 の日を検索
# 2. format_slack_message UDF を呼んでフォーマット
# 3. 結果を返す
print(response.content)
```

期待される出力:
```
:star: *今週 のハイライト*

1. 3/27 金曜。達成感のある週だった。 (mood: 8)
2. 3/28 土曜。家族と外食。美味しかった。 (mood: 9)
3. 3/30 月曜。朝会で前向きになれた。 (mood: 7)

:chart_with_upwards_trend: 計 3 件のハイライト
```

## ハンズオン Step 4: 会話の継続とメモリ（10分）

```python
# マルチターン会話
conversation = []

# ターン1
conversation.append({"role": "user", "content": "3月で一番つらかった週はいつ？"})
r1 = agent.send_message(messages=conversation)
conversation.append({"role": "assistant", "content": r1.content})
print("ターン1:", r1.content)

# ターン2（前のターンの文脈を引き継ぐ）
conversation.append({"role": "user", "content": "その週に何があったか、カレンダーの予定と合わせて教えて"})
r2 = agent.send_message(messages=conversation)
print("ターン2:", r2.content)

# ターン3
conversation.append({"role": "assistant", "content": r2.content})
conversation.append({"role": "user", "content": "励ましのメッセージを書いて"})
r3 = agent.send_message(messages=conversation)
print("ターン3:", r3.content)
```

## 2026年の新機能: Brave Search API 統合

```sql
-- Brave Search をツールとして追加（Public Preview）
CREATE OR REPLACE CORTEX AGENT focus_you_agent_v2
  USING (
    CORTEX_ANALYST(SEMANTIC_MODEL => '@FOCUS_YOU.RAW.MODELS/semantic_model.yaml'),
    CORTEX_SEARCH(SEARCH_SERVICE => 'FOCUS_YOU.RAW.DIARY_SEARCH'),
    TOOL(FUNCTION => 'FOCUS_YOU.RAW.FORMAT_SLACK_MESSAGE'),
    BRAVE_SEARCH()  -- ウェブ検索
  );
```

「ストレス解消に効果的な方法を調べて、今週の日記データと合わせてアドバイスして」のような質問に、内部データ+ウェブ知識で回答できる。

出典: https://www.snowflake.com/en/blog/intelligent-governed-ai-at-scale/ (2026-04-15参照)

## まとめ: Snowflake Cortex Agents の手触り

**良い点**:
- **ツール統合が最もシンプル**: CREATE CORTEX AGENT 一文で Analyst + Search + UDF を統合できる
- **自動ルーティング**: 構造化/非構造化を Agent が判断。ユーザーは意識不要
- **SQLスキルの資産化**: パターンA/Bで作ったSemantic Model と Search Service がそのまま Agent のツールになる
- **Brave Search統合**: 内部データ+ウェブ知識の組み合わせが簡潔

**気になる点**:
- **カスタムオーケストレーションの限界**: ReAct / Plan-and-Execute の切り替えや、ツール選択ロジックのカスタマイズはできない。Snowflakeが管理するブラックボックス
- **評価フレームワークなし**: Agent の回答品質を体系的に測定する仕組みがない。Databricksの Agent Evaluation に相当するものがない
- **デバッグの難しさ**: Agent がなぜそのツールを選んだかの推論過程は、レスポンスの thinking steps として見えるが、体系的なトレーシングは限定的

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Cortex Agents: Analyst + Search + UDF を統合オーケストレーション（https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents）
- Agent はツール選択→実行→評価→応答のループを自動管理（https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-manage）
- Brave Search API 統合でウェブ検索をツールとして追加可能（Public Preview）（https://www.snowflake.com/en/blog/intelligent-governed-ai-at-scale/）
- Getting Started ガイド（https://www.snowflake.com/en/developers/guides/getting-started-with-cortex-agents/）

### 2. 限界の明示

- **オーケストレーションのカスタマイズ**: ツール選択ロジックはSnowflake管理。「このタイプの質問は必ずAnalystを使う」のような明示的ルール設定はできない
- **評価**: Agent の回答品質を定量的に測るフレームワークがない。手動でのスポットチェックが必要
- **UDFの制約**: Python UDFは Snowpark Runtime の制約を受ける。外部API呼び出しはネットワーク制限に注意
- **コスト**: Agent は複数回LLMを呼ぶため、パターンA/Bより確実にコストが高い。事前の見積もりが難しい

### 3. 壁打ちモードへの導線

1. **「Cortex Agent と Streamlit + Cortex Analyst の直呼び、どちらがいいか？」** — Agent の自動ルーティングが不要なら、Analyst直呼びのほうがシンプルでコスト安
2. **「UDF でどんなカスタムツールを追加すると価値があるか？」** — Slack通知、メール下書き、PDFレポート生成など。ツールの粒度設計
3. **「Cortex Agent を社内で展開するとき、権限設計はどうなるか？」** — Semantic Model で見せるテーブル/カラムを制限。RBAC + RLS の組み合わせ
