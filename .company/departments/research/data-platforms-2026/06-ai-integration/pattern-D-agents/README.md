# パターン D: AI Agent — Tool Use で計画・実行・応答

> **ゴール**: 「今週のハイライトを Slack 風にまとめて」のような複合タスクを、Agent が自律的に計画→ツール実行→応答する流れを3基盤で体験する。

## このパターンの肝

パターンA-Cは「人がSQLを書いてLLMに渡す」構造だった。パターンDは逆で、**LLMが自分でSQLを書いてデータを取り、加工して返す**。人はゴールだけ伝える。

2025年に「Agent」という言葉がバズワード化したが、2026年に入って各基盤が **プロダクショングレードのAgent基盤** を整備し始めた。共通するアーキテクチャは:

1. **Orchestrator（LLM）**: ユーザーの意図を理解し、計画を立てる
2. **Tools（道具）**: SQL実行、RAG検索、API呼び出しなど、Agent が使える機能
3. **Memory（記憶）**: 会話履歴、過去の結果をコンテキストに保持
4. **Guardrails（安全弁）**: 権限境界、コスト上限、承認フロー

3基盤はいずれもこの4要素を実装しているが、**「ツールの粒度」と「オーケストレーション方式」が大きく異なる**。

## Agent のアーキテクチャパターン

### ReAct (Reasoning + Acting)

最もシンプル。LLMが「考える→行動する→観察する→考える→...」のループを繰り返す。

```
ユーザー: 今週のハイライトを教えて
→ LLM (Think): 今週の日記を取得する必要がある
→ Tool (Act): SQL実行: SELECT * FROM diary_entries WHERE entry_date >= '2026-03-24'
→ LLM (Observe): 7件の日記が返ってきた。mood_score が高い日を特定する
→ Tool (Act): mood_score でソート
→ LLM (Think): 上位3件をハイライトとしてまとめる
→ 応答: 今週のハイライトは...
```

### Plan-and-Execute

最初に計画全体を立ててから実行する。複雑なタスクに向く。

```
ユーザー: 今週のハイライトをSlack風にまとめて
→ LLM (Plan):
  1. 今週の日記を取得
  2. 感情分析結果を取得  
  3. カレンダーイベントを取得
  4. mood_scoreが高い日を特定
  5. Slack風のフォーマットで整形
→ Execute: ステップ1→2→3→4→5を順次実行
→ 応答: :star: *今週のハイライト* ...
```

### 3基盤の Agent アーキテクチャ比較

| 軸 | Snowflake Cortex Agents | Databricks Agent Framework | Fabric Data Agent |
|---|---|---|---|
| **オーケストレーション** | Snowflake管理。Analyst+Search+UDF を自動ルーティング | LangGraph/PyFunc/OpenAI で自由に構築 | Copilot Studio で視覚的に構築 |
| **ツール** | Cortex Analyst (Text-to-SQL), Cortex Search (RAG), UDF, Stored Procedures | Unity Catalog Tools, Vector Search, SQL Warehouse, 外部API, MCP | Power BI Semantic Model, Lakehouse, OneLake, 外部コネクタ |
| **メモリ** | 会話履歴（セッション管理） | LangGraph State, MLflow Trace | Copilot Studio のSession State |
| **評価** | - | Agent Evaluation (LLM-as-judge, MLflow) | - |
| **デプロイ** | REST API (Cortex Agent API) | Model Serving + Databricks Apps | Copilot Studio + Teams/M365 |
| **カスタマイズ度** | 低〜中（ツール追加で拡張） | 高（フレームワーク自由） | 低（GUI中心、コード少なめ） |
| **一番の強み** | Snowflake内データへの統合アクセスが最も簡潔 | LangGraph統合で自由度最大。評価基盤がある | M365/Teams/Power BI への配信が最短 |
| **一番の弱み** | カスタムロジックの自由度が低い | 学習コストが高い | 高度なオーケストレーションは難しい |

出典:
- Snowflake: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents (2026-04-15参照)
- Databricks: https://docs.databricks.com/aws/en/generative-ai/agent-framework/author-agent (2026-04-15参照)
- Fabric: https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent (2026-04-15参照)

## focus-you で試すシナリオ（3基盤共通）

### シナリオ1: 複合データ検索
「今週 mood_score が一番高かった日は何をしてた？カレンダーの予定も教えて」
→ diary_entries + calendar_events の JOIN が必要。Agent が自分で SQL を組み立てるか？

### シナリオ2: 分析+生成
「3月で一番つらかった週を特定して、励ましのメッセージを書いて」
→ 集計 + テキスト生成の組み合わせ。Agent がどの順序でツールを使うか？

### シナリオ3: 構造化出力
「今週のハイライトを Slack の Block Kit JSON で出して」
→ データ取得+フォーマット変換。構造化出力をAgent が正確に生成できるか？

### シナリオ4: 曖昧な指示への対応
「最近ちょっと元気ないんだけど、何かいい方法ない？」
→ 「最近」の定義が曖昧。Agent が clarification を求めるか、推測で動くか？

## 設計論点（プロダクション目線）

### ツール権限

Agent がSQLを自由に実行できるのは強力だが危険。SELECT のみに制限するか、特定テーブルのみアクセス可能にするか。

- **Snowflake**: Cortex Analyst のセマンティックモデルで参照可能テーブルを制限。UDFは明示的に登録したものだけ
- **Databricks**: Unity Catalog の GRANT 体系でツールアクセスを制御。Model Serving のエンドポイント権限も別途
- **Fabric**: Fabric ワークスペースの RBAC。Copilot Studio の「Allowed Actions」で制限

### コスト制御

Agent は「考える→行動する」ループを何度も回す。1回の会話で 5-10回 LLM を呼ぶことがある。パターンCの「1行1回」とはコスト構造が根本的に違う。

- **ループ回数の上限**: max_steps / max_iterations を設定
- **モデル選択**: オーケストレーターは大モデル（GPT-4o）、ツール実行は小モデル（Haiku）で分ける
- **キャッシュ**: 同じ質問への回答をキャッシュして LLM 呼び出しを減らす

### 評価（Agent が正しく動いたかの判定）

Agent の出力品質を測るのは難しい。Databricks の Agent Evaluation が最も体系的:

1. **Request-level evaluation**: 各リクエストに対する回答の正確性
2. **Retrieval evaluation**: RAG検索の適合率・再現率
3. **Tool use evaluation**: 正しいツールを正しい引数で呼んだか
4. **LLM-as-judge**: 別のLLMが品質を5段階で評価

Snowflake/Fabric には同等の評価フレームワークがまだない（2026-04-15時点）。

### MCP (Model Context Protocol) 対応

2026年のAgent分野で最も注目されている標準。Databricks が先行して対応:

- **Databricks**: Agent Framework が MCP をネイティブサポート。外部ツール接続の標準プロトコル
- **Snowflake**: 2026年4月時点で公式MCP対応は未発表。Brave Search API 統合でウェブ検索は可能
- **Fabric**: Copilot Studio が独自のコネクタ体系。MCP対応は進行中

出典: https://www.databricks.com/product/machine-learning/retrieval-augmented-generation (2026-04-15参照)

## ハンズオン手順（概要）

| 基盤 | ファイル | 所要時間 |
|------|---------|---------|
| Snowflake | `snowflake-cortex-agents.md` | 70分 |
| Databricks | `databricks-agent-framework.md` | 70分 |
| Fabric | `fabric-data-agent.md` | 60分 |

推奨順: Snowflake（最もシンプル、ツール統合の自動ルーティングを体験）→ Databricks（LangGraph で自由度を体験、評価も試す）→ Fabric（Copilot Studio の視覚的構築を体験）

## 教材化メモ

- **5分ミニ教材候補**: 「Agent = ループ。ReAct を手で1回トレースする」 — Agent の神秘を剥がす
- **躓きポイント**: Agent が無限ループに入る（max_steps未設定）、権限エラーでツール実行失敗（事前にGRANT確認）
- **驚きポイント**: 「今週のハイライトを教えて」だけで3テーブルをJOINしてSlack風テキストが返ってくる瞬間

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Snowflake Cortex Agents: Analyst + Search + UDF を統合オーケストレーション。Brave Search API統合でウェブ検索も可能（https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents）
- Databricks Agent Framework: LangGraph/PyFunc/OpenAI 互換。MCP対応。Agent Evaluation で品質測定（https://docs.databricks.com/aws/en/generative-ai/agent-framework/author-agent）
- Fabric Data Agent + Copilot Studio: マルチエージェントオーケストレーション。A2A プロトコル対応（2026年4月GA予定）（https://blog.fabric.microsoft.com/en-us/blog/fabric-data-agents-microsoft-copilot-studio-a-new-era-of-multi-agent-orchestration）
- Copilot Studio: Fabric reasoning でエンタープライズデータへの直接アクセス（https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/new-and-improved-multi-agent-orchestration-connected-experiences-and-faster-prompt-iteration/）

### 2. 限界の明示

- **評価フレームワーク**: Databricks のみ体系的な Agent Evaluation を持つ。Snowflake/Fabric での品質測定は自前構築が必要
- **コスト予測の難しさ**: Agent はループ回数が可変のため、1会話あたりのコストが予測しにくい。30行のデータでも、質問の複雑さでコストが10倍変わりうる
- **MCP対応状況**: Databricks が先行。Snowflake/Fabric は2026年中の対応が見込まれるが、時期は未確定
- **マルチテナント**: 複数ユーザーが同時にAgent を使う場合の権限分離・リソース分離は、3基盤とも実装途上

### 3. 壁打ちモードへの導線

1. **「Agent をクライアントに提案するとき、最初に確認すべきことは？」** — ユースケースの複雑度。単純なQ&AならText-to-SQL（パターンA）で十分
2. **「Agent のコストをクライアントにどう説明するか？」** — 「1会話あたりXX円」ではなく「月間XX会話でYY円」の積み上げ
3. **「LangGraph を自分で触る必要があるか？」** — Snowflake/Fabric は抽象化が進んでいるが、カスタマイズ要件が出た瞬間にDatabricks+LangGraphが必要になる
4. **「Agent の失敗ケースを3つ挙げられるか？」** — 無限ループ・権限エラー・幻覚。これを事前に説明できるとクライアント信頼度が上がる
5. **「focus-youのユースケースでAgent が本当に必要か？」** — パターンA-Cの組み合わせで十分な可能性も。Agentの過剰適用を自覚する
