# Karpathy LLM Wiki 設計思想分析と宮路HD適用レポート

- ステータス: completed
- 担当: リサーチ部 技術調査チーム
- 作成日: 2026-04-06
- 調査対象: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

---

## 結論

Karpathyが2026年4月3〜4日に公開した「LLM Knowledge Base / LLM Wiki」は、RAGの根本的な限界（知識の非蓄積）を克服するアーキテクチャ。LLMをドキュメント検索エンジンではなく「知識コンパイラ」として使い、Markdownファイル群を生きた百科事典として育てる発想。

宮路HDの現行設計はこの思想と約80%一致。残り20%、特に「WikiとしてのKB設計」「Lintワークフロー」「クエリ結果の還流」は即座に取り入れ可能な改善ポイント。

---

## I. 公知情報ベースの分析

### 1-1. 背景と問題意識

> "A large fraction of my recent token throughput is going less into manipulating code, and more into manipulating knowledge."

LLMの使い方のシフト: コード生成（vibe coding → agentic engineering）から知識管理へ。

従来のRAGの限界:
- 「毎回ゼロから発見し直す」構造
- 5つのドキュメントを横断する複雑な問いには弱い
- 蓄積がない: 同じコンテキスト整理を何度も繰り返す

### 1-2. LLM Wiki の3層アーキテクチャ

```
raw/       <- 人間が投入。記事・論文・PR・会議メモ・データセット
wiki/      <- LLMが維持管理。Markdownファイル群（要約・概念・比較・分析）
schema.md  <- LLMへの指示書。フォルダ構成・引用規則・ワークフロー定義
```

| 層 | 管理者 | 変更ルール |
|----|--------|-----------|
| raw/ | 人間 | 基本変更しない（原典保持） |
| wiki/ | LLM | 書き込み・更新主体 |
| schema.md | 人間とLLMの共進化 | 運用しながら改善 |

### 1-3. 3つのキーファイル

- **index.md（コンテンツ目録）**: Wiki内の全ページをカタログ化。1行サマリー + メタデータ
- **log.md（追記型年表）**: すべてのingest・クエリ・lintパスを時系列で記録。append-only
- **schema.md（CLAUDE.mdに相当）**: LLMの行動規範。「知識維持者」として動作させる

### 1-4. 3つのワークフロー

- **Ingest**: raw/に投入 → LLMが読んで議論 → wiki/に要約ページ作成 → index.md更新 → log.md記録
- **Query**: ユーザーが質問 → index.md参照 → 対象ページ読んで引用付き回答 → 良い回答はwikiに還流
- **Lint（定期品質チェック）**: ページ間の矛盾・古くなった主張・孤立ページ・概念の記述漏れを検出

### 1-5. 「Idea File」という新概念

> "In this era of LLM agents, there is less of a point/need of sharing the specific code/app, you just share the idea, then the other person's agent customizes it."

コードではなくアイデアをオープンソースとして共有。「開放されたコード」から「開放されたアイデア」へ。

---

## II. 宮路HDシステムとの対応関係

### 一致している点（~80%）

| Karpathyの概念 | 宮路HDの実装 | 一致度 |
|----------------|-------------|--------|
| schema.md | CLAUDE.md + .claude/rules/ | 高 |
| log.md | secretary/notes/ + activity_log | 高 |
| LLMがwikiを維持 | Sub-agentsがファイルを書く | 高 |
| 昇格ゲート | knowledge_base confidence + 社長承認 | 高 |
| Ingestワークフロー | 部署CLAUDE.mdのルール | 高 |

### ギャップ（~20%）

| Karpathyの概念 | 現状 | ギャップ |
|----------------|------|---------|
| index.md（横断目録） | なし | ナレッジの横断検索・参照が困難 |
| Lintワークフロー | 未実装 | 矛盾・古さ・孤立の自動検出なし |
| クエリ回答の還流 | 会話に消える | 良い回答がナレッジ化されない |
| raw/（原典保管） | なし | インプット情報の管理がない |

---

## III. 取り入れるべきポイント

### P0: 即座に着手（1週間以内）

1. **`~/.claude/knowledge/index.md` の作成** — 現在のナレッジYAMLの横断目録。LLMの参照精度向上
2. **`~/.claude/knowledge/log.md` の整備** — ingest・昇格・Lintの追記型年表

### P1: 中期的に取り入れる（1ヶ月以内）

3. **チャット回答の自動還流** — LLMに「ナレッジ化すべきか」判定させ、YesならMD自動生成
4. **Lintワークフロー** — weekly jobで成果物全体をスキャン（矛盾・古さ・孤立ページ検出）
5. **部署成果物のindex.md** — 各departments/に目録設置

### P2: 長期的な設計変更（3ヶ月以内）

6. **`.company/inbox/raw/` 設計** — 情報インプットの投入口
7. **Idea File形式** — コンサルノウハウをアイデアファイルとして蓄積

---

## IV. 限界の明示

1. gistの全文は二次情報から再構成（WebFetch権限制限のため）。schema.md例の直接確認を推奨
2. Karpathyは研究・知識整理が主目的、宮路HDはPJ管理・ビジネス実務が主目的
3. 還流パイプライン・Lintワークフローの実装工数は未算定
4. LLMのwiki品質リスク: 出典なし合成の検出には定期的な人間のスポットチェックが不可欠

---

## V. 壁打ち導線

- 「知識の蓄積がない」というRAGへの批判は、宮路HDのknowledge_baseにも当てはまるか?
- P0の「index.md作成」は1時間で着手できる。まず手動で作って効果を体感してみないか?
- 「Every business has a raw/ directory. Nobody's ever compiled it. That's the product」— クライアント企業で「未整理情報の宝の山」を持っているところは?
- コンサルノウハウをIdea File形式で蓄積するとしたら、どんな形が考えられるか?

---

## Sources

- [Karpathy LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [Andrej Karpathy on X - Idea File](https://x.com/karpathy/status/2040470801506541998)
- [VentureBeat - Karpathy shares LLM Knowledge Base](https://venturebeat.com/data/karpathy-shares-llm-knowledge-base-architecture-that-bypasses-rag-with-an)
- [antigravity.codes - Complete Guide to His Idea File](https://antigravity.codes/blog/karpathy-llm-wiki-idea-file)
- [DAIR.AI Academy - LLM Knowledge Bases](https://academy.dair.ai/blog/llm-knowledge-bases-karpathy)
- [Postscript - The Wiki That Writes Itself](https://extendedbrain.substack.com/p/postscript-the-wiki-that-writes-itself)
