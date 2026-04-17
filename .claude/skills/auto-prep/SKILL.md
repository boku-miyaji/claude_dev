---
name: auto-prep
description: MTG準備を自動化。カレンダーから準備が必要なMTGを検出し、クライアント企業の最新情報収集→3段構成の事前分析を提供する。
user_invocable: true
---

# Auto Prep — MTG準備自動化

## いつ使うか

- `/auto-prep` を実行したとき
- `/company` のブリーフィングで ★★★ / ★★☆ のMTGが検出されたとき（秘書が自動提案）
- 「明日の準備して」「MTGの準備」と言われたとき

## 実行手順

### Step 1: 準備対象MTGの検出

1. Google Calendar から直近48時間のイベントを全カレンダーから取得
2. prep-log/SCHEMA.md の分類ルールで各MTGの stakes を判定:
   - タイトルの `[Ex@client]` → high/critical
   - 参加者に外部ドメイン → high
   - 社長が organizer → presenter
   - 定例（recurring） → medium に降格
3. ★★★ と ★★☆ のMTGを抽出

### Step 2: 準備対象ごとに実行

各MTGに対して:

#### A. クライアント情報の収集
1. `.company-{name}/CLAUDE.md` からクライアント情報を読み込む
2. intelligence 部署の最新レポート（`reports/`）からクライアント関連の情報を抽出
3. **Web検索**（利用可能な場合）:
   - `{会社名} IR site:{domain}` で最新IR
   - `{会社名} プレスリリース` で最新ニュース
   - `{会社名} {PJ関連キーワード}` でドメイン情報

#### B. 3段構成の分析レポート生成

```markdown
## MTG準備: {MTGタイトル}
**日時**: YYYY-MM-DD HH:MM
**PJ**: {company_id}
**stakes**: ★★★

### ① 公知情報ベース分析
- [最新IR: 2025年度Q3決算](URL) — 要点
- [プレスリリース: DX推進室新体制](URL) — 要点
- 前回MTGからの変化点

### ② 限界の明示
- 中期経営計画の具体数値 → 非公開、社長の手元資料で確認
- 社内の意思決定プロセス → MTGで直接確認
- 推測: [根拠付きの推測]

### ③ 壁打ちモード
この情報をもとに深掘りできます:
- 「中計でDXの優先度はどう位置づけられていますか？」
- 「前回のMTGで出た懸念点は解消されましたか？」
- 「今回のMTGで確認すべき最重要ポイントは？」
```

#### C. prep-log に記録
- `.company/secretary/prep-log/{date}_{slug}.yaml` を作成/更新
- `prep.planned_start` に現在時刻を記録
- `prep.tasks` に実行した準備タスクを記録

### Step 3: ブリーフィングへの統合

準備完了後、秘書のブリーフィングに統合:

```
📅 明日の準備状況:
  10:30 [Ex@client] アンケート報告 ★★★ → ✅ 準備完了
    - 公知情報3件収集済み（リンク付き）
    - 壁打ちモード利用可能
  14:00 [Ex@online] SOMPOケア打合せ ★★☆ → ✅ 準備完了
    - 最新IR確認済み
```

### Step 4: MTG後フィードバック

MTG翌日のブリーフィングで:
- 「昨日のMTG、準備は十分でしたか？」
- quality_score を記録
- what_was_missing を記録
→ prep-log の result セクションを更新
→ 次回の推奨リードタイムに反映

## 秘書からの自動提案トリガー

`/company` 起動時のブリーフィングで:
1. 48h以内に ★★★ MTGがある
2. そのMTGの prep-log がまだない、または `prep.actual_start` が null
→ 「{MTGタイトル}の準備をしましょうか？」と提案

## 注意事項

- 準備レポートは「完成品」ではなく「壁打ちの素材」（エンハンス原則）
- 公知情報には必ずURLを付与
- 推測は明確にラベル付け
- 社長が腹落ちするまで壁打ちを続ける
