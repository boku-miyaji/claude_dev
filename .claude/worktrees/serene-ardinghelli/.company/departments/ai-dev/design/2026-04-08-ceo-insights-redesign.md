# CEO Insights 再設計（確定版）

## 設計思想

- **主目的**: ユーザー自身の自己理解。AI PaRTnerの記憶はその副産物
- **中心軸**: 日記（内面）。全ての分析に日記を紐づける
- **副軸**: prompt_log（行動・関心）。無意識の関心を可視化する
- **生データ主義**: 要約だけで分析しない。意外な発見は生テキストにしかない
- **階層化**: 日次→週次→月次の3層。各層は前層の要約+生データを見る

## カテゴリ設計

### 日記ベース（内面分析）

| カテゴリ | source | 意味 | 例 |
|---|---|---|---|
| `mood_cycle` | diary | 気分の波の周期 | 「週後半にトーンが落ちやすい」 |
| `trigger` | diary | 気分を動かすトリガー（正負両方） | 「新PJ着手で上がる、MTG連続で下がる」 |
| `correlation` | diary | 本人が気づいてない外部要因との相関 | 「雨の日は日記が短くなる」 |
| `disconnect` | diary | 行動と感情のズレ | 「タスク消化できた日に充実感がない」 |
| `value` | diary | 繰り返し大事にしてること | 「没頭できる時間を求めてる」 |
| `drift` | diary | 週〜月単位のゆっくりした変化 | 「3月は実行モード、4月から思考モードに移行」 |
| `fading` | diary | かつて出てたテーマの消失 | 「先月まで書いてた〇〇の話が消えた」 |

### prompt_logベース（関心・行動分析）

| カテゴリ | source | 意味 | 例 |
|---|---|---|---|
| `focus` | prompt | 最近集中してるテーマ | 「AI PaRTnerの設計に意識が向いてる」 |
| `recurring` | prompt | 繰り返し気にしてること | 「コスト管理が定期的に出る」 |
| `shift` | prompt | 関心の変化 | 「実装寄り→設計・方針寄りに変わった」 |
| `blind_spot` | prompt | 言及が少ない領域 | 「rikyuPJが2週間触れられてない」 |

## 3層アーキテクチャ

### Layer 1: エントリ下処理（日次）

- **トリガー**: diary_entries.ai_summary が null のエントリがある
- **入力**: 未処理の日記エントリ（生テキスト）
- **処理**: gpt-5-mini でtopics, ai_summary, notableフラグを付与
- **出力**: diary_entries の各カラムを UPDATE
- **目的**: 検索性向上。分析はここではしない

### Layer 2: 週次分析（7日ごと）

- **トリガー**: 前回の週次分析から7日以上経過
- **入力**:
  - 今週の日記 **生テキスト全件**
  - 今週のprompt_log
  - 前回の週次分析結果（差分検出用）
- **出力**:
  - diary_analysis (period_type='weekly') — 要約3-5文
  - ceo_insights — mood_cycle, trigger, focus, shift の差分
- **モデル**: gpt-5-mini

### Layer 3: 月次分析（30日ごと）

- **トリガー**: 前回の月次分析から30日以上経過
- **入力**:
  - 今月の日記 **生テキスト全件**
  - 週次要約4件
  - 前回の月次分析結果
  - 今月のprompt_log集約
- **処理**: 2段階
  - Step 1: 今月の生データ全件を読み、パターン仮説を出す
  - Step 2: 仮説検証のため過去データをSQL取得 → 追加API call
- **出力**:
  - diary_analysis (period_type='monthly') — 要約5-8文
  - ceo_insights — correlation, disconnect, value, drift, fading, recurring, blind_spot の差分
- **モデル**: gpt-5-mini

## ceo_insights 差分管理

- 分析時に既存insightsをLLMに渡す
- 出力形式: { "insert": [...], "update": [...], "archive": [...] }
- 同じ発見を重複INSERTしない

## AI PaRTnerへの接続

ceo_insights → useMorningBriefing.ts の【この人の傾向】セクションに自動注入

## 実行環境

| 処理 | 実行環境 | モデル |
|---|---|---|
| Layer 1-3 | Edge Function (diary-analysis) | gpt-5-mini |
| 設計思想抽出（月次） | Claude CLI（開発者専用） | Claude |

## コスト試算（gpt-5-mini）

月間トークン: ~70K input / ~20K output
月間コスト: ~$0.1以下

## 決定日

2026-04-08 社長承認済み
