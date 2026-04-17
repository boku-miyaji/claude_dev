# パターン C: バッチLLM推論 — SQL一発で全行にLLMをかける

> **ゴール**: diary_entries 30日分を SQL/Python 一発で感情分類・タグ抽出・要約する。3基盤の「SQL内LLM呼び出し」を触り比べ、コスト感覚とエラーハンドリングを身体に入れる。

## このパターンの肝

パターンA（Text-to-SQL）は「1問1答」、パターンB（RAG）は「検索+生成」だった。パターンCは逆方向で、**テーブルの全行にLLMを流す**。ETLパイプラインの中にLLMを組み込む発想。

2024年に各社が「SQLからLLMを呼べます」と発表したとき、多くの人が「面白い」で終わった。2025-2026年になって **プロダクション運用が始まり、3つの壁** が見えてきた:

1. **コスト爆発**: 10万行×GPT-4oだと数百ドル。小モデルで十分な処理を大モデルでやると予算が溶ける
2. **部分失敗**: 30行中1行だけLLMがタイムアウトしたとき、全体をやり直すか？ → 冪等な差分処理が必須
3. **出力の非決定性**: 同じプロンプトでもモデルバージョンが変わると結果が変わる → モデル固定とバージョニングが必要

3基盤はこの3つの壁に対して **驚くほど似た解決策** を用意している。SQL関数としてラップし、リトライと並列化を基盤側で吸収する。違いは「どこまで基盤が面倒を見るか」。

## 3基盤比較表

| 軸 | Snowflake (Cortex AISQL) | Databricks (ai_query) | Fabric (AI Functions) |
|---|---|---|---|
| **呼び出し方** | `AI_COMPLETE('model', prompt)` 等のSQL関数 | `ai_query('endpoint', prompt)` SQL関数 | `ai.generate_response(df, ...)` pandas拡張 or DW SQL関数(Preview) |
| **タスク特化関数** | AI_CLASSIFY, AI_EXTRACT, AI_SUMMARIZE_AGG, AI_SENTIMENT, AI_FILTER | ai_classify, ai_extract, ai_fix_grammar, ai_gen, ai_mask, ai_query, ai_similarity, ai_summarize, ai_translate | ai.classify, ai.extract, ai.generate_response, ai.similarity, ai.summarize, ai.translate, ai.sentiment |
| **利用可能モデル** | Snowflake管理モデル(Claude, Llama, Mistral等) + BYOモデル | Databricksホスト(DBRX, Llama) + 外部(GPT-4o, Claude) + カスタムエンドポイント | Azure OpenAI (GPT-4o/4o-mini) ※Fabric管理 |
| **構造化出力** | AI_EXTRACTでスキーマ指定可。AI_COMPLETEはJSONモード | responseFormat でJSON Schema強制 | output_type引数でスカラー/dict指定 |
| **並列化** | 基盤が自動並列化。ユーザー制御不要 | 基盤が自動並列化。フルデータを1クエリで投入推奨 | Spark/pandasのパーティションで並列 |
| **リトライ** | 基盤が自動リトライ | 基盤が自動リトライ。max_requests_per_minuteで制御 | Notebook内で自前実装 or Spark再実行 |
| **冪等処理** | WHERE + processed_at IS NULLパターン | 同上 + Delta Lakeのマージ | 同上 + Lakehouse Delta |
| **コスト単位** | AIクレジット (トークンベース、edition非依存) | DBU (Foundation Model Serving DBU) | Fabric CU (Capacity Unit)消費 |
| **一番の強み** | タスク特化関数が豊富。SQL完結 | responseFormatでJSON Schema完全制御。外部モデル統合 | Power BI連携。pandas使い慣れた人には自然 |
| **一番の弱み** | 外部モデル統合がやや制限的 | SQL関数名がai_queryに統一で使い分けが見えにくい | DW SQL版はPreview。モデル選択肢がAzure OpenAIに限定 |

出典:
- Snowflake: https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql (2026-04-15参照)
- Databricks: https://docs.databricks.com/aws/en/large-language-models/ai-functions (2026-04-15参照)
- Fabric: https://learn.microsoft.com/en-us/fabric/data-science/ai-functions/overview (2026-04-15参照)

## focus-you で実行する共通タスク（3基盤共通）

diary_entries 30行に対して、以下3つの処理を全基盤で実行する:

### タスク1: 感情分類 (Classification)
入力: `entry_text` → 出力: `primary_emotion` (joy / sadness / anger / fear / surprise / neutral)

### タスク2: タグ抽出 (Extraction)
入力: `entry_text` → 出力: `tags` (配列。例: ["運動", "仕事", "人間関係"])

### タスク3: 全体要約 (Aggregation)
入力: 30行全体 → 出力: 1段落の月間サマリ

これを同じ順番で3基盤それぞれ実行し、「結果の質」「速度」「コスト」を比較する。

## 設計論点（プロダクション目線）

### 冪等性（Idempotency）

バッチLLM推論で最も重要な設計原則。30行中28行が処理済みのとき、残り2行だけ再処理したい。

```sql
-- 共通パターン: processed_at が NULL の行だけ処理
UPDATE diary_analysis
SET emotion = AI_CLASSIFY(...), processed_at = CURRENT_TIMESTAMP()
WHERE processed_at IS NULL;
```

このパターンは3基盤すべてで使える。Delta Lake（Databricks/Fabric）なら MERGE INTO も有効。ポイントは「**LLM呼び出しは高い。同じ行を2回処理しない仕組みを最初から入れる**」。

### 部分失敗ハンドリング

- **Snowflake**: TRY_AI_COMPLETE でエラーをNULLに変換。後で NULL 行だけ再処理
- **Databricks**: ai_query のエラーは行レベルで NULL / エラー文字列になる。エラー行を別テーブルに退避してリトライ
- **Fabric**: pandas の try-except + apply で行レベル制御。Spark なら mapInPandas

### モデル固定とバージョニング

LLMの出力は非決定的で、モデルバージョンが変わると結果が変わる。プロダクションでは:

- **処理時のモデル名+バージョンを記録**: `model_used = 'claude-3-5-haiku-20250120'`
- **再処理時は同じモデルを指定**: バージョンが上がっても過去データの一貫性を保つ
- **Snowflake**: モデル名にバージョンを含める or Cortex Fine-tuned Model を固定
- **Databricks**: エンドポイント名でモデルを固定。Provisioned Throughput で確実に
- **Fabric**: Azure OpenAI のデプロイメント名で固定

### 小モデル優先の原則

感情分類のような「選択肢が有限」のタスクに GPT-4o は不要。小モデル（Llama 3.1 8B、GPT-4o-mini、Claude Haiku）で十分。コストは10-50倍違う。

ルール: **タスク特化関数（AI_CLASSIFY等）があるなら、AI_COMPLETE/ai_query より先にそちらを使う**。タスク特化関数は内部で最適モデルを選んでくれることが多い。

### コスト見積もりの実践

30行の日記（平均100文字 ≒ 50トークン/行）で概算:

| 処理 | 入力トークン | 出力トークン | Snowflake概算 | Databricks概算 | Fabric概算 |
|------|------------|------------|-------------|--------------|-----------|
| 感情分類×30行 | 3,000 | 300 | ~0.01 credits | ~0.001 DBU | ~0.01 CU |
| タグ抽出×30行 | 3,000 | 1,500 | ~0.02 credits | ~0.002 DBU | ~0.02 CU |
| 月間要約×1回 | 5,000 | 500 | ~0.01 credits | ~0.001 DBU | ~0.01 CU |

30行では差は微小。**10万行になると100-1000倍**になるので、小モデル選択が効いてくる。詳細は `cost-comparison.md` 参照。

## ハンズオン手順（概要）

各基盤の詳細手順は個別ファイルを参照:

| 基盤 | ファイル | 所要時間 |
|------|---------|---------|
| Snowflake | `snowflake-aisql.md` | 60分 |
| Databricks | `databricks-ai-query.md` | 60分 |
| Fabric | `fabric-ai-functions.md` | 60分 |

推奨順: Snowflake（タスク特化関数が最も直感的）→ Databricks（JSON Schema制御が面白い）→ Fabric（pandas方式で比較）

## 教材化メモ

- **5分ミニ教材候補**: 「AI_CLASSIFY vs AI_COMPLETE: いつ使い分ける？」 — タスク特化関数と汎用関数の使い分け判断フロー
- **躓きポイント**: モデル名のtypo（Snowflakeはモデル名が独自表記）、JSON出力のパース失敗（Databricksの responseFormat を知らないと手動パース地獄）
- **驚きポイント**: SQL1行で30行の感情分類が完了する瞬間は初見で確実に驚く

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Snowflake Cortex AISQL は 2025年11月にGA（https://docs.snowflake.com/en/release-notes/2025/other/2025-11-04-cortex-aisql-operators-ga）
- 2026年4月からAIクレジットがedition非依存化。コスト構造が大幅に変わった（https://medium.com/towards-data-engineering/breaking-down-snowflakes-ai-pricing-overhaul-credits-caching-and-cost-strategy-bde56f48f53f）
- Databricks ai_query は基盤が自動で並列化・リトライを管理。フルデータを1クエリで投入推奨（https://docs.databricks.com/aws/en/large-language-models/ai-query）
- Fabric AI Functions は2026年3月にGA拡張。マルチモーダル対応もPreviewで追加（https://blog.fabric.microsoft.com/en-US/blog/29826/）

### 2. 限界の明示

- **実額コスト**: 各社の課金体系が異なり（クレジット/DBU/CU）、直接比較は概算レベル。社長のアカウントのリージョン・契約条件で実額は変動する
- **レイテンシ**: 30行では差が見えにくい。1000行以上で基盤間の並列化性能差が顕在化する可能性があるが、個人アカウントでは検証しにくい
- **モデルラインナップの変動**: 特にSnowflakeは2026年Q1にモデル追加・廃止が頻繁。ドキュメントの更新日を必ず確認
- **Fabric DW SQL版**: AI関数のDW SQL版はまだPreviewで、pandas Notebook方式のほうが安定

### 3. 壁打ちモードへの導線

1. **「30行の感情分類にGPT-4oを使う必要はあるか？」** — 小モデルで十分なタスクの見極め基準を自分の言葉で持つ
2. **「バッチLLM推論のコストが暴走するシナリオを3つ挙げられるか？」** — WHERE句忘れ・大モデル誤選択・出力トークン爆発。クライアントへの説明に直結
3. **「冪等処理を入れなかったら何が起きるか？」** — 重複処理のコスト影響を具体的な金額で語れるか
4. **「パターンCとOpenAI API直叩きの違いを30秒で説明するなら？」** — ガバナンス・監査・並列化・リトライが基盤に組み込まれている価値
5. **「感情分類の精度が低かったとき、次にやることは？」** — プロンプト改善 vs Few-shot追加 vs モデル変更の判断フロー
