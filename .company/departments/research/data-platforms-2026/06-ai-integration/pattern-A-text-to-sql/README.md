# パターン A: Text-to-SQL / 自然言語BI

> **ゴール**: 「先週ストレスが高かった日を教えて」「気分が良かった週末は何してた？」のような自然言語の問いを、DBに対するSQL実行に変換して答える機能を、3基盤それぞれで触る。

## このパターンの肝

Text-to-SQL は2024年に各社が「すぐできる」と言って出した機能だが、2025-2026年に **現場で3つの壁** が顕在化した:

1. **Schema だけでは LLM がカラムの意味を理解できない** → Semantic Model（意味モデル）が必要
2. **権限境界を越えて見えないデータが見えてしまう** → Row-Level Security との統合が必要
3. **曖昧な問いに LLM が勝手に答えを決める** → "ask-back" できる対話UIが必要

3基盤はこの3つの壁に **ほぼ同じ発想** で対処しているが、**Semantic Model の書き方と管理方法が大きく違う**。ここを触り比べるのが本節のコア価値。

## 比較軸

| 軸 | Snowflake Cortex Analyst | Databricks Genie | Fabric Data Agent / AI Skill |
|---|---|---|---|
| Semantic Model の定義場所 | YAML ファイル（stage に置く） | Unity Catalog Metrics + Genie Space 設定UI | Power BI Semantic Model (既存BI資産を流用) |
| サポート範囲 | SQL生成に集中 | SQL生成 + チャート提案 + Thinking Steps | SQL + Power BI Visual + Copilot Studio 統合 |
| 対話性 | 曖昧な問いには clarification response を返せる | "Inspect" 機能で SQL 生成を自己レビュー | Copilot UI の自然対話 |
| 権限境界 | Snowflake RBAC + Row Access Policy | Unity Catalog のGrant体系 | Fabric workspace + RLS |
| エンドユーザーが呼ぶ方法 | REST API / Streamlit / Slack bot | Genie Space UI / REST API | Copilot in Power BI / M365 / Teams |
| **一番楽だと感じるのは** | YAML を一度書けば再利用しやすい | 既存 Unity Catalog 資産がある人には最短 | 既に Power BI Semantic Model がある現場には無敵 |

## focus-you で問いかける質問（3基盤共通）

ハンズオンで全基盤に以下を聞く:

1. **単純集計**: "先週の joy スコアの平均はいくつ？"
2. **条件抽出**: "先週ストレスが高かった日は？"（stress = sadness + anger + fear で定義）
3. **結合と文脈**: "気分が良かった日に多かったカレンダーカテゴリは？"
4. **時系列**: "3月で最も joy が高かった日と、その日の予定を教えて"
5. **曖昧な問い（LLMの応答を見る）**: "ちょっと疲れた気がする日が多かった週は？" ← "疲れた" の定義が未定。3基盤それぞれのask-back挙動を見る

これを3基盤で同じ順で試すことで、「**同じ問いに対する違う答え方**」を体感できる。

## 設計論点（プロダクション目線）

### 幻覚対策

- **Semantic Model で全カラムに description を書く**: カラム名だけでは伝わらない意味情報を明示
- **許可するテーブル/ビューを限定する**: 100テーブル全部見せると幻覚が増える。マート層だけ見せる
- **Few-shot サンプルを入れる**: 「このような問いにはこのSQL」のペアを数件与えると激減する
- **LLM 生成SQL を事前検証する層を入れる**: Databricks Genie の "Inspect" はこれを自動化したもの

### 権限境界

- 原則: **Text-to-SQL は必ずエンドユーザーの権限で実行する** (service account で実行して結果を返すのはアンチパターン)
- Row-Level Security と組み合わせ、RLS が効いた結果を LLM が説明する構造にする
- 監査ログには **「誰が」「何を聞き」「どんなSQLが生成され」「どの行が返ったか」** を全部残す

### 曖昧クエリ

- "先週" = カレンダー週 / 過去7日 / 営業週? → LLM に決めさせず、"先週(= 2026-04-06〜04-12) ですか、それとも過去7日ですか?" と ask-back する
- NULL 扱い: "気分が良かった日" に mood_score が NULL の日を含めるか → 除外前提を UI に明示する
- タイムゾーン: ユーザーのロケールに明示的にバインドする（特にグローバル案件）

### 監査ログ

- Snowflake: ACCOUNT_USAGE の QUERY_HISTORY + Cortex Analyst の request/response をアプリ側で保存
- Databricks: Unity Catalog の audit log + Genie のクエリ履歴
- Fabric: Purview 連携で横断的に捕捉

## 公知情報の限界

- 各社の Semantic Model フォーマットはまだ標準化されていない。同じ内容を3回書くことになる
- Cortex Analyst は2026年時点で日本語の自然言語問い合わせの精度が英語より低い傾向（公式見解ではなく実装レベルの観察）
- Genie の Thinking Steps / Inspect は Public Preview（2026-04時点）で、仕様変更の可能性
- Fabric Data Agent は個人用試用アカウントでは有効化できない場合があり、クライアントテナントで触る必要あり

## 壁打ちモードへの導線

- 「Semantic Model を YAML で書く（Snowflake）」「UC Metrics で書く（Databricks）」「Power BI Semantic Model を流用（Fabric）」— クライアントが既に持っている資産に応じて、どれが一番省力か即答できるか？
- "ユーザー全員が自然言語で聞ける" 状態を実現したとき、**組織にどんな副作用** が生まれるか（データ民主化の副作用）
- Text-to-SQL と BI ダッシュボードはどちらが先に要るか。両立案はあるか

---

**次のファイル**:
- [`snowflake-cortex-analyst.md`](./snowflake-cortex-analyst.md)
- [`databricks-genie.md`](./databricks-genie.md)
- [`fabric-ai-skills.md`](./fabric-ai-skills.md)
