# AI統合コスト比較 — 5パターン x 3基盤 + OpenAI直

> **目的**: focus-you のデータ規模（30件/1,000件/10万件）でパターンA-Eの実行コストを実額ベースで試算する。「基盤内でAIを動かすのと、OpenAIを直接叩くのと、どちらが安いか？」の判断材料。

## 前提条件

### データ規模の定義

| スケール | レコード数 | 想定シナリオ | 1レコードの平均トークン数 |
|---|---|---|---|
| **Small** | 30件 | focus-you 個人利用1ヶ月分 | 入力: ~200 tokens, 出力: ~100 tokens |
| **Medium** | 1,000件 | focus-you 個人利用3年分 or 小規模SaaS | 同上 |
| **Large** | 100,000件 | SaaS 商用化（数百ユーザー） | 同上 |

### 通貨と単価の前提

- **Snowflake**: 1クレジット = $3.00（Standard Edition、オンデマンド）。AI クレジットはモデル別の per-million-token 課金
- **Databricks**: 1 DBU = $0.07〜$0.40（ワークロード種別による）。Foundation Model API は per-token 課金
- **Fabric**: 1 CU = ~$0.18/hour（Pay-as-you-go）。AI Functions は CU 消費 + Azure OpenAI トークン課金
- **OpenAI 直**: API 直接呼び出し。GPT-4o: $2.50/$10.00 per 1M tokens (input/output)、GPT-4o-mini: $0.15/$0.60
- 為替: $1 = 150円で換算

出典:
- Snowflake 料金: https://www.snowflake.com/en/pricing-options/ (2026-04-16参照)
- Snowflake Cortex 単価: https://docs.snowflake.com/en/user-guide/snowflake-cortex/ai-func-cost-management (2026-04-16参照)
- Databricks 料金: https://www.databricks.com/product/pricing (2026-04-16参照)
- Fabric 料金: https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/ (2026-04-16参照)
- OpenAI 料金: https://openai.com/api/pricing/ (2026-04-16参照)

## Snowflake Cortex 単価表

Cortex AISQL / Cortex Analyst / Cortex Search / Cortex Agents はすべてトークンベース課金（AI クレジット）。

| モデル | 用途 | Credits / 1M tokens | 実質 $/1M tokens |
|---|---|---|---|
| snowflake-arctic-embed-l-v2.0 | Embedding | 0.05 | $0.15 |
| snowflake-arctic | 汎用テキスト生成（小） | 0.32 | $0.96 |
| mistral-large2 | 汎用テキスト生成（中） | 0.47 | $1.41 |
| llama3.1-70b | 汎用テキスト生成（中） | 0.19 | $0.57 |
| llama3.1-405b | 汎用テキスト生成（大） | 0.96 | $2.88 |
| claude-3.5-sonnet (via Cortex) | 外部モデル連携 | ~4.0 | ~$12.00 |

**注意**: AI_CLASSIFY, AI_EXTRACT 等のタスク特化関数は内部でモデルが自動選択されるため、正確な単価は事後にしかわからない。概ね llama3.1-70b 相当（$0.57/1M tokens）が目安。

出典:
- Snowflake Service Consumption Table: https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf (2026-04-16参照)
- Cortex コスト管理: https://docs.snowflake.com/en/user-guide/snowflake-cortex/ai-func-cost-management (2026-04-16参照)
- 隠れコストの事例: https://seemoredata.io/blog/snowflake-cortex-ai/ (2026-04-16参照)

## Databricks 単価表

Databricks は DBU（Databricks Unit）ベース課金。AI 系は Foundation Model API / Mosaic AI が担当。

| ワークロード | DBU単価 ($/DBU) | 備考 |
|---|---|---|
| Jobs Compute | $0.07 - $0.15 | バッチ処理 |
| SQL Warehouse (Classic) | $0.22 - $0.40 | BI / SQL クエリ |
| SQL Warehouse (Serverless) | $0.35 - $0.50 | サーバーレス SQL |
| Model Serving (GPU) | $0.40 - $0.70 | リアルタイム推論 |
| Foundation Model API | per-token | Llama / DBRX 等 |

Foundation Model API の単価:

| モデル | Input $/1M tokens | Output $/1M tokens |
|---|---|---|
| DBRX Instruct | $0.75 | $2.25 |
| Llama 3.1 70B | $0.90 | $0.90 |
| Llama 3.1 405B | $3.00 | $3.00 |
| Mixtral 8x7B | $0.50 | $0.50 |
| BGE Large (Embedding) | $0.10 | - |

**注意**: AI Functions（ai_query()）は Foundation Model API + SQL Warehouse DBU の二重課金。

出典:
- Databricks Pricing: https://www.databricks.com/product/pricing (2026-04-16参照)
- Foundation Model API: https://docs.databricks.com/aws/en/machine-learning/foundation-models/supported-models (2026-04-16参照)
- Mosaic AI Gateway 料金: https://www.truefoundry.com/blog/databricks-mosaic-ai-gateway-pricing-explained-2026 (2026-04-16参照)

## Fabric 単価表

Fabric は CU（Capacity Unit）ベース課金。AI Functions は Azure OpenAI のトークン課金が別途発生。

| リソース | 単価 | 備考 |
|---|---|---|
| Fabric CU (Pay-as-you-go) | ~$0.18/CU/hour | リージョンにより +-15% |
| Fabric CU (1年予約) | ~$0.11/CU/hour | 約41%割引 |
| F2 (Trial) | 無料 | 2 CU、60日間 |
| F64 | ~$11.52/hour | 64 CU |
| Azure OpenAI GPT-4o | $2.50/$10.00 per 1M tokens | AI Functions 経由 |
| Azure OpenAI GPT-4o-mini | $0.15/$0.60 per 1M tokens | AI Functions 経由 |

**注意**: Fabric の AI Functions (ai.generate_text等) は CU 消費 + Azure OpenAI トークン課金の二重課金構造。

出典:
- Fabric Pricing: https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/ (2026-04-16参照)
- Fabric Pricing Calculator: https://www.microsoft.com/en-us/microsoft-fabric/capacity-estimator (2026-04-16参照)

## パターン別コスト試算

### パターン A: Text-to-SQL

ユーザーが自然言語で質問 → SQL生成 → 実行 → 結果を返す。1クエリあたりの試算。

| 項目 | Snowflake (Cortex Analyst) | Databricks (Genie) | Fabric (AI Skills) | OpenAI 直 |
|---|---|---|---|---|
| LLM コスト / 1クエリ | ~$0.003 (semantic model + SQL生成) | ~$0.005 (DBU + Foundation API) | ~$0.004 (CU + Azure OpenAI) | ~$0.003 (GPT-4o-mini) |
| SQL 実行コスト | ウェアハウス稼働: ~$0.01 | SQL Warehouse: ~$0.02 | CU 消費: ~$0.005 | N/A (自前DB必要) |
| **合計 / 1クエリ** | **~$0.013** | **~$0.025** | **~$0.009** | **~$0.003 + DB費用** |
| 月100クエリ | ~$1.30 | ~$2.50 | ~$0.90 | ~$0.30 + DB費用 |

**ポイント**: OpenAI 直が最安に見えるが、SQL を実行するデータベース自体の運用費用が別途必要。基盤内蔵型は「AIコスト + コンピュートコスト」が一体で管理しやすい。

### パターン B: RAG

30件/1,000件/10万件のドキュメントをベクトル化してインデックス → 検索 → LLM回答。

| 項目 | Snowflake (Cortex Search) | Databricks (Vector Search) | Fabric (AI Search) | OpenAI 直 (+ Pinecone) |
|---|---|---|---|---|
| **Embedding (初回)** | | | | |
| 30件 (~6K tokens) | $0.001 | $0.001 | $0.001 | $0.001 |
| 1,000件 (~200K tokens) | $0.03 | $0.02 | $0.03 | $0.03 |
| 100,000件 (~20M tokens) | $3.00 | $2.00 | $3.00 | $2.60 |
| **検索 + 回答 / 1クエリ** | | | | |
| 検索 | Cortex Search CU | Vector Search DBU | CU消費 | Pinecone $0.001 |
| LLM 回答 | ~$0.002 | ~$0.003 | ~$0.004 | ~$0.003 |
| 合計 / 1クエリ | ~$0.005 | ~$0.008 | ~$0.007 | ~$0.004 + Pinecone |
| **月間 (100クエリ)** | | | | |
| 30件 | ~$0.50 | ~$0.80 | ~$0.70 | ~$0.40 + Pinecone月額 |
| 1,000件 | ~$0.53 | ~$0.82 | ~$0.73 | ~$0.43 + Pinecone月額 |
| 100,000件 | ~$3.50 | ~$2.80 | ~$3.70 | ~$3.00 + Pinecone $70/month |

**ポイント**: 小規模（30〜1,000件）では差はほぼない。10万件規模では Pinecone 等の外部ベクトルDB の月額固定費が効いてくる。

### パターン C: バッチ LLM 推論

diary_entries の全行に感情分類 + 抽出 + 要約を一括実行。

| 項目 | Snowflake (AISQL) | Databricks (ai_query) | Fabric (AI Functions) | OpenAI 直 (Batch API) |
|---|---|---|---|---|
| **30件 処理** | | | | |
| 感情分類 (30行) | $0.005 | $0.007 | $0.006 | $0.002 |
| 情報抽出 (30行) | $0.005 | $0.007 | $0.006 | $0.002 |
| 週次要約 (4回) | $0.003 | $0.004 | $0.004 | $0.002 |
| **合計 (30件)** | **~$0.013** | **~$0.018** | **~$0.016** | **~$0.006** |
| **1,000件 処理** | | | | |
| 感情分類 | $0.17 | $0.23 | $0.20 | $0.06 |
| 情報抽出 | $0.17 | $0.23 | $0.20 | $0.06 |
| 週次要約 (143回) | $0.10 | $0.14 | $0.14 | $0.07 |
| **合計 (1,000件)** | **~$0.44** | **~$0.60** | **~$0.54** | **~$0.19** |
| **100,000件 処理** | | | | |
| 感情分類 | $17 | $23 | $20 | $6 |
| 情報抽出 | $17 | $23 | $20 | $6 |
| 週次要約 (14,285回) | $10 | $14 | $14 | $7 |
| **合計 (100,000件)** | **~$44** | **~$60** | **~$54** | **~$19** |

**ポイント**: OpenAI Batch API（50% 割引）が純粋なトークンコストでは最安。ただしデータを外部に送信するため PII/ガバナンスの問題がある。基盤内蔵型はデータが外に出ない代わりに 2〜3倍のコスト。

### パターン D: Agents

複数ツールを使ったマルチステップ推論。1セッション（5ターン）あたり。

| 項目 | Snowflake (Cortex Agents) | Databricks (Agent Framework) | Fabric (Data Agent) | OpenAI 直 (Assistants API) |
|---|---|---|---|---|
| LLM / 1セッション | ~$0.02 | ~$0.03 | ~$0.03 | ~$0.02 |
| ツール実行 | Cortex Search + SQL | Vector Search + SQL | AI Search + SQL | 外部API呼び出し |
| コンピュート | ウェアハウス稼働 | SQL Warehouse | CU消費 | N/A |
| **合計 / 1セッション** | **~$0.05** | **~$0.08** | **~$0.06** | **~$0.03 + 外部費用** |
| 月100セッション | ~$5 | ~$8 | ~$6 | ~$3 + 外部費用 |

### パターン E: Feature Store + ML

ML モデルの学習 + 推論。LLM を使わないため、コスト構造が根本的に異なる。

| 項目 | Snowflake | Databricks | Fabric | OpenAI (参考: LLMで同じ予測) |
|---|---|---|---|---|
| **学習 (30件)** | | | | |
| コンピュート | ~$0.05 (XS Warehouse 1分) | ~$0.10 (Jobs Compute 1分) | ~$0.003 (F2 1分) | N/A |
| **学習 (100,000件)** | | | | |
| コンピュート | ~$0.50 (XS Warehouse 10分) | ~$1.00 (Jobs Compute 10分) | ~$0.03 (F2 10分) | N/A |
| **推論 (100,000件)** | | | | |
| ML 推論 | ~$0.05 (数秒) | ~$0.10 (数秒) | ~$0.003 (数秒) | $30+ (LLM で1行ずつ) |
| **レイテンシ** | ~10ms | ~10ms | ~10ms | ~2,000ms |

**ポイント**: ML 推論は LLM の **1/600 のコスト、1/200 のレイテンシ**。構造化データの数値予測には ML が圧倒的に合理的。

## 隠れコスト

基盤の利用料金だけでは見えないコストがある。

### 1. ウェアハウス / クラスター起動コスト

| 基盤 | 最小起動単位 | 起動時間 | 最低課金 |
|---|---|---|---|
| Snowflake | XS Warehouse | ~5秒 | 1分 = ~$0.05 |
| Databricks | SQL Warehouse (Serverless) | ~10秒 | 1分 = ~$0.02 |
| Fabric | CU (常時稼働) | 即時 | 秒単位 |

Snowflake の「AUTO_SUSPEND = 60秒」設定でも、30件の処理のために1分のウェアハウス稼働が発生する。これが「$5Kのクエリ」の原因になった事例もある（https://seemoredata.io/blog/snowflake-cortex-ai/）。

### 2. データ移動コスト

| シナリオ | コスト |
|---|---|
| OpenAI 直: データをAPIに送信 | エグレス料金（クラウド間なら $0.01-0.09/GB） |
| 基盤内蔵: データ移動なし | $0 |
| RAG: ベクトルDBへの同期 | エグレス + ベクトルDB ストレージ |

### 3. 開発・運用コスト

| 項目 | 基盤内蔵 | OpenAI 直 |
|---|---|---|
| データパイプライン構築 | 少（SQL/Python で完結） | 多（ETL + API呼び出し + 結果書き戻し） |
| PII 対応 | 不要（データが基盤内） | 必要（匿名化 or DLP 設定） |
| エラーハンドリング | 基盤が管理 | 自前で実装（リトライ、レートリミット） |
| モニタリング | 基盤のダッシュボード | 自前構築（CloudWatch 等） |

## コスト最適化テクニック

### Snowflake

```sql
-- 1. AI Budget で上限設定（2026年3月GA）
ALTER ACCOUNT SET AI_BUDGET = 100;  -- $100/月の上限

-- 2. モデル選択の最適化
-- AI_COMPLETE でモデルを明示的に指定（安いモデルを選ぶ）
SELECT AI_COMPLETE('llama3.1-70b', prompt)  -- $0.57/1M tokens
-- ではなく
SELECT AI_COMPLETE('snowflake-arctic', prompt)  -- $0.96/1M tokens は避ける

-- 3. AI_CLASSIFY 等のタスク特化関数を優先
-- 内部で最適モデルが選択され、プロンプトも最適化される
SELECT AI_CLASSIFY(text, ['positive', 'negative'])  -- AI_COMPLETE より安い
```

出典: https://docs.snowflake.com/en/release-notes/2026/other/2026-02-25-ai-functions-cost-management (2026-04-16参照)

### Databricks

```python
# 1. Serverless SQL を避ける（DBU単価が高い）
# → Classic SQL Warehouse or Jobs Compute を使う

# 2. Foundation Model API でキャッシュを活用
# 同じプロンプトの繰り返しはキャッシュヒットでコスト削減

# 3. バッチ処理は Jobs Compute（最安のDBU単価）
# ai_query() を SQL Warehouse ではなく Notebook + Jobs Compute で実行
```

### Fabric

```python
# 1. F2 Trial を最大活用（60日間無料）
# 2. CU の一時停止: 使わない時間は容量を停止
# 3. 1年予約で41%割引
# 4. AI Functions は GPT-4o-mini を指定（GPT-4o の 1/16 のコスト）
```

### OpenAI 直

```python
# 1. Batch API（50%割引、24時間以内の応答）
# 大量のバッチ処理には最適
# https://platform.openai.com/docs/guides/batch

# 2. GPT-4o-mini を基本にする
# GPT-4o は「どうしても品質が必要な場合」のみ

# 3. Structured Outputs でトークン節約
# JSON Schema を指定して無駄な出力を削減
```

## スケール別の推奨

| スケール | 推奨 | 理由 |
|---|---|---|
| **30件（個人利用）** | OpenAI 直 or Fabric Trial | コストがほぼゼロ。基盤の月額固定費を払う意味がない |
| **1,000件（小規模SaaS）** | 既存基盤に統合 | 基盤を既に使っているなら内蔵AIが楽。新規なら OpenAI 直 + Supabase で十分 |
| **100,000件（商用SaaS）** | 基盤内蔵 + OpenAI Batch 併用 | PII 対応が必要な処理は基盤内蔵、バッチ処理は OpenAI Batch で最適化 |

## 年間コスト試算（100,000件、全パターン月次実行）

| 項目 | Snowflake | Databricks | Fabric (F64) | OpenAI 直 + Supabase |
|---|---|---|---|---|
| AI 処理（パターンA-D） | ~$720/年 | ~$960/年 | ~$840/年 | ~$360/年 |
| ML 処理（パターンE） | ~$12/年 | ~$24/年 | ~$1/年 | N/A |
| コンピュート基盤 | ~$3,600/年 (XS常時) | ~$4,800/年 (Serverless) | ~$8,400/年 (F64) | ~$300/年 (Supabase Pro) |
| ストレージ | ~$240/年 | ~$120/年 | 含まれる | ~$60/年 |
| **年間合計** | **~$4,572** | **~$5,904** | **~$9,241** | **~$720 + 開発費** |

**注意**: OpenAI 直の場合、データパイプライン・モニタリング・エラーハンドリングの開発費用（エンジニア工数）が別途必要。基盤内蔵型はこれらが組み込まれている。

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Snowflake Cortex: AI クレジットはモデル別 per-million-token 課金。2026年3月に AI Budget（コスト上限）がGA（https://docs.snowflake.com/en/user-guide/snowflake-cortex/ai-func-cost-management）
- Databricks: DBU ベース + Foundation Model API の per-token 課金の二重構造（https://www.databricks.com/product/pricing）
- Fabric: CU ベース + Azure OpenAI トークン課金の二重構造（https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/）
- OpenAI Batch API: 50%割引で大量処理に有利（https://openai.com/api/pricing/）
- Snowflake Cortex の隠れコスト事例: $5K の単一クエリ（https://seemoredata.io/blog/snowflake-cortex-ai/）

### 2. 限界の明示

- **単価の変動**: 3基盤ともAI機能の単価は頻繁に改定される。この試算は2026年4月時点の公開情報に基づく
- **実際のトークン数**: 日本語テキストは英語の約1.5-2倍のトークンを消費する。上記試算は英語ベース
- **コンピュート固定費**: Snowflake / Databricks はウェアハウス/クラスターの起動単位があり、小規模利用では割高になる
- **推測**: Cortex のタスク特化関数（AI_CLASSIFY等）の内部モデル選択は非公開。llama3.1-70b 相当と仮定
- **Fabric F64 の年間費用**: 常時稼働の想定。実際には一時停止を活用すれば大幅に削減可能

### 3. 壁打ちモードへの導線

1. **「focus-you の現在の規模（30件）で、基盤のAI機能に月額を払う意味はあるか？」** --- コストだけなら No。ただし「基盤を学ぶ体験」としてTrial/無料枠を使う価値はある
2. **「10万件規模になったとき、どの基盤が一番安いか？」** --- AI処理単体なら OpenAI 直。基盤込みなら Snowflake。ただし PII 要件で基盤内蔵が必須になる可能性
3. **「日本語のトークン数を考慮すると、試算はどう変わるか？」** --- 全コストが約1.5-2倍になる。特にバッチ処理（パターンC）への影響が大きい
4. **「クライアントにコスト比較をどう見せるか？」** --- 「AI処理コスト」と「基盤運用コスト」を分けて提示。前者は微々たるもの、後者が支配的
5. **「OpenAI 直 + Supabase の構成で、基盤を使わない選択肢はどこまで通用するか？」** --- 10万件以下、チーム3人以下、PII 要件なしならかなり合理的。それを超えたら基盤の価値が出る
