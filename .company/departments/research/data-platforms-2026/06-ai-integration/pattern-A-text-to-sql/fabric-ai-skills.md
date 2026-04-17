# Microsoft Fabric Data Agent / AI Skill ハンズオン

> 所要時間: 約70分 / 前提: 第1弾 `04-fabric-handson.md` を終え、Fabric ワークスペース内の Lakehouse に focus-you データがある状態

## このハンズオンのゴール

Fabric の **Data Agent**（Preview）と **Copilot in Power BI** の自然言語問い合わせを、focus-you データに対して触る。既存 Power BI Semantic Model を流用できる強みと、M365 / Copilot Studio 連携の広がりを体感する。

## Fabric の Text-to-SQL は "入口が複数ある"

Fabric の自然言語BIは単一機能ではなく、入口が複数:

| 入口 | 何ができるか | 内部の仕組み |
|---|---|---|
| **Copilot in Power BI** | レポート横のチャットで "総 joy の推移を見せて" と言える | Power BI Semantic Model を LLM が読む |
| **Fabric Data Agent** (Preview) | Lakehouse / Warehouse / Semantic Model を tool として使える Agent を自作 | Data Agent 設定UI + LLM |
| **Copilot for Data Engineering** (Notebook) | Notebook セル内で自然言語から Spark/SQL を生成 | GPT-5 |
| **AI Skill (旧名)** | 自然言語BIを "Skill" として保存し、他の Copilot から呼べる | Power BI + Fabric Copilot |

本ハンズオンでは **Copilot in Power BI** と **Data Agent** の2つを触る。

公式: [Overview of Copilot in Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/copilot-fabric-overview) / [Fabric Data Agent concept](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent) (accessed 2026-04-15)

---

## 前提: Capacity が Copilot 対応か確認

Fabric Copilot は **F64 以上** の capacity でのみ有効化される（試用 capacity でも有効なケースあり）。個人試用アカウントでは有効化できない場合があり、その場合は以下の代替:

- **代替A**: Microsoft 365 Developer Program で取得した E5 テナントで Fabric 試用を有効化
- **代替B**: Data Agent を **Python SDK 経由** で呼ぶ（Capacity要件が緩い場合あり）
- **代替C**: 自然言語BIだけ触るなら、Power BI Desktop の **Copilot preview** を使う

詰まったら `00-trial-and-pricing.md`（第1弾）の Fabric 節を再読。

## ステップ 1: Power BI Semantic Model を作る（20分）

Fabric ワークスペース → Lakehouse `focus_you` → 右上 **New semantic model** → `daily_mood_v` View / テーブルを選択して **Confirm**。

できた Semantic Model を開き、**Modeling view**:

1. **Measures を追加**
   - 右パネルの `daily_mood_v` で右クリック → **New measure**
   - `stress_score_avg = AVERAGE(daily_mood_v[stress_score])`
   - `mood_score_avg = AVERAGE(daily_mood_v[mood_score])`
   - `joy_avg = AVERAGE(daily_mood_v[joy])`
2. **カラムと Measure の Description を埋める**（Copilot が読む）
   - `stress_score`: "sadness + anger + fear の合計。0〜3。高いほどストレスが強い"
   - `mood_score`: "自己申告の気分スコア。1〜10。高いほど良い"
3. **Q&A linguistic schema** で同義語を登録
   - `stress_score` の同義語に "ストレス", "stress" を追加
   - `mood_score` の同義語に "気分", "mood"

👉 **驚きポイント**: 既に Power BI を使っている組織なら、Semantic Model は **既に存在する** 資産。Text-to-SQL のために一から書き直す必要がない。これが Fabric の最大の強み。

## ステップ 2: Power BI レポートを作って Copilot で問いかけ（15分）

Semantic Model から **Create Report** → 適当に折れ線グラフを1つ置く。

レポート画面右上の **Copilot** ボタンを押し、サイドパネルで:

1. "Show the trend of joy_avg over time"
2. "Which week had the highest stress_score_avg?"
3. "先週ストレスが高かった日は？"
4. "気分が良かった週末の予定は？"

Copilot は:
- 既存ビジュアルへの変更提案
- 新しいビジュアル生成
- 自然言語の回答

を返す。

**日本語と英語で精度差** を比較する。2026年時点では英語のほうが安定する傾向があるので、組織の運用言語に応じて回避策を検討する必要がある。

## ステップ 3: Fabric Data Agent を作る（25分）

Fabric ワークスペース → **New** → **Data Agent** (Preview)。

### 設定内容

1. **Name**: `focus-you agent`
2. **Data sources**: 
   - Lakehouse `focus_you` を追加
   - Semantic Model `daily_mood_v` を追加（tool として使う）
3. **Instructions**:
   ```
   あなたは focus-you ユーザーの気分分析アシスタントです。
   - stress_score は sadness + anger + fear の合計を指します
   - "気分が良い" は mood_score >= 7 を指します
   - 結果が3行以内の時は自然言語で要約も添える
   - 日付は YYYY-MM-DD 形式で
   ```
4. **Example questions** に以下を追加:
   - "先週ストレスが高かった日は？"
   - "今月の joy の平均は？"
   - "気分が良かった日に多かった予定カテゴリは？"

### テスト

Data Agent 画面下部のチャットから問いかけ。Data Agent は複数の data source から必要なものを選んで問い合わせる（RAGっぽいルーティング）。

### Copilot Studio から呼ぶ（省略可）

Data Agent は Copilot Studio 経由で Microsoft Teams や M365 Copilot からも呼べる。「組織横断で AI 資産を使い回す」という MS 特有の世界観を体感したい場合は、Copilot Studio 側で agent を作って Fabric Data Agent を tool として宣言する。手順は [Consume a data agent in Copilot Studio](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-copilot-studio) (accessed 2026-04-15) を参照。

## コスト

Fabric の AI機能は **Capacity Unit (CU)** 消費。Copilot / Data Agent の CU 消費量は以下のドキュメントに公表されている:

- [Power BI Copilot pricing](https://powerbiconsulting.com/blog/power-bi-copilot-complete-guide-2026) (accessed 2026-04-15)
- Fabric capacity は時間課金で、使用量に応じて burst → smoothing される

**隠れコスト**:
- Copilot を有効化すると capacity 使用率が跳ね上がる時間帯があり、他ワークロードへ影響する
- Semantic Model のサイズが大きいと Copilot の応答時間とコストが比例して増える

**節約Tips**:
- Semantic Model の粒度を絞る（全カラムを露出しない）
- Measures は10個程度に絞る。増やしすぎると Copilot が迷う
- F2 / F4 capacity では Copilot を使わない（CU が跳ねて SKU 限度を食う）

## 他2基盤との差分メモ

- **既存 BI 資産を流用できる**: 3基盤の中で Fabric が最強。Power BI Semantic Model は世界中の組織に既にある
- **Capacity 課金**: "LLM の使用量" と "計算リソース消費" が1つの CU に束ねられているため、コスト配分が追いにくい
- **Copilot / Agent / AI Skill / Data Agent の名前の整理**: MS のネーミングは頻繁に変わる。2026年時点では **Data Agent** が総称として定着しつつある

## 公知情報の限界

- Fabric Data Agent は **Preview**。仕様変更リスクが高い
- 日本語の精度は英語比で劣る傾向。公式の精度指標はなし
- Capacity 要件が個人アカウントで満たせない場合あり（E5 テナント推奨）
- Copilot Studio 連携は「できる」ことはドキュメント化されているが、実運用例の公開情報は乏しい

## 壁打ちへの導線

- クライアントが既に **Power BI Enterprise** を全社展開している場合、Fabric の Text-to-SQL は "既存資産の延長"。これを他基盤と天秤にかけられるか？
- Data Agent / AI Skill / Copilot / Copilot Studio の整理を30秒で説明できるか？
- 日本語精度の低さを "組織の運用言語は英語に寄せる" で回避するか、"Semantic Model を日本語で多義語化" で乗り切るか

## ネクストアクション

- [ ] Semantic Model の同義語をすべて日本語で設定する
- [ ] 同じ質問を Power BI Copilot / Data Agent / Notebook Copilot の3経路で試し、精度を比較
- [ ] CU 消費を Metric App で可視化し、1問あたりコストを推定

---

**Sources (accessed 2026-04-15)**:
- [Overview of Copilot in Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/copilot-fabric-overview)
- [Fabric Data Agent concept](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent)
- [Consume a data agent in Copilot Studio](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-copilot-studio)
- [Consume a data agent from Copilot in Power BI](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-copilot-powerbi)
- [Fabric Data Agents + Copilot Studio blog](https://blog.fabric.microsoft.com/en-us/blog/fabric-data-agents-microsoft-copilot-studio-a-new-era-of-multi-agent-orchestration)
- [Power BI Copilot Guide 2026](https://powerbiconsulting.com/blog/power-bi-copilot-complete-guide-2026)
