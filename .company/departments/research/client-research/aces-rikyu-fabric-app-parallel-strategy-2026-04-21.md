# Microsoft Fabric 待ち vs Azure アプリ並行開発 — 社内議論用 壁打ち素材

**作成日**: 2026-04-21
**目的**: クライアント（fujimoto_hd）社内で「データ基盤（Fabric）ができる前にアプリを作ると捨てる羽目になる」という慎重派の主張に対し、並行開発の可能性を検討するための論理と具体例を整理する。
**前提アーキテクチャ**: Azure 環境にアプリを構築。**業務データストアは Cosmos DB（半構造化 JSON）**。ベクトル検索は **Azure AI Search**。LLM は Azure OpenAI / AI Foundry。データ基盤として **Microsoft Fabric を後から導入予定**。
**構成**: 1) 慎重派の主張整理 → 2) 事実ベースの検討 → 3) 再利用マトリクス → 4) 最新データ基盤動向 → 5) ハイブリッドロードマップ → 6) FAQ・想定反論 → 17) Repository パターン解説

**スタンス**: 並行開発が常に正解とは限らない。規律（§16）を守れる場合に有効な選択肢として提示する。基盤先行が合理的なケース（規制業界でデータ品質が最優先、並行開発の組織経験が無い、等）も存在する。

---

## 1. 慎重派の主張と、その前提の検討

### 主張
> 「データ基盤（Microsoft Fabric）ができる前にアプリを作ると、後で捨てる羽目になる。だからアプリ開発を止めるべき」

この主張には一定の合理性がある。特に以下のような状況では基盤先行が妥当になりうる:
- 金融・医療など厳格な規制業界で、データ品質・監査ログが最優先
- アプリチーム・基盤チーム間で並行開発の規律（Data Contract等）を回す組織経験が無い
- データモデルが極端に複雑で、アプリ側だけで仕様を確定できない

一方で、以下の3つの暗黙前提は **条件次第で揺らぐ** ため、クライアントの具体条件で再検討する価値がある。

### 主張の裏にある3つの前提
| # | 暗黙の前提 | 検討 |
|---|-----------|--------|
| A | アプリはデータ基盤に強く依存している | **条件付き**。データアクセス層（§17 で解説）を抽象化していれば依存度は下がる。逆に抽象化を怠れば依存度は高いまま |
| B | データ基盤完成後にアプリを作る方が効率的 | **状況依存**。DW 案件には "完成したが使われない" 失敗パターンが業界で広く指摘される一方、規制・品質重視の場面では基盤先行が有効。組織の規律次第 |
| C | Fabric が完成するまで、業務改善は一切進められない | **技術的には不正確**。Fabric は Mirroring / Shortcut により、"既存アプリ DB を後から取り込む" ことを公式にサポートしている（§2 参照） |

→ 慎重派の主張は一部妥当な前提に支えられている。ただし **技術面（前提 C）は2024年以降の Fabric 新機能で状況が変わっている** ため、前提 A（抽象化の有無）と規律条件（§16）を満たせるかが判断の鍵になる。

---

## 2. 事実ベース — Microsoft 自身が並行開発を想定した機能を提供している

### 2.1 Fabric Mirroring の存在
Microsoft Fabric は **Cosmos DB / Azure SQL DB / Snowflake / Databricks / PostgreSQL / Oracle / SAP** を "そのまま Fabric 内で分析可能にする" Mirroring 機能を提供している（2024 年 GA、2025-2026 で対応ソース拡大）。

**本 PJ は Cosmos DB を業務データストアに使う想定**。Cosmos DB Mirroring は 2024 年に GA しており、半構造化 JSON 文書を自動で Fabric OneLake 上の Delta テーブルに変換・レプリケートする。

- アプリが Cosmos DB に書き込んだ JSON 文書は、数秒〜数分のラグで Fabric OneLake 内の Delta テーブルにレプリカされる（ネスト構造は JSON 列として保持）
- Fabric 側の Lakehouse / Warehouse / Power BI から Direct Lake で読める
- **アプリ側は何も変えなくていい**

→ **「アプリ先に作って、後から Fabric を被せる」運用は Microsoft が公式にサポートしているパターン**。慎重派が懸念する "捨てる羽目になる" というリスクは、技術的には大幅に軽減されている（組織的な規律の問題は残る — §16）。

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

本 PJ の前提（**Azure 上のアプリ、Cosmos DB、Azure AI Search、Azure OpenAI**）で「先にアプリを作って、後から Fabric を導入する」とき、何が残り何が捨てられるかを層別に整理する。割合はあくまで目安であり、実際の規律（§16）が守られている前提での値。

### 3.1 大部分を再利用できる層

| 層 | 内容 | Fabric導入後の扱い |
|---|------|------------------|
| フロントエンド | React/Next.js、UI コンポーネント、デザインシステム | 変更なし |
| API サーバ | FastAPI / Node.js / .NET、ビジネスロジック | 変更なし |
| 認証・認可 | Entra ID (Azure AD)、JWT、RBAC | 変更なし（Fabric も同じ Entra ID） |
| 運用基盤 | App Insights、Log Analytics、Key Vault、Private Endpoint、VNet | 変更なし |
| コンテナ基盤 | Container Apps、AKS、ACR、App Service | 変更なし |
| LLM / エージェント層 | Azure OpenAI、AI Foundry、プロンプト、ツール定義、エージェント実行エンジン | 変更なし（Fabric Copilot と共存） |
| ベクトル検索 | **Azure AI Search**（埋め込みインデックス、ハイブリッド検索） | **変更なし**。当面はそのまま本番運用、Fabric Vector は GA 後の選択肢 |
| 非構造化ファイル置き場 | Azure Blob Storage（PDF、画像、音声、長文） | **OneLake Shortcut で参照可能（物理コピー不要）**。Blob はそのまま残す |
| CI/CD | GitHub Actions、Azure DevOps、Bicep / Terraform | 変更なし |
| **業務データストア（Cosmos DB）** | 半構造化 JSON 文書（注文、会話履歴、エージェント推論ログ） | **Mirroring で Fabric OneLake に取り込む → 捨てない**。ネスト構造は JSON 列として保持 |
| Event / Messaging | Event Grid、Service Bus | 変更なし（後で Fabric Eventstream に繋ぎやすい） |

**→ 本 PJ のようなアプリ構成では、アプリ構築工数の大部分がここに属する（経験則で 80-90% レンジ）。** これらは基盤の有無に関係なく作れる。

### 3.2 部分的に書き換える層（抽象化していれば差し替えだけ）

| 層 | アプリ先行時の実装 | Fabric 導入後の姿 | 書き換え量 |
|---|-------------------|------------------|----------|
| データアクセス層（§17 参照） | Repository 経由で Cosmos SDK / AI Search SDK を呼ぶ | Repository の実装を Fabric SQL endpoint / OneLake 経由に差し替え | **インタフェースは変わらず、実装だけ差し替え** |
| 分析クエリ | アプリ内で Cosmos に集計クエリを投げる（コストも重い） | Fabric Warehouse / Notebook に移譲 | **中**（分析画面の接続先変更 + 集計ロジック移植） |
| BI ダッシュボード | Power BI Direct Query → Cosmos の Analytics Store | Direct Lake → OneLake | **小**（データソースの接続先を変えるだけ） |

**→ Repository パターン（§17）で抽象化していれば、差し替えは工数的に僅少。抽象化していなければ書き換え量は跳ね上がる。**

### 3.3 捨てる / 大きく書き換える層

| 層 | 内容 | 理由 |
|---|------|------|
| 自前データマート | アプリ内で集計結果をキャッシュする Cosmos コンテナ | Fabric Gold 層に統合される |
| 自前バッチ集計 | cron / Azure Functions で動く集計スクリプト | Fabric Pipeline / Notebook に置き換わる |
| アドホック分析用の一時コンテナ | 一時的な集計結果保持 | Fabric のテーブルで代替 |

**→ 捨てる部分は存在するが、性質上アプリ全体のごく一部（集計の副産物であり本質業務ロジックではない）。**

### 3.4 早期に決めておくべき "アーキテクチャ契約"

並行開発で書き換え量を最小化するための5点。詳細は §16（地雷リスト）と §17（Repository パターン）:

1. **データアクセス層を必ず抽象化する（Repository パターン）** — これさえやっていれば、データソースを後から差し替えられる
2. **Cosmos DB の文書スキーマを JSON Schema / TypeScript 型で定義して NTTデータ側と共有する** — Data Contract 的な発想
3. **ドメインイベント（注文成立、顧客登録、エージェント応答完了等）を Event Grid / Service Bus に発行する** — 後で Fabric Eventstream に繋ぎやすい
4. **BI は Power BI を使う** — Direct Lake 切替がスムーズ
5. **Entra ID を認証の前提にする** — Fabric と揃う

---

## 4. 「Fabric 完成を待つ vs 並行開発」— どっちが早い？

結論: **規律（§16）を守れる前提では、並行開発の方が早く立ち上がる場面が多い。ただし規律が守れない場合、並行開発はむしろ混乱を招く。** どちらが常に正解ではなく、組織の条件次第。

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
- データモデルが "机上設計" のまま確定してしまう可能性
- アプリ要件とズレが発覚した時点で Gold 層の作り直し
- "完成したが使われない DW" は業界で広く報告される失敗パターン（Gartner / Forrester / 国内 DWH プロジェクト事例で繰り返し指摘されている。具体数字は時期・調査元で異なるため、ここでは定性的傾向として扱う）

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

### 4.3 両方必要、は正論。論点は "順序" の選択肢

「基盤とアプリの両方が必要」は前提として合意。そのうえで順序の選択肢は2つ:

- 選択肢①：基盤 → アプリ（ウォーターフォール的）— 規律確立に時間がかかる組織、規制が厳しい業種で有効
- 選択肢②：アプリ MVP ∥ 基盤の骨格 → アプリ改善 ∥ 基盤の肉付け（並行）— 規律が揃う組織、Time-to-Value を重視する場面で有効

agile / lean / Data Mesh / Data Contract などの設計思想では選択肢②を推奨する流れが強いが、業界・組織により適合度は異なる。本 PJ では「どちらが適合するか」を Phase 0 で評価すべき論点として位置づける。

---

## 5. 「基盤→アプリ」の順序が唯一解ではなくなった技術的背景

基盤先行を絶対視しなくてよくなった理由は、2020年代後半の技術変化による。

### 5.1 Data Contract の台頭（2023-2026 で主流化）

Chad Sanderson らが提唱する **Data Contract** の発想:
- プロデューサ（業務アプリ）とコンシューマ（データ基盤）の間で "契約" を先に結ぶ
- 契約さえ守られていれば、両側は独立に進化できる
- → **アプリ開発と基盤開発を並行しやすくなる**（ただし契約管理の組織能力が必要）

出典: "The Rise of Data Contracts" (Chad Sanderson, Data Quality Camp)、dbt Labs、ThoughtWorks Technology Radar。

### 5.2 Data Product Thinking

Zhamak Dehghani 提唱の **Data Mesh** の核:
- データはドメイン単位の "プロダクト" として扱う
- 中央集権的な "一つの基盤" を目指すのではなく、ドメインごとに "必要な分" を育てる
- → Fabric を "一つの巨大な基盤" として完成を待つ発想 **の代替案** が提示された

注: Data Mesh は万能ではない。中央集権が有利な組織（少人数、規制厳格など）もある。

### 5.3 Lakehouse / Zero-ETL 時代

2010 年代：OLTP（業務 DB）と OLAP（分析 DB）は完全分離。ETL を組んで転送。
2020 年代後半：**Lakehouse + Mirroring + Iceberg** で境界が溶けてきている。
- アプリの OLTP DB（本 PJ では Cosmos DB）が、ほぼリアルタイムで分析可能
- "ETL を組むために基盤を完成させる" という大仕事は、選択肢の一つであって必須ではなくなった

→ **「基盤を完成させてからアプリ」は ETL 中心時代の主流だった発想。現代の Lakehouse / Mirroring アーキテクチャでは、並行開発も選択肢として技術的に成立する**。どちらを選ぶかは組織条件で決める。

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

## 11. LLM / エージェントアプリ特有の要素（Cosmos DB + 半構造化 + Azure AI Search 前提）

本 PJ は **Cosmos DB（半構造化 JSON）＋ Azure AI Search（ベクトル）＋ Azure OpenAI**。LLM・エージェント・非構造化文書を扱う。構造化データ中心のフレームでは抜ける要素を整理する。

### 11.1 Fabric の有無と独立（大半はここ）

| 要素 | 実体 | Fabric 導入時 |
|---|---|---|
| システムプロンプト、エージェント定義 | プロンプトファイル、YAML、コード | 変更なし |
| ツール実装（関数定義、MCP サーバ） | Python/TS の関数、API 呼び出し | 変更なし |
| LLM 呼び出しコード | Azure OpenAI / AI Foundry 経由の SDK | 変更なし |
| エージェント実行エンジン | Semantic Kernel、LangGraph、独自 Orchestrator | 変更なし |
| 会話 UI、ストリーミング、履歴表示 | React、WebSocket | 変更なし |
| 評価・観測（Evals、プロンプト A/B） | AI Foundry Evaluation、自前 | 変更なし |
| **Azure AI Search**（ベクトル検索、ハイブリッド検索、スコアプロファイル） | インデックス、スキルセット、インデクサー | **そのまま本番運用継続**。Fabric Vector に移す必然性は現時点で無い |

**結論**: LLM / エージェントの "頭脳" 部分と検索インフラは Fabric と独立。Fabric は "そこで生まれたデータを分析する側" にしか入ってこない。

### 11.2 差し替えが発生する可能性

| 要素 | 現状の実装 | Fabric 導入後 |
|---|---|---|
| 非構造化ファイル置き場 | Azure Blob Storage（PDF、画像、音声、長文テキスト） | **OneLake Shortcut で参照（物理コピー不要）**。Blob はそのまま残す |
| RAG の文書ソース管理 | Blob の PDF、SharePoint、Confluence を Azure AI Search が吸う | インデクサーのソースは変更なし。OneLake Shortcut を追加ソースにできる（選択肢） |
| ファイル抽出パイプライン（PDF→テキスト、OCR、チャンキング） | Azure Functions / Container Apps / Document Intelligence | Fabric Data Factory に移植可能。ただし既存のままでも動く |
| **会話ログ、エージェント推論ログ**（Cosmos DB 上の JSON 文書） | `conversations` コンテナに Message 配列を保存 | **Cosmos Mirroring で Fabric に取り込み、分析だけ Fabric 側で実施**。書き込み側は無変更 |
| **業務文書・注文・顧客データ**（Cosmos DB 上の JSON 文書） | `orders`, `customers` 等のコンテナ | Cosmos Mirroring → Fabric Bronze。書き込み側は無変更 |

**Cosmos DB Mirroring 特有の注意**:
- ネスト構造（配列、オブジェクト）は JSON 列として OneLake 上に保持される
- JSON から列を展開する場合、Fabric Notebook / Warehouse 側で `OPENJSON` や `explode` を使う（アプリ側は無変更）
- Partition Key の選択は Cosmos の性能だけでなく、Mirroring 後の分析効率にも影響

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

## 14. 2026年時点のデータ基盤最新トレンド（公開情報で裏付け）

この分析を **"現代的な定石" として裏付ける** 公開情報。社内説得時のエビデンスとして使える。

### 14.1 Fabric Mirroring — 2026年3月に SAP / Oracle が GA

**2026年3月の FabCon / Microsoft Fabric March 2026 Feature Summary で、SAP と Oracle の Mirroring が Generally Available に昇格した。**

- **SAP 対応**: SAP S/4HANA（on-prem / cloud）、SAP ECC、SAP BW、SAP BW/4HANA、SAP SuccessFactors、SAP Ariba、SAP Concur、SAP Datasphere
- **Oracle 対応**: on-premises、Oracle OCI、Exadata まで網羅
- **Open Mirroring Partner Ecosystem**: Oracle GoldenGate 23ai、Qlik Replicate（SAP / DB2 z/OS / Teradata / Oracle / Aurora など 40+ ソース）が CDC 経由で連携

→ **2026年4月時点で、実質あらゆる業務 DB が "ボタン1つで Fabric に取り込める" 状態**。fujimoto_hd が使っている業務 DB が何であれ、後から取り込めない理由はほぼ無い。

出典:
- [Fabric March 2026 Feature Summary (Microsoft)](https://blog.fabric.microsoft.com/en-us/blog/fabric-march-2026-feature-summary)
- [Mirroring SQL Server / Postgres / Cosmos DB GA (Microsoft)](https://blog.fabric.microsoft.com/en-US/blog/mirroring-sql-server-postgres-db-cosmos-db-and-updates-to-snowflake-mirroring-now-ga/)
- [Mirror Oracle Databases in Microsoft Fabric (Learn)](https://learn.microsoft.com/en-us/fabric/mirroring/oracle)
- [Mirroring SAP in Microsoft Fabric (Learn)](https://learn.microsoft.com/en-us/fabric/mirroring/sap)
- [FabCon / SQLCon 2026 Highlights (Azure Blog)](https://azure.microsoft.com/en-us/blog/fabcon-and-sqlcon-2026-unifying-databases-and-fabric-on-a-single-data-platform/)

### 14.2 Apache Iceberg の勝利 — プラットフォーム間の壁が溶けた

**Iceberg は Delta Lake や Hudi との主導権争いに勝利し、2026年時点で「すべての主要データ基盤が読み書きできる唯一のフォーマット」になった。**

決定的だったのは Apache Software Foundation によるベンダー中立ガバナンス（Snowflake、AWS、Apple、Netflix、LinkedIn 等が共同コントリビュート）。

2026年4月時点で実現している相互運用:
- **Snowflake ⇔ Fabric OneLake**: Iceberg v3 で完全双方向 GA。Snowflake 管理 Iceberg テーブルを OneLake にネイティブ保存可能
- **Databricks Unity Catalog ⇔ Fabric OneLake**: Azure Databricks から OneLake のネイティブ読み書きが preview
- **Snowflake Polaris**（OSS）と **Unity Catalog** が両方とも REST Catalog spec を実装

→ **「Fabric を選ぶと他の基盤と分断される」という古い懸念は無効**。将来 Databricks や Snowflake を併用することになっても、データは Iceberg で共有できる。

出典:
- [Announcing full Apache Iceberg support in Databricks](https://www.databricks.com/blog/announcing-full-apache-iceberg-support-databricks)
- [Snowflake ↔ Unity Catalog Iceberg bidirectional access](https://docs.snowflake.com/en/user-guide/tutorials/tables-iceberg-set-up-bidirectional-access-to-unity-catalog)
- [Breaking the Silos: Iceberg & Data Tax (AnalyticsWeek, 2026)](https://analyticsweek.com/apache-iceberg-zero-copy-snowflake-fabric-2026/)
- [Iceberg Catalog Showdown: Polaris vs Unity (Estuary)](https://estuary.dev/blog/iceberg-catalog-apache-polaris-vs-unity-catalog/)

### 14.3 Zero-ETL の本当の意味

Microsoft 公式: **"Zero-ETL ≠ zero transforms — コピーパイプラインが消えるだけで、変換は残る"**。

Fabric の OneLake Shortcut + Mirroring で実現されているのは:
- データの「移動」が不要（物理コピーしない）
- 変換は「データがある場所」で実行（in-place）
- 複数クラウド（Azure / AWS / GCP）のストレージを横断参照

→ **ETL 基盤を組むために半年かける時代は終わった**。業務 DB とデータ基盤の境界は「運用的には分離、データ的には統合」という状態。

出典:
- [FabCon 2026: What's new in OneLake](https://blog.fabric.microsoft.com/en-us/blog/fabcon-and-sqlcon-2026-whats-new-in-microsoft-onelake/)
- [Modern Data Lakehouse in 2026 (Medium)](https://vardhmanandroid2015.medium.com/modern-data-lakehouse-in-2026-from-open-source-foundations-to-databricks-snowflake-microsoft-5fd6970d35a0)

### 14.4 Data Contract の標準化 — 並行開発の土台理論

Chad Sanderson らの **"Data Contracts: Developing Production-Grade Pipelines at Scale"** が O'Reilly から2025年に出版。2026年4月時点でエンタープライズ導入事例（Glassdoor、Grab など）が複数公開されている。

核心主張:
- Data Contract = 「データの API 仕様」。schema・SLA・business logic・governance を明示
- Producer（業務アプリ）と Consumer（データ基盤）の間に契約を先に結ぶ
- **契約さえ守られていれば、両側は独立に進化できる → 並行開発の理論的根拠**
- Chad 本人 曰く「最大の課題は技術ではなく組織。エンジニアに採用してもらうのが難しい」

→ **「基盤ができるまでアプリを止める」は、Data Contract を採用していない旧来型組織の発想**。

出典:
- [Data Contracts book (O'Reilly, 2025)](https://www.oreilly.com/library/view/data-contracts/9781098157623/)
- [The Rise of Data Contracts (Chad Sanderson)](https://dataproducts.substack.com/p/the-rise-of-data-contracts)
- [The Shift Left Data Manifesto](https://dataproducts.substack.com/p/the-shift-left-data-manifesto)
- [Shifting Left with Data DevOps (Gable.ai, 2025)](https://www.gable.ai/blog/shifting-left-with-data-devops-chad-sanderson-shift-left-data-conference-2025)

### 14.5 日本市場の Fabric 動向

2026年4月時点で、日本の大企業・SIer が Fabric 導入を進めている:

- **日清製粉**: Microsoft Customer Story に掲載。Fabric Real-Time Intelligence で **リアルタイム分析を全社展開、スマートファクトリー化を加速**
- **日立ソリューションズ**: 2025年4月1日から Fabric 導入支援サービスを提供開始
- **電通総研（旧ISID）**: 製造業向け Fabric ソリューションを展開
- **ヘッドウォーターズ / 双日TI**: Fabric 実装パートナー

→ **fujimoto_hd が Fabric を選ぶこと自体は日本の主流と整合的**。議論すべきは「選択の是非」ではなく「並行開発の可否」。

出典:
- [日清製粉 Microsoft Customer Story](https://www.microsoft.com/ja-jp/customers/story/26328-nisshin-flour-milling-microsoft-fabric)
- [日立ソリューションズ: Fabric 導入支援サービス](https://www.hitachi-solutions.co.jp/company/press/news/2025/0331.html)
- [Microsoft Fabric 公式パートナー一覧](https://www.microsoft.com/ja-jp/microsoft-fabric/partners)

### 14.6 このセクションのまとめ — 反対派に刺さる3つの事実

1. **Fabric 自身が「既存業務 DB を後から取り込む」ことを公式機能として提供し、SAP/Oracle までGAしている**（2026年3月）
2. **Iceberg の勝利で、プラットフォーム選択は将来変更可能。Fabric = ロックイン という古い認識は誤り**
3. **Data Contract の書籍化・エンタープライズ事例公開で、"並行開発は現代の定石" が公開情報で裏付けられる**

---

## 15. 最終メッセージ（社長が説明時に強調する7点）

1. **Phase 1 までコード変更ゼロ**。Fabric 管理画面の操作だけで既存 DB が取り込める（Mirroring のデモが効く）
2. **アプリの書き換えは Phase 3 だけ**。DAL（データアクセス層）の実装差し替えで済み、画面や API は無変更
3. **OLTP（業務のリアルタイム処理）は Azure SQL DB のまま**。Fabric に移すのは分析系だけで、全部を Fabric に寄せる必要はない
4. **並行開発しておけば、Phase 1 のスタート時に "既に使われているデータ" が存在する** → Silver/Gold 層が "使う順" で育ち、机上設計の無駄が出ない
5. **LLM / エージェントの頭脳（プロンプト・ツール・実行エンジン）は Fabric と完全に独立**。Fabric は分析層にしか入ってこない
6. **権限管理は作り直さない**。Entra ID という同じ土台を使うので、Fabric 側は追加定義だけ（OneSecurity と Warehouse RLS の定義追加は発生）
7. **個人情報削除（GDPR）だけは設計時から考慮が必要**。Mirroring で Fabric にも複製されるため、削除要求が来たときに両方から消す仕組みを先に組んでおく

---

## 16. 並行開発を成功させる条件 — "作り直し" を避ける地雷リスト

§3 の再利用マトリクスは **「DAL が抽象化されている」「Data Contract が合意されている」等の前提** に依存している。この前提が崩れると、実際に大規模書き換えが発生する。Phase 0 の設計レビューで以下を確認すること。

### 16.1 最重要 — 外すと確実に書き直し

| # | 地雷 | 起きる事故 | 対策 |
|---|------|----------|------|
| 1 | **データアクセス層の抽象化不足** | データソース差し替え時に呼び出し箇所を全書き換え | Repository パターン（§17）を**最初の1行目から徹底**。画面・API ハンドラから `container.items.query(...)` や AI Search の直呼びを排除 |
| 2 | **文書 ID の採番戦略ミス** | Cosmos DB は `id` フィールドを任意指定だが、連番や業務由来 ID を使うとパーティション偏り・衝突リスク | **UUIDv7 / ULID / GUID を最初から**。Cosmos DB は UUID ネイティブ対応、難しくない |
| 3 | **タイムゾーン混在** | JST / UTC 混在で時刻ズレ、後修正不可能 | **全て UTC 保存（ISO 8601 文字列 or Unix epoch）、表示時のみ JST 変換** |
| 4 | **曖昧な JSON スキーマ・命名規則** | Mirroring で OneLake に来た JSON から列展開するとき型推論が不安定、Silver/Gold 破綻 | **英語スネークケース、JSON Schema / TypeScript 型で契約化**。オプショナル/必須、数値の精度、日付フォーマットを明示 |
| 5 | **Data Contract の口頭合意** | NTTデータ側 schema 変更でアプリ側が壊れる / 責任論争 | **書面化**（SemVer、事前レビュー期間、deprecation 期限を含む変更プロセス） |

### 16.2 重要 — 見落とすとコスト／コンプライアンス事故

| # | 地雷 | 起きる事故 | 対策 |
|---|------|----------|------|
| 6 | **個人情報削除フロー未設計** | GDPR / 個人情報保護法の削除要求に対応不能 | 個人情報列は Mirroring 対象外 or ハッシュ化。削除伝搬プロセスを Phase 0 で設計 |
| 7 | **BLOB・ベクトルを DB に格納** | Mirroring 対象外 or 型マッピング失敗 | バイナリは Blob Storage、ベクトルは Azure AI Search。DB にはポインタだけ |
| 8 | **権限マッピング後回し** | Bronze 層が全件見える状態 = 情報漏洩 | Phase 0 から OneSecurity 設計。センシティブ列は Mirroring 除外 / 列マスキング |
| 9 | **リアルタイム要件と Mirroring 遅延の混同** | 秒未満レイテンシ要件を Fabric 経由で満たそうとして失敗 | リアルタイム系は Eventstream / Reflex、分析系は Mirroring で住み分け |
| 10 | **Fabric Capacity コスト Cap なし** | 想定外クエリで Throttling / 請求ショック | Capacity モニタリング + コスト Cap を Phase 0 で設定 |

### 16.3 AI / エージェント特有

| # | 地雷 | 起きる事故 | 対策 |
|---|------|----------|------|
| 11 | **会話ログを Message オブジェクトのまま保存** | `tool_use` / `tool_result` / `thinking` の入れ子構造を後で展開する作業が地獄 | 最初からイベント単位にフラット化（Event Sourcing 風）。`user_message`, `llm_response`, `tool_call`, `tool_result` を個別レコード |
| 12 | **Azure OpenAI ↔ Fabric AI の役割分担曖昧** | プロンプト資産が分散、二重投資 | プロンプト・ツール定義は Git で一元管理。モデル選択は実行時切替 |
| 13 | **RAG インデックスのロックイン** | Fabric Vector（プレビュー）に移行しにくい | 当面 Azure AI Search で本番運用、Fabric Vector 移行は GA 後 1-2年の検討事項 |

### 16.4 組織・プロセス

| # | 地雷 | 起きる事故 | 対策 |
|---|------|----------|------|
| 14 | **NTTデータとの連携フレーム不在** | Phase 1 の Mirroring 接続時に schema ズレ・責任論争 | 週次/隔週 schema review、四半期 roadmap 同期を Phase 0 で取り決め |
| 15 | **テスト環境のズレ（dev / staging / prod）** | マージ時に予期せぬ障害 | Fabric Deployment Pipelines で同数環境分離を Phase 0 で |

### 16.5 Phase 0 で絶対に守る5箇条（チェックリスト）

以下をチェックリストとして Phase 0 設計レビューで確認:

- [ ] **① Repository パターンでデータアクセス層を抽象化**（画面・API ハンドラから Cosmos SDK / AI Search SDK の直呼び禁止）
- [ ] **② ID は UUID/ULID、時刻は UTC、命名は英語スネークケース、JSON スキーマを契約化**
- [ ] **③ 個人情報の削除フローと権限マッピング計画を Phase 0 で文書化**
- [ ] **④ バイナリは Blob Storage、ベクトルは Azure AI Search、文書 DB（Cosmos）と分離**
- [ ] **⑤ Data Contract を NTTデータと書面で合意**（schema 変更プロセス含む）

→ **この5箇条を Phase 0 で確認できれば、大規模な書き換えは高い確率で回避できる**。逆にここを軽視すると、並行開発のメリットが崩れて慎重派の警告通りに書き換えが発生する可能性が上がる。

### 16.6 社長が説明時に使うロジック

慎重派の「作り直しになる」という懸念を **条件付きで正しい** と認めたうえで、その条件を具体化する:

> 「作り直しが発生するリスクは確かにあります。ただしそれは主に以下のような設計上の判断に依存します:
> - データアクセス層を抽象化していない
> - 文書スキーマ／命名規則／ID 採番を揃えていない
> - Data Contract を NTTデータと書面で合意していない
>
> これらを Phase 0 で規律として入れれば、書き換え量を大幅に抑えられます。
> 逆に規律を入れる組織的余裕が無いのであれば、基盤先行が妥当な判断になり得ます。
> 判断軸は "組織が規律を実行できるか" です」

---

## 17. Repository パターンの分かりやすい解説（Cosmos DB + JSON + ベクトル前提）

本 PJ の大前提（アプリが **Cosmos DB と Azure AI Search を直接使う**）で、Repository パターンがどう効いてくるかを具体例で示す。社内説明時にこのまま使える粒度。

### 17.1 一言で言うと

**データの出し入れを "窓口係（Repository）" に一任する設計パターン**。画面やビジネスロジックは窓口に頼むだけで、中身（Cosmos に問い合わせるのか、AI Search を叩くのか、ファイルを読むのか）は知らない。

例えるなら **ホテルのコンシェルジュ**。お客さん（画面）は「東京駅までタクシー」と頼むだけで、コンシェルジュ（Repository）が配車会社を選び電話する。配車会社が変わってもお客さんの頼み方は同じ。

### 17.2 Cosmos DB 版のコード例 — 「顧客の最近の注文を取得する」

#### Repository なし（直接書く場合）

```typescript
// 画面コンポーネントに直接 Cosmos SDK を書く
async function CustomerOrdersPage({ customerId }) {
  const container = cosmos.database('app').container('orders')
  const { resources } = await container.items.query({
    query: 'SELECT * FROM c WHERE c.customer_id = @id AND c.created_at > @since ORDER BY c.created_at DESC',
    parameters: [
      { name: '@id', value: customerId },
      { name: '@since', value: dayjs().subtract(90, 'day').toISOString() },
    ],
  }).fetchAll()

  return <Table data={resources} />
}
```

**問題**:
- Cosmos SQL（Cosmos 固有の SQL API）が画面に漏れる → 後で Fabric SQL endpoint の T-SQL 方言に差し替えるとき全画面を書き換え
- JSON 文書の生構造（`c.customer_id`）が画面まで貫通 → 将来 `customer.id` にスキーマ変更すると画面まで修正
- 同じ90日制約を別画面でも使いたくなるとコピペ
- テスト時は本物の Cosmos を立てる必要

#### Repository あり（窓口を1つ置く）

```typescript
// ① 窓口（Repository）— ここだけが Cosmos を知る
class OrderRepository {
  constructor(private cosmos: CosmosClient) {}

  async findRecentByCustomer(customerId: string, days = 90): Promise<Order[]> {
    const container = this.cosmos.database('app').container('orders')
    const since = dayjs().subtract(days, 'day').toISOString()
    const { resources } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.customer_id = @id AND c.created_at > @since ORDER BY c.created_at DESC',
      parameters: [{ name: '@id', value: customerId }, { name: '@since', value: since }],
    }).fetchAll()
    return resources.map(toOrder) // JSON → Order ドメイン型へ
  }
}

// ② 画面は窓口に頼むだけ
async function CustomerOrdersPage({ customerId }) {
  const orders = await orderRepository.findRecentByCustomer(customerId)
  return <Table data={orders} />
}
```

**Fabric 導入後の差し替え**（Phase 3）:
```typescript
class OrderRepository {
  async findRecentByCustomer(customerId: string, days = 90): Promise<Order[]> {
    // 中身だけ Fabric SQL endpoint に差し替え。画面は無変更
    const rows = await fabricSql.query(
      'SELECT * FROM gold.orders WHERE customer_id = @id AND created_at > @since ORDER BY created_at DESC',
      { id: customerId, since: dayjs().subtract(days, 'day').toISOString() }
    )
    return rows.map(toOrder)
  }
}
```

### 17.3 Azure AI Search（ベクトル検索）にも同じ発想で適用

ベクトル検索を画面から直接叩くと同じ問題が起きる。RAG のクエリも Repository に閉じ込める。

```typescript
// Repository（検索専用）
class KnowledgeRepository {
  constructor(private searchClient: SearchClient) {}

  async searchSimilar(queryText: string, topK = 5): Promise<KnowledgeHit[]> {
    const embedding = await embedClient.embed(queryText)
    const results = await this.searchClient.search(queryText, {
      vectorQueries: [{ vector: embedding, kNearestNeighborsCount: topK, fields: ['content_vector'] }],
      select: ['id', 'title', 'content', 'source_url'],
      top: topK,
    })
    return results.results.map(toKnowledgeHit)
  }
}

// エージェントのツール実装は Repository を呼ぶだけ
const retrieveKnowledgeTool = {
  name: 'retrieve_knowledge',
  execute: async ({ query }) => knowledgeRepository.searchSimilar(query),
}
```

→ 後で Fabric Vector に移すか、別ベクトル DB に乗り換えるとしても、**ツール定義・エージェント実行エンジンは無変更**。

### 17.4 会話ログ・エージェント推論ログも同様

本 PJ 固有の事情：LLM の `messages` 配列（`user_message`, `tool_call`, `tool_result`, `thinking` のネスト）を Cosmos にそのまま入れると、後で分析が地獄になる（§16.3 の地雷 11）。Repository 経由なら、書き込み時にフラット化が可能。

```typescript
class ConversationRepository {
  async appendEvent(conversationId: string, event: ConversationEvent): Promise<void> {
    // 書き込み時に個別イベントに分解してフラット保存
    const container = this.cosmos.database('app').container('conversation_events')
    await container.items.create({
      id: uuidv7(),
      conversation_id: conversationId,
      event_type: event.type, // 'user_message' | 'llm_response' | 'tool_call' | 'tool_result'
      payload: event.payload,
      created_at: new Date().toISOString(),
    })
  }
}
```

→ Mirroring で Fabric に流した後、イベント単位で分析できる。後から正規化し直す必要がない。

### 17.5 実装の最小ルール（Cosmos + JSON + AI Search 前提）

| ルール | 意味 |
|---|---|
| ① Cosmos SDK / AI Search SDK を画面・API ハンドラ・エージェントツールから追放 | データ操作は必ず Repository 経由 |
| ② Repository の関数名は業務の言葉（`findRecentByCustomer`, `searchSimilar`, `appendEvent`） | `queryCosmos` みたいな技術用語で命名しない |
| ③ Repository が返すのは **ドメインオブジェクト**（`Order` 型、`KnowledgeHit` 型） | Cosmos の生 JSON（`{id: '...', customer_id: '...'}`）を外に出さない |
| ④ エンティティ1つに Repository 1個が目安 | `OrderRepository`, `CustomerRepository`, `ConversationRepository`, `KnowledgeRepository` |
| ⑤ 書き込み時に Data Contract を満たすよう形を整える | UUID 採番、UTC 時刻、フラット構造はここで担保 |

### 17.6 Fabric 導入時の書き換え量の差

| | Repository なし | Repository あり |
|---|---|---|
| 変更箇所 | 画面・API・エージェントツール全て | Repository クラスのみ |
| テスト影響 | アプリ全体を再テスト | Repository 層のテストだけ |
| 工数 | 数ヶ月の書き換え | 1〜2週間で差し替え完了 |

### 17.7 既存コードのチェック方法

クライアント側の既存コード（もしあれば）を grep で判別可能:

```bash
# ヒットが多ければ要リファクタ（画面・API から Cosmos 直呼びが散らばっている状態）
grep -rn "container.items.query\|container.items.read\|searchClient.search" src/pages src/api

# Repository / Service クラス配下のみにヒットする状態が理想
```

既にアプリ着手済みなら、**Phase 0 の最初の作業として Repository 層への退避リファクタを入れるのが最優先**。ここを飛ばすと、後続の議論（並行開発、再利用マトリクス §3、地雷回避 §16）が成立しない。

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
