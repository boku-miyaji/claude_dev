# Databricks Mosaic AI Agent Framework — AI Agent ハンズオン

> **所要時間**: 70分 / **前提**: Databricks ワークスペース（Trial可）、Unity Catalog の基本理解 / **ゴール**: LangGraph で Agent を構築し、Agent Evaluation で品質を測り、Model Serving にデプロイする

## Mosaic AI Agent Framework とは何か

Databricks の Agent Framework は「Agent を作る→評価する→デプロイする」の全サイクルをカバーするプラットフォーム。最大の特徴は **フレームワーク非依存**: LangGraph、LlamaIndex、PyFunc、OpenAI の任意のフレームワークで Agent を書き、Databricks の評価・デプロイ基盤に乗せられる。

Snowflake Cortex Agents が「Snowflakeが管理するブラックボックスAgent」なのに対し、Databricks は「Agent のロジックは自分で書く。基盤は評価とデプロイを提供する」という思想。自由度は最大だが学習コストも最大。

公式ドキュメント:
- Agent 構築: https://docs.databricks.com/aws/en/generative-ai/agent-framework/author-agent (2026-04-15参照)
- Agent Tools: https://docs.databricks.com/aws/en/generative-ai/agent-framework/agent-tool (2026-04-15参照)
- チュートリアル: https://docs.databricks.com/aws/en/generative-ai/tutorials/agent-framework-notebook (2026-04-15参照)

## アーキテクチャ

```
ユーザー ──→ Model Serving Endpoint (REST API)
                │
                └── Agent (LangGraph / PyFunc)
                      │
                      ├── Tool: SQL Warehouse (diary_entries, emotion_analysis, calendar_events)
                      ├── Tool: Vector Search (diary_search_index)
                      ├── Tool: Custom Function (format_slack_message)
                      └── Tool: External API (MCP対応)
                      
               MLflow Trace ──→ Agent Evaluation ──→ 品質レポート
```

## 事前準備

```python
# Notebook で必要なライブラリ
%pip install langgraph langchain-community databricks-agents mlflow>=3.0
```

## ハンズオン Step 1: LangGraph で Agent を構築（25分）

### 1-1. ツールの定義

```python
from langchain_community.tools.databricks import UCFunctionToolkit
from langchain_core.tools import tool
import json

# Unity Catalog のテーブルをSQLで問い合わせるツール
@tool
def query_diary(sql: str) -> str:
    """diary_entries, emotion_analysis, calendar_events テーブルに対してSQLを実行する。
    SELECT文のみ実行可能。"""
    try:
        result = spark.sql(sql).toPandas()
        return result.to_markdown()
    except Exception as e:
        return f"SQL実行エラー: {str(e)}"

# 感情分析結果を検索するツール
@tool  
def search_similar_entries(query: str, top_k: int = 5) -> str:
    """日記テキストからセマンティック検索を行い、類似する過去の日記を返す。"""
    from databricks.vector_search.client import VectorSearchClient
    
    vsc = VectorSearchClient()
    index = vsc.get_index(
        endpoint_name="diary_search_endpoint",
        index_name="focus_you.raw.diary_search_index"
    )
    results = index.similarity_search(
        query_text=query,
        columns=["entry_date", "entry_text", "mood_score"],
        num_results=top_k
    )
    return json.dumps(results['result']['data_array'], ensure_ascii=False, indent=2)

# Slack風フォーマッター
@tool
def format_slack_message(highlights: list, period: str) -> str:
    """ハイライトのリストをSlack風メッセージにフォーマットする。
    highlights: ハイライト文字列のリスト
    period: 対象期間（例: '今週', '3月'）"""
    lines = [f":star: *{period} のハイライト*\n"]
    for i, h in enumerate(highlights, 1):
        lines.append(f"{i}. {h}")
    lines.append(f"\n:chart_with_upwards_trend: 計 {len(highlights)} 件のハイライト")
    return '\n'.join(lines)

tools = [query_diary, search_similar_entries, format_slack_message]
```

### 1-2. LangGraph の State と Graph 定義

```python
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode
from langchain_community.chat_models import ChatDatabricks

# LLM: Databricks ホストモデル
llm = ChatDatabricks(
    endpoint="databricks-claude-3-5-haiku",
    temperature=0.0
)

# ツールバインド
llm_with_tools = llm.bind_tools(tools)

# ノード: LLM呼び出し
def call_model(state: MessagesState):
    system_prompt = """あなたは focus-you 日記アプリのデータアシスタントです。
    
    利用可能なテーブル:
    - diary_entries (entry_date DATE, entry_text STRING, mood_score INT)
    - emotion_analysis (entry_date DATE, joy FLOAT, sadness FLOAT, anger FLOAT, fear FLOAT, surprise FLOAT, primary_emotion STRING)
    - calendar_events (event_date DATE, event_title STRING, category STRING)
    
    ユーザーの質問に答えるために、適切なツールを選んで実行してください。
    日本語で回答してください。"""
    
    messages = [{"role": "system", "content": system_prompt}] + state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}

# ノード: ツール実行
tool_node = ToolNode(tools)

# 条件分岐: ツール呼び出しがあるか？
def should_continue(state: MessagesState):
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return END

# グラフ構築
workflow = StateGraph(MessagesState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)
workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")  # ツール実行後、またAgentに戻る

agent = workflow.compile()
```

### 1-3. Agent を試す

```python
# テスト1: 単純な質問
result = agent.invoke({
    "messages": [{"role": "user", "content": "3月で mood_score が一番高かった日はいつ？"}]
})
print(result["messages"][-1].content)

# テスト2: 複合タスク
result = agent.invoke({
    "messages": [{"role": "user", "content": "今週のハイライトをSlack風にまとめて"}]
})
print(result["messages"][-1].content)

# テスト3: 曖昧な質問
result = agent.invoke({
    "messages": [{"role": "user", "content": "最近ちょっと元気ない感じなんだけど"}]
})
print(result["messages"][-1].content)
```

## ハンズオン Step 2: Agent Evaluation（20分）

### 2-1. 評価データセットの作成

```python
import pandas as pd

eval_dataset = pd.DataFrame([
    {
        "request": "3月で mood_score が一番高かった日はいつ？",
        "expected_response": "3月8日と3月28日（mood_score: 9）",
        "expected_facts": ["3月8日", "3月28日", "mood_score", "9"],
    },
    {
        "request": "先週ストレスが高かった日は？",
        "expected_response": "ストレスが高い日（sadness + anger + fear が高い日）を特定",
        "expected_facts": ["sadness", "anger", "fear"],
    },
    {
        "request": "今週のハイライトをSlack風にまとめて",
        "expected_response": "Slack風フォーマットでハイライトを表示",
        "expected_facts": ["ハイライト", ":star:"],
    },
    {
        "request": "気分が良かった日に多かったカレンダーカテゴリは？",
        "expected_response": "mood_score が高い日のカレンダーカテゴリを集計",
        "expected_facts": ["social", "カテゴリ"],
    },
    {
        "request": "3月の全体的な気分の傾向を教えて",
        "expected_response": "mood_score の推移を分析し、傾向を説明",
        "expected_facts": ["傾向", "mood_score"],
    },
])
```

### 2-2. MLflow で Agent を評価

```python
import mlflow
from databricks.agents import evaluate as agent_evaluate

# MLflow Experiment にログ
with mlflow.start_run(run_name="focus-you-agent-eval-v1"):
    
    # Agent Evaluation 実行
    eval_results = agent_evaluate(
        model=agent,  # 上で作った LangGraph agent
        data=eval_dataset,
        model_type="databricks-agent",
    )
    
    # 結果の確認
    print("=== Evaluation Results ===")
    print(f"Overall score: {eval_results.metrics}")
    
    # 各リクエストの詳細
    for row in eval_results.tables["eval_results"].itertuples():
        print(f"\nRequest: {row.request}")
        print(f"Response: {row.response[:100]}...")
        print(f"Assessment: {row.assessment}")
```

### 2-3. LLM-as-Judge の仕組み

Agent Evaluation の内部では、別のLLM（Judge）が以下を評価する:

1. **Correctness**: 回答が期待される事実を含んでいるか
2. **Relevance**: 質問に対して適切な回答か
3. **Groundedness**: 回答がツールの出力に基づいているか（幻覚でないか）
4. **Safety**: 有害な内容を含んでいないか

```python
# カスタム Judge の設定も可能
from databricks.agents.evals import JudgeConfig

custom_judge = JudgeConfig(
    judge_model="databricks-claude-3-5-haiku",
    criteria={
        "japanese_quality": "回答が自然な日本語で書かれているか",
        "actionability": "回答がユーザーの次のアクションにつながるか"
    }
)
```

## ハンズオン Step 3: Model Serving にデプロイ（15分）

### 3-1. MLflow にモデルを登録

```python
import mlflow
from mlflow.models import infer_signature

# Agent をMLflowモデルとしてログ
with mlflow.start_run(run_name="focus-you-agent-v1"):
    # 入出力のシグネチャを推論
    input_example = {"messages": [{"role": "user", "content": "テスト"}]}
    
    mlflow.langchain.log_model(
        lc_model=agent,
        artifact_path="agent",
        input_example=input_example,
        registered_model_name="focus_you.models.diary_agent",
    )
```

### 3-2. Model Serving Endpoint の作成

```python
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import EndpointCoreConfigInput, ServedEntityInput

w = WorkspaceClient()

# サーバレスエンドポイント作成
w.serving_endpoints.create(
    name="focus-you-agent",
    config=EndpointCoreConfigInput(
        served_entities=[
            ServedEntityInput(
                entity_name="focus_you.models.diary_agent",
                entity_version="1",
                workload_size="Small",
                scale_to_zero_enabled=True,
            )
        ]
    )
)
```

### 3-3. デプロイ後の動作確認

```python
import requests

# REST API で Agent を呼ぶ
endpoint_url = f"https://{workspace_url}/serving-endpoints/focus-you-agent/invocations"

response = requests.post(
    endpoint_url,
    headers={"Authorization": f"Bearer {token}"},
    json={
        "messages": [
            {"role": "user", "content": "今週のハイライトを教えて"}
        ]
    }
)
print(response.json())
```

## MCP (Model Context Protocol) 対応

```python
# MCP ツールを Agent に追加
from databricks.agents.tools import MCPTool

# 外部サービスを MCP で接続
slack_tool = MCPTool(
    server_url="https://mcp-server.example.com/slack",
    tool_name="send_slack_message",
    description="Slackチャンネルにメッセージを送信する"
)

# 既存ツールに追加
tools_with_mcp = tools + [slack_tool]
```

出典: https://www.databricks.com/product/machine-learning/retrieval-augmented-generation (2026-04-15参照)

## MLflow Trace でのデバッグ

```python
# MLflow 3.0 の Trace でAgent の推論過程を可視化
mlflow.langchain.autolog()

# トレース付きで実行
with mlflow.start_span(name="agent-debug"):
    result = agent.invoke({
        "messages": [{"role": "user", "content": "今週のハイライトをSlack風にまとめて"}]
    })

# MLflow UIでトレースを確認:
# - 各ツール呼び出しのタイミング
# - LLM の入力/出力トークン
# - ツール実行の所要時間
# - エラーが発生したステップ
```

出典: https://docs.databricks.com/aws/en/mlflow3/genai/tracing/trace-unity-catalog (2026-04-15参照)

## まとめ: Databricks Agent Framework の手触り

**良い点**:
- **自由度最大**: LangGraph / PyFunc / OpenAI から好きなフレームワークを選べる
- **Agent Evaluation**: LLM-as-judge で品質を定量評価。これはSnowflake/Fabricにない
- **MLflow Trace**: Agent の推論過程を完全に可視化。デバッグが圧倒的に楽
- **MCP対応**: 外部ツール接続の標準プロトコルをネイティブサポート
- **Model Serving**: スケーラブルなサーバレスエンドポイントにワンステップでデプロイ

**気になる点**:
- **学習コスト**: LangGraph の概念（State, Node, Edge, Conditional Edge）を理解する必要がある
- **ボイラープレート**: Snowflake の CREATE CORTEX AGENT に比べてコード量が10倍以上
- **Community Edition不可**: Agent Framework は有料ワークスペースが必要
- **ツール定義の手間**: Unity Catalog Function としてツールを登録する手順が必要

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Mosaic AI Agent Framework: LangGraph / PyFunc / OpenAI 互換のAgent構築基盤（https://docs.databricks.com/aws/en/generative-ai/agent-framework/author-agent）
- Agent Evaluation: LLM-as-judge + ground truth で品質を定量評価（https://docs.databricks.com/aws/en/generative-ai/tutorials/agent-framework-notebook）
- MLflow 3.0 Trace: Agent の推論過程を Unity Catalog に保存・可視化（https://docs.databricks.com/aws/en/mlflow3/genai/tracing/trace-unity-catalog）
- MCP対応: 外部ツール接続の標準プロトコルをネイティブサポート（https://www.databricks.com/product/machine-learning/retrieval-augmented-generation）

### 2. 限界の明示

- **LangGraph の学習曲線**: Agent の概念に加え、LangGraph 固有の State / Graph の理解が必要。初見で1日は必要
- **評価データの質**: Agent Evaluation の精度は評価データセットの質に依存。good/bad のラベルを人間が用意する手間がある
- **コスト見積もり**: Agent は推論ループの回数が可変。1会話あたりのコストを事前に見積もるのが困難
- **Managed Agent Builders**: Supervisor Agent / Knowledge Assistant は managed だが、2026-04-15時点で日本語の品質は未検証

### 3. 壁打ちモードへの導線

1. **「LangGraph と Snowflake Cortex Agents、クライアントにどちらを勧めるか？」** — カスタマイズ要件の有無で判断。標準的なQ&AならSnowflake、独自ロジックがあるならDatabricks
2. **「Agent Evaluation を定期実行する運用は現実的か？」** — CI/CDパイプラインに組み込むことで、Agent の品質劣化を検知
3. **「MCP で何を接続すると価値があるか？」** — Slack、Jira、Google Calendar、社内Wiki など。focus-you なら LINE 連携が面白い
4. **「Agent のコストを月額XX万円に抑えるにはどう設計するか？」** — ループ上限、キャッシュ、小モデル活用の3つの軸
