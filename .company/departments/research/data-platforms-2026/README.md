# データ基盤3強 個人ハンズオン学習パック（2026年4月版）

> 社長が **Snowflake / Databricks / Microsoft Fabric** を「DXコンサル案件で触ったことがある」と言えるレベルまで個人で学習するための教材。題材は focus-you の感情分析データ。

## このパックの前提

- 読者は社長本人。AI/LLM開発には精通しているが、**エンタープライズDWH/レイクハウス/BIは未経験**
- ゴールは「全機能の網羅」ではなく「3基盤の思想差を**手を動かして**体感し、案件で語れる語彙を獲得する」こと
- 最新情報は2026年4月15日時点。各ドキュメントのリンクにアクセス日を付記
- 理論より手順重視。まず動かし、後で概念を整理する構成

## ファイル構成と読む順番

| # | ファイル | 内容 | 読むタイミング |
|---|---------|------|--------------|
| 0 | [`00-trial-and-pricing.md`](./00-trial-and-pricing.md) | サインアップ手順・課金を避ける運用 | **最初に読む**（事故防止） |
| 1 | [`01-concept-comparison.md`](./01-concept-comparison.md) | 3基盤の思想・アーキテクチャ比較表 | 手を動かす前の地図 |
| 2 | [`02-snowflake-handson.md`](./02-snowflake-handson.md) | Snowflakeで focus-you データを扱う | 第1週末 |
| 3 | [`03-databricks-handson.md`](./03-databricks-handson.md) | Databricks Free Edition で同じことをやる | 第2週末 |
| 4 | [`04-fabric-handson.md`](./04-fabric-handson.md) | Microsoft Fabric で同じことをやる | 第3週末 |
| 5 | [`05-comparison-reflection.md`](./05-comparison-reflection.md) | 触り比べての所感テンプレ（社長が埋める） | 全部終わった後 |

## 統一ユースケース

**focus-you の「感情×予定」ダッシュボード**を3基盤で同じ仕様で組む。

入力データ（`sample-data/` に同梱の3つのCSV）:

| ファイル | 内容 | カラム |
|---------|------|--------|
| `diary_entries.csv` | 日記30日分 | entry_date, entry_text, mood_score |
| `emotion_analysis.csv` | 感情スコア30日分 | entry_date, joy, sadness, anger, fear, surprise, disgust |
| `calendar_events.csv` | カレンダー予定34件 | event_date, event_title, category |

達成するタスク（3基盤で共通）:

1. **INGEST**: 3つのCSVをプラットフォームに取り込む
2. **TRANSFORM**: 日次で感情スコアとカレンダーカテゴリ件数を結合
3. **AGGREGATE**: 週次のPERMA+V代理スコアを算出（= joy 平均 × mood_score 平均）
4. **VISUALIZE**: ダッシュボード or Notebook で時系列と category別を可視化
5. **AI**: LLM機能で「直近の気分傾向」を日本語で要約

## 学習スケジュール（週末 2〜3時間 × 3回）

| 週 | 対象 | 作業 | 想定時間 |
|----|------|------|---------|
| 第1週末 | Snowflake | サインアップ → CSV取り込み → Cortex で要約 → Streamlit | 2.5h |
| 第2週末 | Databricks Free Edition | サインアップ → Notebook → Delta → ai_query → AI/BI | 2.5h |
| 第3週末 | Microsoft Fabric | サインアップ（個人で難あり。05 参照） → Lakehouse → Notebook → Direct Lake → Copilot | 3h |
| 第3週末の最後 | 振り返り | `05-comparison-reflection.md` を埋める | 30分 |

**推奨順序の理由**: Snowflake が最もシンプルで挫折しにくい → Databricks で Notebook/Spark/Delta の概念を吸収 → Fabric は MS エコシステム統合の思想が強く、前2つを知った上で見たほうが差分がわかる。

## 公知情報の限界

- 各社の **価格・機能は月次で変わる**。ここに書いたものは 2026-04-15 時点。ハンズオン実施時は各 `00-*` と公式料金ページで最新を確認すること
- Microsoft Fabric の個人アカウント縛りは2025年途中から強化されており、**新規テナントでは試用できない**ケースが増えている。代替策を 00 に記載
- AI/LLM 機能は各基盤とも急速に進化中。今日Previewのものが来月GAになる。**SQL関数名が変わる可能性あり**
- 本教材はすべて「個人での触り比べ」が前提。**エンタープライズ機能（Purview統合、専用VNet、HA/DR）には触れていない**。案件で深掘りが必要ならベンダーSE同席が前提

## 壁打ちモードへの導線

全部触り終わったあと、社長が自分で腹落ちさせるための問い（`05-comparison-reflection.md` にテンプレ化済み）:

- 「今回の focus-you ユースケースで、一番ストレスなく5ステップ回せたのはどれか。なぜ？」
- 「クライアントが**MS365を全社展開している中堅企業**だったら、自分は何を推すか」
- 「逆に **AI/ML ユースケースが先にある** スタートアップだったら？」
- 「**既にSnowflake入れたが使いこなせていない**という相談が来たら、自分の価値は何か」
- 「自分が **1人で運用する** としたら、どれが一番運用コストが低いか。なぜそう思うか」

答えを `05-comparison-reflection.md` に書き溜めておくと、提案資料の叩きになる。

---

## 結論（パック全体）

- **案件で「触ったことがある」と言える最低ライン**: 3基盤すべてでこのハンズオン5ステップを通すこと。所要合計 7〜8時間
- **案件で「語れる」ラインに引き上げるには**: 触った直後に `05` の壁打ちを実施し、自分の言葉で3基盤の差を書き直すこと
- **最速で価値を出すなら**: 週末3回のうち第1週末（Snowflake）だけは必ずやる。Snowflake は市場シェア・日本企業導入例ともに最大で、案件遭遇率が最も高い

## ネクストアクション

- [ ] `00-trial-and-pricing.md` を読み、3基盤のサインアップを**事前に**済ませる（本番で詰まらないため）
- [ ] `sample-data/` の3CSVをローカルで開き、構造を目視確認
- [ ] 第1週末にSnowflakeハンズオン実施、終わったら `05` に所感を1行書く
- [ ] 3基盤終了後、`05` の全項目を埋めて壁打ちセッションを社長＋秘書で実施
