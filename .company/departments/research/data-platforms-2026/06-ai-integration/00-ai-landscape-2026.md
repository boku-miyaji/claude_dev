# 00 データ基盤 × AI 界隈の動向サマリ（2026年4月時点）

> 社長がクライアントの前で「最近の潮流は〜」と語れるようにするための地図。各節の主張は公開情報ベース、URLを併記。

---

## 2026年に何が起きているか（一文でまとめると）

**「データ基盤の中で LLM を呼ぶのが当たり前になった年」**。2023-2024年は基盤とLLMは別物で、アプリ層で接続していた。2025年にSQL関数化が本格化し、2026年は **評価と観測性とコスト管理** に焦点が移っている。

---

## 論点1: Lakehouse 統合が "終わった" 年

2024年まで「DWH派 vs Lakehouse派」という対立軸があった。2026年時点でこの議論は実質終了している:

- **Snowflake**: Apache Iceberg を正式サポートし、外部テーブルとネイティブに変わらない性能で扱える。`ICEBERG TABLE` 構文で Lakehouse 資産をそのまま読める
- **Databricks**: Delta Lake の `UniForm` で Iceberg フォーマットとの相互運用を提供し、他ツールから Delta テーブルが Iceberg として見える
- **Fabric**: OneLake の基盤ストレージは Delta Parquet 一本化。Warehouse も Lakehouse も同じストレージを参照する構造

結果として「Lakehouseか否か」はもはや買い物基準にならず、**AI統合の深さ・ガバナンスの粒度・エコシステム適合性** が選定軸になった。

## 論点2: AI関数のSQL統合が標準化

2024年後半～2026年にかけて、3基盤すべてが「SQLから直接LLMを呼ぶ関数」を提供し、シグネチャがほぼ同じ形で揃った:

| 基盤 | 関数 | ドキュメント |
|---|---|---|
| Snowflake | `AI_COMPLETE()`, `AI_CLASSIFY()`, `AI_EXTRACT()`, `AI_AGG()`, `AI_SENTIMENT()`, `AI_EMBED()` | [Snowflake Cortex AISQL](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql) (2026-04-15) |
| Databricks | `ai_query()`, `ai_classify()`, `ai_gen()`, `ai_summarize()`, `ai_extract()`, `ai_similarity()` | [Mosaic AI capabilities](https://docs.databricks.com/aws/en/generative-ai/guide/mosaic-ai-gen-ai-capabilities) (2026-04-15) |
| Fabric | `ai.generate_response()`, `ai.classify()`, `ai.analyze_sentiment()`, `ai.extract()`, `ai.embed()`, `ai.similarity()` | [Fabric AI Functions overview](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/overview) (2026-04-15) |

**共通する設計思想**: LLM呼び出しをビュー定義・マテビュー・COPY INTO に組み込めるようにし、ETLパイプラインの一行として扱える状態にした。この結果、「新着1000件をバッチ処理するのにアプリを書く」必要が消えた。

**隠れた含意**: データエンジニアが Python を書かずに RAG もバッチ推論も構築できるようになった。**AI統合の民主化** が本当に起きたのは2025年後半から。

## 論点3: 自然言語BI (Text-to-SQL) の3社共通課題

各社が自然言語 BI を出した:

- Snowflake → **Cortex Analyst** ([docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst), 2026-04-15)
- Databricks → **Genie Space** ([docs](https://docs.databricks.com/aws/en/genie/), 2026-04-15)
- Fabric → **Copilot in Power BI** / **Data Agent** ([docs](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent), 2026-04-15)

**共通課題**:

1. **幻覚（Hallucination）**: 存在しないカラム名・テーブル名を作って SQL を生成する事故がゼロにはならない。各社 Semantic Model（意味モデル）で列の意味を LLM に教える方式で対処
2. **権限境界**: ユーザーが本来見れないデータが、Text-to-SQL 経由で漏洩する事故。Row-Level Security と組み合わせる必要がある
3. **曖昧クエリ**: 「先週」の意味、タイムゾーン、NULL 扱い、集計粒度 — これらは人間でも割れる。LLM に勝手に決めさせないために "ask-back" を実装する基盤が出てきた（Genie の Thinking Steps、Cortex Analyst の clarification response）

**2026年に顕在化した解**: 「LLM に自由にSQL を書かせない。事前定義された Metrics / Measure の組み合わせから選ばせる」方向に各社が寄せている。

## 論点4: Agent Framework の年

2025年に各社「Agent」と呼び始めた機能がすべて出揃った:

- Snowflake **Cortex Agents**: Analyst / Search / ストアドプロシージャを tool として宣言し、Agent がそれらを呼ぶ ([docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents), 2026-04-15)
- Databricks **Mosaic AI Agent Framework**: Python + LangGraph でエージェントを作り、MLflow でトラッキング。UC Function を tool にできる ([docs](https://www.databricks.com/product/machine-learning/retrieval-augmented-generation), 2026-04-15)
- Fabric **Data Agent**: OneLake 上のデータに対する自然言語エージェント。Copilot Studio 経由で M365 全体から呼べる ([docs](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent), 2026-04-15)

**2026年のテーマ**: 作るのは簡単になった。課題は「**評価と観測性**」に移っている:

- Databricks が Quotient AI を買収し、Agent 評価を標準機能化
- Snowflake は `CORTEX_AGENT_USAGE_HISTORY` ビューで Agent 呼び出しを分解可視化 ([2026-02-25 GA](https://docs.snowflake.com/en/release-notes/2026/other/2026-02-25-cortex-agent-usage-history-view), 2026-04-15)
- Fabric は Copilot Studio 経由で Agent の会話ログを横断取得

**コンサル文脈の重要ポイント**: 「Agent を作ってください」と言われたら、**最初の質問は「評価データセットはありますか？」**。ない案件は POC で終わる。

## 論点5: モデルベンダー中立化

各基盤とも、単一モデルへの依存を避ける方向に動いた:

| 基盤 | 主力モデル（2026年4月時点） |
|---|---|
| Snowflake Cortex | Anthropic Claude (haiku-4-5, sonnet-4-6), Meta Llama 3.3, Mistral Large, Snowflake Arctic ([docs](https://docs.snowflake.com/en/sql-reference/functions/complete-snowflake-cortex), 2026-04-15) |
| Databricks FMAPI | Meta Llama 3.3, DBRX (Databricks独自), Anthropic Claude, OpenAI GPT (一部リージョン) ([docs](https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/supported-models), 2026-04-15) |
| Fabric | OpenAI GPT-5 (gpt-5 / gpt-5-mini / gpt-5-nano), Azure AI Foundry 経由で各種 ([blog](https://blog.fabric.microsoft.com/en-US/blog/29826/), 2026-04-15) |

**ポイント**: Fabric だけは OpenAI 系に強く寄っており、Claude/Llama を使いたい場合は Azure AI Foundry のエンドポイント設定が必要。Snowflake / Databricks は最初から Anthropic を一級市民扱いしている。

## 論点6: Vector Search の "内蔵化"

2023年は Pinecone / Weaviate / Chroma が花盛りだった。2026年は「データ基盤内蔵」が主流:

- Snowflake: **Cortex Search** (ハイブリッド: BM25 + ベクトル)
- Databricks: **Mosaic AI Vector Search** (Delta Sync で Delta テーブルから自動インデックス)
- Fabric: **Fabric AI Search** / `ai.similarity()` / Azure AI Search 統合

**含意**: **データ移動ゼロでRAGが作れる** 時代になった。外部 Vector DB のメリットは「専用性能」「既存エコシステム」「リアルタイム性」に絞られ、案件の多くは基盤内蔵で足りる。

## 論点7: Feature Store の再評価

LLM全盛期に「Feature Store はオワコン」という論調が2024年にあったが、2026年は揺り戻し:

- Databricks: **Feature Store + Online Feature Store**、MLflow 3 で実験管理と統合
- Snowflake: **Snowflake Feature Store** (Snowpark ML ベース)
- Fabric: **MLflow + Semantic Link (SemPy)** で Power BI のセマンティックモデルから特徴量を取れる

**なぜ残っているか**: LLM は「文脈」を扱うのが強いが、「構造化された数値特徴量」を統計的に扱うのは今でも XGBoost / LightGBM の方がコスト・性能ともに圧倒的。focus-you の「翌日の気分予測」のような **ラベル付き教師あり学習** は、LLM ではなく古典ML＋Feature Store が本命。

## 論点8: コスト構造の二重化

2026年は「**コンピュート従量 + LLMトークン従量**」の二重課金時代:

- コンピュート側: Warehouse / DBU / Capacity Unit
- LLM側: 入力/出力トークン単価、モデルにより10倍以上の差

**典型的な事故**: 開発者が `SELECT AI_COMPLETE('claude-sonnet', col) FROM big_table` を走らせて数千ドル請求される。Snowflake は2026年3月に **Cortex AI functions のコスト管理機能をGA** 化し、実行前に budget cap をかけられるようにした ([release note](https://docs.snowflake.com/en/release-notes/2026/other/2026-02-25-ai-functions-cost-management), 2026-04-15)。

**コンサル視点**: AI統合を勧める時、**「コスト爆発の防ぎ方」まで語れないと信用を失う**。

## 論点9: 3社の戦略差 — 一言で

| 基盤 | 戦略 | 強み | 弱み |
|---|---|---|---|
| **Snowflake** | SQL中心のAI統合、運用簡単 | 学習コスト低、データエンジニアでAIが組める、Iceberg対応 | ML開発プロセス（実験管理・ノートブック）は Databricks に劣る |
| **Databricks** | Lakehouse + Agent Framework で ML/AI 開発者の本丸 | ML/AI 開発ワークフロー、MLflow、LangGraph統合、Agent Evaluation | セットアップとガバナンスの複雑さ、料金の読みにくさ |
| **Fabric** | M365 / Azure エコシステム統合 | PowerBI / Teams / Copilot との距離ゼロ、既存MS資産との親和性 | AI機能の成熟度と提供リージョンで先行2社に数ヶ月遅れ、Preview 多め |

---

## 公知情報の限界

- 各社の機能は月次で変わる。特に Snowflake の料金体系は2026-02/03に見直しがあり、本文中の "単価" の数字は数ヶ月で陳腐化する可能性がある
- Fabric は OneLake / Copilot Studio の連携部分に **Preview** が多く、試用アカウントでは動かない機能がある
- 各社の「Agent 評価」は2026年現在も発展途上。ベストプラクティスが固まっていない
- 本文の「戦略差」は公開情報ベースの一般化。実案件では顧客の既存資産が最優先判断材料になる

## 壁打ちモードへの導線

- 「Lakehouse統合が終わったとしたら、今度の選定軸は何か？」を自分の言葉で3つ挙げる
- 「AI関数のSQL統合が民主化した」ことで、**消える仕事** と **増える仕事** は何か
- 「Agent は評価データセットが本体」と言うとき、自分ならどうやって評価データを作るか
- クライアントが「とりあえず ChatGPT でいいじゃん」と言ったとき、**データ基盤内AIを選ぶ理由** を30秒で返す練習

---

**Sources (accessed 2026-04-15)**:

- [Snowflake Cortex AISQL](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql)
- [Snowflake Cortex Analyst](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst)
- [Snowflake Cortex Agents](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents)
- [Snowflake AI Functions cost management GA](https://docs.snowflake.com/en/release-notes/2026/other/2026-02-25-ai-functions-cost-management)
- [Databricks Mosaic AI overview](https://docs.databricks.com/aws/en/generative-ai/guide/mosaic-ai-gen-ai-capabilities)
- [Databricks Genie Space](https://docs.databricks.com/aws/en/genie/)
- [Databricks Foundation Model APIs](https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/supported-models)
- [Microsoft Fabric AI Functions overview](https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/overview)
- [Microsoft Fabric Data Agent](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent)
- [Fabric AI Functions Enhancements GA](https://blog.fabric.microsoft.com/en-US/blog/29826/)
