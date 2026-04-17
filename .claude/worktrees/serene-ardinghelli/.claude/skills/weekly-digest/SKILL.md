---
name: weekly-digest
description: 週次のCEO分析レポート。時間配分 vs 予定密度の比較、準備不足PJのアラート、改善提案を生成する。
user_invocable: true
---

# Weekly Digest — 週次CEO分析レポート

## いつ使うか

- `/weekly-digest` を実行したとき
- 「週次レポート」「今週の振り返り」「分析して」と言われたとき

## 実行手順

### Step 1: データ収集

以下を並行で取得する:

1. **Supabase prompt_log** — 直近7日分を全件取得
   ```bash
   source .claude/hooks/supabase.env
   curl -4 -s "${SUPABASE_URL}/rest/v1/prompt_log?select=*&created_at=gte.$(date -d '7 days ago' +%Y-%m-%dT00:00:00)&order=created_at.asc&limit=1000" \
     -H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" -H "x-ingest-key: ${SUPABASE_INGEST_KEY}"
   ```

2. **Google Calendar** — 来週1週間の全カレンダーイベント
   - primary, acesinc, xyz, gangsters の4カレンダー

3. **前回の ceo_insights** — 既存の分析結果を取得して比較

### Step 2: 分析

Python スクリプトで以下を算出:

#### A. 今週の時間配分
- PJ別推定作業時間（セッションベース）
- 日別・時間帯別のアクティビティ分布
- 深夜作業率

#### B. 来週の予定密度
- PJ別MTG件数
- 準備が必要なMTG（★★★ / ★★☆）の件数
- 空き時間の算出

#### C. ギャップ分析
- **投下時間 vs MTG密度のミスマッチ**を検出
  - 例: foundry に 0.5h しか使っていないのに来週5件MTGあり → アラート
- **準備不足リスク** — prep-log の quality_score が低い MTG がないか
- **前週比** — 前回の insights と比較してトレンド変化を検出

#### D. 改善提案
- 各部署への具体的なアクション提案
- 推奨スキル/ツールの提案
- 来週の最適時間配分の提案

### Step 3: 出力

#### テキストレポート（会話内で表示）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Weekly Digest — YYYY-MM-DD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 今週の時間配分:
  circuit   ████████████ 45%  8.6h
  rikyu     ██████       24%  4.7h
  ...

📅 来週の予定密度:
  foundry   ██████████ 12件  ← ⚠️ 投下時間2%
  rikyu     ████████   8件
  ...

⚠️ ギャップアラート:
  [foundry] 投下2.4% vs MTG密度40% → 準備不足リスク高

💡 提案:
  1. ...
  2. ...
```

#### Supabase 保存
- `ceo_insights` テーブルに新しい insights を INSERT
- カテゴリ: `weekly_digest`

### Step 4: フィードバック

レポート表示後、社長に確認:
- 「この分析で合っていますか？」
- 「来週の注力PJの優先順位を変えたいですか？」
→ フィードバックがあれば ceo_insights を更新
