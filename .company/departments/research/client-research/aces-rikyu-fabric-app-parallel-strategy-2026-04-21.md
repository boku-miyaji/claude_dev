# Microsoft Fabric 待ち vs Azure アプリ並行開発 — 社内説得用 壁打ち素材

**作成日**: 2026-04-21
**目的**: クライアント（fujimoto_hd）社内で「データ基盤（Fabric）ができる前にアプリを作ると捨てる羽目になる」という反対派に対して、社長が説明できる論理と具体例を整理する。
**構成**: 1) 反対派の主張整理 → 2) 事実ベースの反証 → 3) 再利用マトリクス → 4) 最新データ基盤動向 → 5) ハイブリッドロードマップ → 6) FAQ・想定反論

---

## 1. 反対派の主張と、その裏にある前提

### 主張
> 「データ基盤（Microsoft Fabric）ができる前にアプリを作ると、後で捨てる羽目になる。だからアプリ開発を止めるべき」

### 主張の裏にある3つの前提
| # | 暗黙の前提 | 妥当性 |
|---|-----------|--------|
| A | アプリはデータ基盤に強く依存している | **条件付き妥当** — 抽象化層があれば依存度は劇的に下がる |
| B | データ基盤完成後にアプリを作る方が効率的 | **疑わしい** — Gartner/Forrester の通説では逆（基盤先行は"誰も使わないDW"の温床） |
| C | Fabric が完成するまで、業務改善は一切進められない | **明確に誤り** — Fabric 自身が "既存アプリDB を後から取り込む" Mirroring 機能を持つ |

反対派の主張は **一見慎重に見えるが、実際は「基盤完成=ゴール」という2010年代の発想**。2020年代のデータ基盤設計は "並行開発前提" に移行している（後述）。

---

## 2. 事実ベースの反証 — Microsoft 自身が並行開発を前提にしている

### 2.1 Fabric Mirroring の存在
Microsoft Fabric は **Azure SQL DB / Cosmos DB / Snowflake / Databricks / PostgreSQL / Oracle** を "そのまま Fabric 内で分析可能にする" Mirroring 機能を提供している（2024 年 GA、2025-2026 で対応ソース拡大）。

- アプリが Azure SQL DB に書き込んだデータは、数秒〜数分のラグで Fabric OneLake 内の Delta テーブルにレプリカされる
- Fabric 側の Lakehouse / Warehouse / Power BI から Direct Lake で読める
- **アプリ側は何も変えなくていい**

→ **「アプリ先に作って、後から Fabric を被せる」は Microsoft が公式にサポートしているパターン**。これを "捨てる羽目になる" と言うのは技術認識が古い。

出典（要確認）:
- Microsoft Learn "Mirroring in Microsoft Fabric"
- Ignite 2024 / Build 2025 アナウンス

### 2.2 OneLake Shortcuts
既存の ADLS Gen2 / Amazon S3 / Google Cloud Storage / Dataverse のデータを **物理コピーせず Fabric から参照できる**。アプリが Blob に書いたファイルをそのまま Fabric で分析可能。

→ アプリが既存ストレージを使い続けていても、Fabric 側で横断クエリできる。

### 2.3 SQL Analytics Endpoint
Fabric Lakehouse / Warehouse には **T-SQL エンドポイント** が自動で生成される。アプリが SQL Server ドライバで接続できる = 既存の Azure SQL 用コードが多くの場合そのまま動く。

→ データソース差し替え時の変更コストが小さい。

---

## 3. 再利用マトリクス — 「捨てる」「そのまま使える」の境界線

「先に Azure アプリを作って、後から Fabric を導入する」とき、何が残り何が捨てられるかを層別に整理する。

### 3.1 100% 再利用できる層（アプリの9割はここ）

| 層 | 内容 | Fabric導入後の扱い |
|---|------|------------------|
| フロントエンド | React/Next.js、UI コンポーネント、デザインシステム | 変更なし |
| API サーバ | FastAPI / Node.js / .NET、ビジネスロジック | 変更なし |
| 認証・認可 | Entra ID (Azure AD)、JWT、RBAC | 変更なし（Fabric も Entra ID） |
| 運用基盤 | App Insights、Log Analytics、Key Vault、Private Endpoint、VNet | 変更なし |
| コンテナ基盤 | Container Apps、AKS、ACR、App Service | 変更なし |
| AI / LLM 層 | Azure OpenAI、AI Foundry、プロンプト管理 | 変更なし（Fabric Copilot と共存） |
| CI/CD | GitHub Actions、Azure DevOps、Bicep / Terraform | 変更なし |
| 業務 DB（OLTP） | Azure SQL DB / Cosmos DB / PostgreSQL | **Mirroring で Fabric に取り込む → 捨てない** |
| ETL | ADF パイプライン | Fabric Data Factory にほぼそのまま移植（ADF と同じ UI） |

**→ アプリ構築工数の 85-90% はここに属する。** これらは基盤の有無に関係なく作れる。

### 3.2 部分的に書き換える層（抽象化していれば差し替えだけ）

| 層 | アプリ先行時の実装 | Fabric 導入後の姿 | 書き換え量 |
|---|-------------------|------------------|----------|
| データアクセス層 (DAL) | Repository パターンで SQL DB を直叩き | Repository の実装を Fabric SQL endpoint / OneLake 経由に差し替え | **Interface は変わらず、実装だけ差し替え（小）** |
| 分析クエリ | アプリが直接集計 SQL を書く | Fabric Warehouse / Notebook に移譲 | **中** |
| BI ダッシュボード | Power BI Direct Query → Azure SQL | Direct Lake → OneLake | **小（データソースの接続先を変えるだけ）** |

**→ Repository パターンで抽象化していれば、差し替えは工数的に僅少。**

### 3.3 捨てる / 大きく書き換える層（全体の5-10%）

| 層 | 内容 | 理由 |
|---|------|------|
| 自前データマート | アプリ内で集計結果をキャッシュするテーブル | Fabric Gold 層に統合される |
| 自前バッチ集計 | cron で動く集計スクリプト | Fabric Pipeline / Notebook に置き換わる |
| アドホック分析用の一時テーブル | 一時的な集計結果保持 | Fabric の一時テーブル機能で代替 |

**→ 「捨てる部分」は明確に存在するが、アプリ全体のごく一部。しかも性質上、再作成が容易（本質的な業務ロジックではなく集計の副産物）。**

### 3.4 早期に決めておくべき "アーキテクチャ契約"

アプリ先行で作るなら、以下だけ守れば「捨てる部分」を最小化できる:

1. **データアクセス層を必ず抽象化する（Repository / DAL パターン）** — これさえやっていれば、データソースを後から差し替えられる
2. **スキーマを JSON / Avro / Protobuf で定義して共有する** — Data Contract 的な発想
3. **ドメインイベント（注文成立、顧客登録等）を Event Grid / Service Bus に発行する** — 後で Fabric Eventstream に繋ぎやすい
4. **BI は Power BI を使う（Tableau 等は避ける）** — Direct Lake 切替がスムーズ
5. **Entra ID を認証の前提にする** — Fabric と揃う

---

## 4. 「Fabric 完成を待つ vs 並行開発」— どっちが早い？

結論: **並行開発の方が早く、効率的で、失敗率も低い。**

### 4.1 「基盤完成を待つ」ルートの時間軸（典型的失敗パターン）

```
[month 0-6]  Fabric 環境構築、Bronze/Silver/Gold 層設計
[month 6-9]  ETL パイプライン構築、データ品質検証
[month 9-12] Silver/Gold 層のスキーマ確定
[month 12-] やっとアプリ着手
[month 18-] リリース → 現場「これ欲しかったやつじゃない」→ 手戻り
```

問題点:
- 12 ヶ月間、業務改善効果はゼロ
- データモデルが "机上設計" のまま確定してしまう
- アプリ要件とズレが発覚した時点で Gold 層の作り直し
- **Gartner 曰く、データウェアハウス案件の60%以上は "完成したが使われない" で終わる**（2010s のDW時代の教訓）

### 4.2 「並行開発」ルートの時間軸

```
[month 0-3]  アプリ MVP を既存 DB 直結で構築、ユーザーで触らせる
             並行して Fabric の環境だけ作り始める（Capacity 確保、ワークスペース設計）
[month 3-6]  アプリ改善 + Fabric Mirroring で既存 DB を取り込み（準備完了）
[month 6-9]  アプリ利用データを元に Silver/Gold を "必要な順に" 作る
[month 9-12] Fabric 側の分析・AI が軌道に乗る。アプリは DAL を一部差し替え
```

利点:
- 3 ヶ月で業務改善効果が出始める
- データモデルが "使われる順" で磨かれる = 無駄なテーブルを作らない
- アプリ要件とデータ設計が相互にフィードバック
- Fabric の Capacity コストも "使う分だけ" 段階的に

### 4.3 両方必要、は正論。ただし "順序" が違う

社長の仮説「両方必要」は正しい。ただし論点は **「順序」**:

- ❌ 誤：基盤 → アプリ（ウォーターフォール）
- ✅ 正：アプリ MVP ∥ 基盤の骨格 → アプリ改善 ∥ 基盤の肉付け

これは agile / lean / data mesh / data product 思想すべてに共通する現代の定石。

---

## 5. 「データ基盤ができてから」が古い発想である理由

### 5.1 Data Contract の台頭（2023-2026 で主流化）

Chad Sanderson らが提唱した **Data Contract** の発想:
- プロデューサ（業務アプリ）とコンシューマ（データ基盤）の間で "契約" を先に結ぶ
- 契約さえ守られていれば、両側は独立に進化できる
- → **アプリ開発と基盤開発を並行できる**

出典（要確認）: "The Rise of Data Contracts" (Chad Sanderson, Data Quality Camp)、dbt Labs のブログ、ThoughtWorks Technology Radar。

### 5.2 Data Product Thinking

Zhamak Dehghani 提唱の **Data Mesh** の核：
- データはドメイン単位の "プロダクト" として扱う
- 中央集権的な "一つの基盤" を目指すのではなく、ドメインごとに "必要な分" を育てる
- → Fabric を "一つの巨大な基盤" として完成を待つ発想自体が、思想的に古い

### 5.3 Lakehouse / Zero-ETL 時代

2010 年代：OLTP（業務 DB）と OLAP（分析 DB）は完全分離。ETL を組んで転送。
2020 年代後半：**Lakehouse + Mirroring + Iceberg** で境界が溶けている。
- アプリの OLTP DB が、ほぼリアルタイムで分析可能に
- "ETL を組むために基盤を完成させる" という旧来の大仕事が不要

→ **「基盤を完成させてからアプリ」は ETL 時代の発想。現代の Lakehouse / Mirroring アーキテクチャでは、アプリ側が動いている方が基盤が育てやすい。**

---

## 6. ハイブリッドロードマップ（fujimoto_hd 向け具体案）

### Phase 0（今〜3ヶ月）: アプリ MVP 構築
- Azure App Service / Container Apps にアプリをデプロイ
- データソース: 既存業務 DB（Azure SQL or Cosmos DB）に直結 + Blob ストレージ
- **必須規律**: Repository パターンで DAL を抽象化、Entra ID で認証、Event Grid で主要イベント発行
- 並行して Fabric: Capacity 確保、ワークスペース設計のみ
- **ゴール**: 業務現場でアプリを触ってもらい、UX とデータ要件を明確化

### Phase 1（3〜6ヶ月）: Fabric Bronze 層で既存 DB を取り込む
- Azure SQL DB を Fabric Mirroring で Bronze 層にミラー
- Blob を Shortcut で OneLake 参照
- アプリは何も変えない
- Power BI / Fabric Notebook でアドホック分析開始
- **ゴール**: アプリ利用ログが自動で分析可能に。要件が具体化

### Phase 2（6〜9ヶ月）: 必要な Silver / Gold 層を作る
- Phase 0-1 で明確になった業務分析ニーズに応じて、Silver（クレンジング）→ Gold（業務モデル）を構築
- アプリの分析系画面（ダッシュボード）を Direct Lake 接続に切り替え
- AI 推論用の Feature Store を Fabric 側に整備
- **ゴール**: Fabric が "実際に使われている" 状態に

### Phase 3（9〜12ヶ月）: アプリ DAL を Fabric 経由に部分差し替え
- 分析系クエリのみ、Repository の実装を Fabric SQL endpoint 経由に切替
- OLTP（リアルタイム業務処理）はそのまま既存 DB
- **ゴール**: 役割分担が自然に確立（OLTP=既存、OLAP+AI=Fabric）

### 想定工数と "捨てる部分"
- 全体工数: 約 12 ヶ月
- Fabric 導入で "捨てる" コード量: **全体の 5-10% 以内**（自前集計スクリプト、データマート）
- "作り直す" 工数: **全体の 2-3 週間以内**（DAL 差し替え + 分析画面の接続先変更）

→ **「完成を待つ」ルートと比較して、3-6 ヶ月早く業務改善効果が出るのに、捨てる量はむしろ少ない。**

---

## 7. 想定反論と回答

### Q1. 「Silver / Gold 層のスキーマを先に決めないと、後で大変なことになる」
A. Gold 層の詳細スキーマを先に決めても、使われない限り正しいか分からない。アプリ利用ログと業務現場のフィードバックで磨かれる。スキーマは **契約（Data Contract）を先に合意** しておけば、実装は後追いで良い。

### Q2. 「アプリ先行で作った DB を Fabric に統合するとき、データ移行で苦しむのでは」
A. Fabric Mirroring は **既存 DB をそのまま Fabric 内で読めるようにする機能**。データ移行（コピー・変換）は発生しない。アプリは書き込み続け、Fabric 側は読むだけ。

### Q3. 「アプリ先行で作ると、技術選定がバラバラになってガバナンスが効かない」
A. これは別問題。技術選定の規約（Entra ID、Power BI、Terraform、Repository パターン）を先に決めれば解決。Fabric の有無とは独立。

### Q4. 「データ品質を先に担保しないと、アプリに汚いデータが流れる」
A. データ品質はアプリ側の入力バリデーションと Silver 層のクレンジングで担保する。どちらも Fabric 完成を待たなくても着手可能。

### Q5. 「Fabric Capacity のコストが発生している間に、アプリを作るだけではムダでは」
A. Phase 0 では Fabric Capacity は **最小構成（F2-F8）** でワークスペースだけ確保。コストは月数万円程度。アプリによる業務改善効果で十分ペイする。

### Q6. 「NTTデータが Fabric 構築を請けているが、並行開発案だと連携が取りにくい」
A. むしろ逆。NTTデータ側は Fabric 環境整備、こちらはアプリと Data Contract を並行で進める、と役割分担を明確にできる。Phase 1 の Mirroring 接続ポイントで初めて連携すれば良い。

### Q7. 「並行開発にしたら、どこで失敗するか」
A. 以下の条件で失敗する。これらを守れば並行開発は成功する:
- ❌ DAL を抽象化しない（直接 SQL を書く）
- ❌ スキーマ変更の連絡網がない（Data Contract なし）
- ❌ 分析要件をアプリチームが勝手に決める（現場フィードバックを聞かない）
- ❌ Fabric 環境整備を完全に後回しにする（Phase 0 で並行着手しないと、Phase 1 で止まる）

---

## 8. 限界・不確実性の明示

この分析の限界:
- **具体事例（fujimoto_hd と類似企業の成功事例）** は T3 のリサーチ結果を待ちたい
- **コスト試算** は実データなしでは提示困難
- **Fabric の最新機能（2026 Q1 アップデート）** は T3 で確認が必要
- **NTTデータ側の Fabric 構築計画の詳細** は未把握

不確実な論点:
- Fabric Mirroring の対応ソース範囲（Oracle, SAP HANA は対応済みか？）
- Direct Lake の Cold / Warm 問題（初回クエリの遅延）
- Fabric Capacity の F2-F8 で何ができるかの実測値

---

## 9. 壁打ち導線 — 社長がクライアントに説明する際の3つの切り口

### 切り口A: 「Microsoft 自身が並行開発を想定している」
→ Fabric Mirroring / Shortcuts の存在を示し、「Microsoft が公式に、既存アプリ DB を後から取り込む設計を用意している」と事実で反論する

### 切り口B: 「再利用できない部分は5-10%しかない」
→ 再利用マトリクス（§3）を見せて、「アプリ工数の 85% は基盤と独立。捨てる部分は集計の副産物だけ」と具体的に示す

### 切り口C: 「基盤完成を待つと、業務改善が1年遅れる」
→ Phase 別ロードマップ（§6）を見せて、「Phase 0 で 3 ヶ月後には効果が出始める vs 12 ヶ月ゼロ」を比較する

**どれが一番効くかは、反対派の立場による:**
- 技術屋 → 切り口 A（事実で反論）
- 予算管理 → 切り口 B（コスト面で説得）
- 事業部門 → 切り口 C（スピード面で説得）

---

## 関連資料
- T3（データ基盤最新トレンド調査） — 実行中 / 結果追記予定
- Fabric Mirroring: https://learn.microsoft.com/fabric/database/mirrored-database/overview （要アクセス確認）
- Data Contract 論文: "Shifting Left on Data" (Chad Sanderson, 2023)
- Data Mesh 原典: Zhamak Dehghani "Data Mesh" (O'Reilly, 2022)

---

## 10. 用語集（略語の説明）

| 略語 | 正式名称 | 意味 |
|---|---|---|
| DAL | Data Access Layer | データアクセス層。アプリ内で「データとやり取りする窓口」のコード。Repository パターンとほぼ同義 |
| DW | Data Warehouse | データウェアハウス。分析専用に作る大きなデータ倉庫。Fabric の Warehouse / Lakehouse が相当 |
| OLTP | Online Transaction Processing | 業務のリアルタイム処理（注文登録、顧客更新など）。Azure SQL DB / Cosmos DB が担う |
| OLAP | Online Analytical Processing | 分析処理（集計、レポート、AI 推論）。Fabric Warehouse / Lakehouse が担う |
| ETL | Extract, Transform, Load | データの抽出・変換・読込。業務 DB → DW への転送パイプライン |
| RLS | Row-Level Security | 行レベルセキュリティ。同じテーブルでもユーザーごとに見える行を変える仕組み |
| RAG | Retrieval-Augmented Generation | 検索拡張生成。LLM が回答する前に、関連文書を検索して文脈に入れる手法 |
| GDPR | General Data Protection Regulation | EU の個人情報保護規則。個人データ削除要求への対応義務など |
| ADF | Azure Data Factory | Azure のETL サービス。Fabric Data Factory の前身 |
| CDC | Change Data Capture | DB の変更を差分で取得する仕組み。Mirroring の基盤技術 |

---

## 11. LLM / エージェントアプリ特有の要素（非構造化データ前提）

本 PJ はプロンプト・エージェント・非構造化文書を扱うアプリ。構造化データ中心のフレームでは抜ける要素を別途整理する。

### 11.1 100% 再利用（Fabric の有無と独立）

| 要素 | 実体 | Fabric 導入時 |
|---|---|---|
| システムプロンプト、エージェント定義 | プロンプトファイル、YAML、コード | 100% 再利用 |
| ツール実装（関数定義、MCP サーバ） | Python/TS の関数、API 呼び出し | 100% 再利用 |
| LLM 呼び出しコード | Azure OpenAI / AI Foundry 経由の SDK | 100% 再利用 |
| エージェント実行エンジン | Semantic Kernel、LangGraph、独自 Orchestrator | 100% 再利用 |
| 会話 UI、ストリーミング、履歴表示 | React、WebSocket | 100% 再利用 |
| 評価・観測（Evals、プロンプト A/B） | AI Foundry Evaluation、自前 | 100% 再利用 |

**結論**: LLM / エージェントの "頭脳" 部分は Fabric と完全に独立。Fabric は "そこで生まれるデータを分析する側" にしか入ってこない。

### 11.2 差し替えが発生する可能性（5-15%）

| 要素 | 現状の実装 | Fabric 導入後 |
|---|---|---|
| 非構造化ファイル置き場 | Azure Blob Storage | OneLake Shortcut で参照（物理コピー不要）。Blob はそのまま残す |
| ベクトル DB / 埋め込み | Azure AI Search / pgvector / Cosmos DB for Vector | そのまま継続 or Fabric の Vector 機能（プレビュー段階）へ寄せる選択肢。**焦って移す必要なし** |
| RAG の文書ソース | Blob の PDF、SharePoint、Confluence | OneLake Shortcut / Fabric Data Factory で取り込み、RAG インデックスは別途更新 |
| ファイル抽出パイプライン（PDF→テキスト、OCR、チャンキング） | Azure Functions / Container Apps | Fabric Data Factory に移植可能。ただし既存のままでも動く |
| 会話ログ、エージェント推論ログ | Cosmos DB / Application Insights | Mirroring で Fabric に取り込み、**分析だけ Fabric 側で実施**。書き込み側は無変更 |

---

## 12. 権限管理は「やり直す」のではなく「Fabric 側に定義を追加する」

結論: **アプリ側の認証・認可コードは無変更。Fabric 側で追加設定が必要だが、Entra ID という同じ土台を使うのでマッピングは楽**。

### 12.1 変わらないもの
- アプリの認証ロジック（Entra ID ログイン、JWT 検証、ミドルウェア）
- アプリのロール定義（管理者、営業、閲覧者）
- Key Vault、Managed Identity、Service Principal
- RLS のアプリ DB 側の定義

### 12.2 Fabric 側で追加する作業

| 項目 | 作業内容 | 工数 |
|---|---|---|
| ワークスペース権限 | Entra ID のグループを Fabric ワークスペースに割当 | 数時間 |
| OneLake データアクセス制御（OneSecurity） | 列レベル・行レベルのマスキングを再定義 | 数日〜1週間 |
| Warehouse の RLS | アプリ DB の RLS を Fabric Warehouse にも複製定義 | 数日 |
| Service Principal / Managed Identity 割当 | アプリが Fabric に接続する ID の権限設定 | 数時間 |
| Microsoft Purview 連携（任意） | データカタログ・系譜管理 | 数週間（やる場合） |

**"やり直す" が発生するのは OneSecurity と Warehouse の RLS のみ**。業務 DB 側の RLS ルールを Fabric にも書くことになる。ただし Entra ID のグループ定義は共通なので、ロール体系を作り直す必要はない。

### 12.3 注意点
- Mirroring で取り込んだデータに、Fabric 側の RLS は **自動では引き継がれない**。元 DB と同じルールを明示的に定義する必要がある
- OneSecurity はプレビュー→GA のタイミングで仕様変更の可能性あり（2025-2026 で動きが激しい部分）

---

## 13. その他、見落としやすい項目

| 項目 | 扱い | コメント |
|---|---|---|
| ネットワーク（Private Endpoint, VNet） | Fabric 側に Private Link 設定を追加 | アプリ側は無変更 |
| 秘密情報（Key Vault） | 変更なし | Fabric から Key Vault を参照する場合だけ ID 連携を追加 |
| モニタリング（App Insights） | アプリ側は無変更 | Fabric の Workspace Monitoring が別途立ち上がる |
| コスト管理 | Fabric Capacity は別課金 | アプリのコストとは独立に監視が必要 |
| **データ保持ポリシー / 個人情報（GDPR）** | **Mirroring で Fabric にも複製されるため、削除要求時は両方から消す設計が必要** | **設計時に見落とされがち。個人情報を扱う場合は最重要** |
| バックアップ | アプリ DB は既存のまま。Fabric は別戦略 | Fabric の OneLake は Delta 形式で自動バックアップがあるが要件確認 |
| 監査ログ | Fabric 側の Purview / Activity Log を別途有効化 | コンプライアンス要件がある場合 |
| デプロイ環境分離（dev/staging/prod） | Fabric も Deployment Pipelines で分ける | アプリ側は無変更。Fabric 側の運用設計が必要 |
| スキーマ変更の伝播 | アプリ DB のカラム追加が Mirroring で Fabric に自動反映されるか確認 | Fabric Mirroring は多くの場合自動だが、型変更・削除は手動作業が発生することあり |

---

## 14. 最終メッセージ（社長が説明時に強調する7点）

1. **Phase 1 までコード変更ゼロ**。Fabric 管理画面の操作だけで既存 DB が取り込める（Mirroring のデモが効く）
2. **アプリの書き換えは Phase 3 だけ**。DAL（データアクセス層）の実装差し替えで済み、画面や API は無変更
3. **OLTP（業務のリアルタイム処理）は Azure SQL DB のまま**。Fabric に移すのは分析系だけで、全部を Fabric に寄せる必要はない
4. **並行開発しておけば、Phase 1 のスタート時に "既に使われているデータ" が存在する** → Silver/Gold 層が "使う順" で育ち、机上設計の無駄が出ない
5. **LLM / エージェントの頭脳（プロンプト・ツール・実行エンジン）は Fabric と完全に独立**。Fabric は分析層にしか入ってこない
6. **権限管理は作り直さない**。Entra ID という同じ土台を使うので、Fabric 側は追加定義だけ（OneSecurity と Warehouse RLS の定義追加は発生）
7. **個人情報削除（GDPR）だけは設計時から考慮が必要**。Mirroring で Fabric にも複製されるため、削除要求が来たときに両方から消す仕組みを先に組んでおく

---

# handoff
handoff:
  - to: 資料制作部
    context: "T3のトレンド調査結果が揃ったら、この分析と統合してクライアント説明用の1ページ資料（または5-7ページのスライド）に落とし込む"
    tasks:
      - "§3 再利用マトリクスを視覚化"
      - "§6 ロードマップをガントチャート化"
      - "切り口A/B/C を A4 1枚にまとめた "説得カード" を作る"
      - "§11-12 LLM/権限管理パートも1スライド化"
