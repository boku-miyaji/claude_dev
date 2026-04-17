# 準備タイミングインテリジェンス

## 目的

ミーティングごとに「いつ準備を始めるべきか」を精度高く提案し、実績データからフィードバックループで改善していく。

## ログファイル仕様

ファイル名: `{YYYY-MM-DD}_{meeting-slug}.yaml`
配置先: `.company/secretary/prep-log/`

```yaml
meeting:
  date: "2026-03-30"
  time: "10:30"
  duration_min: 45
  title: "アンケート集計結果・報告ストーリー相談"
  calendar: "acesinc"           # acesinc / xyz / personal / gangsters
  company_id: "rikyu"           # HD会社ID or null
  recurring: true               # 定例か単発か
  recurrence_freq: "weekly"     # weekly / biweekly / monthly / quarterly / one-off

  # --- 多次元分類 ---
  audience:                     # 参加者の立場（複数可）
    primary: "client-working"   # client-exec / client-working / internal-team / internal-cross / external-partner / personal
    size: 2                     # 参加者数
    key_stakeholders:           # 重要な参加者
      - "ryo.kodama@acesinc.co.jp"

  purpose:                      # MTGの目的（主目的 + 副目的）
    primary: "reporting"        # reporting / status-update / brainstorming / decision / demo / review / workshop / knowledge-sharing / 1on1 / logistics / onboarding
    secondary: "discussion"     # 副目的（あれば）

  your_role: "presenter"        # presenter / co-presenter / facilitator / participant / observer / organizer

  format: "online"              # in-person / online / hybrid

  stakes: "high"                # critical / high / medium / low
                                # critical: 契約・予算に直結、失敗不可
                                # high: クライアント向け or 重要なデリバラブル
                                # medium: 内部定例、進捗共有
                                # low: 参加自由、雑談系

  prep_dependency:              # 他の準備・成果物に依存するか
    depends_on: []              # 別MTGのslugや成果物
    blocks: []                  # このMTGの結果を待つMTG

prep:
  planned_start: "2026-03-29T20:00"    # 計画上の準備開始時刻
  actual_start: "2026-03-29T20:15"     # 実際の準備開始時刻
  actual_end: "2026-03-29T22:30"       # 実際の準備完了時刻
  actual_duration_min: 135              # 実際にかかった分数
  lead_time_hours: 14.25               # MTGまでの残り時間（開始時点）

  tasks:                                # 準備で行った個別作業
    - type: "data-analysis"             # 下記タスクタイプ参照
      description: "アンケート集計"
      duration_min: 90
      complexity: "medium"              # simple / medium / complex
    - type: "document-creation"
      description: "報告ストーリー作成"
      duration_min: 45
      complexity: "medium"

  interruptions: 0                     # 中断回数
  context_switches: 1                  # 他タスクへの切り替え回数

result:                                # MTG後に記録
  prep_sufficient: true                # 準備は十分だったか
  quality_score: 4                     # 1-5（5=完璧、1=全然足りず）
  what_was_missing: ""                 # 足りなかったこと
  what_was_unnecessary: ""             # 不要だった準備
  ideal_lead_time_hours: 24            # 振り返って理想的だった開始時期
  ideal_duration_min: 120              # 振り返って理想的だった準備時間
  meeting_outcome: "positive"          # positive / neutral / negative
  notes: ""
  next_action: ""                      # MTG後に発生したアクション
```

## タスクタイプ一覧

| type | 説明 | 典型的な所要時間 |
|------|------|----------------|
| `data-analysis` | データ集計・分析・可視化 | 30-120min |
| `document-creation` | 報告書・提案書・設計書の新規作成 | 60-180min |
| `document-update` | 既存ドキュメントの更新 | 15-60min |
| `slide-deck` | プレゼン資料の作成・更新 | 30-120min |
| `code-demo` | デモ用コード準備・動作確認 | 30-90min |
| `code-implementation` | 実装作業（MTGまでに完了が必要） | 60-240min |
| `research` | 技術調査・競合調査 | 30-90min |
| `review-materials` | 共有資料・議事録の事前確認 | 10-30min |
| `agenda-setting` | アジェンダ作成・論点整理 | 10-30min |
| `stakeholder-alignment` | 事前の社内すり合わせ | 15-45min |
| `environment-setup` | デモ環境・ツールのセットアップ | 15-60min |
| `rehearsal` | リハーサル・発表練習 | 15-30min |

## 精度向上メカニズム

### Phase 1: 経験則ベース（ログ 0-4件）

| stakes × your_role | デフォルト推奨リードタイム | デフォルト準備時間 |
|--------------------|------------------------|------------------|
| critical × presenter | 72h前 | 180min |
| critical × participant | 24h前 | 60min |
| high × presenter | 24h前 | 120min |
| high × co-presenter | 18h前 | 90min |
| high × participant | 4h前 | 30min |
| medium × presenter | 4h前 | 60min |
| medium × participant | 1h前 | 15min |
| low × any | 0h（準備不要） | 0min |

社長の明示的指示があればそちらを優先（例: polaris = 早め）

### Phase 2: 実績統計ベース（ログ 5-9件）

同一分類の過去実績から中央値を算出:
- `GROUP BY (stakes, your_role, purpose.primary)` → リードタイム中央値、準備時間中央値
- 精度表示: `±XX%`（標準偏差ベース）

### Phase 3: 個別最適化（ログ 10-19件）

追加の分類軸を導入:
- `GROUP BY (company_id, audience.primary, purpose.primary)` → PJ×相手×目的で最適化
- prep_dependency の連鎖を考慮（AのMTGの結果がBの準備に必要）

### Phase 4: 予測モデル（ログ 20件〜）

カレンダーの新規イベント検出時に自動で:
1. タイトル・参加者・カレンダーから分類を推定
2. 過去の類似MTGから準備タスクを予測
3. 推奨準備開始時刻をブリーフィングに含める

### フィードバックトリガー

- MTG翌日のブリーフィング時: 前日のMTGの `result` を社長に確認
- `quality_score <= 2` が2回: 該当分類のリードタイムを自動で1.5倍に引き上げ提案
- `what_was_unnecessary` が同じ項目2回: 該当タスクタイプを準備推奨から除外提案

## 週間ビューでの表示

ブリーフィング時、1週間の全MTGに対して:
```
📅 3/31 (火)
  10:00 [in] rikyu algo mtg          ★☆☆ 準備不要（定例・participant）
  14:00 [Ex] SOMPOケア打合せ          ★★☆ 推奨: 当日午前に30min確認
  20:30 [Int] polaris 図面共有        ★★★ 推奨: 3/29夜〜準備開始（presenter想定）
```
★の数 = stakes レベル（★☆☆=low/medium, ★★☆=high, ★★★=critical/high+presenter）
