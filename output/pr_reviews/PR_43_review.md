# PR #43 レビュー: Added management agenda creation

| 項目 | 内容 |
|------|------|
| **PR番号** | #43 |
| **タイトル** | Added management agenda creation |
| **作者** | stephen1807 (Stephen) |
| **ブランチ** | `stephenraharja/implement-hearing-4` → `develop` |
| **作成日** | 2026-02-25 |
| **変更規模** | 43ファイル (+1,053 / -90) |
| **推奨** | **Request Changes** |

---

## 1. PR概要

第4回ヒアリング（2026-02-19 ソリビヒアリング・定例会）の結果を反映し、**経営アジェンダ作成機能**を追加するPR。

### 主要な変更点

- **新規エージェント4件**
  - `AgendaExtractorAgent` -- 顧客アジェンダ（経営課題）の抽出
  - `AgendaFeedbackAgent` -- アジェンダ品質のフィードバック評価
  - `AgendaScorerAgent` -- アジェンダの優先度スコアリング
  - `DocumentWriterCustomerAgendaAgent` -- アジェンダドキュメント出力

- **ワークフロー拡張**: 6フェーズ → 9フェーズ
  - フェーズ2: 顧客アジェンダ抽出（新規）
  - フェーズ6: アジェンダの優先度付け（新規）
  - フェーズ7: 面談スクリプト作成（新規）

- **用語定義の統一**: アジェンダ→ニーズ→ソリューションの3層構造を全エージェントに反映

- **Web検索統合**: `ExternalInformationGathererAgent` をResponses APIに移行し `web_search` ホスト型ツールを統合

- **既存エージェント更新**
  - 全エージェントのプロンプトに3層構造の用語定義を反映
  - `NeedsExtractorAgent` から経営アジェンダツールを削除（AgendaExtractorAgentへ移管）
  - `ConversationHelperAgent` の役割をエンゲージメント戦略→面談スクリプト作成に変更

- **インフラ**: `BaseOpenAIClient` に `ResponsesClient` 追加、`BaseAgent` の `log_tools` をホスト型ツール対応

- **ドキュメント**: ワークフロー設計書・変更履歴14ファイル・ナレッジベース4ファイルを更新

### 変更ファイルの分類

| カテゴリ | ファイル数 | 主なファイル |
|----------|-----------|-------------|
| コード (Python) | 7 | `base_agent.py`, `base_openai_client.py`, 新規エージェント4件, `workflow_service.py` |
| プロンプト (md) | 17 | instructions 13件, knowledge_base 4件 |
| ドキュメント (md) | 16 | changelog 14件, `0_magentic_workflow.md` |
| その他 | 3 | `__init__.py`, `get_customer_information.py` |

---

## 2. レビュー結果

### 2.1 Critical / High（マージ前に要修正）

#### H-1: ワークフロー設計書（`0_magentic_workflow.md`）のフェーズ構成が未更新

- **ファイル**: `docs/algorithm/0_magentic_workflow.md`
- **問題**: `workflow_manager_instructions.md` ではフェーズを9つに拡張しているが、ワークフロー設計書は**旧6フェーズ構成のまま**
  - 112行目: 「6つのフェーズ」→「9つ」に更新が必要
  - フェーズ2「顧客アジェンダ抽出」が未追加
  - フェーズ6「アジェンダの優先度付け」、フェーズ7「面談スクリプト作成」が未追加
  - 既存フェーズの番号繰り下げが未反映
- **影響**: プロンプトと設計書でフェーズ構成が完全に不一致となり、ドキュメントの信頼性が損なわれる

#### H-2: `AgendaExtractorAgent` に経営アジェンダツールが割り当てられていない

- **ファイル**: `project_rikyu/agents/magentic/agenda_extractor_agent.py`
- **問題**: `get_tools()` は `customer_tools.get_customer_information_tools()` を呼び出しているが、この返り値には `get_customer_management_agenda` が**含まれていない**
  - 設計書のエージェント一覧では「顧客情報ツール（プロファイル、財務分析、キーパーソン、**経営アジェンダ**）」と記載
  - `NeedsExtractorAgent` からは経営アジェンダツールが削除済み
  - → 経営アジェンダデータにアクセスできるエージェントが存在しない状態
- **対応案**: `AgendaExtractorAgent.get_tools()` に `get_customer_management_agenda` を追加するか、`get_customer_information_tools()` の返り値に含める

#### H-3: フェーズ番号の旧番号参照が残存

- **ファイル**: `project_rikyu/prompts/instructions/magentic/workflow_manager_instructions.md`
- **問題**: フェーズ9「最終出力」で「**フェーズ5**で各ドキュメントライターエージェントが生成した出力の概要を出力」と記載。正しくは**フェーズ8**
- **影響**: ワークフロー実行時に参照不整合

#### H-4: `ExternalInformationGathererAgent.get_agent()` の型ヒント不一致

- **ファイル**: `project_rikyu/agents/magentic/external_information_gatherer_agent.py`
- **問題**: 返り値の型が `OpenAIResponsesClient` だが、`BaseAgent.get_agent()` の型ヒントは `OpenAIChatClient` を期待。LSP違反
- **影響**: 型チェッカーでエラー

#### H-5: `web_search` ツール取得のフォールバックが脆弱

- **ファイル**: `project_rikyu/agents/magentic/external_information_gatherer_agent.py`
- **問題**: `getattr` + dict フォールバック (`{'type': 'web_search'}`) で `web_search` ツールを取得。MAFがこの形式を受け入れるか不明
- **影響**: 実行時エラーの可能性

---

### 2.2 Medium（改善推奨）

#### M-1: `AgendaScorerAgent` の評価方式が設計書と不一致

- **設計書**: 「ニーズ充実度・ソリューション適合度・戦略的重要度・当行貢献度の**4観点**で評価する」
- **プロンプト**: 重要度・理解度・商品の明確さの**3観点** + 対応方針の4象限分類
- **changelog**: 「4観点スコア(1-10)方式 → 3観点評価方式に変更」と記載
- 設計書が旧版のまま

#### M-2: `AgendaFeedbackAgent` の評価基準数が不一致

- **設計書**: 7項目（「粒度の適切性」が欠落）
- **プロンプト / changelog**: 8項目（「粒度の適切性」を含む）

#### M-3: 「当社」vs「当行」の表記揺れ

以下のファイルで「当社」が残存（りそな銀行向けシステムのため「当行」に統一すべき）:
- `needs_feedback_instructions.md`: 「当社提供サービス」「当社の営業プロセス」
- `agenda_feedback_instructions.md`: 「当社のワークフロー」
- `solutions_feedback_instructions.md`: 「当社の営業プロセス」
- `0_magentic_workflow.md` フェーズ3: 「当社の製品・サービス」

#### M-4: `BaseOpenAIClient.__init__()` で全インスタンスに `OpenAIResponsesClient` を即時初期化

- **ファイル**: `project_rikyu/io/llm/base_openai_client.py`
- **問題**: 使うのは `ExternalInformationGathererAgent` の1箇所のみ。遅延初期化（`@property` + キャッシュ等）が望ましい

#### M-5: `get_customer_management_agenda` のメソッド定義がデッドコード化

- **ファイル**: `project_rikyu/agents/tools/get_customer_information.py`
- **問題**: `get_customer_information_tools()` から削除されたが、メソッド定義自体は残存。H-2の対応次第で復活させるか削除するか判断が必要

#### M-6: `AgendaFeedbackAgent` にスコアリング方式・合格基準の記載なし

- 他の Feedback Agent（NeedsFeedback, SolutionsFeedback）は10点満点のスコアリングと合格基準（8/10以上）を明記
- AgendaFeedbackAgent のプロンプトにはスコアリング方式と品質ゲートの記載がない

---

### 2.3 Low（軽微な指摘）

| # | 問題 | ファイル |
|---|------|----------|
| L-1 | ファイル末尾の改行欠落 | `agenda_extractor_instructions.md`, `agenda_scorer_instructions.md` |
| L-2 | description の英語文法: "put priority to" → "prioritizes" | `agenda_scorer_agent.py` |
| L-3 | 誤字: 「**在**の収益の柱」→「**現在**の収益の柱」 | `agenda_extractor_instructions.md` |
| L-4 | AGD-002 の `next_action` が AGD-001 のコピペ（海外事業拡大なのに同じ文面） | `agenda_scorer_instructions.md` |
| L-5 | ナレッジベース4件がプレースホルダーのまま | `agenda_*_knowledge_base.md`, `document_writer_customer_agenda_knowledge_base.md` |
| L-6 | `DocumentWriterCustomerAgenda` のセクション構成が設計書(5セクション)とプロンプト(4セクション)で不一致 | `0_magentic_workflow.md` |
| L-7 | 設計書にAgendaFeedbackのフィードバックループ説明が未追加 | `0_magentic_workflow.md` |

---

## 3. 良い点

1. **既存パターンの忠実な踏襲** -- 新規4エージェントのクラス構造・命名・`get_agent()`/`get_tools()` シグネチャが既存エージェントと一貫している
2. **3層構造の設計が優秀** -- アジェンダ（論点）→ニーズ（目標・課題）→ソリューション（手段）の定義と関係性が明確で、workflow_manager_instructions.md の用語定義セクションは図式（論点→ゴール→方針の大筋→手段）まで含み非常に分かりやすい
3. **モデル選定が合理的** -- GPT-5.2（高推論）、GPT-5-mini（構造化）、GPT-5-nano（評価）の使い分けが適切
4. **Responses API移行が段階的** -- リスクを最小化しつつ web_search 機能を活用
5. **AgendaScorerAgent のスコアリング設計が実践的** -- 重要度 x (理解度 + 商品の明確さ) の4象限分類は営業現場で直感的に使える
6. **用語定義の全エージェント反映が網羅的** -- NeedsExtractor, SolutionsSuggestor, Feedback系, DocumentWriter系すべてに3層構造の定義を追加
7. **DocumentWriterCustomerAgenda の「2ページ以内」制約が実務的** -- 面談前確認資料として適切な分量制限
8. **Web検索のガイドラインが充実** -- ExternalInformationGathererAgent の検索クエリ作成、信頼性評価、鮮度評価、タグ付けルールが体系的

---

## 4. 総合評価

| 指標 | 件数 |
|------|------|
| Critical | 0 |
| High | 5 |
| Medium | 6 |
| Low | 7 |

### 判定: **Request Changes**

3層構造（アジェンダ→ニーズ→ソリューション）の設計思想は優れており、コード品質も既存パターンに忠実。しかし **ワークフロー設計書（`0_magentic_workflow.md`）の更新が大幅に不足** しており、プロンプトとの間でフェーズ構成・番号・エージェント説明が不一致。

### マージ前に必須の対応

1. **H-1**: `0_magentic_workflow.md` のフェーズ構成を6→9に更新し、全フェーズ記述を `workflow_manager_instructions.md` と整合させる
2. **H-2**: `AgendaExtractorAgent` のツール割り当てに `get_customer_management_agenda` を追加する
3. **H-3**: フェーズ番号の参照（フェーズ9内「フェーズ5」→「フェーズ8」）を修正する
4. **H-4**: `get_agent()` の型ヒントを `BaseAgent` と整合させる
5. **H-5**: `web_search` ツール取得の堅牢性を確認する

---

*レビュー実施日: 2026-02-25*
*レビュアー: Claude Code*
