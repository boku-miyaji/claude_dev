# Microsoft Fabric Data Agent + Copilot Studio — AI Agent ハンズオン

> **所要時間**: 60分 / **前提**: Fabric ワークスペース（Trial可）、Power BI Semantic Model の基本理解 / **ゴール**: Fabric Data Agent を作成し、Copilot Studio と連携して「今週のハイライト」を対話的に引き出す

## Fabric Data Agent とは何か

Fabric Data Agent は Microsoft Fabric のデータに対して自然言語で問いかけられるエージェント。Copilot Studio と連携することで、Teams / Microsoft 365 / Power BI 内から直接呼び出せる。

Snowflake Cortex Agents と似た「マネージドAgent」だが、最大の違いは **Copilot Studio との統合** と **マルチエージェントオーケストレーション**。2026年4月にA2A (Agent-to-Agent) プロトコル対応がGAし、複数のAgent を組み合わせた複合タスクが可能になった。

公式ドキュメント:
- Data Agent 概要: https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent (2026-04-15参照)
- Copilot Studio 連携: https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-copilot-studio (2026-04-15参照)
- マルチエージェント: https://blog.fabric.microsoft.com/en-us/blog/fabric-data-agents-microsoft-copilot-studio-a-new-era-of-multi-agent-orchestration (2026-04-15参照)

## アーキテクチャ

```
ユーザー ──→ Teams / M365 / Power BI
                │
                └── Copilot Studio
                      │
                      ├── Fabric Data Agent (focus-you)
                      │     ├── Lakehouse (diary_entries, emotion_analysis, calendar_events)
                      │     ├── Power BI Semantic Model
                      │     └── AI Skills (カスタムロジック)
                      │
                      └── 他のエージェント（A2A プロトコル）
                            ├── SharePoint Agent
                            └── カスタムAgent
```

## ハンズオン Step 1: Data Agent の作成（20分）

### 1-1. Fabric ワークスペースで Data Agent を作成

1. Fabric ワークスペースを開く
2. 「+ New」→「Data Agent (Preview)」を選択
3. 名前: `focus-you-diary-agent`

### 1-2. データソースの接続

Data Agent の設定画面で、利用するデータソースを選択:

```
データソース:
  - Lakehouse: focus_you_lakehouse
    テーブル:
      - diary_entries (entry_date, entry_text, mood_score)
      - emotion_analysis (entry_date, joy, sadness, anger, fear, surprise, primary_emotion)
      - calendar_events (event_date, event_title, category)
```

### 1-3. 指示の設定

Data Agent の「Instructions」セクション:

```
あなたは focus-you 日記アプリのデータアシスタントです。

利用可能なテーブル:
- diary_entries: 日記のテキストと気分スコア（1-10）
- emotion_analysis: 各日の感情スコア（joy, sadness, anger, fear, surprise）
- calendar_events: カレンダーの予定（work, social, health, personal）

回答のルール:
1. 日本語で回答する
2. データに基づいて回答する。推測は「推測:」と明示する
3. mood_score の解釈: 1-3=低調, 4-6=普通, 7-10=好調
4. 「ストレス」は sadness + anger + fear の合計で計算する
5. 曖昧な質問には確認を返す（例: 「最近」→ 何日間か聞く）
```

### 1-4. テスト（Agent 設定画面内）

設定画面の右ペインにテストチャットがある:

```
ユーザー: 3月で mood_score が一番高かった日は？
Agent: diary_entries を検索... 3月8日(日曜、家族と公園)と3月28日(土曜、家族と外食)が
       mood_score 9 で最高でした。どちらも家族との時間です。

ユーザー: その日のカレンダーの予定は？
Agent: calendar_events を検索... 
       3月8日: family_park (personal)
       3月28日: family_dinner (social)
```

## ハンズオン Step 2: AI Skills の追加（15分）

AI Skills は Data Agent のカスタムロジック。Notebook で Python 関数として定義し、Agent のツールとして登録する。

### 2-1. AI Skill の作成

Fabric Notebook で:

```python
# AI Skill: 週間ハイライトの生成
def generate_weekly_highlights(week_start: str) -> str:
    """指定した週のハイライトをSlack風フォーマットで生成する"""
    import fabric.functions as ai
    import pandas as pd
    
    # データ取得
    df = spark.sql(f"""
        SELECT d.entry_date, d.entry_text, d.mood_score, 
               e.primary_emotion, c.event_title, c.category
        FROM lakehouse.diary_entries d
        LEFT JOIN lakehouse.emotion_analysis e ON d.entry_date = e.entry_date
        LEFT JOIN lakehouse.calendar_events c ON d.entry_date = c.event_date
        WHERE d.entry_date >= '{week_start}' 
          AND d.entry_date < DATE_ADD('{week_start}', 7)
        ORDER BY d.mood_score DESC
    """).toPandas()
    
    if len(df) == 0:
        return "該当する週のデータがありません。"
    
    # ハイライト（mood_score 7以上）
    highlights = df[df['mood_score'] >= 7]
    
    lines = [f":star: *{week_start} 週のハイライト*\n"]
    for _, row in highlights.iterrows():
        emoji = ":blush:" if row['primary_emotion'] == 'joy' else ":thinking_face:"
        lines.append(f"  {emoji} {row['entry_date']}: {row['entry_text']} (mood: {row['mood_score']})")
    
    # 全体サマリ
    avg_mood = df['mood_score'].mean()
    lines.append(f"\n:bar_chart: 週平均 mood: {avg_mood:.1f}")
    
    return '\n'.join(lines)
```

### 2-2. AI Skill を Data Agent に登録

Fabric UI で:
1. Data Agent の設定画面 → 「AI Skills」タブ
2. 「Add AI Skill」→ 上で作成した Notebook の関数を選択
3. Description: 「指定した週のハイライトをSlack風フォーマットで生成する」

### 2-3. AI Skill の動作確認

```
ユーザー: 3月24日の週のハイライトをSlack風で教えて
Agent: generate_weekly_highlights を呼び出し...

:star: *2026-03-24 週のハイライト*

  :thinking_face: 2026-03-26: 難問が解けた。気持ちがスッと軽くなった。 (mood: 8)
  :blush: 2026-03-27: 金曜。達成感のある週だった。 (mood: 8)
  :blush: 2026-03-28: 土曜。家族と外食。美味しかった。 (mood: 9)

:bar_chart: 週平均 mood: 6.3
```

## ハンズオン Step 3: Copilot Studio との連携（15分）

### 3-1. Copilot Studio でカスタム Agent を作成

1. https://copilotstudio.microsoft.com にアクセス
2. 「Create」→ 「Agent」
3. Agent 名: `focus-you-copilot`
4. 「Connected agents」→ 「Add Fabric Data Agent」
5. 先ほど作成した `focus-you-diary-agent` を選択

### 3-2. 会話フローの設定

Copilot Studio の視覚的エディタで:

```
[トリガー: "ハイライト" を含む発話]
  │
  ├── [条件分岐: 期間の指定があるか]
  │     ├── Yes → Fabric Data Agent に転送
  │     └── No → 「いつの期間のハイライトですか？」と確認
  │
  └── [Fabric Data Agent からの応答を整形]
        └── [Teams / M365 に返す]
```

### 3-3. Teams での動作確認

Copilot Studio で「Publish」→ 「Teams」を選択すると、Teams チャット内で Agent が使えるようになる:

```
[Teams チャット]
ユーザー: @focus-you-copilot 今週のハイライトを教えて
Agent: :star: 今週のハイライト...
```

## ハンズオン Step 4: マルチエージェントオーケストレーション（10分）

2026年4月にGAしたA2A (Agent-to-Agent) プロトコルで、複数のAgent を組み合わせる:

### 4-1. 概念

```
ユーザー: 「今週のハイライトをまとめて、チームのSlackに共有して」
  │
  └── Copilot Studio (Orchestrator)
        ├── focus-you Data Agent → 今週のハイライトを取得
        └── Slack Agent → ハイライトを Slack に投稿
```

### 4-2. 設定

Copilot Studio の「Connected agents」で複数のAgent を登録:

```yaml
# Copilot Studio の設定概念
connected_agents:
  - name: focus-you-diary-agent
    type: fabric-data-agent
    capabilities: ["日記データの検索", "感情分析", "ハイライト生成"]
  - name: slack-notification-agent
    type: custom-agent
    capabilities: ["Slackメッセージ送信", "チャンネル選択"]
```

Copilot Studio のOrchestrator が、ユーザーの意図に応じて適切なAgent にルーティングする。

出典: https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/new-and-improved-multi-agent-orchestration-connected-experiences-and-faster-prompt-iteration/ (2026-04-15参照)

## Fabric Reasoning

Copilot Studio の「Fabric reasoning」機能により、Copilot Agent が Fabric のデータレイク・DWH・リアルタイム分析に直接アクセスして推論できる:

```
ユーザー: 「今月の気分の傾向を、先月と比較して教えて」
→ Copilot が Fabric Lakehouse に直接SQLを発行
→ 2ヶ月分のデータを集計・比較
→ 自然言語で傾向を説明
```

これは Data Agent とは別の機能で、Copilot Studio のAgent が Fabric のデータを直接参照する仕組み。Data Agent を経由せずにデータにアクセスできるため、シンプルなデータ参照にはこちらが適している。

## まとめ: Fabric Data Agent + Copilot Studio の手触り

**良い点**:
- **M365 統合が最短**: Teams / Outlook / Power BI 内から直接 Agent を呼べる。エンドユーザーへの展開が最も速い
- **ノーコード/ローコード**: Copilot Studio の視覚的エディタで会話フローを構築。開発者でなくても設定できる
- **マルチエージェント**: A2A プロトコルで複数Agent を組み合わせる設計が標準装備
- **Fabric Reasoning**: データへの直接アクセスが Copilot に組み込まれている
- **既存M365資産の活用**: SharePoint、OneDrive のドキュメントも Agent のコンテキストに含められる

**気になる点**:
- **カスタムロジックの制約**: AI Skills でPythonは書けるが、LangGraph のような自由なオーケストレーションは難しい
- **評価フレームワークなし**: Databricks の Agent Evaluation に相当するものがない。品質測定は手動
- **Preview機能が多い**: Data Agent 自体がまだ Preview（2026-04-15時点）。プロダクション利用にはリスク
- **デバッグ**: Agent の推論過程の可視化が限定的。Databricks の MLflow Trace ほど詳細ではない

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Fabric Data Agent: Lakehouse / Power BI Semantic Model に対する自然言語エージェント（https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent）
- Copilot Studio 連携: Data Agent を connected agent として Copilot Studio に統合（https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-copilot-studio）
- マルチエージェントオーケストレーション: A2A プロトコル対応。2026年4月GA予定（https://blog.fabric.microsoft.com/en-us/blog/fabric-data-agents-microsoft-copilot-studio-a-new-era-of-multi-agent-orchestration）
- Fabric Reasoning: Copilot Agent から Fabric データへの直接アクセス（https://windowsnews.ai/article/microsoft-copilot-studio-update-adds-multi-agent-orchestration-fabric-reasoning-a2a-capabilities.412324）
- Skills for Fabric: MCP対応のAgent Skills（GitHub公開）（https://github.com/microsoft/skills-for-fabric）

### 2. 限界の明示

- **Preview状態**: Data Agent 自体がPreview。GA時期は未発表。プロダクション利用にはリスクがある
- **AI Skills の成熟度**: カスタムロジックの追加は可能だが、Databricks Agent Framework ほどの柔軟性はない
- **評価手段**: Agent の品質を定量評価する仕組みがない。手動テストに依存
- **日本語品質**: Copilot Studio の日本語対応は進んでいるが、Agent のルーティング精度が英語に比べてどうかは未検証
- **ライセンス**: Copilot Studio は別途ライセンスが必要（Fabric ライセンスに含まれない）

### 3. 壁打ちモードへの導線

1. **「M365ベースの組織にAgent を提案するとき、Fabric Data Agent が最適解か？」** — 既存のM365投資を活かせるか。Teams展開の速度はクライアントにとって大きな価値
2. **「Copilot Studio のノーコード設定は、誰が保守するのか？」** — IT部門 vs 業務部門。保守責任の設計が重要
3. **「マルチエージェントのユースケースを具体的に3つ挙げられるか？」** — 日記分析Agent + スケジュールAgent + 通知Agent、など
4. **「Data Agent がPreviewであることのリスクをクライアントにどう説明するか？」** — GA前に仕様変更の可能性。POCとしては使えるがプロダクションは慎重に
