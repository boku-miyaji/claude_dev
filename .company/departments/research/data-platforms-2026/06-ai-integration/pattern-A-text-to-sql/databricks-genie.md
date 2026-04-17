# Databricks Genie ハンズオン

> 所要時間: 約60分 / 前提: 第1弾 `03-databricks-handson.md` を終え、Unity Catalog の `focus_you.default.*` に Delta テーブルがある状態

## このハンズオンのゴール

**Genie Space** を作成し、focus-you データに自然言語で問い合わせできる状態にする。Semantic な情報（Metrics・例示クエリ・用語集）を与え、Thinking Steps と Inspect で幻覚を抑える挙動を観察する。

## Genie とは（30秒で）

Databricks の自然言語BI機能。**Unity Catalog に登録されたテーブル・View に対し、自然言語で問い合わせると SQL を生成 → 実行 → 結果テーブル + チャート + 説明を返す**。Unity Catalog Metrics（定義済み指標）と Genie Space 内で与えるサンプル質問・用語定義を組み合わせて精度を上げる。

2026年時点の特徴:
- **Thinking Steps**: LLM が SQL を組み立てる過程を自然言語で説明 ([docs](https://docs.databricks.com/aws/en/genie/talk-to-genie), 2026-04-15)
- **Inspect**: 生成SQL をLLMが自分でレビューして修正する（Public Preview）
- **Genie Code**: "agentic engineering" 寄りの新機能（範囲外）

公式: [What is a Genie space](https://docs.databricks.com/aws/en/genie/) (accessed 2026-04-15)

---

## ステップ 0: マート View を作る（5分）

Notebook で:

```sql
CREATE OR REPLACE VIEW focus_you.default.daily_mood_v AS
SELECT
  d.entry_date, d.entry_text, d.mood_score,
  e.joy, e.sadness, e.anger, e.fear, e.surprise, e.disgust,
  (e.sadness + e.anger + e.fear) AS stress_score,
  COALESCE(SUM(CASE WHEN c.category='work'     THEN 1 END), 0) AS work_events,
  COALESCE(SUM(CASE WHEN c.category='personal' THEN 1 END), 0) AS personal_events,
  COALESCE(SUM(CASE WHEN c.category='health'   THEN 1 END), 0) AS health_events
FROM focus_you.default.diary_entries d
LEFT JOIN focus_you.default.emotion_analysis e USING (entry_date)
LEFT JOIN focus_you.default.calendar_events c ON d.entry_date = c.event_date
GROUP BY ALL;
```

View に **COMMENT** をつけておくと Genie が拾ってくれる:

```sql
COMMENT ON VIEW focus_you.default.daily_mood_v IS
  '日次の気分・感情・予定を結合したマート。focus-youのコアテーブル。';

COMMENT ON COLUMN focus_you.default.daily_mood_v.stress_score IS
  'sadness + anger + fear の合計。0〜3の範囲。高いほどストレスが強い。';
COMMENT ON COLUMN focus_you.default.daily_mood_v.mood_score IS
  '自己申告の気分スコア。1〜10で高いほど良い。';
```

👉 **驚きポイント**: カラム COMMENT を真面目に書くと、Genie の精度が劇的に上がる。これは SQL 文化と LLM 文化の架け橋。

## ステップ 1: Genie Space を作る（5分）

左サイドバー → **Genie** → **New** を選択。

1. **Name**: `focus-you analytics`
2. **Description**: "focus-you の日次気分・感情・予定データに自然言語でアクセス"
3. **Tables**: `focus_you.default.daily_mood_v` を選択（マスターのみ追加が推奨。RAWは見せない）
4. **Create** をクリック

Genie Space 画面に入る。右上 **Settings** から設定を追加していく。

## ステップ 2: サンプル質問と指示を設定（10分）

Genie Space の **Settings → Instructions** で以下を貼る:

```
# 指示
- "ストレス" は stress_score カラムを指す
- "気分が良い" は mood_score >= 7 を指す
- "先週" は現在日付から過去7日を指す (絶対日付ではない)
- 日付を出す場合は YYYY-MM-DD 形式で
- 結果が3行以内で収まる質問には、自然言語の説明も添えること
```

**Sample Questions** タブで:

```
先週ストレスが高かった日は？
3月で一番joyが高かった日とその日の予定は？
気分が良かった日に多かったカレンダーカテゴリは？
平日と週末で mood_score に差はありますか？
```

**Trusted Assets** (Certified Queries) タブで検証済みクエリを追加しておくと、類似質問で LLM が再利用する:

```sql
-- Name: stressful_days_last_week
SELECT entry_date, stress_score
FROM focus_you.default.daily_mood_v
WHERE entry_date >= current_date() - INTERVAL 7 DAYS
ORDER BY stress_score DESC
LIMIT 3;
```

## ステップ 3: チャット欄で触る（15分）

Space 画面下部のチャットから問いかける:

1. "先週ストレスが高かった日は？"
   - Genie は **Thinking Steps** を展開する。"先週 = 過去7日と解釈" "stress_score で降順" といったステップが表示される
2. "3月で一番joyが高かった日とその日の予定を教えて"
   - 結合がないので joy のピーク日だけ返るはず。足りなかったら「その日の予定も一緒に」と追加質問
3. "平日と週末で mood_score に差はありますか？"
   - Genie が `DAYOFWEEK` や `CASE WHEN` を使ってグループ集計するかを観察
4. "ちょっと疲れた気がする日が多かった週は？"
   - "疲れた" の定義が曖昧。Genie は自分の解釈を Thinking Steps に出すはず。Instructions に追記して挙動を変えてみる

## ステップ 4: Inspect を有効化する（5分）

Space の Settings → **Inspect**（Public Preview）をオンにする。オンにすると、Genie は最初に出した SQL を LLM 自身にレビューさせ、必要なら修正版を生成する。挙動が変わるか見る:

- 修正が入るケース: 集計粒度がおかしい、WHERE 句が欠落している、など
- 入らないケース: 既にシンプルな集計

2026年時点で Public Preview。本番ワークロードで使う場合は、Inspect あり/なしの精度差を自分の環境で測ってから決める。

## ステップ 5: REST API から呼び出す（15分）

Genie は REST API からも呼べる。Notebook で:

```python
import requests, os
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
host = w.config.host
token = w.config.token
space_id = "XXXXXXXXXX"  # Genie Space の URL から取得

# 会話を開始
resp = requests.post(
    f"{host}/api/2.0/genie/spaces/{space_id}/start-conversation",
    headers={"Authorization": f"Bearer {token}"},
    json={"content": "先週ストレスが高かった日は？"},
).json()
print(resp)
```

アプリに組み込む場合は、Slack bot / Streamlit on Databricks / Databricks Apps のいずれかに載せる。

## コスト

Genie は **Pay-per-token** の Foundation Model Serving を消費 + SQL Warehouse のコンピュート。2026年時点の FMAPI 単価は [Databricks Foundation Model Serving pricing](https://www.databricks.com/product/pricing/foundation-model-serving) (accessed 2026-04-15) を参照。

**節約Tips**:
- SQL Warehouse は **Serverless** を使い `Auto Stop = 5 min`
- 試用期間中は Free Edition を利用
- Trusted Queries を充実させて "first-pass hit" 率を上げる（LLMが最初から正しい SQL を出せば Inspect のリトライ分が不要）

## 他2基盤との差分メモ

- **vs Snowflake Cortex Analyst**: 
  - Snowflake は YAML でオフラインに Semantic を管理、Databricks は Space UI + UC Metrics
  - Genie の方が **Thinking Steps** / **Inspect** など対話的なデバッグが充実
  - Snowflake の方が一度書いた YAML を Git 管理しやすい
- **vs Fabric Data Agent / AI Skill**:
  - Fabric は既存 Power BI Semantic Model を流用できるので、BI資産がある組織では最短
  - Databricks は Unity Catalog 資産と直結（Lakehouse 前提の組織向け）

## 公知情報の限界

- Thinking Steps / Inspect は Public Preview（2026-04時点）で、仕様変更リスクあり
- Genie の日本語対応状況は明示的な公表がなく、実測で確認する必要あり
- Agent Evaluation との統合は "Quotient AI 買収後に強化" と公式発表されているが、本番向けベストプラクティスは流動的

## 壁打ちへの導線

- Unity Catalog の COMMENT を書く文化が組織にあるか（無い組織では Genie の効果が半減）
- "Thinking Steps" をエンドユーザーに見せるか隠すか
- Trusted Queries の運用責任者は誰か（データ品質責任者？ BI 運用者？）

## ネクストアクション

- [ ] View にすべての COMMENT を入れて精度変化を観察
- [ ] Instructions を日本語/英語で書き換えて精度差を見る
- [ ] Genie 経由の月次コストを `cost-comparison.md` に記録

---

**Sources (accessed 2026-04-15)**:
- [What is a Genie space](https://docs.databricks.com/aws/en/genie/)
- [Talk to Genie](https://docs.databricks.com/aws/en/genie/talk-to-genie)
- [Set up and manage a Genie space](https://docs.databricks.com/aws/en/genie/set-up)
- [Curate an effective Genie space](https://docs.databricks.com/aws/en/genie/best-practices)
- [Databricks Foundation Model Serving pricing](https://www.databricks.com/product/pricing/foundation-model-serving)
