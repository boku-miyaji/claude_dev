# 第2弾: AI活用編 — 3基盤 × 5パターン ハンズオン学習パック

> 第1弾では各基盤の概念とCRUDを扱った。第2弾は **AI活用の主要5パターン** を 3基盤すべてで触り比べ、DXコンサル文脈で「AI統合まで触った体験」を語れる状態にする。

**作成日**: 2026-04-15 / **想定読者**: 社長本人（LLM/AI開発に精通、エンタープライズDWH未経験） / **想定時間**: 週末×3回 (約10-12時間)

---

## なぜ第2弾が必要か

第1弾で各基盤の「CRUD + 軽いLLM要約」は触った。しかし DXコンサル現場で出てくる質問は、ほぼ例外なく「**で、AIとどう統合するの？**」に集約される。

- 「Text-to-SQL は幻覚が怖いと聞くが本当か」
- 「RAG のベクトル検索、どの基盤が一番楽？」
- 「LLMで全行処理するとコストいくらかかるの？」
- 「Agent と言ってるけど、Langchain との違いは？」
- 「結局、昔ながらの Feature Store はまだ要るの？」

これらに **自分の手で触った経験から答えられる** 状態を目指す。第2弾の成果物は同時に、将来 focus-you の日記データを題材にした **商用AI学習教材** の素材プールを兼ねる。

## 5パターン × 3基盤の学習マトリクス

| パターン | 何をやるか | focus-you題材 | Snowflake | Databricks | Fabric |
|---|---|---|---|---|---|
| **A: Text-to-SQL** | 自然言語でDB問い合わせ | 「先週ストレスが高かった日は？」 | Cortex Analyst + Semantic View | Genie Space (Unity Catalog Metrics) | Data Agent + Semantic Model / AI Skill |
| **B: RAG** | ベクトル検索で類似文書を引く | 「今日と似た気分の日を過去から5件」 | Cortex Search (ハイブリッド) | Mosaic AI Vector Search (Delta Sync) | Fabric AI Search + `ai.similarity` |
| **C: バッチLLM推論** | SQL一発で全行にLLMをかける | 日記30日分を一括で感情タグ+要約 | `AI_COMPLETE` / `AI_CLASSIFY` / `AI_AGG` | `ai_query()` SQL関数 | `ai.generate_response` / `ai.classify` (pandas or DW) |
| **D: AI Agent** | Tool Useで計画→実行→応答 | 「今週のハイライトをSlack風に書いて」 | Cortex Agents (Analyst + Search + UDF) | Mosaic AI Agent Framework (LangGraph) | Fabric Data Agent + Copilot Studio |
| **E: Feature Store + 小ML** | 特徴量化してモデル学習 | 翌日の気分スコアを予測 | Snowflake Feature Store + Snowpark ML | Databricks Feature Store + MLflow 3 | Fabric MLflow + Semantic Link (SemPy) |

読む順番は `00 → A → B → C → D → E` を推奨。A→Bが最も手触りの差が大きく、C→Dはコスト感覚が立ち上がる。Eは「LLM時代でもテーブルベース特徴量は死なない」ことの体感用。

## ファイル一覧

```
06-ai-integration/
├── README.md                        ← 本ファイル
├── 00-ai-landscape-2026.md          ← 2026年のDWH×AI動向サマリ（コンサルトーク用）
├── pattern-A-text-to-sql/
│   ├── README.md                    ← パターンAの比較軸と設計論点
│   ├── snowflake-cortex-analyst.md
│   ├── databricks-genie.md
│   └── fabric-ai-skills.md
├── pattern-B-rag/
│   ├── README.md
│   ├── snowflake-cortex-search.md
│   ├── databricks-vector-search.md
│   └── fabric-ai-search.md
├── pattern-C-batch-llm/
│   ├── README.md
│   ├── snowflake-aisql.md
│   ├── databricks-ai-query.md
│   └── fabric-ai-functions.md
├── pattern-D-agents/
│   ├── README.md
│   ├── snowflake-cortex-agents.md
│   ├── databricks-agent-framework.md
│   └── fabric-data-agent.md
├── pattern-E-ml-feature-store/
│   ├── README.md
│   ├── snowflake-feature-store.md
│   ├── databricks-feature-store-mlflow.md
│   └── fabric-mlflow-semantic-link.md
├── cost-comparison.md               ← 5パターン × 3基盤のコスト比較（実額 + スケール後）
├── production-considerations.md     ← プロダクション設計論点（ガバナンス/評価/SLA）
└── education-material-seeds.md      ← 将来の商用教材ネタの切り出し元
```

## 学習の流れ（推奨）

| 回 | 対象 | 作業 | 時間 |
|----|------|------|------|
| **週末1** | `00-ai-landscape-2026.md` → パターンA（全3基盤）→ パターンB（全3基盤） | 地図を作ってから触る。Text-to-SQL と RAG は最も手触り差が大きい | 4h |
| **週末2** | パターンC（全3基盤）→ `cost-comparison.md` | SQL一発でLLMバッチを流すのは爽快。直後にコスト表と突き合わせて「値段」の感覚を作る | 3.5h |
| **週末3** | パターンD（全3基盤）→ パターンE（全3基盤）→ `production-considerations.md` | AgentとFeature Store。仕上げにプロダクション論点を通読 | 4h |
| **最後** | `education-material-seeds.md` を通読 → `05-comparison-reflection.md`（第1弾）を AI 視点でアップデート | 30分 |

## 成果物の商用教材化を意識したスタイル

- **読むだけでも学べる文章品質**: 箇条書きの羅列で終わらせず、「なぜそうなるか」を必ず地の文で1-2行挟む
- **躓きポイントを先回り**: 「ここで多くの人が止まる」を明記
- **"驚きポイント"タグ**: 初学者が感動する箇所は 👉 で目立たせる（教材化時の切り取り候補）
- **公式URLには必ずアクセス日を付記**（2026-04-15）

## 公知情報の限界

- AI関数のシグネチャ・モデル名・単価は **月次で変わる**。特に Snowflake は 2026-02/03 に料金体系を見直している。実装時は必ず各ドキュメントの更新日を確認すること
- 本パックは **個人アカウントで触れる範囲** に限定。エンタープライズ機能（専用VPC、PrivateLink、監査ログの詳細、Purview統合の全貌）はカバー外
- Fabric のいくつかの AI 機能は Preview で、無料容量/試用アカウントでは実行不可の場合がある。その場合は代替手順（Python SDK 経由など）を示す
- 価格比較は本ドキュメント作成時点の公表値ベース。社長のアカウント状況（リージョン、割引契約）で実額は変動する

## 壁打ちモードへの導線（全体）

第2弾を終えたあと、社長が自分で腹落ちさせるための問い:

1. **「5パターンのうち、クライアントに最初に見せるなら？」** — 衝撃が一番強いパターンはどれか、業種別に答えを持つ
2. **「SaaS の LLM API 直叩きではなく、わざわざ DWH 内で AI を動かす価値を30秒で説明するなら？」** — データ移動しない・ガバナンスが同じ・監査が効く、以外に何があるか
3. **「自分が担当する案件で、パターンAが欲しいと言われた時の最初の問いは？」** — 「Semantic Model ありますか？」から始める根拠
4. **「パターンCのコストが暴走するリスクを避ける設計原則を3つ挙げるなら？」** — 小モデル優先、LIMIT必須、`WHERE processed_at IS NULL` での冪等化、など
5. **「LLM時代になぜ Feature Store がまだ生き残るのか？」** — 構造化特徴量が不要になる場面と必要な場面の境界線

---

## 結論（第2弾全体）

- **AI統合まで触ったコンサルになる最低ライン**: パターンA・C・Dを 3基盤で1周する（合計約6時間）
- **語れるラインに引き上げるには**: コスト比較表を自分の数字で埋め直し、"いくらで動くか" を即答できる状態にする
- **教材化まで持っていくには**: 躓きと気づきを `education-material-seeds.md` に追記しながら進める

## ネクストアクション

- [ ] 第1弾の環境（Snowflake / Databricks / Fabric）が有効か再確認
- [ ] `00-ai-landscape-2026.md` を読む（地図）
- [ ] パターンA Snowflake → Databricks → Fabric の順で3基盤触る
- [ ] `cost-comparison.md` の「focus-you 30日データでの推定コスト」欄を、自分の実測で上書き
- [ ] 完了後、第1弾 `05-comparison-reflection.md` の「AI統合の感想」節を新設して埋める
