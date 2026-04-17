# AI教材シード集 — 5分ミニ教材・FAQ・混同マップ・教材パッケージ構想

> **目的**: パターンA-Eのハンズオンを「自分で学ぶ体験」から「人に教える教材」に昇華させるための素材集。focus-you の教材プラットフォーム構想（AI がどう動くか学べる教材の商用化）に直結する。

## 5分ミニ教材 5本

### 教材 1: 「SQLでAIが動く」体験 — AI_COMPLETE を1行で

**対象**: SQL は書けるが AI/LLM は使ったことがない人
**所要時間**: 5分
**ゴール**: SELECT 文の中で LLM が動く体験をする

```sql
-- これが全部。SQL を知っていれば AI が使える。
SELECT
    entry_date,
    entry_text,
    AI_COMPLETE(
        'llama3.1-70b',
        '次の日記を1行で要約してください: ' || entry_text
    ) AS summary
FROM diary_entries
LIMIT 3;
```

**驚きポイント**: 「え、SQL の中で AI が動くの？Python 書かなくていいの？」

**教材の流れ**:
1. まず上の SQL をコピペして実行（1分）
2. 結果を見て「SQL の中で LLM が動いている」ことを確認（1分）
3. プロンプトを変えてみる: 「感情を分析してください」に書き換え（1分）
4. AI_CLASSIFY に書き換えて構造化出力を体験（1分）
5. 振り返り: 「どんな場面で使えそうか？」を30秒考える（1分）

**詰まりポイント**: 「AI_COMPLETE と AI_CLASSIFY はどう違うの？」→ AI_COMPLETE は自由テキスト、AI_CLASSIFY は選択肢から選ぶ。用途が決まっているなら AI_CLASSIFY の方が安定する。

---

### 教材 2: 「Agent って何がすごいの？」 — 分解して見せる

**対象**: 「AI Agent」という言葉は聞くが、中身がわからない人
**所要時間**: 5分
**ゴール**: Agent の動作を「計画 → ツール呼び出し → 回答」に分解して理解する

**教材の流れ**:

Step 1: まず質問する（1分）
```
質問: 「先週の月曜は何をしていた？気分はどうだった？」
```

Step 2: Agent の内部動作を見せる（2分）
```
[Agent の思考]
1. 「先週の月曜」→ 日付を計算する必要がある → カレンダーツールを使う
2. カレンダーから 2026-04-06 (月曜) を特定
3. diary_entries から 2026-04-06 のエントリを取得 → SQLツールを使う
4. emotion_analysis から同日の感情データを取得 → SQLツールを使う
5. 取得した情報をもとに回答を生成

[ツール呼び出し 1] calendar_lookup("先週の月曜") → 2026-04-06
[ツール呼び出し 2] SQL: SELECT * FROM diary_entries WHERE entry_date = '2026-04-06'
[ツール呼び出し 3] SQL: SELECT * FROM emotion_analysis WHERE entry_date = '2026-04-06'
[回答生成] 「先週の月曜は朝ジョギングして、午後は企画書を書いていました。
            気分は7/10で、joy が高めでした」
```

Step 3: 分解図を描く（1分）
```
質問 → [計画] → [ツール1: 日付計算]
                → [ツール2: 日記検索]
                → [ツール3: 感情取得]
       → [回答生成] → 回答
```

Step 4: 「Agent がない場合」と比較する（1分）
```
Agent なし:
1. 自分でカレンダーを開く
2. 日記アプリを開いて該当日を探す
3. 感情分析の結果を探す
4. 頭の中で情報を統合する

→ Agent は「情報を集めて統合する」部分を自動化している
```

**驚きポイント**: 「Agent は魔法じゃなくて、ツールを順番に使っているだけ。人間がやっていることの自動化」

---

### 教材 3: 「LLM vs ML、どっちが正解？」 — mood予測で比較

**対象**: LLM があれば何でもできると思っている人
**所要時間**: 5分
**ゴール**: 構造化データの予測には古典MLが合理的であることを体感する

**教材の流れ**:

Step 1: 同じ予測を LLM と ML でやる（2分）

```python
# LLM アプローチ: 1件あたり ~2秒、~$0.003
prompt = f"""
以下の情報から、明日のmood_scoreを1-10で予測してください。
- 今日のmood: 6
- 直近3日の平均: 5.7
- 曜日: 水曜
- 明日の予定: 会議3件
予測スコア:
"""
# → LLM: "7" (2.1秒、$0.003)

# ML アプローチ: 1件あたり ~3ms、~$0.00001
model.predict([[6, 5.7, 3, 3]])
# → ML: [6.8] (3ms、$0.00001)
```

Step 2: 10万件で比較表を見せる（1分）

| 指標 | LLM | ML (XGBoost) |
|------|-----|-------------|
| 処理時間 (10万件) | ~55時間 | ~3秒 |
| コスト (10万件) | ~$300 | ~$0.01 |
| 精度 (MAE) | ~1.5 | ~1.2 |
| 説明可能性 | 低い | 高い (SHAP) |

Step 3: 使い分けルールを1枚にまとめる（1分）
```
入力がテキスト → LLM
入力が数値/カテゴリ → ML
出力がテキスト → LLM
出力が数値 → ML
```

Step 4: 「じゃあ LLM はいつ使うの？」（1分）
→ 日記のテキストを読んで感情を理解する部分は LLM。その感情スコアを使って翌日を予測する部分は ML。パイプラインの中で役割が違う。

**驚きポイント**: 「10万件で55時間 vs 3秒。LLM万能じゃないんだ」

---

### 教材 4: 「感情分析のギャップ」 — AIの分析 vs 自分の実感

**対象**: AIの分析結果に「ほんとに？」と思ったことがある人
**所要時間**: 5分
**ゴール**: AIの感情分析と本人の実感のギャップを可視化し、AIの限界を理解する

**教材の流れ**:

Step 1: 自分の日記1件をAIに分析させる（1分）
```
日記: 「今日は一日中雨だった。家でゆっくり本を読んだ。」

AI の分析:
- joy: 0.3 (低い)
- sadness: 0.5 (やや高い)
- mood: 4/10 (低め)

自分の実感:
- 実は雨の日に家で過ごすのが好き
- mood: 8/10 (高い)
```

Step 2: なぜギャップが生まれるか（2分）
```
AI は「雨」「一日中」をネガティブな文脈で解釈しがち
→ AIは言葉の統計的パターンで判断する
→ 個人の文脈（雨が好き）は学習データに反映されていない
→ これが「AIの感情分析の限界」
```

Step 3: ギャップを埋める方法（1分）
```
1. 自分の実感を記録して、AIに学習させる（パーソナライズ）
2. AIの分析は「参考値」として使い、最終判断は自分でする
3. ギャップが大きい日をマークして、自分のパターンを発見する
```

Step 4: 「ギャップ自体が価値」（1分）
→ ギャップが大きい日は「自分でも気づいていない感情の変化」かもしれない。AIの「間違い」が自己理解のきっかけになる。

**驚きポイント**: 「AIが間違えることに価値がある」

**focus-you への接続**: この「ギャップの可視化」は focus-you のコア機能になりうる。AI分析 vs 自己評価のダッシュボード。

---

### 教材 5: 「Feature Store = Excel の名前付き範囲」 — 身近な例え

**対象**: Feature Store という言葉を初めて聞く人
**所要時間**: 5分
**ゴール**: Feature Store の概念を Excel のアナロジーで理解する

**教材の流れ**:

Step 1: Excel の名前付き範囲を思い出す（1分）
```
Excel で:
- セルB2:B31 に「今月の売上」という名前を付ける
- =AVERAGE(今月の売上) で平均を計算
- グラフでも同じ「今月の売上」を参照
- データが追加されても、名前付き範囲が自動拡張

→ 「データに名前を付けて、どこからでも同じ定義で使える」
```

Step 2: Feature Store は「組織版の名前付き範囲」（2分）
```
Feature Store で:
- 「mood_3day_avg」= 直近3日のmood_scoreの平均、と定義
- 学習時: Feature Store から mood_3day_avg を取得
- 推論時: Feature Store から mood_3day_avg を取得（同じ計算）
- データが更新されても、定義は同じ

Excel の名前付き範囲と同じ。ただしスケールが違う:
- Excel: 1人が1ファイルで使う
- Feature Store: 組織全体が数百テーブルで使う
```

Step 3: 名前付き範囲がないとどうなるか（1分）
```
Excel で名前なし:
- Aさん: =AVERAGE(B2:B31) ← 31日分
- Bさん: =AVERAGE(B2:B30) ← 30日分（1日ずれ）
- → 同じ「月平均」のはずが微妙に違う

Feature Store なし:
- 学習コード: mood_3day_avg = df['mood'].rolling(3).mean()
- 推論コード: mood_3day_avg = df['mood'].tail(3).mean()  # 微妙に違う
- → Training-Serving Skew の発生
```

Step 4: 「いつ Feature Store が必要になるか？」（1分）
```
- 特徴量が10個以下 → pandas で十分（Excel の名前なしでも困らない）
- 特徴量が10個以上 → Feature Store 検討（名前付き範囲がないと混乱する）
- チームが2人以上 → Feature Store 推奨（認識のずれが発生する）
```

**驚きポイント**: 「Feature Store って Excel の名前付き範囲の延長なんだ。難しくない」

## 詰まりポイント FAQ

### パターン A-B（Text-to-SQL / RAG）

| 質問 | 回答 |
|------|------|
| 「Text-to-SQL と RAG、どっちを使えばいい？」 | データが構造化（テーブル）なら Text-to-SQL、非構造化（ドキュメント）なら RAG。日記の mood_score を集計するなら Text-to-SQL、日記の内容を検索するなら RAG |
| 「Text-to-SQL で間違った SQL が生成されたらどうする？」 | 生成された SQL を人間がレビューしてから実行する（Human-in-the-loop）。または Semantic Model で「正しい SQL の範囲」を制限する |
| 「RAG の精度が低い。何が悪い？」 | (1) チャンクサイズが大きすぎる/小さすぎる (2) Embedding モデルが日本語に弱い (3) 検索結果の上位K件が少なすぎる |
| 「Embedding って何？30秒で教えて」 | テキストを数百次元の数値ベクトルに変換すること。「今日は楽しかった」→ [0.12, -0.34, 0.78, ...] のように。似た意味のテキストは似たベクトルになる。近いベクトルを探すのが検索 |

### パターン C（バッチ LLM）

| 質問 | 回答 |
|------|------|
| 「AI_COMPLETE と AI_CLASSIFY はどう違う？」 | AI_COMPLETE は自由テキスト出力。AI_CLASSIFY は選択肢から1つ選ぶ。「感情を教えて」→ AI_COMPLETE、「positive/negative/neutral のどれ？」→ AI_CLASSIFY |
| 「全行処理すると高くない？」 | 30行なら数円。1,000行で数十円。10万行で数千円。OpenAI Batch API なら半額。小規模なら気にしなくてよい |
| 「構造化出力って何？」 | LLM の出力を JSON などの決まった形式にすること。自由テキストだと「ポジティブです」「positive」「肯定的」とバラバラになるが、JSON Schema を指定すると {"category": "positive"} に統一される |

### パターン D（Agents）

| 質問 | 回答 |
|------|------|
| 「Agent と Chat の違いは？」 | Chat = 1回の質問 → 1回の回答。Agent = 質問 → 計画 → 複数のツールを使う → 回答。Agent は「調べてから答える」ことができる |
| 「Agent はいつ使うの？」 | 1つのツールでは答えられない質問のとき。「先週と今週の気分の変化を分析して、原因を推測して」→ 日記検索 + 感情データ取得 + カレンダー確認 + 分析 の複数ステップが必要 |
| 「Agent は暴走しない？」 | する可能性がある。ツールの権限を制限し（読み取りのみ等）、ステップ数に上限を設けるのが基本。高リスクな操作は Human-in-the-loop |

### パターン E（Feature Store + ML）

| 質問 | 回答 |
|------|------|
| 「30行で ML をやる意味はある？」 | 精度は出ない。「ML がこう動く」を体験するのが目的。半年分のデータで再学習すると精度が出始める |
| 「XGBoost って何？」 | テーブルデータ（数値やカテゴリ）の予測に最も使われる ML アルゴリズム。「数値予測の王様」。2026年現在もKaggleコンペの上位常連 |
| 「Feature Store って pandas で十分じゃない？」 | 1人で10個の特徴量を扱うなら pandas で十分。チーム2人以上、特徴量50個以上、モデル3つ以上なら Feature Store の価値が出る |

## 混同マップ

「これとこれ、何が違うの？」のペアを整理する。

### 紛らわしい概念ペア

```
Text-to-SQL  vs  RAG
├── 共通点: 自然言語で質問して答えを得る
├── Text-to-SQL: 構造化データ（テーブル）に対してSQLを生成
├── RAG: 非構造化データ（テキスト）をベクトル検索して回答を生成
└── 判断基準: データが SELECT で取れる → Text-to-SQL
              データがテキスト検索で見つかる → RAG

Agent  vs  RAG
├── 共通点: LLM が外部データを参照して回答する
├── RAG: 検索 → 回答の1ステップ
├── Agent: 計画 → 複数ツール → 回答の多ステップ
└── 判断基準: 1回の検索で十分 → RAG
              複数の情報源を組み合わせる → Agent

LLM  vs  ML
├── 共通点: データからパターンを学んで予測する
├── LLM: テキストを理解・生成。数十億パラメータ
├── ML: 構造化データの数値予測。数百〜数万パラメータ
└── 判断基準: 入力がテキスト → LLM
              入力が数値/カテゴリ → ML

Feature Store  vs  ETL
├── 共通点: データを変換して保存する
├── ETL: 「生データ → 使えるデータ」の変換パイプライン
├── Feature Store: 「使えるデータ → ML用の特徴量」の管理 + 再利用保証
└── 判断基準: 変換結果をMLモデルで使う → Feature Store
              変換結果をBIで使う → ETL / ELT

Embedding  vs  エンコーディング
├── 共通点: データを別の形式に変換する
├── Embedding: テキスト → 意味を保持した数値ベクトル（数百次元）
├── エンコーディング: カテゴリ → 数値（one-hot, label encoding）
└── 判断基準: テキストの意味的な類似度が必要 → Embedding
              カテゴリを数値に変換したいだけ → エンコーディング

Semantic Model  vs  データモデル
├── 共通点: データの構造を定義する
├── Semantic Model: Power BI のビジネスロジック層（メジャー、リレーション、書式）
├── データモデル: テーブル設計（ER図、スキーマ）
└── 判断基準: BI/レポートの定義 → Semantic Model
              DB設計 → データモデル
```

### 混同が起きやすい3基盤用語

| 概念 | Snowflake | Databricks | Fabric |
|------|-----------|------------|--------|
| AI でテキスト生成 | AI_COMPLETE | ai_query | ai.generate_text |
| AI で分類 | AI_CLASSIFY | ai_query + prompt | ai.classify |
| ベクトル検索 | Cortex Search | Vector Search | AI Search |
| 自然言語→SQL | Cortex Analyst | Genie | AI Skills |
| Agent | Cortex Agents | Agent Framework | Data Agent |
| 特徴量管理 | Feature Store | Feature Engineering | (SemPy + Lakehouse) |
| モデル管理 | Model Registry | Unity Catalog MLflow | Fabric MLflow |
| 自動更新 | Dynamic Table | Lakeflow Pipelines | Fabric Pipeline |

## 学習記録 → 教材化 YAML 構造

ハンズオンの学習記録を構造化して蓄積し、教材の改善に活用する。

### YAML 構造

```yaml
# learning_record.yaml
metadata:
  learner_id: "anonymous-001"
  date: "2026-04-16"
  pattern: "C"  # A, B, C, D, E
  platform: "snowflake"  # snowflake, databricks, fabric
  duration_minutes: 45

steps:
  - step: 1
    title: "AI_CLASSIFY で感情分類"
    status: "completed"  # completed, stuck, skipped
    duration_minutes: 12
    difficulty: 3  # 1-5
    notes: "AI_CLASSIFYの構文は直感的だった"

  - step: 2
    title: "AI_EXTRACT で情報抽出"
    status: "stuck"
    duration_minutes: 18
    difficulty: 4
    stuck_point: "JSONのスキーマ定義が難しい"
    resolution: "公式ドキュメントの例をコピペして修正"
    notes: "スキーマの書き方の例がもっと欲しい"

  - step: 3
    title: "AI_SUMMARIZE_AGG で週次要約"
    status: "completed"
    duration_minutes: 15
    difficulty: 2
    aha_moment: "GROUP BY でAI要約ができるのは面白い"

surprises:
  - "SQLの中でAIが動くのは新鮮"
  - "AI_CLASSIFYの信頼度スコアが意外と低い日がある"

confusions:
  - question: "AI_COMPLETE と AI_CLASSIFY の使い分けがわからない"
    resolved: true
    resolution: "出力が自由テキストならCOMPLETE、選択肢ならCLASSIFY"

  - question: "トークン数でいくらかかるか計算できない"
    resolved: false

suggestions:
  - "ステップ2のJSONスキーマにもっと例が欲しい"
  - "コスト計算の簡易ツールがあると嬉しい"

overall:
  satisfaction: 4  # 1-5
  would_recommend: true
  most_valuable: "AI_CLASSIFY が一番実用的に感じた"
  next_want_to_learn: "RAG (パターンB)"
```

### 学習記録の集計

```yaml
# education_analytics.yaml
# 複数の学習記録を集計して教材改善に活用

pattern_difficulty:
  A_text_to_sql:
    avg_difficulty: 2.8
    completion_rate: 0.92
    most_stuck_step: "Semantic Model の定義"
  B_rag:
    avg_difficulty: 3.5
    completion_rate: 0.78
    most_stuck_step: "チャンクサイズの調整"
  C_batch_llm:
    avg_difficulty: 2.3
    completion_rate: 0.95
    most_stuck_step: "AI_EXTRACT の JSON スキーマ"
  D_agents:
    avg_difficulty: 3.8
    completion_rate: 0.72
    most_stuck_step: "ツール定義の構文"
  E_feature_store:
    avg_difficulty: 4.2
    completion_rate: 0.65
    most_stuck_step: "Training-Serving Skew の概念理解"

improvement_actions:
  - pattern: "E"
    action: "Feature Store の概念をExcelアナロジーで先に説明する"
    priority: "high"
  - pattern: "B"
    action: "チャンクサイズの推奨値を明記する"
    priority: "medium"
  - pattern: "C"
    action: "JSON スキーマの例を3パターン追加する"
    priority: "medium"
```

## 教材パッケージ将来像

### Phase 1: セルフラーニング教材（現在）

```
focus-you-education/
├── patterns/
│   ├── A-text-to-sql/
│   │   ├── 5min-intro.md          ← 5分ミニ教材
│   │   ├── hands-on-snowflake.md  ← ハンズオン（既存）
│   │   ├── hands-on-databricks.md
│   │   └── hands-on-fabric.md
│   ├── B-rag/
│   ├── C-batch-llm/
│   ├── D-agents/
│   └── E-feature-store/
├── reference/
│   ├── confusion-map.md           ← 混同マップ
│   ├── faq.md                     ← FAQ
│   └── cost-comparison.md         ← コスト比較
└── sample-data/
    ├── diary_entries.csv
    ├── emotion_analysis.csv
    └── calendar_events.csv
```

### Phase 2: インタラクティブ教材

```
追加:
├── interactive/
│   ├── sql-playground/            ← ブラウザでSQL実行（Snowflake Trial連携）
│   ├── quiz/                      ← 理解度チェッククイズ
│   │   ├── llm-vs-ml.json
│   │   ├── agent-decompose.json
│   │   └── feature-store-basics.json
│   └── progress-tracker/          ← 学習進捗の可視化
└── learning-records/
    └── schema.yaml                ← 学習記録YAML
```

### Phase 3: AI教材プラットフォーム（商用化）

```
focus-you-education-platform/
├── content/
│   ├── courses/                   ← コース（5パターン x 3基盤 = 15コース）
│   ├── mini-lessons/              ← 5分ミニ教材
│   └── case-studies/              ← 実際のデータで学ぶケーススタディ
├── personalization/
│   ├── learning-path-engine/      ← 学習パスの自動推薦
│   │   └── 「SQL経験あり + ML未経験」→ パターンC → A → E の順を推薦
│   ├── difficulty-adapter/        ← 詰まりポイントに応じて難易度調整
│   └── gap-analyzer/             ← 学習記録から弱点を特定
├── community/
│   ├── discussion/                ← 質問・議論
│   └── showcase/                  ← 学習成果の共有
└── analytics/
    ├── completion-funnel/         ← どこで離脱するか
    ├── difficulty-heatmap/        ← どのステップが難しいか
    └── improvement-suggestions/   ← 教材改善の自動提案
```

### 教材パッケージの差別化

| 競合 | 特徴 | focus-you 教材の差別化 |
|------|------|----------------------|
| Coursera / Udemy | 汎用的なML/AI講座 | **自分のデータ（日記）で学ぶ** |
| Databricks Academy | Databricks 固有 | **3基盤を横断比較** |
| Snowflake University | Snowflake 固有 | **3基盤を横断比較** |
| Microsoft Learn | Fabric 固有 | **3基盤を横断比較** |
| Kaggle Learn | コンペ寄り | **ビジネス実装寄り** |

**最大の差別化**: 「自分の日記データ」で学ぶので、結果が自分事として理解できる。汎用的なサンプルデータ（Titanic, Iris）では得られない「自分の感情パターンを AI が分析する」体験。

---

## リサーチ部 3段構成

### 1. 公知情報ベースの分析

- Databricks Academy: Databricks 固有の学習プラットフォーム（https://www.databricks.com/learn）
- Snowflake University: Snowflake 固有の学習プラットフォーム（https://learn.snowflake.com/）
- Microsoft Learn (Fabric): Fabric 固有の学習パス（https://learn.microsoft.com/en-us/training/paths/get-started-fabric/）
- MLflow ドキュメント: モデル管理の標準ツール（https://mlflow.org/docs/latest/index.html）
- AI 教材市場: Coursera / Udemy の AI 関連講座は年間20%成長（推測: 各プラットフォームの公開データから）

### 2. 限界の明示

- **教材の鮮度**: AI/LLM の進化が速く、半年で教材が古くなる可能性が高い。自動更新の仕組みが必要
- **サンプルデータの限界**: 30行の日記データでは ML の精度が出ない。「体験用」と割り切る必要がある
- **3基盤の差異**: 各基盤のUIやAPIは頻繁に変わる。スクリーンショットベースの教材は特に陳腐化しやすい
- **推測**: AI 教材市場の成長率は各プラットフォームの公開データに基づく推測。正確な市場規模データは取得できていない
- **商用化の壁**: 個人の日記データを教材に使うには、プライバシーとデータ所有権の問題を解決する必要がある

### 3. 壁打ちモードへの導線

1. **「5分ミニ教材の中で、最初に商品化するならどれ？」** --- 教材1（SQL-LLM）が最もハードルが低い。SQL を知っている人が多く、成功体験までの距離が短い
2. **「自分のデータで学ぶ教材は、プライバシーの問題をどう解決する？」** --- ローカルで動かす前提にする（クラウドに送信しない）。または匿名化されたサンプルデータを用意し、「自分のデータに差し替えて試してみて」と促す
3. **「教材の鮮度をどう保つか？」** --- (1) 概念説明は陳腐化しにくいので重視 (2) コードサンプルは「動かなくなったら」を前提にバージョン情報を明記 (3) 学習記録の「stuck_point」から自動的に教材改善提案を生成
4. **「競合（Databricks Academy等）との差別化は持続可能か？」** --- 「自分のデータで学ぶ」は各プラットフォームが真似しにくい。日記データは極めて個人的で、汎用プラットフォームでは扱いにくい
5. **「最初の顧客は誰？」** --- (1) データ基盤を導入したが AI 統合に手が回らない企業の社内教育担当 (2) SQL は書けるがMLに手を出していないデータアナリスト (3) focus-you のユーザーで「AIの仕組みを理解したい」人
