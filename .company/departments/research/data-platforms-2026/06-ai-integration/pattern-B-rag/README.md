# パターン B: RAG（ベクトル検索）

> **ゴール**: 過去日記から「今日と似た気分の日」をベクトル検索で5件引き、その日のカレンダー予定と合わせて傾向要約させる。3基盤それぞれの Vector Search 機能の違いを手で体感する。

## このパターンの肝

2023-2024年は「Vector DB は専用ツール（Pinecone / Weaviate / Chroma）で持つ」のが主流。2026年は **データ基盤内蔵 Vector Search** が標準化し、「Delta / Iceberg テーブルを自動インデックス化 → 同じ権限体系で検索」ができるようになった。

これはコンサル視点で重要: **「RAGしたい」と言われたら、まず "既存の DWH/Lakehouse に載ってるかどうか" を聞けばよい**。載っているなら外部 Vector DB は不要な案件がほとんど。

## RAG の基礎（最小限の復習）

1. **Embedding**: テキストを数値ベクトル（通常 768〜3072次元）に変換
2. **Index**: ベクトルを近傍探索しやすい構造に格納 (HNSW / IVF / ScaNN など)
3. **Retrieval**: クエリも Embed → 最近傍 k 件を取得
4. **Augmentation**: 取得したコンテキストを LLM プロンプトに挿入して回答生成

**ハイブリッド検索**: BM25（全文検索）＋ ベクトル検索を併用。キーワードが効く場合とセマンティックが効く場合のいいとこ取り。2026年時点では **Snowflake Cortex Search** がデフォルトでハイブリッド。

## 比較軸

| 軸 | Snowflake Cortex Search | Databricks Vector Search | Fabric AI Search |
|---|---|---|---|
| 検索方式 | ハイブリッド標準 (BM25+ベクトル) | ベクトル中心 (ハイブリッドも可) | ベクトル + Azure AI Search 統合 |
| 同期モード | 自動（テーブル更新を追随） | **Delta Sync**（自動） / Direct Access | 手動 or Pipeline |
| Embedding | 内蔵 (Arctic Embed L) / 自前も可 | 内蔵 (BGE系) / OpenAI / 自前 | `ai.embed()` / Azure OpenAI |
| インデックス更新 | 自動。数分で反映 | 自動。数分 | Pipeline経由、遅延あり |
| 権限 | テーブルと同じ Snowflake RBAC | Unity Catalog | Fabric workspace / Purview |
| 多言語 | 主要言語OK (実測は必要) | 多言語OK | Azure AI Search 側に依存 |
| **楽に感じるのは** | CREATE 1コマンドで即動く | Delta Sync が強力 | Azure 資産との連携は最強 |

## focus-you で試す検索クエリ

共通のハンズオンフロー:

1. `diary_entries` の `entry_text` を Embed してインデックス化
2. クエリ: "今日はプロジェクトで上司と衝突した。どうにも気が晴れない" → 似た気分の日を5件
3. 取得した5件の `entry_date` を使って `calendar_events` を JOIN し、その日の予定カテゴリを集計
4. LLM に「これらの日の共通点と、こういう気分の時に効きそうな予定カテゴリ」を要約させる

**この一連のフロー** を3基盤それぞれで組む。Embedding → Index → Retrieval → JOIN → LLM要約、の5ステップ。

## 設計論点（プロダクション目線）

### Embedding モデル選定

- **内蔵モデルを使う**: 運用が最も楽。Snowflake Arctic Embed L、Databricks の BGE、Fabric の `text-embedding-3-small` など
- **自前で選ぶべきケース**: 日本語中心、ドメイン特殊語（医療/法律）、超高精度が必要
- **次元数**: 大きい方が精度高いが、ストレージ・検索コスト・レイテンシが増える。768次元が実務のスイートスポット

### チャンキング戦略

日記30日分は短いので不要だが、ドキュメントRAGでは必須:

- **固定長** (512〜1024 tokens): 実装楽、意味の途切れリスク
- **セマンティック分割**: 文/段落境界で切る。自然だが実装面倒
- **オーバーラップ** (10-20%): 境界の取りこぼし対策
- **階層チャンク**: ドキュメント全体要約 + 詳細チャンク

### 検索品質評価 (Recall@k)

- **評価データセット**: 「この問いには理想的にはこのドキュメント」のペアを50-200件用意
- **Recall@5**: 上位5件に正解が含まれる率
- **MRR (Mean Reciprocal Rank)**: 正解の順位の平均逆数
- **nDCG**: 順位の重み付け版

実案件で評価データを作る労力が RAG 構築の **7割** を占める。POC で評価をサボると後で破綻する。

### インデックス更新

- **Snowflake Cortex Search**: テーブル更新後 **数分** で反映（内部 target_lag 設定可）
- **Databricks Delta Sync**: 継続同期モード
- **Fabric**: Pipeline / Notebook で再インデックス（手動寄り）

### コールドスタート

- インデックスが育つまでは精度が低い。数百件未満のコーパスでは BM25 のほうが強いことがある
- ドメイン特殊な用語が多い時はハイブリッド検索が必須

### 多言語

- Embedding モデルの多言語サポートを確認
- 日本語RAGでは Cohere Embed Multilingual V3 / BGE M3 / Arctic Embed L などが実用域

## 公知情報の限界

- 各社 Embedding の精度比較は公式の統一ベンチがない
- 日本語の Recall@k は案件ごとに自分で測る必要あり
- Cortex Search のコストは「サービスサイズ + 検索リクエスト数 + 背景 compute」の3層で読みにくい

## 壁打ちへの導線

- クライアントが「Pinecone 入ってます」と言った時、データ基盤内蔵に載せ替える ROI を30秒で説明できるか
- 評価データセットを社内でどう作るか（LLM-as-judge で自動生成はアリか？）
- ハイブリッド検索の BM25 重みと vector 重みをどう決めるか（デフォルト固定 vs 動的チューニング）

---

**次のファイル**:
- [`snowflake-cortex-search.md`](./snowflake-cortex-search.md)
- [`databricks-vector-search.md`](./databricks-vector-search.md)
- [`fabric-ai-search.md`](./fabric-ai-search.md)
