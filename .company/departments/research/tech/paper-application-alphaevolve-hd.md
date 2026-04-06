# 論文適用設計書: AlphaEvolve思想 × HD仮想カンパニー

- ステータス: draft
- 作成日: 2026-04-07
- 元論文: "Discovering Multiagent Learning Algorithms with LLMs" (arxiv:2602.16928)
- 担当: リサーチ部 + 秘書

---

## 論文の核心（3行要約）

1. **LLMで「アルゴリズムのコード」を進化させる** — 変異→評価→選択のループ
2. **フィットネス関数で自動評価** — 人間の直感に頼らず、実績データで良し悪しを判定
3. **非直感的だが有効な設計を発見** — 人間が思いつかない組み合わせをLLMが提案

---

## HDシステムへの適用マップ

| 論文の概念 | HDでの対応物 | 適用アイデア |
|-----------|-------------|-------------|
| アルゴリズムのコード | `CLAUDE.md` / `rules/` / Agent定義 | ルール自体を進化対象にする |
| フィットネス関数 | 人事部の5軸評価 | 評価指標を自動フィットネスに転用 |
| 変異操作（LLMによる提案） | 人事部の改善提案 | LLMが自動でルール変異を生成 |
| 世代選択 | 社長承認 | 実績データで自動フィルタ→社長は最終承認のみ |
| VAD（ボラティリティ適応割引） | パイプライン選択 | タスク結果のブレに応じて自動度を調整 |
| Hard Warm-Starting | PJ会社オンボーディング | 類似PJのルールを積極転用 |
| PSRO（母集団ベース戦略） | 部署の委譲テンプレート | プロンプト戦略の複数バリアント保持 |

---

## 適用案1: Self-Evolving CLAUDE.md（自己進化ルール）

### 現状の問題
- 人事部の改善サイクルは「同じ修正2回→提案」のトリガーだが、**提案内容は秘書の推測に依存**
- ルール改善は反応的（失敗してから直す）で、先手を打てない

### 論文からの着想
AlphaEvolveは「現行コード→LLMが変異提案→テスト環境で評価→良いものを採用」のループ。
これをCLAUDE.mdに適用する。

### 設計

```
┌─────────────────────────────────────────────┐
│  Self-Evolving CLAUDE.md ループ              │
│                                             │
│  ① 現行ルール + 実績データを入力              │
│     ↓                                       │
│  ② LLMが「ルール変異体」を3-5個生成           │
│     例: "委譲テンプレートにコスト上限を追加"    │
│     例: "QAステップで型チェック必須を外す"      │
│     ↓                                       │
│  ③ フィットネス関数で自動スコアリング          │
│     - 過去の同種タスクの一発OK率で予測          │
│     - ルール複雑度ペナルティ（簡潔さ重視）      │
│     - 社長フィードバック履歴との整合性           │
│     ↓                                       │
│  ④ スコア上位の変異体を社長に提示              │
│     「このルール変更で一発OK率が推定+15%です」  │
│     ↓                                       │
│  ⑤ 社長承認 → rules/ に反映                  │
│     却下 → 理由を記録 → 次回の変異に反映       │
└─────────────────────────────────────────────┘
```

### フィットネス関数（具体案）

```python
def fitness(rule_variant, historical_data):
    # 過去タスクで「このルールがあれば防げた失敗」の件数
    prevented_failures = count_preventable(rule_variant, historical_data.corrections)
    
    # ルールの簡潔度（トークン数の逆数）
    brevity = 1.0 / len(tokenize(rule_variant))
    
    # 既存ルールとの矛盾度（低いほど良い）
    consistency = 1.0 - contradiction_score(rule_variant, current_rules)
    
    # 社長の過去の承認パターンとの整合性
    ceo_alignment = predict_approval(rule_variant, historical_data.approvals)
    
    return (prevented_failures * 0.4 
            + brevity * 0.1 
            + consistency * 0.2 
            + ceo_alignment * 0.3)
```

### 実装方針
- **データソース**: `prompt_log`（修正指示）, `knowledge_base`（承認/却下履歴）, `activity_log`（差し戻し）
- **実行タイミング**: weekly-digest 実行時に併せて
- **出力先**: `.company/hr/proposals/YYYY-MM-DD-evolved-rules.md`
- **社長承認ゲート**: 既存のナレッジ昇格フローをそのまま使用

---

## 適用案2: Volatility-Adaptive Pipeline（変動適応型パイプライン）

### 現状の問題
- パイプライン選択は「キーワードマッチ」で固定的
- 実行モード（full-auto / checkpoint / step-by-step）は毎回社長に確認
- **同じ種類のタスクでも、最近の成功率によって適切な自動度が変わる**はず

### 論文からの着想
VAD-CFRの「ボラティリティ適応型割引」: **最近の結果が安定→割引小（過去を信頼）、不安定→割引大（慎重に）**

### 設計

```
volatility = stddev(最近5回の同種タスクの一発OK率)

if volatility < 0.1:
    # 安定期: 過去の実績を強く信頼
    推奨モード = "full-auto"
    推奨チェックポイント = なし
    
elif volatility < 0.3:
    # 通常: バランス
    推奨モード = "checkpoint"  
    推奨チェックポイント = "設計完了後"
    
else:
    # 不安定期: 慎重に
    推奨モード = "step-by-step"
    推奨チェックポイント = "各ステップ"
```

### 実装方針
- `pipeline_runs` テーブルの実績データを使用
- 秘書がStep 0（事前確認）で提示する際、volatility に基づくデフォルト推奨を表示:
  ```
  🔧 推奨モード: full-auto（直近5回の一発OK率: 100% / 変動: 0.0）
  ```
- **社長がオーバーライド可能**（推奨はあくまで提案）

---

## 適用案3: Hard Warm-Starting for PJ Companies

### 現状の問題
- 新PJ会社は `references/departments.md` のテンプレートから生成
- **既存PJで学んだルール・ナレッジが自動的に引き継がれない**
- 同じ種類の失敗を新PJで繰り返すリスク

### 論文からの着想
Hard Warm-Starting: **以前の学習結果を積極的に活用して収束を加速**

### 設計

```
新PJ会社作成時:
  1. 既存PJ会社をベクトル類似度でランキング
     - 入力: 新PJの説明文
     - 比較対象: 既存PJのCLAUDE.md + 蓄積ナレッジ
     
  2. 最も類似するPJの「進化済みルール」を抽出
     - knowledge_base から status='active' & company_id=類似PJ のルール
     - 一発OK率が高かったパイプライン設定
     - 部署構成の実績（どの部署が稼働率高かったか）
     
  3. 新PJのCLAUDE.mdに「Warm-Start セクション」として注入
     ---
     ## Warm-Start（類似PJからの知見転用）
     
     転用元: {similar_pj_name}（類似度: {score}%）
     
     - 資料作成は必ず2段階（自分用→他者向け）で進める
     - APIテストはpytestで書く（unittestは使わない）
     - 設計完了後にcheckpointを入れる（一発OK率+20%の実績）
     ---
  
  4. 社長に確認:「{similar_pj}の知見を引き継ぎますか？」
```

### 実装方針
- PJ会社オンボーディングフロー（/company skillの「PJ会社生成」セクション）に組み込み
- 類似度計算は Supabase Edge Function + embedding or LLMベースで
- warm-start ルールの有効期限: 30日後にレビュー（PJ固有の進化が始まるため）

---

## 適用案4: Population-Based Prompt Strategy（母集団ベースプロンプト戦略）

### 現状の問題
- 各部署の委譲テンプレートは1つしかない
- タスクの種類（調査 vs 実装 vs レビュー）に関わらず同じプロンプト
- **最適なプロンプトはタスク特性によって異なる**はず

### 論文からの着想
SHOR-PSROの「母集団ベース戦略」: **複数の戦略バリアントを保持し、状況に応じて最適なものを選択**

### 設計

```yaml
# .claude/agents/dept-sys-dev.md に strategy variants を追加

strategies:
  default:
    description: "汎用。バランス重視"
    effort: medium
    maxTurns: 15
    
  deep-investigation:
    description: "調査・デバッグ向け。読み取り重視"
    effort: high  
    maxTurns: 25
    tools: [Read, Glob, Grep, Bash, WebFetch]  # Write/Edit なし
    
  rapid-fix:
    description: "小さな修正向け。速度重視"
    effort: low
    maxTurns: 8
    
  creative:
    description: "設計・アーキテクチャ向け。発散思考"
    model: opus
    effort: high
    maxTurns: 20
```

### 選択ロジック

```python
def select_strategy(task_description, dept, historical_data):
    # タスク特性を分類
    task_type = classify(task_description)  # investigation / fix / design / implementation
    
    # 過去の同種タスクで最も一発OK率が高かった戦略
    best_strategy = max(
        historical_data.filter(dept=dept, task_type=task_type),
        key=lambda r: r.first_time_ok_rate
    ).strategy
    
    return best_strategy
```

---

## 優先度と実装ロードマップ

| # | 適用案 | インパクト | 実装コスト | 推奨順序 |
|---|--------|----------|----------|---------|
| 2 | Volatility-Adaptive Pipeline | **高** | **低**（pipeline_runs参照のみ） | **1st** |
| 4 | Population-Based Prompt Strategy | **高** | **中**（Agent定義改修） | **2nd** |
| 3 | Hard Warm-Starting | **中** | **中**（オンボーディング改修） | **3rd** |
| 1 | Self-Evolving CLAUDE.md | **最高** | **高**（フィットネス関数設計が要） | **4th** |

### 推奨の理由

- **#2が最初**: 既存の `pipeline_runs` データを使うだけ。コード変更は秘書のStep 0のみ。即効性あり
- **#4が次**: Agent定義の frontmatter に strategies を追加するだけ。秘書の選択ロジックのみ追加
- **#3が3番目**: PJ新設は頻度が低いが、やるときの効果は大きい
- **#1が最後**: 最もインパクトが大きいが、フィットネス関数の設計にデータ蓄積が必要。#2,#4で実績データが溜まってから着手

---

## 論文思想の本質的な適用ポイント

> **「人間が手動で改善するサイクル」を「LLMが自動で変異→評価→選択するサイクル」に置き換える」**

HDシステムに当てはめると:

| 現状（手動） | 進化後（自動） |
|-------------|--------------|
| 社長が修正指示 → 秘書が反映 | LLMが変異提案 → フィットネスで評価 → 社長は承認のみ |
| パイプライン選択は毎回確認 | 実績データから自動推奨 |
| 新PJは白紙から | 類似PJの知見をwarm-start |
| 部署への委譲は1パターン | タスク特性に応じて最適戦略を自動選択 |

**社長の役割が「指示者」から「承認者」にシフトし、秘書+LLMが先手を打つ組織になる。**

---

```yaml
# handoff
handoff:
  - to: pm
    tasks:
      - "上記4案をタスクチケットに分割（#2→#4→#3→#1の順）"
      - "適用案2（VAD Pipeline）の実装チケットを最優先で作成"
  - to: ai-dev
    context: "適用案1のフィットネス関数設計が必要"
    tasks:
      - "フィットネス関数のプロトタイプ設計"
```
