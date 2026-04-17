---
name: diary
description: 日記の分析・壁打ち。感情分析、PERMA+Vスコアリング、カレンダー×プロンプトログとの横断分析。
user_invocable: true
---

# /diary — 日記分析・壁打ち

## いつ使うか

- `/diary` — 未分析の日記を一括分析
- `/diary analyze` — 未分析エントリーにAI分析を実行
- `/diary weekly` — 週次レポート生成
- `/diary chat` — 日記データをもとに壁打ち
- 「日記を分析して」「最近の調子は？」「感情の傾向を教えて」と言われたとき

## 分析フロー

### 1. 未分析エントリーの検出

```bash
source .claude/hooks/supabase.env
# emotions が null のエントリーを取得
curl -4 -s "${SUPABASE_URL}/rest/v1/diary_entries?emotions=is.null&select=*&order=entry_date.desc" \
  -H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}"
```

### 2. 各エントリーに対して分析

#### A. 感情分析（Plutchik 8基本感情）
日記本文を読み、以下の8感情を0-100でスコアリング:
- joy（喜び）, trust（信頼）, fear（恐れ）, surprise（驚き）
- sadness（悲しみ）, disgust（嫌悪）, anger（怒り）, anticipation（期待）

#### B. PERMA+V スコアリング（8軸、各1-10）
- P: Positive Emotion（ポジティブ感情）
- E: Engagement（没入・集中）
- R: Relationships（人間関係）
- M: Meaning（意味・目的）
- A: Achievement（達成感）
- V: Vitality（活力）
- Au: Autonomy（自律性）
- St: Stress Relief（ストレス緩和）
- WBI = 8軸の平均

#### C. トピック抽出
日記から主要トピックを抽出（仕事、人間関係、健康、趣味、学び、etc.）

#### D. AI要約
1-2文で日記の要約を生成

#### E. パーソナリティシグナル
Big Five（OCEAN）の要素が表れている部分を検出:
- Openness（開放性）, Conscientiousness（誠実性）, Extraversion（外向性）
- Agreeableness（協調性）, Neuroticism（神経症的傾向）

#### F. カレンダー連携
その日のGoogleカレンダー予定を取得し、日記の文脈と照合:
- どの予定が感情に影響しているか
- MTG後の感情変化
- 休日 vs 仕事日の傾向

### 3. Supabase に更新

```bash
curl -4 -s "${SUPABASE_URL}/rest/v1/diary_entries?id=eq.{ID}" \
  -X PATCH \
  -H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d '{
    "emotions": {"joy": 70, "trust": 50, ...},
    "perma_v": {"P": 7, "E": 8, ...},
    "wbi": 6.5,
    "topics": ["仕事", "成長"],
    "ai_summary": "...",
    "personality_signals": {"O": 0.7, "C": 0.8, ...},
    "calendar_events": [...]
  }'
```

### 4. 結果報告

```
📔 日記分析完了（3件）

2026-03-29:
  感情: joy 70 | anticipation 60 | trust 50
  WBI: 6.5 (E:8 > A:7 > P:7 > ... > St:4)
  トピック: 仕事、組織設計、成長
  AI: 新しいシステム構築に没頭。達成感は高いが休息が不足気味。
  📅 予定との相関: MTGなし(日曜) → 集中作業でE:8

全体傾向: 仕事への没入度が高い(E:8平均)。Stが最低(4平均) → 意識的な休息を。
```

## 週次レポート（/diary weekly）

直近7日分を集約し diary_analysis テーブルに保存:

- エントリー数、平均WBI、感情分布
- ハイライト（ベストデイ / チャレンジデイ）
- カレンダー予定数 vs WBI の相関
- プロンプトログの作業量 vs WBI の相関
- 前週比の変化
- AI提言

## 壁打ちモード（/diary chat）

社長の日記データ全体をコンテキストに、対話形式で自己分析:

- 「最近怒りを感じた日は？何があった？」
- 「仕事のストレスと人間関係の相関は？」
- 「1ヶ月前と比べてどう変わった？」
- 「自分の価値観を教えて」

## /company との連携

/company ブリーフィング時:
- 最新の日記の WBI が前日比で-2以上低下 → 「調子があまりよくなさそうですね。何かありましたか？」
- 3日以上記録なし → 「日記が3日間空いています」
- ストリーク達成 → 「7日連続記録おめでとうございます！」
