# focus-you 本番データ基盤評価 — Snowflake / Databricks / Fabric（2026-04）

> focus-you を B2C SaaS としてプロダクト化する前提で、Snowflake / Databricks / Microsoft Fabric を**本番データ基盤**として使う意味があるかをフラットに評価する。結論ありきではない。

**作成日**: 2026-04-15 / **担当**: HD共通リサーチ部 / **対象PJ**: focus-you（個人向け日記・感情分析・AI対話SaaS）

---

## 1. エグゼクティブサマリ（30秒版）

- **100 MAU まで Supabase 単独で十分。3基盤はどれも過剰投資**。最も安い「Supabase Pro + OpenAI直叩き」で月 **$30〜$40（約 4,500〜6,000円）**。3基盤併設は最小でも月 $100 以上かかり、ROIが合わない。
- **1,000 MAU（MRR 約 ¥980,000〜¥2,980,000想定）で初めて「分析層」として Databricks か Snowflake を検討する価値が出る**。ただし「入れるべき」ではなく「入れても赤字にならない」ライン。基盤側コストは Supabase ベースラインに月 $200〜$500 上乗せ程度。
- **10,000 MAU＋教材/B2B展開が見えてから、本命は Databricks（Lakebase 併用）**。理由は (a) LLM/RAG/Vector Search が一体、(b) OLTP の Lakebase が2026-02にGA、(c) Free Edition で開発環境を温存しやすい。Snowflake はコスト透明性で対抗、Fabric は MS365 ロックインされた B2B 案件が来たとき限定で意味がある。
- **今やるべき意思決定は「どれを入れるか」ではなく「Supabase を Bronze/Silver/Gold のどこに置き続けるか」**。OLTP は Supabase 維持、分析とRAGは後から外に切り出す前提でスキーマ設計しておくのが最小リスク。
- **完全移行（Supabase廃止）はどの基盤でも非推奨**。Snowflake Hybrid Tables / Databricks Lakebase は技術的には可能だが、認証・Realtime・Edge Function エコシステムを自前で再構築するコストがSaaSのMRRを食い尽くす。

---

## 2. 現状アーキテクチャ（Supabase）の再確認と限界

### 2.1 現在の構成（確認済み）

| レイヤ | 実装 |
|---|---|
| OLTP DB | Supabase PostgreSQL（`diary_entries`, `emotion_analysis`, `secretary_notes`, `ceo_insights` 等、RLSあり） |
| 認証 | Supabase Auth（ES256 publishable key, 2026初頭に移行済み） |
| Realtime | Supabase Realtime（ダッシュボード更新） |
| LLM | OpenAI gpt-5-nano / Anthropic を **Edge Function 経由**で呼ぶ（ブラウザ直叩き禁止のルール確立済み） |
| Vector検索 | pgvector（Supabase標準）想定。現状RAG本実装は未確認 |
| バッチ | Edge Function + 将来 Claude Code CLI（`feedback_use_claude_code_not_api.md`） |
| Frontend | React（focus-you ダッシュボード） |

### 2.2 Supabase でやれていること・やれていないこと

**やれていること**
- 日記CRUD・感情分析タグ付け・RLSでのユーザー分離・Realtime更新・認証・Google Calendar連携（proxy方式）
- pgvector があるので小規模 RAG なら外部サービス不要
- コストは MAU に対して非線形にスケール（compute add-on と storage overage）

**やれていない／不得意なこと**
- **全ユーザー横断の集計**（週次 PERMA+V の全MAU推移、コホート分析、日記テーマの LDA 等）。OLTP DB で長時間バッチを回すとロック・レスポンス劣化のリスク
- **大規模 Vector 検索**（pgvector は 10万行くらいから IVFFlat/HNSW のメモリ圧で compute add-on を上位に上げる必要）
- **教材プラットフォーム展開時に必要な「匿名化済み日記コーパス」の二次利用**。本番OLTPから毎回SELECTするのは筋悪
- **B2B 向けの監査ログ・データリネージ・SLA**。Supabase 単体ではエンタープライズ契約に耐えない
- **カラムナ集計**。行指向 PG で10万MAU×日記月36万件を長期集計するのは効率が悪い

### 2.3 「限界」はいつ来るか

実測はできないが、Supabase 公式ベンチと類似 SaaS の経験則からの**推測**:

| MAU規模 | Supabase単独で捌けるか | ボトルネック候補 |
|---|---|---|
| 〜1,000 | 余裕 | なし。Pro plan の Small/Medium compute で十分 |
| 1,000〜10,000 | 可能。ただし compute 上位 add-on 必須 | pgvector スケール、週次バッチのロック |
| 10,000〜100,000 | 技術的には可能だが辛い | 全ユーザー集計、RAG 精度、B2B監査 |
| 100,000〜 | Supabase 単独は非推奨 | OLTP と分析の分離が事実上必須 |

**ここが分析層を検討する閾値**。明確な数字ではなく「1,000〜10,000 の間のどこかで必然的に外に出す」くらいの粒度で覚えておけばよい。

---

## 3. 評価フレーム

| 観点 | 重み | 評価方法 |
|---|---|---|
| **コスト（定量）** | ★★★★★ | 3シナリオで実額試算 |
| **アーキテクチャ適合性** | ★★★★☆ | OLTP/分析/LLM/Vector の4要素カバレッジ |
| **撤退コスト** | ★★★★☆ | データエクスポート容易性・標準形式採用度 |
| **商用化タイミング適合性** | ★★★★☆ | MVP→1k→10k MAU のどこで ROI が出るか |
| **運用負荷（1人運用前提）** | ★★★★☆ | pause忘れ事故・監視負荷 |
| **B2B/教材展開対応** | ★★★☆☆ | マルチテナント、監査、SLA、契約書テンプレ |

---

## 4. アーキテクチャパターン整理（7パターン）

focus-you の文脈でありうるパターンを列挙する。`★` は本レポートで試算対象にするもの。

| # | パターン | 概要 | 評価 |
|---|---|---|---|
| **P0** ★ | Supabase 単独 | 現状維持 | ベースライン |
| **P1** ★ | Supabase + Snowflake（分析層のみ） | OLTPは Supabase、夜間 CDC で Snowflake に流す。集計・RAG・LLMは Snowflake Cortex | 本命候補A |
| **P2** ★ | Supabase + Databricks（分析層のみ） | 同上 Databricks 版。Vector Search・Mosaic AI・Genie | 本命候補B |
| **P3** ★ | Supabase + Fabric（分析層のみ） | 同上 Fabric 版。OneLake + Direct Lake | MS365ロックイン案件向け |
| **P4** ★ | Snowflake 単独（Hybrid Tables で OLTP も） | Supabase 廃止し OLTP も Snowflake Hybrid Tables | 技術的には可、撤退コスト高 |
| **P5** ★ | Databricks 単独（Lakebase で OLTP も） | Supabase 廃止し OLTP も Lakebase（2026-02 GA） | 技術的には可、最新・賭け要素あり |
| **P6** ★ | Fabric 単独 | Fabric SQL Database（プレビュー）で OLTP | 個人SaaSには無理筋 |

完全移行系（P4〜P6）は B2C SaaS の認証・Realtime を作り直す必要があり、コスト試算だけでは表現できないエンジニアリング負債が大きい（詳細は §7）。

---

## 5. スケール別コスト試算

### 5.1 試算の前提

**共通前提**
- 為替: $1 = 150円で換算。MRR は別途試算から独立
- LLM の input/output 比: 3:1 と仮定（日記要約・感情分類のワークロード）
- 日記平均: 600文字 ≒ 400トークン（入力）、感情タグ付け出力 100トークン
- ナラティブ生成: 週次、入力 2,000トークン（直近7日分要約）、出力 500トークン
- RAG検索: 入力 1,000トークン（クエリ+上位3件）、出力 300トークン
- ダッシュボード閲覧: LLM を呼ばない純SQLクエリ
- 1MAU あたり日記 12件/月、感情分析 12回、ナラティブ 4回、RAG 0.5回、閲覧 60回
- 前月からの総トークン（100MAU の場合）:
  - 入力: 100 × (12×400 + 4×2000 + 0.5×1000) = 100 × 13,500 = **1.35M tok/月**
  - 出力: 100 × (12×100 + 4×500 + 0.5×300) = 100 × 3,350 = **0.335M tok/月**
- 1,000 MAU は10倍、10,000 MAU は100倍

**LLM 単価**（2026-04時点、[OpenAI 公式](https://openai.com/api/pricing/)）
- gpt-5-nano: 入力 $0.050 / 1M tok、出力 $0.400 / 1M tok、キャッシュ入力 $0.005 / 1M tok

**各基盤の参照価格**
- Snowflake Standard: ~$2/credit（[Snowflake pricing](https://www.snowflake.com/en/pricing-options/)、Tokyo は+20〜40%、本試算は $2.6/credit を採用）、ストレージ $23/TB/月（on-demand US; Tokyo は約$25〜40）
- Databricks Serverless SQL: ~$0.70/DBU（[Databricks SQL pricing](https://www.databricks.com/product/pricing/databricks-sql)）、Serverless Jobs ~$0.22/DBU、Vector Search endpoint は **継続課金**（endpoint ある限り課金）
- Fabric F2: $0.36/時（[Azure Fabric pricing](https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/)）= 24h稼働で月約 $262、F4 $524、F8 $1,049、F64 $8,394。Pause で秒課金停止
- Supabase Pro: $25/月ベース、Small compute $10/月（$10クレジット込で実質 $0）、Medium $60、Large $110、XL $210、2XL $410、4XL $790、8XL $1,550、12XL $2,400、16XL $3,730（[Supabase pricing](https://supabase.com/pricing)）

---

### 5.2 シナリオA: 100 MAU（月1,200日記 / LLM 約1,685回 / RAG 50回 / 閲覧 6,000回）

総LLMトークン: 入力 1.35M tok、出力 0.335M tok

**OpenAI gpt-5-nano 直叩き費用**:
- 1.35M × $0.050 + 0.335M × $0.400 = $0.068 + $0.134 = **約 $0.20 / 月**

これが支配的でないことに注目。100MAUでは LLM はほぼタダ。

| 構成 | 内訳 | 月額 (USD) | 月額 (円換算) |
|---|---|---|---|
| **P0: Supabase単独** | Pro $25 + Small compute $0（$10クレジット相殺）+ LLM $0.20 + Storage余裕内 | **$25.20** | 約 3,780 |
| **P1: Supabase + Snowflake分析** | Supabase $25 + Snowflake最小 XS WH を月10時間（$2.6×10×1credit = $26）+ Storage 5GB無視できる + Cortex未使用 + LLM $0.20 | **$51.20** | 約 7,680 |
| **P2: Supabase + Databricks分析** | Supabase $25 + Databricks Free Edition（商用不可なので実運用は **Premium Serverless SQL 最小 2X-Small を月10時間**: 約 $0.70×4DBU×10h = $28）+ Vector Search endpoint $0（未使用）+ LLM $0.20 | **$53.20** | 約 7,980 |
| **P3: Supabase + Fabric分析** | Supabase $25 + Fabric F2 を週末2日×4時間のみ稼働 = 月32時間 = $0.36×32 = $11.52 + OneLake ストレージ無視できる + LLM $0.20 | **$36.72** | 約 5,510 |
| **P4: Snowflake単独（Hybrid Tables）** | Hybrid Tables 10GB $0.23 + XS WH 24h稼働（Realtime代替）= $2.6×24×30×1 = $1,872 + Storage + Cortex Search endpoint | **$1,900前後** | 約 285,000 |
| **P5: Databricks単独（Lakebase）** | Lakebase 最小 CU hour 連続稼働（Autoscaling min 1 CU ≒ $0.30/h 想定\*）= $216 + Serverless SQL 20h $14 + Vector Search endpoint 連続稼働 $50〜$100\* | **$280〜$350** | 約 42,000〜52,500 |
| **P6: Fabric単独** | F2 24h稼働 = $262 + OneLake + Fabric SQL DB | **$280前後** | 約 42,000 |

\* Lakebase Autoscaling の具体 DBU レートは2026-04時点で公式ドキュメントに分単位の rate が明記されていない。ここでは公式の [Lakebase Autoscaling pricing](https://docs.databricks.com/aws/en/oltp/projects/pricing) が示す「DBU×Capacity Unit hour」を最小構成で見積もっている。実額は社長が実測する必要あり（§9 参照）。

**結論（A）**: 100 MAU では **P0（Supabase単独）が圧勝**。P1〜P3 は「学習目的で併設」なら意味があるが、**売上ゼロの段階では月+$10〜$30 の余計な負担**。P4〜P6 は完全に過剰。

**隠れコスト注意点（A）**
- Snowflake の XS WH は AUTO_SUSPEND=60s を徹底しないと「クエリ1回で10分課金」される
- Fabric F2 は **pause 忘れ1日で $8.4**。月末締めて1週間放置したら月額が2倍になる
- Databricks Vector Search endpoint は **index を作った瞬間から課金継続**、削除しても24時間は課金
- Supabase Pro の $10 compute クレジットは Small までしか相殺しない。Medium 以上にすると丸々請求

---

### 5.3 シナリオB: 1,000 MAU（10倍スケール）

総LLMトークン: 入力 13.5M tok、出力 3.35M tok

**OpenAI gpt-5-nano 直叩き費用**:
- 13.5M × $0.050 + 3.35M × $0.400 = $0.675 + $1.34 = **約 $2 / 月**

LLM はまだ誤差レベル。支配的なのは DB compute と Vector 検索。

| 構成 | 内訳 | 月額 (USD) | 月額 (円換算) |
|---|---|---|---|
| **P0: Supabase単独** | Pro $25 + Medium compute $60（$10相殺で実質 $50）+ storage 50GB $6 + LLM $2 | **$83** | 約 12,450 |
| **P1: Supabase + Snowflake分析** | Supabase $83 + Snowflake XS WH 月30h $78 + S WH 週次バッチ4h = $21 + Storage 100GB $2.3 + Cortex 未使用 | **約 $184** | 約 27,600 |
| **P2: Supabase + Databricks分析** | Supabase $83 + Serverless SQL 2X-Small 月40h $112 + Jobs 週次 4h $6.2 + Vector Search endpoint 最小 $100前後\* + LLM $2 | **約 $303** | 約 45,500 |
| **P3: Supabase + Fabric分析** | Supabase $83 + Fabric F4 を月160h（平日夜のみ）= $0.72×160 = $115 + LLM $2 | **約 $200** | 約 30,000 |
| **P4: Snowflake単独（Hybrid Tables）** | Hybrid Tables 100GB $2.3 + Cortex Search endpoint + XS WH 24h連続（Realtime相当） = $2.6×24×30 = $1,872 + Cortex LLM 少々 | **約 $1,900** | 約 285,000 |
| **P5: Databricks単独（Lakebase）** | Lakebase Autoscaling min 2 CU h 想定 $400+ + Serverless SQL 分析 40h $112 + Vector Search $100 | **約 $650** | 約 97,500 |
| **P6: Fabric単独** | F4 24h連続（Fabric SQL DB + OneLake + Power BI）= $524 + Pro ライセンス除外 | **約 $540** | 約 81,000 |

\* Databricks Vector Search endpoint の具体単価は公式 [Vector Search pricing](https://www.databricks.com/product/pricing/vector-search) で「DBU based」としか明記がなく、実額は endpoint サイズと index 数に依存。ここでは類似SaaSの実績から最小 $100/月を見積もり。

**結論（B）**: 1,000 MAU では **P0 の $83 がまだ最安**。**P1（Snowflake）が +$100 程度で分析層を持てる**ので、MRR が仮に ¥980×1000×0.1（課金率10%）= ¥98,000 ≒ $650 あれば、粗利を12〜15%削る代わりに「教材展開の準備」「B2B商談の可視化」を持てる。**MRR が $500 未満なら P1 は時期尚早**。

**この段階で見える現実**
- 課金率が想定より低ければ MRR が $200 にも届かず、P1 でも赤字
- B2B SLA を約束する前に基盤を入れるのは順序として正しいが、**B2B の初期案件が取れてから入れる方が ROI 明確**
- P2 は Vector Search の継続課金がボディブロー。100MAU RAG ではオーバースペック
- P3 は Fabric F4 が **pause前提の運用に向かない**（Power BI Direct Lake が常時接続を前提とする場面が多い）

---

### 5.4 シナリオC: 10,000 MAU（100倍スケール + 週次全ユーザーバッチ）

総LLMトークン: 入力 135M tok、出力 33.5M tok

**OpenAI gpt-5-nano 直叩き費用**:
- 135M × $0.050 + 33.5M × $0.400 = $6.75 + $13.4 = **約 $20 / 月**

**週次全ユーザーバッチ（PERMA+V推移 + コホート分析）**:
- 日記 36万件を走査、集計、可視化素材生成
- Snowflake: S WH（2 credits/h）で 4時間 = 8 credits = $20.8
- Databricks: Serverless Jobs Small（4 DBU/h）で 4時間 = 16 DBU × $0.22 = $3.5（Jobs の方が SQL より単価安い）
- Fabric: F8 を4時間 = $5.8
- Supabase だけで回すと compute add-on 最上位が必要（XL以上）で常時課金

| 構成 | 内訳 | 月額 (USD) | 月額 (円換算) |
|---|---|---|---|
| **P0: Supabase単独** | Pro $25 + XL compute $210（$10相殺 $200）+ Storage 500GB $62 + Read replica $110 + LLM $20 + pgvector 追加compute | **約 $430** | 約 64,500 |
| **P1: Supabase + Snowflake分析** | Supabase $400（ただし XL 十分、Read replica 不要）+ Snowflake S WH 月80h $416 + Hybrid Table 不使用 + Storage 500GB $11.5 + Cortex 少々 $10 | **約 $830** | 約 124,500 |
| **P2: Supabase + Databricks分析** | Supabase $400 + Serverless SQL Small 月80h $224 + Jobs 週次バッチ $14 + Vector Search endpoint Small $150〜$300\* + Model Serving（ナラティブをオンプラ化する場合）$200+ | **約 $990〜$1,150** | 約 148,500〜172,500 |
| **P3: Supabase + Fabric分析** | Supabase $400 + F8 24h稼働 $1,049 + OneLake ストレージ + Copilot(F2以上でOK) | **約 $1,450** | 約 217,500 |
| **P4: Snowflake単独（Hybrid Tables）** | Hybrid Tables 500GB $11.5 + S WH 24h連続 = $2.6×2×24×30 = $3,744 + Cortex $30 + バックアップ等 | **約 $3,800** | 約 570,000 |
| **P5: Databricks単独（Lakebase + Mosaic AI）** | Lakebase min 8 CU h 連続 $1,700〜$2,500\* + Serverless SQL 分析 $300 + Vector Search $300 + Model Serving $400 | **約 $2,700〜$3,500** | 約 405,000〜525,000 |
| **P6: Fabric単独** | F16 24h連続 = $2,098 + OneLake + Fabric SQL DB + Power BI Pro/PPU | **約 $2,300** | 約 345,000 |

\* Lakebase 具体額は未確定。実測必須。

**結論（C）**: 10,000 MAU では **P0 の限界が見え始める**（Read replica や pgvector チューニングで頭打ち）。**P1（Snowflake）か P2（Databricks）が分析層として現実解**。P1 は透明な単価で予算化しやすく、P2 は RAG/Vector/Model Serving を一体運用できる強み。

**P1 vs P2 の分岐点**:
- **教材プラットフォーム主軸** → P2 Databricks（Mosaic AI でカスタムモデル・Vector Search 一体）
- **B2B ウェルビーイング分析売り** → P1 Snowflake（Cortex Analyst / ダッシュボード共有が速い、クライアント側の Snowflake 資産と連携可）

**完全移行系 P4/P5/P6 はこのレンジでも「割高」**。OLTPを動かし続ける固定費が B2C SaaS の粗利を圧迫する。Supabase の $25+α という安さは異常値で、それを捨てる合理性は「B2B契約で SLA 99.9% を約束した瞬間」くらいしかない。

---

### 5.5 全シナリオまとめ表（ひと目で見る）

| シナリオ | P0 Supabase単独 | P1 +Snowflake | P2 +Databricks | P3 +Fabric | P5 Databricks単独 |
|---|---|---|---|---|---|
| **A: 100 MAU** | **$25** | $51 | $53 | $37 | $280〜$350 |
| **B: 1,000 MAU** | **$83** | $184 | $303 | $200 | $650 |
| **C: 10,000 MAU** | $430⚠限界 | **$830** | $990〜$1,150 | $1,450 | $2,700〜$3,500 |

**読み方**: A/B は P0 が最安、C で初めて P1 が現実解として浮上する。**P0→P1 の差額は MAU とともに縮む**（A: 2倍、B: 2.2倍、C: 1.9倍）。絶対額の差は広がっているが、割合では変わらない＝基盤を入れる意味は **MRR に対する割合**で決まる。

---

## 6. 基盤別メリット・デメリット

### 6.1 Snowflake

**光る機能（focus-you文脈）**
- **Cortex AISQL** で SQL 一行から感情分析・要約・分類。SQL知識だけで LLM 機能を書ける
- **Hybrid Tables** で限定的 OLTP もカバー（ただし本試算の通り Supabase より高い）
- **コスト透明性**: credit×時間 の掛け算が極めてシンプル。予算化が楽
- **データ共有（Secure Data Sharing）**: 教材プラットフォームで匿名化済みコーパスをパートナーに配る際、コピー不要で共有できる
- **トライアル $400 クレジット**が手厚い

**不適合・弱み**
- Realtime がない（CDC 遅延が数分〜）
- Vector Search は Cortex Search で可能だが Databricks より後発
- OLTP 性能は Hybrid Tables でも Supabase PG 並み期待は無理
- Tokyo リージョンは US より20〜40%高い

**ベンダーロックイン度**: 中。データは COPY INTO で S3 に戻せる。Streamlit in Snowflake / Cortex を使い込むほどロックインが進む

**撤退コスト**: 低〜中。標準SQL+Parquetエクスポートで他基盤へ移行可。Cortex 呼び出しだけ書き換えが必要

---

### 6.2 Databricks

**光る機能**
- **Lakebase（2026-02 GA）**: Postgres 互換 OLTP + Lakehouse 一体。focus-you の「OLTPも分析も全部Databricks」夢が成立しうる（ただし試算通りコスト高）
- **Mosaic AI Vector Search**: Delta Table から直接ベクトル化、同期が自動
- **ai_query() / Model Serving**: LLM を SQL からも Notebook からも呼べる。カスタムモデル（Claude、社内ファインチューン）も一元管理
- **Free Edition**（無期限・クレカ不要）で開発環境を温存しやすい
- **Genie / AI/BI Dashboards** で自然言語クエリ（教材向けに強い）

**不適合・弱み**
- **Vector Search endpoint の継続課金**が小規模で効く（index を残すだけで月$100オーダー）
- Lakebase は新しく、実績が薄い。本番運用の事故パターンが未蓄積
- Free Edition は商用不可。本番は Premium/Enterprise 必須でコストが跳ねる
- コスト予測が DBU 単位で複雑（FinOps 必須）

**ベンダーロックイン度**: 中〜高。Delta Lake は Open だが Mosaic AI / Unity Catalog / Genie を使うほどロックイン

**撤退コスト**: 中。Delta は Parquet 互換だが、Vector Index・Model Serving・Genie を捨てる痛みは大きい

---

### 6.3 Microsoft Fabric

**光る機能**
- **Power BI 完全統合**。レポートの見栄え・配布・組織共有は3基盤で最強
- **Direct Lake** で OneLake から直接 Power BI、ETL不要
- **Copilot が F2 から使える**（2025-04 以降解放、[Fabric blog](https://blog.fabric.microsoft.com/)）
- **MS365 エコシステム連携**（Teams, SharePoint, Purview）

**不適合・弱み**
- **個人 SaaS には完全に過剰**。B2C focus-you の文脈で Power BI を誰も使わない
- Capacity は **時間課金で pause 運用必須**、B2C の24×7要求と相性最悪
- 個人アカウント縛りが厳しく、新規テナントで試用すら困難
- Fabric SQL Database は まだ Preview 色が残る

**ベンダーロックイン度**: 高。OneLake/Direct Lake/Copilot/Purview/Power BI を使い込むと MS365 から出られない

**撤退コスト**: 高。OneLake は Parquet だが、Direct Lake モデルと Power BI レポートは他へ持ち出せない

---

### 6.4 ひと言サマリ

| 基盤 | focus-you にとっての一言 |
|---|---|
| Snowflake | 「分析層を透明にコスト管理したい」なら最適。B2B資産連携に強い |
| Databricks | 「AI/RAG/教材を一体運用」したい将来像に合致。Lakebase の成熟待ち |
| Fabric | 個人 SaaS には不要。MS365ロックインされた **B2B 案件が来たとき限定**で意味あり |

---

## 7. 商用化ロードマップと基盤導入タイミング

### 7.1 ステージ別推奨

| ステージ | MAU | 想定MRR | 推奨構成 | 意思決定 |
|---|---|---|---|---|
| **MVP** | 〜100 | $0〜$500 | **P0 Supabase 単独** | 基盤入れない。LLM は OpenAI 直叩きで継続 |
| **PMF検証** | 100〜1,000 | $500〜$5,000 | **P0 維持 + 分析層は週末だけ Snowflake トライアル** | トライアル枠で月次 PERMA+V 推移を Snowsight で触るだけ。永続契約しない |
| **成長期** | 1,000〜10,000 | $5,000〜$50,000 | **P1 Supabase + Snowflake 分析層**（または B2B の入口が見えたら） | Supabase から CDC で Snowflake に日次流し込み。Supabase は OLTP 専用に縮退 |
| **本格展開** | 10,000〜 | $50,000〜 | **P1 継続 または P2 に乗り換え** | 教材プラットフォームを本気でやるなら P2 Databricks に寄せる判断がここで発生 |
| **B2B参入** | 任意 | 任意 | **Fabric 追加 or Snowflake 共有** | クライアントのスタックに合わせる。自社主軸は動かさない |

### 7.2 「入れるべきタイミング」の判定基準

基盤を入れる判断は、**次のいずれか2つを同時に満たした時**:

1. **月次MRR が $500 以上**（基盤固定費 $100〜$200 を5〜10%以内に抑えられる）
2. **Supabase の compute が Medium 以上**になっている（pgvector または集計クエリで頭打ち）
3. **B2B 商談で監査・集計要件が契約書に載った**
4. **教材コーパスの二次利用（LLMファインチューン、類似分析）が事業計画に入った**

1つだけなら「まだ早い」。

### 7.3 「入れない方がいい」シグナル

- MAU は増えているが **課金率が2%未満**で MRR が $300 未満
- Supabase の Small/Medium compute でレイテンシに余裕がある
- LLM コストが全体の5%未満（= 分析基盤より LLM プロンプト最適化の方がROI高い）
- チームが1人（社長単独）。基盤運用は FinOps 1人分の工数を食う

### 7.4 教材プラットフォーム展開時の基盤価値

**P1/P2 を入れていれば変わること**:
- 匿名化済み日記コーパスを OLTP から切り離して保存（個人情報規制対応）
- コーパスをパートナーに Secure Data Sharing（Snowflake）/ Delta Sharing（Databricks）で配れる
- 教材の「例題」を本物の集計から生成できる
- LLM ファインチューン用のトレーニングデータ管理が楽

**P0 単独だと辛いこと**:
- OLTP を直接触らせない匿名化パイプラインを自前で書く必要
- パートナー配布は毎回 CSV エクスポート → 契約上のガバナンスが弱い

### 7.5 B2B 展開時に必要になる基盤機能

- **マルチテナント分離**: Snowflake は Schema/Role、Databricks は Unity Catalog、Fabric は Workspace
- **監査ログ**: 3基盤とも標準搭載。Supabase 単独だと pgaudit 設定が必要
- **SLA**: Supabase Pro は 99.9%。Enterprise 契約で 99.99% も可。3基盤は Premium 以上で 99.9%〜
- **契約書テンプレ**: Snowflake と MS（Fabric）が日本法人対応でエンタープライズ契約書が速い。Databricks も日本法人あり

---

## 8. 推奨構成

### 8.1 リサーチ部としての明確な推奨

**今（2026-04、想定 MVP 段階）やること**:
1. **P0 Supabase を継続**。基盤は入れない
2. **Supabase のスキーマを「後で外に出せる形」にしておく**: 日記本文・感情スコア・集計結果を論理的に分離、`user_id` でパーティション可能な設計
3. **月1回 Snowflake トライアルを再開**して週次集計を Snowsight で触る（学習継続＋社長の案件経験値）
4. **LLM コスト monitoring を必ず入れる**（gpt-5-nano のキャッシュヒット率を追う。1分あれば可視化できる）

**100 → 1,000 MAU で追加すること**:
- Supabase compute を Small → Medium へ（約 +$50/月）
- pgvector インデックスの HNSW 化
- Edge Function で「過去7日要約」をジョブ化（バッチの外出し準備）

**1,000 MAU で基盤投入を決断**:
- **推奨1基盤: Snowflake**（理由は次項）
- 構成: **P1 Supabase + Snowflake 分析層**
- 投入コスト: 月 +$100〜$300（シナリオBの試算より）
- CDC 方式: Supabase の `pg_changes` を Airbyte / Fivetran の最安プランで Snowflake に流す、または自前 Edge Function + S3 Staging

**10,000 MAU で再評価**:
- 教材プラットフォームが事業の柱なら **P2 Databricks に移行または併用**
- B2B 主体なら **P1 Snowflake 継続**
- Fabric は MS365 ロックインされた案件が来たら追加

### 8.2 推奨1基盤 = Snowflake の理由

1. **コスト透明性**: credit×時間 で予測しやすい。1人FinOpsでも管理できる
2. **Cortex AISQL** が SQL 一行で書けるので、追加のプログラミング負荷ゼロ
3. **トライアル枠が手厚い**（$400）ので、本契約前に十分な検証ができる
4. **撤退コストが最も低い**（3基盤中）。COPY INTO で Parquet 戻しが即可能
5. **B2B 商談での知名度** が高く、営業トーク上有利
6. **Tokyo リージョン**がある（Fabric は Japan East、Databricks は東京）

### 8.3 不採用（at this stage）の理由

- **Databricks**: Vector Search endpoint の継続課金がMVP規模で効きすぎる。Lakebase はまだ本番実績が薄い。**ただし10,000 MAU到達時に最有力候補に昇格**
- **Fabric**: Power BI を誰も使わない B2C focus-you には過剰。**MS365ロックインされた B2B クライアント向け限定**
- **完全移行系（P4/P5/P6）**: Supabase の認証・Realtime・Edge Function を捨てる工数がSaaSのMRRを食い尽くす。**どのMAU規模でも非推奨**

---

## 9. 公知情報の限界（何がわからないか）

本レポートは2026-04-15時点の**公知価格・公式ドキュメント**と、類似SaaS運用の経験則で書いている。以下は確証がない:

1. **Snowflake Tokyo リージョンの正確な credit 単価**: 公式ページに国別の表は載っているが、Standard Tokyo の最新値は ログイン後の Pricing Calculator でしか確認できない。本試算は $2.6/credit と見積もったが、実値は $2.4〜$2.8 の幅
2. **Databricks Lakebase Autoscaling の DBU レート**: [公式](https://docs.databricks.com/aws/en/oltp/projects/pricing) は「DBU×CU hour」と書くだけで、本レポート作成時点で具体単価が明記されていない。実額は社長の手元で min 1 CU を1時間動かして実測する必要あり
3. **Databricks Vector Search endpoint の最小サイズ料金**: 公式は「DBU ベース」としか言わず、最小 endpoint を立てただけで月いくらかは実測しないとわからない。本試算は類似SaaSの実績から $100/月と見積もっただけ
4. **Supabase の pgvector 性能限界**: 10,000 MAU で HNSW インデックスがどこで詰まるかは **データ分布依存**。一般論では 100万ベクトルまでは XL compute で捌ける経験則があるが、focus-you の日記データでは未検証
5. **Fabric F2 で focus-you ワークロードが成立するか**: F2 は 2 CU と小さく、Copilot を本気で使うと CU を食う。Throttling が発生する閾値は公式が明示していない
6. **Cortex LLM の claude-haiku-4-5 credit 単価**: 公式 Service Consumption Table（契約後アクセス）にしかない。本試算では OpenAI 直叩きを前提にし、Cortex LLM は意図的に除外した
7. **100 MAU / 1,000 MAU 時の実際のトークン消費**: 日記600字×感情分析という設計は仮定。ユーザー行動を実測するまで±50%ぶれる
8. **B2B 契約時の監査・SLA要件**の相場：業界・顧客により大きく変動

**精度を上げるために社長が確認すべきこと**:
- [ ] Snowflake で実際にトライアル開始 → Tokyo Standard の credit 単価を Snowsight で直接確認
- [ ] Databricks Free Edition で Vector Search endpoint を1つ立て、翌日の Usage を確認（Free は課金されないが、Premium移行時の試算に使える）
- [ ] focus-you の実データで日記平均文字数・感情分析トークン数を1週間測定
- [ ] Supabase の pgvector を XS データ（1万件）で HNSW ベンチ

---

## 10. 壁打ち導線（社長に確認したい論点3つ）

### 論点1: 「プロダクト化の時間軸」はどのくらいか

本レポートは「MVP→1,000 MAU→10,000 MAU」をざっくり並べたが、**これが1年で起きるのか3年で起きるのかで推奨が変わる**。

- **1年で10,000 MAU まで行く前提**なら、今のうちに Snowflake 学習を深掘りし、PMF検証段階で Snowflake 分析層を用意しておく価値あり
- **3年で1,000 MAU**くらいの緩やかな成長なら、基盤の話は1年後で十分。今は Supabase の pgvector と Edge Function の限界を攻める方がROI高い
- **そもそもプロダクト化しない可能性もある**（個人PJとして深める道）なら、基盤は一切不要

**問い**: 「focus-you の商用化、社長の頭の中で『いつまでに MRR いくら』の絵はありますか？ 無ければ、それを決めることが基盤選定より先」

### 論点2: 「教材プラットフォーム」vs「B2B ウェルビーイング」どちらが本命か

本レポートでは2つを並列で扱ったが、**この2つは推奨基盤が分岐する**:

- **教材主軸** → P2 Databricks（Mosaic AI + Delta Sharing + Vector Search 一体）
- **B2B 主軸** → P1 Snowflake（Secure Data Sharing + Cortex Analyst + 営業武器）

**どちらか1つを選ぶ覚悟があれば、基盤選定は単純になる**。両睨みで進めると、結果的に基盤を2つ入れて固定費が倍になる罠がある。

**問い**: 「もし今『教材とB2Bのどちらか1つしか選べない』と言われたら、社長はどちらを選びますか？ その直感が基盤の方向性を決めます」

### 論点3: 「1人運用の限界」をどこに置くか

本レポートは暗黙に「社長1人で運用する」前提で書いている。**基盤を入れた瞬間、FinOps/監視/障害対応の工数が発生する**。

- Snowflake は最もシンプルだが、WH pause 忘れで月次請求が跳ねる事故が年1〜2回は起きる
- Databricks は DBU 単位のFinOps が必須、継続的な監視工数が月5〜10時間
- Fabric は pause 運用そのものが個人では回しきれない

**1人運用の限界は「個別PJの開発時間を月何時間削ってよいか」に等しい**。この数字が暗黙のまま基盤を入れると、**focus-you 以外のPJが止まる**。

**問い**: 「社長が focus-you の運用・監視に**月何時間**までなら割けますか？ 月10時間なら基盤1つが限界、月20時間超なら2基盤併用も可能。ここを先に決めると逆算で推奨が絞れます」

---

## ネクストアクション

### 短期（今週中）
- [ ] 本レポートを社長が通読し、§10 の3論点に自分なりの答えを出す
- [ ] `05-comparison-reflection.md` に今日時点の「直感的な推奨」を1行書く

### 中期（今月中）
- [ ] Snowflake トライアル再開（2回目）で `focus-you` の実データ1ヶ月分を取り込み、Cortex で感情要約を試す
- [ ] Supabase の compute 使用率ダッシュボードを見る癖をつける（Pro の Supabase Studio で確認可能）
- [ ] LLM コスト（gpt-5-nano 実績）を日次で記録する仕組みを入れる

### 長期（2026 Q2〜Q3）
- [ ] focus-you の課金モデルを確定し、想定 MAU・MRR 曲線を引く
- [ ] 曲線上で「基盤投入ライン（月MRR $500）」を明示
- [ ] 1,000 MAU到達時のキャパシティプラン更新

---

## 参照ソース（アクセス日: 2026-04-15）

### 公式価格ページ
- [Snowflake Pricing](https://www.snowflake.com/en/pricing-options/)
- [Snowflake Pricing Calculator](https://www.snowflake.com/en/pricing-options/calculator/)
- [Snowflake Hybrid Tables pricing（2026-03-02 simplified）](https://docs.snowflake.com/en/release-notes/2026/other/2026-03-02-hybrid-tables-pricing)
- [Snowflake Hybrid Tables cost evaluation](https://docs.snowflake.com/en/user-guide/tables-hybrid-cost)
- [Snowflake storage cost](https://docs.snowflake.com/en/user-guide/cost-understanding-data-storage)
- [Snowflake Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql)
- [Databricks SQL Pricing](https://www.databricks.com/product/pricing/databricks-sql)
- [Databricks Vector Search Pricing](https://www.databricks.com/product/pricing/vector-search)
- [Databricks Vector Search cost management](https://docs.databricks.com/aws/en/vector-search/vector-search-cost-management)
- [Databricks Lakebase product page](https://www.databricks.com/product/lakebase)
- [Lakebase Autoscaling pricing](https://docs.databricks.com/aws/en/oltp/projects/pricing)
- [Lakebase Postgres docs](https://docs.databricks.com/aws/en/oltp/)
- [Microsoft Fabric pricing (Azure)](https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/)
- [Understand Microsoft Fabric Licenses](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)
- [Fabric Copilot availability update](https://blog.fabric.microsoft.com/en-US/blog/copilot-and-ai-capabilities-now-accessible-to-all-paid-skus-in-microsoft-fabric/)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [GPT-5 nano model docs](https://platform.openai.com/docs/models/gpt-5-nano)

### 解説記事（クロスチェック用）
- [2026 Snowflake Pricing Guide - Revefi](https://www.revefi.com/blog/snowflake-pricing-guide)
- [Snowflake Pricing In 2026 - CloudZero](https://www.cloudzero.com/blog/snowflake-pricing/)
- [Databricks 2026 Pricing Guide - Revefi](https://www.revefi.com/blog/databricks-pricing-guide)
- [Databricks Pricing Guide - Flexera](https://www.flexera.com/blog/finops/databricks-pricing-guide/)
- [Microsoft Fabric Pricing 2026 - Synapx](https://www.synapx.com/microsoft-fabric-pricing-guide-2026/)
- [Databricks Lakebase - InfoQ (2026-02)](https://www.infoq.com/news/2026/02/databricks-lakebase-postgresql/)
- [Lakebase Explained - Coeo](https://www.coeo.com/2026/02/lakebase-explained-why-databricks-is-blending-oltp-analytics-and-ai-and-what-that-means-for-your-architecture/)

### 同シリーズ内の関連ファイル
- `/workspace/.company/departments/research/data-platforms-2026/00-trial-and-pricing.md`
- `/workspace/.company/departments/research/data-platforms-2026/01-concept-comparison.md`
- `/workspace/.company/departments/research/data-platforms-2026/05-comparison-reflection.md`
