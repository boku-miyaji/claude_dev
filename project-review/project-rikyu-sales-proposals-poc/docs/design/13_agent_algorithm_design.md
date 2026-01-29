# 伴奏AIエージェント アルゴリズム設計

> **関連**: [設計書サマリ](00_summary.md) | [技術設計](06_technical_design.md) | [PoC検証システム](10_poc_system_redesign.md)

---

## 1. 設計思想

### 1.1 基本原則

| 原則 | 説明 |
|------|------|
| **LLMの力を信じる** | 複雑な判断はLLMに委ね、コードはシンプルに |
| **役割分担を明確に** | 各AIは単一責務、組み合わせて価値を発揮 |
| **拡張ポイントの明確化** | 将来のRAG/評価AI連携に備えた設計 |

### 1.2 4エージェント構成

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      伴奏AI 4エージェント構成                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  【メインパイプライン】                                                      │
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────┐                           │
│  │  ①ニーズ推定AI   │────────▶│ ②ソリューション │                           │
│  │                 │  ニーズ  │   推薦AI        │                           │
│  └─────────────────┘         └─────────────────┘                           │
│          │                           │                                      │
│          ▼                           ▼                                      │
│  ┌─────────────────┐         ┌─────────────────┐                           │
│  │  ③ニーズ推定    │         │ ④ソリューション │                           │
│  │    評価AI       │         │   推薦評価AI    │                           │
│  └─────────────────┘         └─────────────────┘                           │
│                                                                             │
│  【役割分担】                                                                │
│  ・①②: 営業支援の出力を生成（メインAI）                                     │
│  ・③④: 出力品質を評価・改善示唆（評価AI）                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 なぜ4エージェントに分けるか

```
【Single-Call方式】❌ 採用しない
┌───────────────────────────────────────────────┐
│ 全入力 ──▶ LLM 1回 ──▶ 全出力             │
└───────────────────────────────────────────────┘

問題点:
- 責務が混在し、プロンプトが複雑化
- 一部だけ改善したい場合も全体を再実行
- 評価・改善のPDCAが回しにくい


【4エージェント方式】✅ 採用
┌─────────┐    ┌─────────┐
│ニーズ   │───▶│ソリュー │
│推定AI   │    │ション   │
└────┬────┘    │推薦AI   │
     │         └────┬────┘
     ▼              ▼
┌─────────┐    ┌─────────┐
│ニーズ   │    │ソリュー │
│評価AI   │    │ション   │
└─────────┘    │評価AI   │
               └─────────┘

利点:
- 各AIの責務が明確、プロンプトがシンプル
- 個別に改善・評価が可能
- 評価AIを独立させることでPDCAが回しやすい
- 弱点の特定・改善が容易
```

---

## 2. 各エージェントの詳細設計

### 2.1 ①ニーズ推定AI

| 項目 | 内容 |
|------|------|
| **責務** | 顧客情報から潜在ニーズを推定し、情報の充足度を判定する |
| **入力** | 企業情報、面談記録、経営アジェンダシート、キーパーソンマップ |
| **出力** | 推定ニーズリスト、情報充足度判定、深掘りポイント |
| **LLMへの委譲** | ニーズの抽出・優先度判定・情報充足度の判断 |

```
┌─────────────────────────────────────────────────────────────────┐
│                    ①ニーズ推定AI                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【入力】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ・企業情報（業種、規模、財務状況）                        │   │
│  │ ・面談記録（顧客発言、議題）                              │   │
│  │ ・経営アジェンダシート（経営課題、中期計画）              │   │
│  │ ・キーパーソンマップ（意思決定者、関係性）                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  【処理】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. 入力データを統合してプロンプト構築                     │   │
│  │ 2. LLM呼び出し（ニーズ推定特化プロンプト）                │   │
│  │ 3. JSON形式で構造化出力                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  【出力】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ NeedsEstimationOutput:                                    │   │
│  │ ├─ estimated_needs: list[Need]  # 推定ニーズ             │   │
│  │ │   ├─ category      # カテゴリ                          │   │
│  │ │   ├─ priority      # 優先度（高/中/低）                │   │
│  │ │   ├─ confidence    # 確度（高/中/低）                  │   │
│  │ │   ├─ evidence      # 根拠                              │   │
│  │ │   └─ related_agenda # 関連アジェンダ                   │   │
│  │ ├─ information_sufficiency  # 情報充足度                 │   │
│  │ │   ├─ agenda_sufficiency   # アジェンダ充足度           │   │
│  │ │   └─ keymap_sufficiency   # マップ充足度               │   │
│  │ └─ deep_dive_points: list   # 深掘りポイント             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 ②ソリューション推薦AI

| 項目 | 内容 |
|------|------|
| **責務** | 推定ニーズに対して最適なソリューションを提案し、次のアクションを提示する |
| **入力** | ①の出力（推定ニーズ）、商材情報、経営アジェンダ、キーパーソンマップ |
| **出力** | 提案方針、推薦商材、ネクストアクション、アカウントプラン更新提案 |
| **LLMへの委譲** | 商材選定・提案ストーリー構築・アクション具体化 |

```
┌─────────────────────────────────────────────────────────────────┐
│                  ②ソリューション推薦AI                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【入力】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ・推定ニーズ（①の出力）                                  │   │
│  │ ・商材情報（商材カタログ、特徴）                          │   │
│  │ ・経営アジェンダシート                                    │   │
│  │ ・キーパーソンマップ                                      │   │
│  │ ・過去事例（類似企業への提案）                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  【処理】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. ニーズと商材のマッチング検討                           │   │
│  │ 2. キーパーソンを考慮したアプローチ策定                   │   │
│  │ 3. ネクストアクションの具体化                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  【出力】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SolutionRecommendationOutput:                             │   │
│  │ ├─ proposal_policy: str          # 提案方針              │   │
│  │ ├─ recommended_products: list    # 推薦商材              │   │
│  │ │   ├─ name           # 商材名                           │   │
│  │ │   ├─ target_need    # 対応ニーズ                       │   │
│  │ │   ├─ reason         # 推奨理由                         │   │
│  │ │   └─ priority       # 推薦順位                         │   │
│  │ ├─ next_actions: NextActions     # ★伴奏AI核心          │   │
│  │ │   ├─ agenda_deep_dives     # アジェンダ深掘り          │   │
│  │ │   ├─ key_person_approaches # 関係深化                  │   │
│  │ │   └─ additional_info       # 追加情報収集              │   │
│  │ └─ account_plan_update           # AP更新提案            │   │
│  │     ├─ agenda_update         # アジェンダ更新            │   │
│  │     └─ keymap_update         # マップ更新                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 ③ニーズ推定評価AI

| 項目 | 内容 |
|------|------|
| **責務** | ①ニーズ推定AIの出力品質を評価し、**どこで問題が発生したか**を特定し、具体的改善示唆を提供する |
| **入力** | ①の出力、**①のトレース情報（推論過程）**、入力コンテキスト、評価ルーブリック |
| **出力** | 評価スコア、**障害点分析**、具体的改善示唆 |
| **評価観点** | ニーズ網羅性、根拠の妥当性、実用性 |

```
┌─────────────────────────────────────────────────────────────────┐
│                   ③ニーズ推定評価AI                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【入力】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ・①の出力（NeedsEstimationOutput）                       │   │
│  │ ・★①のトレース情報（ReasoningTrace）                    │   │
│  │   - 入力解釈フェーズの中間出力                            │   │
│  │   - ニーズ抽出フェーズの推論過程                          │   │
│  │   - 優先度判定の根拠                                      │   │
│  │   - 情報充足度判定の思考過程                              │   │
│  │ ・入力コンテキスト（企業情報、面談記録等）                │   │
│  │ ・評価ルーブリック                                        │   │
│  │   - needs_coverage（ニーズ網羅性）                        │   │
│  │   - evidence_quality（根拠の妥当性）                      │   │
│  │   - practicality（実用性）                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  【処理】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. 各ルーブリックで評価（LLM-as-Judge）                   │   │
│  │ 2. ★トレース分析：どのフェーズで問題が発生したか特定     │   │
│  │    - 入力解釈の問題？（情報の見落とし）                   │   │
│  │    - ニーズ抽出の問題？（推論ロジック）                   │   │
│  │    - 優先度判定の問題？（判断基準）                       │   │
│  │ 3. 障害点に基づく具体的改善示唆を生成                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  【出力】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ NeedsEvaluationOutput:                                    │   │
│  │ ├─ scores: dict[str, RubricScore]                        │   │
│  │ │   ├─ needs_coverage: {score, rating, comment}          │   │
│  │ │   ├─ evidence_quality: {score, rating, comment}        │   │
│  │ │   └─ practicality: {score, rating, comment}            │   │
│  │ ├─ overall_rating: str   # 総合評価（◯/△/×）            │   │
│  │ ├─ overall_comment: str  # 総合コメント                  │   │
│  │ ├─ ★failure_point_analysis: FailurePointAnalysis        │   │
│  │ │   ├─ phase: str        # 問題発生フェーズ              │   │
│  │ │   ├─ issue_type: str   # 問題の種類                    │   │
│  │ │   ├─ evidence_from_trace: str  # トレースからの根拠    │   │
│  │ │   └─ root_cause: str   # 根本原因の推定                │   │
│  │ └─ improvement_suggestions: list[ImprovementAction]      │   │
│  │     ├─ target_phase: str # 改善対象フェーズ              │   │
│  │     ├─ action: str       # 具体的改善アクション          │   │
│  │     ├─ expected_effect: str  # 期待効果                  │   │
│  │     └─ priority: str     # 優先度                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 ④ソリューション推薦評価AI

| 項目 | 内容 |
|------|------|
| **責務** | ②ソリューション推薦AIの出力品質を評価し、**どこで問題が発生したか**を特定し、具体的改善示唆を提供する |
| **入力** | ②の出力、**②のトレース情報（推論過程）**、①の出力、入力コンテキスト、評価ルーブリック |
| **出力** | 評価スコア、**障害点分析**、具体的改善示唆 |
| **評価観点** | ソリューション適合度、提案理由の明確さ、ネクストアクション品質、AP更新提案有用性 |

```
┌─────────────────────────────────────────────────────────────────┐
│                 ④ソリューション推薦評価AI                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【入力】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ・②の出力（SolutionRecommendationOutput）                │   │
│  │ ・★②のトレース情報（ReasoningTrace）                    │   │
│  │   - ニーズ解釈フェーズの中間出力                          │   │
│  │   - 商材マッチングの推論過程                              │   │
│  │   - ネクストアクション生成の思考過程                      │   │
│  │   - AP更新提案の根拠                                      │   │
│  │ ・①の出力（推定ニーズ：評価の参照用）                    │   │
│  │ ・入力コンテキスト（企業情報等）                          │   │
│  │ ・評価ルーブリック                                        │   │
│  │   - solution_fit（ソリューション適合度）                  │   │
│  │   - reasoning_clarity（提案理由の明確さ）                 │   │
│  │   - next_action_quality（ネクストアクション品質）★       │   │
│  │   - account_plan_update（AP更新提案有用性）★             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  【処理】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. 各ルーブリックで評価（LLM-as-Judge）                   │   │
│  │ 2. ★トレース分析：どのフェーズで問題が発生したか特定     │   │
│  │    - ニーズ解釈の問題？（①の出力の誤読）                 │   │
│  │    - 商材マッチングの問題？（適合判断ロジック）           │   │
│  │    - アクション生成の問題？（具体性・実現可能性）         │   │
│  │    - AP更新の問題？（更新内容の妥当性）                   │   │
│  │ 3. ニーズとソリューションの整合性チェック                 │   │
│  │ 4. 障害点に基づく具体的改善示唆を生成                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  【出力】                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SolutionEvaluationOutput:                                 │   │
│  │ ├─ scores: dict[str, RubricScore]                        │   │
│  │ │   ├─ solution_fit: {score, rating, comment}            │   │
│  │ │   ├─ reasoning_clarity: {score, rating, comment}       │   │
│  │ │   ├─ next_action_quality: {score, rating, comment}     │   │
│  │ │   └─ account_plan_update: {score, rating, comment}     │   │
│  │ ├─ overall_rating: str   # 総合評価（◯/△/×）            │   │
│  │ ├─ overall_comment: str  # 総合コメント                  │   │
│  │ ├─ ★failure_point_analysis: FailurePointAnalysis        │   │
│  │ │   ├─ phase: str        # 問題発生フェーズ              │   │
│  │ │   ├─ issue_type: str   # 問題の種類                    │   │
│  │ │   ├─ evidence_from_trace: str  # トレースからの根拠    │   │
│  │ │   └─ root_cause: str   # 根本原因の推定                │   │
│  │ └─ improvement_suggestions: list[ImprovementAction]      │   │
│  │     ├─ target_phase: str # 改善対象フェーズ              │   │
│  │     ├─ action: str       # 具体的改善アクション          │   │
│  │     ├─ expected_effect: str  # 期待効果                  │   │
│  │     └─ priority: str     # 優先度                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 全体処理フロー

### 3.1 パイプライン全体像

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        伴奏AI パイプライン                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  【Step 1】入力受付                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ScenarioInput                                                        │   │
│  │ ├─ company_info       : 企業情報                                    │   │
│  │ ├─ meeting_record     : 面談記録                                    │   │
│  │ ├─ management_agenda  : 経営アジェンダシート                        │   │
│  │ ├─ key_person_map     : キーパーソンマップ                          │   │
│  │ └─ product_catalog    : 商材情報                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  【Step 2】ニーズ推定 ─────────────────────────────────────────────────────  │
│  ┌────────────────────────┐    ┌────────────────────────┐                   │
│  │  ①ニーズ推定AI         │═══▶│  ③ニーズ推定評価AI     │                   │
│  │  - ニーズ抽出          │出力│  - 品質評価            │                   │
│  │  - 情報充足度判定      │ + │  - ★トレース分析       │                   │
│  │  - ★推論過程トレース  │trace│ - 障害点特定          │                   │
│  └────────────────────────┘    │  - 具体的改善示唆      │                   │
│           │                    └────────────────────────┘                   │
│           │ NeedsEstimationOutput        │ NeedsEvaluationOutput            │
│           │ + ReasoningTrace              │ + FailurePointAnalysis          │
│           ▼                              ▼                                  │
│  【Step 3】ソリューション推薦 ─────────────────────────────────────────────  │
│  ┌────────────────────────┐    ┌────────────────────────┐                   │
│  │  ②ソリューション推薦AI │═══▶│ ④ソリューション評価AI  │                   │
│  │  - 商材提案            │出力│  - 品質評価            │                   │
│  │  - ネクストアクション  │ + │  - ★トレース分析       │                   │
│  │  - AP更新提案          │trace│ - 障害点特定          │                   │
│  │  - ★推論過程トレース  │    │  - 具体的改善示唆      │                   │
│  └────────────────────────┘    └────────────────────────┘                   │
│           │ SolutionOutput                │ SolutionEvaluationOutput        │
│           │ + ReasoningTrace              │ + FailurePointAnalysis          │
│           │                              │                                  │
│           ▼                              ▼                                  │
│  【Step 4】結果統合・トレース ─────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CompanionAIOutput                                                    │   │
│  │ ├─ needs_output       : ①の出力                                     │   │
│  │ ├─ solution_output    : ②の出力                                     │   │
│  │ ├─ needs_evaluation   : ③の出力（★障害点分析含む）                  │   │
│  │ ├─ solution_evaluation: ④の出力（★障害点分析含む）                  │   │
│  │ ├─ reasoning_traces   : ①②の推論過程トレース                        │   │
│  │ └─ execution_metrics  : 実行メトリクス                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 実行モード

| モード | 実行するAI | 用途 |
|--------|-----------|------|
| **フル実行** | ①②③④ | 品質評価を含む完全実行 |
| **メイン実行** | ①② | 評価なしの高速実行 |
| **ニーズのみ** | ①③ | ニーズ推定の検証 |
| **ソリューションのみ** | ②④ | ソリューション推薦の検証（ニーズは入力） |

---

## 4. データモデル

### 4.1 入力モデル

```yaml
ScenarioInput:
  # 必須入力
  company_info: str           # 企業情報
  meeting_record: str         # 面談記録
  management_agenda: str      # 経営アジェンダシート
  key_person_map: str         # キーパーソンマップ
  product_catalog: ProductCatalog  # ★商材カタログ（必須）

  # オプション入力
  past_cases: list            # 類似企業の過去事例
  external_info: str          # 外部環境情報

  # メタ情報
  scenario_id: str            # シナリオID（トレース用）

---

# ★商材カタログモデル
ProductCatalog:
  metadata:
    catalog_version: str      # カタログバージョン
    last_updated: str         # 最終更新日
  categories: list[Category]  # 商材カテゴリ一覧
  products: list[Product]     # 商材一覧
  matching_rules: dict        # ニーズ→商材マッチングルール

Category:
  id: str                     # カテゴリID（例: CAT-LOAN）
  name: str                   # カテゴリ名（例: 融資商品）
  description: str            # カテゴリ説明

Product:
  id: str                     # 商材ID（例: PROD-001）
  name: str                   # 商材名（例: シンジケートローン）
  category: str               # カテゴリID
  short_description: str      # 短い説明（1行）
  description: str            # 詳細説明
  target_needs: list[str]     # 対応ニーズ一覧
  target_segment:             # 対象セグメント
    売上規模: str             # 例: "50億円以上"
    業種: str                 # 例: "製造業"（オプション）
  typical_amount:             # 典型的な金額
    min: str                  # 最小（例: "10億円"）
    max: str                  # 最大（例: "500億円"）
  typical_term:               # 典型的な期間
    min: str                  # 最短（例: "3年"）
    max: str                  # 最長（例: "10年"）
  features: list[str]         # 商材の特徴
  keywords: list[str]         # 検索用キーワード
  matching_rules: list        # マッチングルール
    - condition: str          # 条件（例: "投資規模 >= 10億円"）
      weight: str             # 重み（高/中/低）

# ★主要商材一覧（PoC対象）
# - PROD-001: シンジケートローン（協調融資）
# - PROD-002: 設備資金融資
# - PROD-010: 設備リース
# - PROD-020: 事業承継コンサルティング
# - PROD-042: EV関連設備投資支援
#
# 詳細: data/fixtures/products/product_catalog.yaml 参照
```

### 4.2 出力モデル

```yaml
# ①ニーズ推定AI出力
NeedsEstimationOutput:
  estimated_needs: list[Need]
    - category: str           # カテゴリ
    - priority: str           # 優先度（高/中/低）
    - confidence: str         # 確度（高/中/低）
    - evidence: str           # 根拠
    - related_agenda: str     # 関連アジェンダ

  information_sufficiency:
    agenda_sufficiency: str   # 経営アジェンダ充足度
    agenda_gaps: list[str]    # 不足項目
    keymap_sufficiency: str   # キーパーソンマップ充足度
    keymap_gaps: list[str]    # 不足項目

  deep_dive_points: list[DeepDivePoint]
    - item: str               # 深掘り項目
    - current_level: str      # 現状把握レベル
    - what_to_confirm: list   # 確認すべきこと
    - how_to_confirm: str     # 確認方法
    - sample_questions: list  # 質問例

---

# ②ソリューション推薦AI出力
SolutionRecommendationOutput:
  proposal_policy: str        # 提案方針

  recommended_products: list[Product]
    - name: str               # 商材名
    - target_need: str        # 対応ニーズ
    - reason: str             # 推奨理由
    - proposal_points: str    # 提案ポイント
    - priority: int           # 推薦順位

  next_actions: NextActions   # ★伴奏AI核心
    agenda_deep_dives: list   # 経営アジェンダ深掘り
      - item: str
      - current_level: str
      - action: str
      - sample_questions: list
    key_person_approaches: list # キーパーソン関係深化
      - person: str
      - current_relationship: str
      - approach: str
      - expected_effect: str
    additional_info: list     # 追加情報収集

  account_plan_update: AccountPlanUpdate
    agenda_update:            # アジェンダ更新提案
      add_items: list
      change_items: list
      confirm_items: list
    keymap_update:            # マップ更新提案
      add_persons: list
      relationship_updates: list
      priority_updates: list

---

# ★トレース情報（評価AI入力用）
ReasoningTrace:
  trace_id: str               # トレースID
  agent_id: str               # ①または②
  phases: list[PhaseTrace]    # フェーズごとの推論過程

PhaseTrace:
  phase_name: str             # フェーズ名（例: input_interpretation, needs_extraction）
  phase_order: int            # 実行順序
  input_summary: str          # このフェーズへの入力要約
  reasoning_steps: list[str]  # 推論ステップ（思考過程）
  intermediate_output: str    # 中間出力
  confidence: str             # 確信度（高/中/低）
  key_decisions: list[str]    # このフェーズでの重要判断

# ①ニーズ推定AIのフェーズ例:
# - input_interpretation: 入力データの解釈
# - needs_extraction: ニーズの抽出
# - priority_assessment: 優先度の判定
# - sufficiency_evaluation: 情報充足度の判定
# - deep_dive_generation: 深掘りポイントの生成

# ②ソリューション推薦AIのフェーズ例:
# - needs_interpretation: ニーズの解釈
# - product_matching: 商材マッチング
# - proposal_strategy: 提案戦略策定
# - next_action_generation: ネクストアクション生成
# - account_plan_update: AP更新提案生成

---

# ③ニーズ推定評価AI出力
NeedsEvaluationOutput:
  scores:
    needs_coverage: RubricScore
    evidence_quality: RubricScore
    practicality: RubricScore

  overall_rating: str         # ◯/△/×
  overall_comment: str        # 総合コメント

  # ★トレース分析に基づく障害点分析
  failure_point_analysis: FailurePointAnalysis
  improvement_suggestions: list[ImprovementAction]

---

# ④ソリューション推薦評価AI出力
SolutionEvaluationOutput:
  scores:
    solution_fit: RubricScore
    reasoning_clarity: RubricScore
    next_action_quality: RubricScore
    account_plan_update: RubricScore

  overall_rating: str         # ◯/△/×
  overall_comment: str        # 総合コメント

  # ★トレース分析に基づく障害点分析
  failure_point_analysis: FailurePointAnalysis
  improvement_suggestions: list[ImprovementAction]

---

# ★障害点分析（トレース分析結果）
FailurePointAnalysis:
  has_issue: bool             # 問題があったか
  phase: str                  # 問題発生フェーズ（例: needs_extraction）
  issue_type: str             # 問題の種類
                              # - information_oversight: 情報の見落とし
                              # - reasoning_error: 推論の誤り
                              # - judgment_criteria: 判断基準の問題
                              # - context_misunderstanding: 文脈の誤解
                              # - knowledge_gap: 知識の不足
  evidence_from_trace: str    # トレースから特定した根拠
  root_cause: str             # 根本原因の推定
  severity: str               # 深刻度（高/中/低）

# ★具体的改善アクション
ImprovementAction:
  target_phase: str           # 改善対象フェーズ
  action: str                 # 具体的改善アクション
  action_type: str            # アクション種別
                              # - prompt_enhancement: プロンプト改善
                              # - knowledge_addition: 知識追加
                              # - reasoning_guidance: 推論ガイダンス追加
                              # - validation_rule: バリデーション追加
  expected_effect: str        # 期待効果
  priority: str               # 優先度（高/中/低）
  implementation_hint: str    # 実装ヒント（プロンプト例など）

---

# 共通: ルーブリックスコア
RubricScore:
  score: int                  # 1-5
  rating: str                 # ◯/△/×
  comment: str                # 評価コメント
  evidence: str               # 根拠
```

---

## 5. プロンプト設計

### 5.1 プロンプト構成（4AIそれぞれ）

| AI | システムプロンプト | ユーザープロンプト |
|----|------------------|------------------|
| ①ニーズ推定 | 役割定義 + タスク説明 + 出力形式 | 入力データ + 分析指示 |
| ②ソリューション推薦 | 役割定義 + 商材知識 + 出力形式 | ニーズ + 入力データ + 提案指示 |
| ③ニーズ評価 | 評価者としての役割 + ルーブリック | ①の出力 + 入力コンテキスト |
| ④ソリューション評価 | 評価者としての役割 + ルーブリック | ②の出力 + ①の出力 + 入力コンテキスト |

### 5.2 LLMへの委譲方針

```
【コードで制御すること】
- 入出力の型定義
- プロンプトの構築
- JSON解析
- エラーハンドリング
- パイプラインの制御

【LLMに委ねること】★重要
- ①: ニーズの抽出・優先順位付け・情報充足度の判定
- ②: 商材選定・提案ストーリー構築・アクション具体化
- ③: ニーズ推定の品質評価・改善示唆
- ④: ソリューション推薦の品質評価・改善示唆

→ 「何を出力すべきか」を指示し、
  「どう判断すべきか」はLLMの推論に任せる
```

---

## 6. 拡張ポイント

### 6.1 拡張ロードマップ

| Phase | 拡張ポイント | 現在 | 将来 |
|-------|-------------|------|------|
| PoC | Knowledge | 静的埋め込み | - |
| MVP | Knowledge | 静的埋め込み | RAG / Vector DB |
| MVP | Tracer | ファイル出力 | Opik連携 |
| 本番 | LLM | 単一モデル | モデル切替、A/Bテスト |
| 本番 | Output | JSON解析 | Structured Output |
| 本番 | Evaluation | 4AI構成 | 人評価との併用 |

### 6.2 KnowledgeProvider（拡張ポイント①）

```
インターフェース:
- get_knowledge(context) -> Knowledge

実装パターン:
- Static: ハードコードされた商材情報
- RAG: ベクトル検索で関連知識を取得
- API: 外部APIから最新情報を取得
- Hybrid: 複数ソースの組み合わせ
```

### 6.3 Tracer（拡張ポイント②）: 評価AIのためのトレーシング

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    トレーシング戦略：評価AIのための推論過程記録                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  【なぜトレースが必要か】                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 評価AIが「何が悪いか」だけでなく「どこで/なぜ悪くなったか」を        │   │
│  │ 特定するためには、メインAI（①②）の推論過程が必要                    │   │
│  │                                                                     │   │
│  │ 最終出力だけ見ても:                                                  │   │
│  │ - 入力の読み取りミスなのか                                          │   │
│  │ - 推論ロジックの問題なのか                                          │   │
│  │ - 判断基準の問題なのか                                              │   │
│  │ が分からない → 改善策が曖昧になる                                   │   │
│  │                                                                     │   │
│  │ トレースがあれば:                                                    │   │
│  │ - どのフェーズで問題が発生したか特定可能                            │   │
│  │ - 具体的な改善アクション（プロンプト修正等）を提示可能              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  【トレース記録内容】                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 基本情報:                                                            │   │
│  │ - trace_id, scenario_id, timestamp                                  │   │
│  │ - 各AIの入出力                                                       │   │
│  │ - メトリクス（トークン、コスト、レイテンシ）                        │   │
│  │                                                                     │   │
│  │ ★評価AI用の推論過程（ReasoningTrace）:                              │   │
│  │ - フェーズごとの中間出力                                            │   │
│  │ - 推論ステップ（LLMの思考過程）                                     │   │
│  │ - 重要判断とその根拠                                                │   │
│  │ - 確信度                                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  【トレース取得方法】                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 方式1: Chain-of-Thought出力                                         │   │
│  │ - プロンプトで「思考過程を出力せよ」と指示                          │   │
│  │ - JSON形式で構造化された推論過程を取得                              │   │
│  │                                                                     │   │
│  │ 方式2: Multi-step実行                                                │   │
│  │ - フェーズごとに別々のLLM呼び出し                                   │   │
│  │ - 各フェーズの入出力を自然に記録                                    │   │
│  │                                                                     │   │
│  │ PoC採用: 方式1（シンプルさ優先）                                     │   │
│  │ 将来拡張: 方式2も検討（より詳細な制御が必要な場合）                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

切り替え:
- 環境変数 TRACER_TYPE=opik | langfuse | noop
```

---

## 7. MS Agent Framework + Opik 実装設計

### 7.1 技術スタック

| 項目 | 技術 | バージョン | 用途 |
|------|------|----------|------|
| **エージェント基盤** | Azure AI Agent Service (azure-ai-projects) | 2.0.0b2 | 4エージェントの構築・実行 |
| **LLM** | Azure OpenAI (GPT-5.2) | - | 推論・評価 |
| **トレーシング** | Opik | latest | 推論過程の記録・評価AI連携 |
| **Structured Output** | Pydantic | v2 | 入出力の型定義 |

### 7.2 MS Agent Framework による4エージェント構成

```python
# === 4エージェント構成 with MS Agent Framework ===
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient, PromptAgentDefinition
import os

class CompanionAIPipeline:
    """伴奏AI 4エージェントパイプライン"""

    def __init__(self, endpoint: str):
        self.credential = DefaultAzureCredential()
        self.project_client = AIProjectClient(
            endpoint=endpoint,
            credential=self.credential
        )
        self.openai_client = self.project_client.get_openai_client()
        self.agents = {}

    def setup_agents(self):
        """4エージェントを作成"""
        model = os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"]

        # ①ニーズ推定AI
        self.agents["needs_estimation"] = self.project_client.agents.create_version(
            agent_name="NeedsEstimationAgent",
            definition=PromptAgentDefinition(
                model=model,
                instructions=self._load_prompt("prompts/needs_estimation_system.txt"),
                temperature=0.3,
            ),
        )

        # ②ソリューション推薦AI
        self.agents["solution_recommendation"] = self.project_client.agents.create_version(
            agent_name="SolutionRecommendationAgent",
            definition=PromptAgentDefinition(
                model=model,
                instructions=self._load_prompt("prompts/solution_recommendation_system.txt"),
                temperature=0.3,
            ),
        )

        # ③ニーズ推定評価AI
        self.agents["needs_evaluation"] = self.project_client.agents.create_version(
            agent_name="NeedsEvaluationAgent",
            definition=PromptAgentDefinition(
                model=model,
                instructions=self._load_prompt("prompts/needs_evaluation_system.txt"),
                temperature=0.1,  # 評価は低温で安定させる
            ),
        )

        # ④ソリューション推薦評価AI
        self.agents["solution_evaluation"] = self.project_client.agents.create_version(
            agent_name="SolutionEvaluationAgent",
            definition=PromptAgentDefinition(
                model=model,
                instructions=self._load_prompt("prompts/solution_evaluation_system.txt"),
                temperature=0.1,
            ),
        )

    def _load_prompt(self, path: str) -> str:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
```

### 7.3 Opik によるトレーシング実装

```python
# === Opik トレーシング ===
import opik
from opik import track, Opik
from opik.opik_context import get_current_span_data, update_current_span
from pydantic import BaseModel, Field
from typing import List, Optional

opik.configure(project_name="companion-ai-poc")
opik_client = Opik(project_name="companion-ai-poc")

# === フェーズごとの推論トレース ===
class PhaseTrace(BaseModel):
    """フェーズごとの推論過程"""
    phase_name: str
    phase_order: int
    input_summary: str
    reasoning_steps: List[str]
    intermediate_output: str
    confidence: str
    key_decisions: List[str]

class ReasoningTrace(BaseModel):
    """推論トレース全体"""
    trace_id: str
    agent_id: str
    phases: List[PhaseTrace]

# === トレース付きエージェント実行 ===
class TracedAgentExecutor:
    """Opikトレース付きエージェント実行"""

    def __init__(self, pipeline: CompanionAIPipeline):
        self.pipeline = pipeline

    @track(name="needs_estimation", capture_output=True)
    async def run_needs_estimation(
        self,
        company_info: str,
        meeting_record: str,
        management_agenda: dict,
        key_person_map: dict
    ) -> tuple[dict, ReasoningTrace]:
        """①ニーズ推定AI実行（トレース付き）"""

        # 現在のSpan情報を取得
        span_data = get_current_span_data()

        # フェーズごとにトレースを記録
        phases = []

        # Phase 1: 入力解釈
        input_interpretation = await self._run_phase(
            phase_name="input_interpretation",
            phase_order=1,
            prompt=f"""
            以下の入力を解釈し、重要なポイントを抽出してください。
            企業情報: {company_info}
            面談記録: {meeting_record}
            経営アジェンダ: {management_agenda}
            キーパーソンマップ: {key_person_map}
            """,
            output_instruction="重要ポイントと解釈を出力"
        )
        phases.append(input_interpretation)

        # Phase 2: ニーズ抽出
        needs_extraction = await self._run_phase(
            phase_name="needs_extraction",
            phase_order=2,
            prompt=f"""
            解釈結果: {input_interpretation.intermediate_output}
            上記から顧客ニーズを抽出してください。
            """,
            output_instruction="顕在・潜在ニーズを列挙"
        )
        phases.append(needs_extraction)

        # Phase 3: 優先度判定
        priority_assessment = await self._run_phase(
            phase_name="priority_assessment",
            phase_order=3,
            prompt=f"""
            ニーズ: {needs_extraction.intermediate_output}
            各ニーズの優先度を判定してください。
            """,
            output_instruction="優先度とその根拠"
        )
        phases.append(priority_assessment)

        # Spanにメタデータを追加
        update_current_span(
            metadata={
                "agent_type": "needs_estimation",
                "phases_count": len(phases),
                "input_length": len(company_info) + len(meeting_record)
            }
        )

        # 最終出力を構築
        final_output = await self._build_needs_output(phases)

        # ReasoningTraceを構築
        reasoning_trace = ReasoningTrace(
            trace_id=span_data.trace_id if span_data else "unknown",
            agent_id="needs_estimation",
            phases=phases
        )

        return final_output, reasoning_trace

    @track(name="solution_recommendation", capture_output=True)
    async def run_solution_recommendation(
        self,
        needs_output: dict,
        product_catalog: str,
        management_agenda: dict,
        key_person_map: dict
    ) -> tuple[dict, ReasoningTrace]:
        """②ソリューション推薦AI実行（トレース付き）"""

        span_data = get_current_span_data()
        phases = []

        # Phase 1: ニーズ解釈
        needs_interpretation = await self._run_phase(
            phase_name="needs_interpretation",
            phase_order=1,
            prompt=f"ニーズ: {needs_output}\n上記ニーズを解釈",
            output_instruction="ニーズの優先順位と対応方針"
        )
        phases.append(needs_interpretation)

        # Phase 2: 商材マッチング
        product_matching = await self._run_phase(
            phase_name="product_matching",
            phase_order=2,
            prompt=f"ニーズ解釈: {needs_interpretation.intermediate_output}\n商材: {product_catalog}",
            output_instruction="マッチする商材と理由"
        )
        phases.append(product_matching)

        # Phase 3: ネクストアクション生成
        next_action_generation = await self._run_phase(
            phase_name="next_action_generation",
            phase_order=3,
            prompt=f"マッチング結果: {product_matching.intermediate_output}\nアジェンダ: {management_agenda}\nキーパーソン: {key_person_map}",
            output_instruction="具体的ネクストアクション"
        )
        phases.append(next_action_generation)

        # Phase 4: AP更新提案
        account_plan_update = await self._run_phase(
            phase_name="account_plan_update",
            phase_order=4,
            prompt=f"全フェーズ結果からアカウントプラン更新提案を生成",
            output_instruction="アジェンダ・マップの更新提案"
        )
        phases.append(account_plan_update)

        update_current_span(metadata={"agent_type": "solution_recommendation", "phases_count": len(phases)})

        final_output = await self._build_solution_output(phases)
        reasoning_trace = ReasoningTrace(
            trace_id=span_data.trace_id if span_data else "unknown",
            agent_id="solution_recommendation",
            phases=phases
        )

        return final_output, reasoning_trace

    async def _run_phase(
        self,
        phase_name: str,
        phase_order: int,
        prompt: str,
        output_instruction: str
    ) -> PhaseTrace:
        """フェーズを実行しトレースを記録"""
        # LLM呼び出し（Chain-of-Thought形式で思考過程も出力）
        response = await self._call_llm_with_cot(prompt, output_instruction)

        return PhaseTrace(
            phase_name=phase_name,
            phase_order=phase_order,
            input_summary=prompt[:200],  # 要約
            reasoning_steps=response["reasoning_steps"],
            intermediate_output=response["output"],
            confidence=response["confidence"],
            key_decisions=response["key_decisions"]
        )
```

### 7.4 評価AIへのトレース連携

```python
# === 評価AI: トレース分析による障害点特定 ===
from opik.evaluation.metrics import BaseMetric, score_result

class NeedsEvaluationMetric(BaseMetric):
    """③ニーズ推定評価AI（Opikカスタムメトリクス）"""

    def __init__(self, rubrics: dict, llm_client):
        super().__init__(name="needs_evaluation")
        self.rubrics = rubrics
        self.llm_client = llm_client

    def score(
        self,
        needs_output: dict,
        reasoning_trace: ReasoningTrace,
        input_context: dict,
        **kwargs
    ) -> score_result.ScoreResult:
        """トレースを分析して評価・障害点特定"""

        # 1. ルーブリック評価
        rubric_scores = self._evaluate_rubrics(needs_output, input_context)

        # 2. トレース分析による障害点特定
        failure_analysis = self._analyze_trace_for_failures(
            reasoning_trace,
            rubric_scores,
            input_context
        )

        # 3. 改善示唆の生成
        improvement_suggestions = self._generate_improvements(
            failure_analysis,
            reasoning_trace
        )

        # 総合スコア
        avg_score = sum(s["score"] for s in rubric_scores.values()) / len(rubric_scores)

        return score_result.ScoreResult(
            value=avg_score / 5.0,  # 0-1に正規化
            name=self.name,
            reason=failure_analysis.get("root_cause", "評価完了"),
            metadata={
                "rubric_scores": rubric_scores,
                "failure_analysis": failure_analysis,
                "improvement_suggestions": improvement_suggestions
            }
        )

    def _analyze_trace_for_failures(
        self,
        trace: ReasoningTrace,
        rubric_scores: dict,
        input_context: dict
    ) -> dict:
        """トレースを分析して障害点を特定"""

        # 低スコアのルーブリックを特定
        low_score_rubrics = [
            k for k, v in rubric_scores.items() if v["score"] <= 2
        ]

        if not low_score_rubrics:
            return {"has_issue": False}

        # トレースの各フェーズを分析
        prompt = f"""
        以下のトレース情報と低スコアの評価結果を分析し、
        どのフェーズでどのような問題が発生したかを特定してください。

        【トレース情報】
        {[p.model_dump() for p in trace.phases]}

        【低スコアの評価項目】
        {low_score_rubrics}

        【入力コンテキスト】
        {input_context}

        【出力形式】
        - phase: 問題が発生したフェーズ名
        - issue_type: information_oversight | reasoning_error | judgment_criteria | context_misunderstanding | knowledge_gap
        - evidence_from_trace: トレースから特定した根拠
        - root_cause: 根本原因の推定
        """

        analysis = self.llm_client.structured_output(
            prompt=prompt,
            response_model=FailurePointAnalysis
        )

        return analysis.model_dump()
```

### 7.5 パイプライン全体フロー（Opik統合）

```python
# === フル実行パイプライン ===
@track(name="companion_ai_full_pipeline")
async def run_full_pipeline(scenario_input: dict) -> dict:
    """4エージェント フル実行パイプライン"""

    # 初期化
    pipeline = CompanionAIPipeline(endpoint=os.environ["AZURE_AI_ENDPOINT"])
    pipeline.setup_agents()
    executor = TracedAgentExecutor(pipeline)

    # ①ニーズ推定AI
    needs_output, needs_trace = await executor.run_needs_estimation(
        company_info=scenario_input["company_info"],
        meeting_record=scenario_input["meeting_record"],
        management_agenda=scenario_input["management_agenda"],
        key_person_map=scenario_input["key_person_map"]
    )

    # ②ソリューション推薦AI
    solution_output, solution_trace = await executor.run_solution_recommendation(
        needs_output=needs_output,
        product_catalog=scenario_input["product_catalog"],
        management_agenda=scenario_input["management_agenda"],
        key_person_map=scenario_input["key_person_map"]
    )

    # ③ニーズ推定評価AI（トレース連携）
    needs_eval_metric = NeedsEvaluationMetric(rubrics=NEEDS_RUBRICS, llm_client=llm_client)
    needs_evaluation = needs_eval_metric.score(
        needs_output=needs_output,
        reasoning_trace=needs_trace,
        input_context=scenario_input
    )

    # ④ソリューション推薦評価AI（トレース連携）
    solution_eval_metric = SolutionEvaluationMetric(rubrics=SOLUTION_RUBRICS, llm_client=llm_client)
    solution_evaluation = solution_eval_metric.score(
        solution_output=solution_output,
        reasoning_trace=solution_trace,
        needs_output=needs_output,
        input_context=scenario_input
    )

    # Opikにフィードバックスコアを記録
    opik_client.log_traces_feedback_scores([
        {"id": needs_trace.trace_id, "name": "needs_estimation_quality", "value": needs_evaluation.value},
        {"id": solution_trace.trace_id, "name": "solution_recommendation_quality", "value": solution_evaluation.value}
    ])

    return {
        "needs_output": needs_output,
        "solution_output": solution_output,
        "needs_evaluation": needs_evaluation.metadata,
        "solution_evaluation": solution_evaluation.metadata,
        "traces": {
            "needs": needs_trace.model_dump(),
            "solution": solution_trace.model_dump()
        }
    }
```

### 7.6 Opik ダッシュボードでの可視化

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Opik ダッシュボード 活用方法                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  【トレース一覧】                                                            │
│  ├─ companion_ai_full_pipeline                                              │
│  │   ├─ needs_estimation (①)                                               │
│  │   │   ├─ input_interpretation                                           │
│  │   │   ├─ needs_extraction                                               │
│  │   │   └─ priority_assessment                                            │
│  │   ├─ solution_recommendation (②)                                        │
│  │   │   ├─ needs_interpretation                                           │
│  │   │   ├─ product_matching                                               │
│  │   │   ├─ next_action_generation                                         │
│  │   │   └─ account_plan_update                                            │
│  │   ├─ needs_evaluation (③) ← トレース参照                                │
│  │   └─ solution_evaluation (④) ← トレース参照                             │
│                                                                             │
│  【フィードバックスコア】                                                    │
│  ├─ needs_estimation_quality: 0.72                                         │
│  ├─ solution_recommendation_quality: 0.68                                  │
│  └─ (rubric別スコアもメタデータに記録)                                     │
│                                                                             │
│  【分析ビュー】                                                              │
│  ├─ 障害点分析: phase=needs_extraction, issue_type=information_oversight   │
│  ├─ 改善示唆: プロンプトに「雑談も分析対象」を追加                          │
│  └─ 改善効果トラッキング: プロンプト修正前後のスコア比較                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. 検証シナリオとの対応

### 8.1 SCENARIO-001 での動作イメージ

```
入力:
- 企業情報: 精密工業株式会社、売上320億円、設備老朽化...
- 面談記録: 常務との面談、設備投資30-40億円...
- 経営アジェンダ: 設備老朽化対応(高)、事業承継(中)...
- キーパーソンマップ: 社長(接点薄い)、専務(面識なし)、常務(良好)...
- ★商材カタログ: シンジケートローン、設備資金融資、設備リース、
                事業承継コンサル、EV関連設備投資支援 など
                （data/fixtures/products/product_catalog.yaml）

↓ ①ニーズ推定AI

ニーズ出力:
- estimated_needs: [{設備投資資金, 高}, {事業承継対策, 中〜高}, ...]
- information_sufficiency: {agenda: 中, gaps: [投資詳細]...}
- deep_dive_points: [{投資計画詳細, 質問例: ...}]

↓ ③ニーズ評価AI

ニーズ評価:
- scores: {needs_coverage: 4, evidence_quality: 4, practicality: 3}
- overall_rating: ◯
- improvement_suggestions: ["潜在ニーズの深掘りを追加"]

↓ ②ソリューション推薦AI

ソリューション出力:
- proposal_policy: "設備投資を軸に、事業承継を組み合わせ..."
- recommended_products: [{シンジケートローン, 1}, ...]
- next_actions:
    agenda_deep_dives: [{投資計画詳細, 質問例: ...}]
    key_person_approaches: [{専務, 常務経由でアプローチ}]
- account_plan_update:
    agenda: {add: [投資優先順位], change: [事業承継: 中→中〜高]}
    keymap: {priority: [専務との接点構築を最優先]}

↓ ④ソリューション評価AI

ソリューション評価:
- scores: {solution_fit: 4, reasoning: 4, next_action: 5, ap_update: 4}
- overall_rating: ◯
- improvement_suggestions: ["競合動向への言及を追加"]
```

---

## 9. 変更履歴

| バージョン | 日付 | 変更内容 |
|------------|------|----------|
| v1.0 | 2026-01-25 | 初版作成（Single-Call方式） |
| v2.0 | 2026-01-25 | 4エージェント構成に再設計（ニーズ推定AI、ソリューション推薦AI、それぞれの評価AI） |
| v3.0 | 2026-01-25 | **トレース活用評価**: 評価AIが推論過程（トレース）を分析し、障害点特定・具体的改善示唆を行う設計に拡張 |
| v4.0 | 2026-01-25 | **MS Agent Framework + Opik実装設計**: Azure AI Agent Service (azure-ai-projects 2.0.0b2) と Opik を使った具体的な実装設計を追加。4エージェントの構成・トレーシング・評価AI連携のコード例を記載 |
| v4.1 | 2026-01-27 | **商材カタログ追加**: 入力モデルに商材カタログ（ProductCatalog）を追加。シナリオに商材情報を追加。data/fixtures/products/product_catalog.yaml を参照 |
