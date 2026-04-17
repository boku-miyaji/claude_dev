# 金融大企業DX 案件獲得のための学習ロードマップ（24ヶ月計画）

**作成日**: 2026-04-17
**作成**: HD共通資料制作部
**対象者**: 社長本人（個人学習・キャリア戦略計画）
**ステータス**: review

---

> **重要な前提**: このレポートは focus-you とは完全に独立した、社長個人の学習・キャリア戦略計画です。focus-youの開発・商用化スケジュールに左右されず、並行して進める計画として策定しています。受託コンサル・フリーランスとして金融大企業DX案件を取りに行くための、個人の学習・認定・実績作りに特化しています。

---

## 0. エグゼクティブサマリ

### 推奨ルート

**Azure 主軸 + AWS 副軸を金融案件向けに最適化する**

日本の金融大企業DX市場において、Azure は Microsoft 365 との親和性・ISMAP 登録・Entra ID の業界標準化によって圧倒的な採用シェアを持つ。一方 AWS は金融グローバル案件・外資系金融機関で強い。両方を持つことで、国内メガバンク・地銀・保険会社から外資系金融まで射程に入れられる。

認定パスは以下のとおり：

```
【Azure メイン】
AZ-900（任意） → AZ-104（Admin） → AZ-500（Security） → AZ-305（Architect）
                                   ↓ 金融特化
                             SC-100（Cybersecurity Architect Expert）

【AWS 副軸】
CLF（任意） → SAA-C03 → SCS-C03（Security Specialty）
```

### 到達点の見通し

| 時点 | 到達目標 | 案件獲得の現実感 |
|------|---------|--------------|
| **6ヶ月後** | AZ-104 取得 + Azure 小PJ 1本完成 + ブログ3本公開 | 金融エントリー案件に応募開始。書類通過率は低い段階だが、経験を積む踏み台 |
| **12ヶ月後** | AZ-500 取得 + サブPJ拡張（セキュリティ機能込み） + ブログ10本 | 金融セキュリティ案件で書類通過率が上昇。月60〜85万円圏の案件が現実的 |
| **24ヶ月後** | AZ-305 or SC-100 + AWS SCS + 設計提案実績 + LinkedIn整備 | 設計リード級で月100万円+ 圏。FISC・ISMAP・ゼロトラスト設計を語れる |

### 月額コスト（概算）

| 項目 | 月額 |
|------|------|
| Azure サブPJ（SWA Free + 無料枠） | $0 |
| AWS サブPJ（S3 + CloudFront + Lambda） | $5〜$15 |
| Cloudflare 教養用（Workers Paid） | $5 |
| 認定受験料（年間平均で均した月額） | $50〜$100 |
| 書籍・Udemy 等（年間平均で均した月額） | $30〜$50 |
| **月額合計** | **$90〜170（約 13,000〜25,000円）** |

---

## 1. 金融大企業DX案件の要件分析

### 金融案件で求められる技術スタック・知識領域

金融機関のDXプロジェクトは、他業界と比べて「セキュリティ・コンプライアンス・監査対応」が設計の中心に来る。技術スタックを知っているだけでなく、**なぜその設計でなければならないか**を金融規制の文脈で語れることが差別化になる。

| 領域 | 具体的な知識 | 重要度 |
|------|-----------|--------|
| **ID/認証管理** | Entra ID（旧 Azure AD）、SAML/OIDC、SCIM プロビジョニング、PIM（特権管理） | 最重要 |
| **ネットワーク分離** | VNet/サブネット設計、Private Endpoint、Azure Firewall、NSG | 最重要 |
| **鍵・暗号化** | Azure Key Vault、KMS、BYOK（Bring Your Own Key）、HSM 連携 | 最重要 |
| **監査ログ** | Azure Monitor、Log Analytics Workspace、長期保持（7年）、改ざん防止 | 最重要 |
| **条件付きアクセス** | Conditional Access、MFA 強制、デバイスコンプライアンス | 重要 |
| **ゼロトラスト** | Zero Trust アーキテクチャ、Cloudflare/Entra Private Access | 重要 |
| **SOC/SIEM** | Microsoft Sentinel、GuardDuty/Security Hub、インシデントレスポンス | 重要 |
| **コンプライアンス** | FISC安全対策基準、ISMAP、個人情報保護法、PCI DSS、SOC 2 | 重要 |
| **IaC** | Bicep / Terraform（OpenTofu）、Azure Landing Zone | 中程度 |
| **コンテナ/マイクロサービス** | AKS / Container Apps、Defender for Containers | 中程度 |

### RFP 頻出項目

金融機関の提案依頼書（RFP）や調達基準書で繰り返し登場する項目を把握しておくことが、提案の質を上げる最短経路になる。

| RFP 頻出キーワード | 意味・背景 |
|-----------------|-----------|
| **Entra ID / Azure AD** | Microsoft 365 を利用している金融機関では、ID管理の中心がすでに Entra ID にある。DX プロジェクトでの SSO・権限管理はここが起点になる |
| **KMS / HSM** | 暗号鍵の管理方式。特に機密性の高いデータを扱う金融では BYOK（自社生成鍵をクラウドに持ち込む）が要件になることが多い |
| **監査ログ 7年保持** | 金融商品取引法・銀行法の要件。ログの改ざん防止（WORM ストレージ等）も求められる |
| **ISMAP** | 政府情報システムのクラウドセキュリティ評価制度。準公共・金融でも ISMAP 登録済みサービスを要求するケースが増えている |
| **FISC 安全対策基準** | 金融情報システムセンター（FISC）が定める金融機関のシステム安全基準。準拠状況のエビデンス提示を求められる |
| **個情法・個人番号法** | 改正個人情報保護法（2026年再改正予定）への対応。越境移転対応・データ最小化・削除対応が必須 |
| **ゼロトラスト** | 「境界防御は信頼できない」前提のセキュリティモデル。テレワーク普及により金融でも主流化が進む |
| **SOC 2 readiness** | B2B SaaS を金融機関に納入する際の信頼の証明。第三者審査に耐える統制設計が必要 |
| **BCP / DR** | 業務継続計画・災害復旧。データセンター冗長・RTO/RPO の定義が求められる |

### 単価レンジ（フリーランス・業務委託、日本市場）

以下の数値は複数のフリーランス案件データベース・エージェントのデータを元にした参考値。個人差・案件差・交渉力で 2 倍以上のブレがある点に注意。

| レベル | 月額単価 | 条件・目安 |
|--------|---------|-----------|
| 初級（経験1〜2年・クラウド基礎） | 25〜50万円 | 認定のみ、実務経験なし。補助的なロールが多い |
| 中級（3〜5年・AZ-104/AZ-500 持ち） | 60〜85万円 | 設計サポート、セキュリティ評価補助 |
| 上級（AZ-305/SC-100 持ち・設計リード） | 80〜130万円 | 移行設計リード、RFP 対応支援 |
| AI/ML 掛け合わせ（Azure OpenAI 含む） | 90〜150万円 | Azure OpenAI Service を含む DX 設計ができる |
| 金融特化スペシャリスト（FISC + ISMAP + 設計実績） | 100〜150万円+ | 金融固有の規制対応を設計レベルで語れる希少人材 |

参照: [bizdev-tech 2026 AWSフリーランス相場](https://bizdev-tech.jp/aws-freelance/) / [xnetwork クラウドエンジニア単価](https://www.xnetwork.jp/contents/cloud-engineer-unitprice) / [infla-lab クラウドエンジニア年収](https://infla-lab.com/blog/cloud-engineer-annual-income/)

### なぜ Azure が日本金融で強いのか

日本の大企業クラウド市場シェアは Azure 49% / AWS 31% / GCP 20% 程度と推計されており（[DEHA Magazine 2026](https://deha.co.jp/magazine/cloud-2026/)、[Programming Helper 2026](https://www.programming-helper.com/tech/cloud-computing-market-share-2026-aws-azure-google-cloud-analysis)）、グローバルとは逆転している。その主因は以下の3点。

1. **Microsoft 365 との一体性**: 日本の大企業・金融機関の大多数が Office 365（現 Microsoft 365）を利用済み。DXプロジェクトの「ID基盤の起点」が既に Entra ID にあるため、Azureへの統合が最小摩擦で実現する
2. **ISMAP 登録の早期対応**: Azure は ISMAP（政府情報システムのクラウドセキュリティ評価制度）に早期から登録しており、公共・準公共・金融での採用要件を満たしやすい
3. **Microsoft Sentinel の SOC 標準化**: 日本の大手金融機関のセキュリティ運用センター（SOC）で Microsoft Sentinel が標準 SIEM として採用されるケースが増えており、Sentinel 運用経験が直接案件評価につながる

---

## 2. 推奨ルート: Azure 主軸 + AWS 副軸 + Cloudflare 教養

### Azure ルート（メイン）

```
AZ-900（任意・スキップ可） → AZ-104（Azure Administrator）
                                    ↓
                            AZ-500（Security Engineer）
                                    ↓
                 ┌──────────────────┴──────────────────┐
         AZ-305（Architect Expert）          SC-100（Cybersecurity Architect Expert）
         ※設計リード案件向け               ※金融セキュリティ特化向け
```

| 認定 | 受験料 | 標準学習時間 | 難易度（5段階） | 金融案件での評価 |
|------|--------|------------|--------------|--------------|
| **AZ-900** | $165（約24,000円） | 20〜40時間 | 1 | 足切り対策。取っておくと安心だが任意でよい |
| **AZ-104** | $165（約24,000円） | 80〜120時間 | 3 | 「Azure できます」の最低証明。中級案件エントリーに必須 |
| **AZ-500** | $165（約24,000円） | 100〜150時間 | 4 | 金融セキュリティ案件での評価が大きく上がる。AZ-104の次に取る |
| **AZ-305** | $165（約24,000円） | 120〜180時間 | 4 | 設計リード案件で明確に差がつく。月100万円+ を狙うなら必要 |
| **SC-100** | $165（約24,000円） | 100〜160時間 | 5 | サイバーセキュリティ特化の最上位。金融 SOC 案件・CISO 支援案件に強い |

受験料参照: [Microsoft 認定資格試験 - Microsoft Learn](https://learn.microsoft.com/ja-jp/credentials/certifications/) / [Azure Certification Roadmap 2026 - MyExamCloud](https://www.myexamcloud.com/blog/azure-certification-roadmap-2026-az900-az104-az305.article)

**取得後のフリーランス単価への影響（目安）**:
- AZ-104 取得: 中級案件へのエントリー資格。単価 60〜80万円圏の案件に応募可能になる
- AZ-500 追加: セキュリティ案件での書類通過率が上がる。単価 70〜90万円圏
- AZ-305 or SC-100 追加: 設計リード・CISO 支援案件。単価 100万円+ 圏

### AWS ルート（副軸）

```
CLF（任意） → SAA-C03（Solutions Architect Associate）
                      ↓
              SCS-C03（Security Specialty）
```

| 認定 | 受験料 | 標準学習時間 | 難易度 | 金融案件での評価 |
|------|--------|------------|--------|--------------|
| **CLF** | $100（約15,000円） | 20〜40時間 | 1 | 任意。AWS を全く知らない状態から始める場合のウォームアップ |
| **SAA-C03** | $150（約22,000円） | 80〜120時間 | 3 | グローバル・マルチクラウド案件で通用する標準証明。Azure 主軸でも持っておく価値がある |
| **SCS-C03** | $300（約45,000円） | 120〜180時間 | 5 | AWS Security Specialty。外資系金融・グローバル金融機関の案件で強い。KMS・GuardDuty・Security Hub を深掘りする |

受験料参照: [AWS Certification Roadmap 2026 - K21Academy](https://k21academy.com/aws-cloud/aws-certification-roadmap/) / [AWS Security Specialty Salary 2026](https://sailor.sh/blog/aws-security-specialty-salary-2026/)

### Cloudflare 教養

認定試験は存在しないが、Cloudflare Zero Trust の50ユーザ無料枠で実体験することで「ゼロトラスト実装経験」を語れるようになる。金融RFP でのゼロトラスト要件に対して、「実際に Cloudflare Access / ZTNA を設定した経験があります」と言えることは実質的な差別化になる。

- **学習内容**: Cloudflare Access（ZTNA）、WAF、Bot Management、Workers で API プロキシ実装
- **費用**: 月 $0〜$5（無料枠での体験は $0）
- **成果物**: 社内ツール風プロトタイプを1本作り、ブログ記事として公開する

---

## 3. 24ヶ月の学習ロードマップ（週8時間前提）

週8時間 = 月32〜34時間の学習時間を前提とする。認定試験の標準学習時間と突き合わせると、以下の計画が現実的。

| 期間 | 主テーマ | 週あたり時間配分 | アウトプット | 認定 |
|------|---------|---------------|-----------|------|
| **1〜2ヶ月目** | Azure 基礎固め。IAM・VNet・Storage・Compute の概念理解。Microsoft Learn の AZ-900 ラーニングパス完走 | 6h 学習 + 2h Microsoft Learn ハンズオン | Microsoft Learn モジュール完了バッジ。学習ノート（Notion / Obsidian 等）を Zenn 記事化（1本） | AZ-900 受験（任意） |
| **3〜5ヶ月目** | Azure Administrator（AZ-104）。VM 管理・Virtual Network・Identity・Storage・Monitor | 5h 学習 + 3h サブPJ実装 | Azure 学習用サブPJ v1（Static Web Apps + Functions + Entra External ID）を完成。Zenn 記事 2本公開 | **AZ-104 受験・合格** |
| **6〜9ヶ月目** | Azure Security（AZ-500）。Microsoft Defender for Cloud・Sentinel・Key Vault・Conditional Access・Privileged Identity Management | 5h 学習 + 3h サブPJ拡張 | サブPJ v2 に Conditional Access・Key Vault・監査ログ設計を追加。Zenn 記事 3本公開。ブログで「FISC 安全対策基準と Azure の対応関係」公開（金融特化コンテンツ） | **AZ-500 受験・合格** |
| **10〜12ヶ月目** | AWS 基礎。SAA-C03 対策。VPC・Lambda・S3・RDS・IAM・Well-Architected Framework | 5h 学習 + 3h AWS 小PJ | AWS 学習用小PJ（VPC + Lambda + S3 + RDS + Cognito）完成。Zenn 記事 2本公開。LinkedIn プロフィール整備・更新 | **SAA-C03 受験・合格** |
| **13〜15ヶ月目** | AWS Security（SCS-C03）。KMS・GuardDuty・Security Hub・WAF・CloudTrail・Config | 5h 学習 + 3h AWS Security 小PJ | AWS Security 小PJ（GuardDuty + Security Hub + CloudTrail + S3 Object Lock）完成。Zenn 記事 2本公開 | **SCS-C03 受験・合格** |
| **16〜18ヶ月目** | 金融特化知識の深掘り。FISC・ISMAP・PCI DSS・BCP/DR・個情法・監査ログ設計 | 4h 学習 + 4h 執筆・発信 | FISC 安全対策基準の Azure/AWS 対応マッピング資料（ホワイトペーパー形式で公開）。JAWS-UG か JAZUG でのライトニングトーク登壇（1回） | 認定なし（深掘り期間） |
| **19〜24ヶ月目** | アーキテクト視点の強化。AZ-305 or SC-100 対策。設計提案力・RFP 対応力の向上 | 5h 学習 + 3h 設計資料作成 | 設計提案テンプレート集（金融機関向け Azure Landing Zone 設計、ゼロトラスト設計）を GitHub 公開。Qiita / Zenn 記事 3本公開。カンファレンス登壇（JAWS-UG 金融 UFUG 等）1〜2回 | **AZ-305 or SC-100 受験・合格** |

**注意事項**:
- 模擬試験で80%を安定して超えるまで本受験しない（落ちると受験料が無駄になり、合格が遅れて案件応募タイミングを逃す）
- 学習時間が確保できない時期（案件繁忙期等）は認定優先度を下げ、翌月に持ち越す
- 各認定の公式学習リソース（Microsoft Learn / AWS Skill Builder）を軸にし、Udemy 等は補完として使う

---

## 4. 学習用サブPJ案（focus-you とは別の小規模アプリ）

以下の3プロジェクトは、focus-you の開発とは完全に独立した学習専用のミニプロジェクト。本番ユーザーを持つ必要はなく、「動いているもの」として GitHub に公開し、ブログで設計を解説することが目的。

### サブPJ 1: Azure 学習用 — 個人タスク管理 SaaS（最小版）

**何を作るか**: Azure Static Web Apps（React/Vite）+ Azure Functions（バックエンド API）+ Microsoft Entra External ID（認証）+ Cosmos DB（データストア）で構成する、個人 TODO 管理の小さな SaaS。機能は最小限（タスク CRUD + 認証のみ）でよい。

**月額コスト**:

| サービス | 月額 |
|---------|------|
| Azure Static Web Apps（Free Tier） | $0 |
| Azure Functions（消費プラン、無料枠 100万回まで） | $0〜$1 |
| Entra External ID（50,000 MAU まで無料） | $0 |
| Cosmos DB（Free Tier、400 RU/s + 5GB） | $0 |
| Key Vault（$0.03/10K 操作） | ~$0 |
| **合計** | **$0〜$1** |

参照: [Azure Static Web Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) / [Azure Cosmos DB Pricing](https://azure.microsoft.com/en-us/pricing/details/cosmos-db/) / [Entra External ID Pricing](https://azure.microsoft.com/en-us/pricing/details/active-directory/external-identities/)

**学習効果**:
- AZ-104 対策: Static Web Apps のデプロイ、Functions のトリガー設定、Entra External ID の SSO 設定
- AZ-500 対策: Key Vault でシークレット管理、Defender for Cloud のセキュリティスコア確認、Conditional Access ポリシー設計
- 金融案件への転用: 「Entra ID を使った ID 管理と Key Vault を使った暗号化を実装した経験があります」と説明できる

**実装目安時間**: 3〜4日（週末2回）。最初の週末でインフラ構築、次の週末でアプリ実装とドキュメント整備。

---

### サブPJ 2: AWS 学習用 — ブックマーク管理 Web アプリ

**何を作るか**: AWS S3 + CloudFront（フロントエンド配信）+ Lambda（API）+ RDS for PostgreSQL（データストア）+ Cognito（認証）で構成する、ブックマーク管理の小さな Web アプリ。SAA-C03 と SCS-C03 の試験で頻出するサービス群を実際に組み合わせる。

**月額コスト**:

| サービス | 月額 |
|---------|------|
| S3 + CloudFront（学習規模） | $1〜$3 |
| Lambda（無料枠 100万回まで） | $0〜$1 |
| RDS PostgreSQL（db.t4g.micro、シングル AZ） | $10〜$15 |
| Cognito（10,000 MAU まで無料） | $0 |
| Route 53（ホストゾーン 1つ） | $0.50 |
| **合計** | **$11〜$19** |

参照: [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/) / [Amazon RDS Pricing](https://aws.amazon.com/rds/postgresql/pricing/) / [Amazon S3 Pricing](https://aws.amazon.com/s3/pricing/)

**学習効果**:
- SAA-C03 対策: VPC 設計（パブリック/プライベートサブネット分離）、Lambda と RDS の接続、CloudFront のオリジン設定、IAM ロール設計
- SCS-C03 対策: GuardDuty の有効化・アラート確認、Security Hub の有効化、CloudTrail + S3 Object Lock でのログ保持、KMS で RDS 暗号化
- 金融案件への転用: 「VPC 分離設計・KMS 暗号化・CloudTrail ログ保持を実装した経験があります」と説明できる

**実装目安時間**: 4〜5日（週末3回）。VPC 設計に1日、アプリ実装に2日、セキュリティ機能の追加に2日。

---

### サブPJ 3: Cloudflare 教養用 — 社内ツール風プロトタイプ（ZTNA 体験）

**何を作るか**: Cloudflare Pages（フロントエンド）+ Workers（API プロキシ）+ R2（ファイルストレージ）+ Zero Trust Access（アクセス制御）で構成する、「特定メンバーしかアクセスできないプライベートツール」のプロトタイプ。コンテンツは何でもよい（例：チームの議事録置き場）。

**月額コスト**:

| サービス | 月額 |
|---------|------|
| Cloudflare Workers Paid（アカウント単位） | $5 |
| R2 ストレージ（10GB まで込み） | $0〜$1 |
| Zero Trust（50ユーザまで無料） | $0 |
| **合計** | **$5〜$6** |

参照: [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) / [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

**学習効果**:
- ゼロトラスト体験: Cloudflare Access で「誰がアクセスできるか」を Identity Provider（GitHub や Google）と連携して制御する体験。金融RFP の「ゼロトラストアーキテクチャ」要件に対して実体験として語れる
- WAF 体験: Cloudflare WAF のルール設定・Bot Fight Mode の動作確認。金融機関の WAF 要件に対する説明力が上がる
- 認定はないが実績として語れる: 「Cloudflare Zero Trust を使って50ユーザ以下の社内ツールを保護した実装経験があります」

**実装目安時間**: 2〜3日（週末1〜2回）。Workers の設定が最初の壁だが、公式チュートリアルが充実している。

---

## 5. 実績作りの方法（focus-you は含めない）

認定を持っているだけでは金融大企業DX案件は取れない。「認定＋実績＋発信」の3点セットが必要。

### ブログ・Zenn・Qiita 公開（学習記録・実装記録）

発信は「完成した知識を教える場」ではなく「学習過程を見せる場」として考えるとハードルが下がる。以下のような記事テーマが、金融DX案件のターゲット層（DX推進部・IT戦略部の担当者）に刺さりやすい。

| 記事テーマ例 | 目的 |
|-----------|------|
| 「AZ-104 合格記：金融エンジニアが押さえておくべき5つのポイント」 | 認定対策と金融文脈の組み合わせ |
| 「FISC 安全対策基準を Azure でどう対応するか：Entra ID + Key Vault + Sentinel のマッピング」 | 金融特化の希少コンテンツ。検索流入・LinkedIn でのシェアが期待できる |
| 「ゼロトラスト実装記録：Cloudflare Access で社内ツールを保護した話」 | 実装経験の公開。採用・案件獲得に直結 |
| 「Azure Key Vault と KMS の比較：金融案件でのBYOK要件を満たす方法」 | 金融特化。競合記事が少なく検索で上位を取りやすい |
| 「GuardDuty + Security Hub + CloudTrail で実現するAWS金融グレードの監査ログ設計」 | AWS セキュリティの深掘り記事 |

**発信ルール**:
- 1ヶ月に1本は必ず公開する（2ヶ月に1本でも可、ゼロが最悪）
- ソースコードは GitHub に公開して記事からリンクする
- 公開したら LinkedIn にシェアして「金融DX」「クラウドセキュリティ」タグを付ける

### GitHub に実装公開

サブPJのコードをすべて GitHub に公開する。README に「このプロジェクトで学んだこと」「金融案件への応用」を書くと、採用側・案件依頼側が実力を判断しやすくなる。OSS ライブラリへの小さな PR（ドキュメント修正でも可）を1〜2本追加すると OSS コントリビューター実績にもなる。

### LinkedIn 更新（外資・フリーランス案件流入）

金融大企業DXの案件は、LinkedIn 経由でアプローチしてくるヘッドハンターや調達担当者が多い。以下を定期的に更新する。

- **スキル欄**: Azure、Microsoft Entra ID、Azure Security、Sentinel、KMS、Zero Trust、FISC、ISMAP
- **資格欄**: 認定取得のたびに即追加（LinkedIn の「認定バッジ」機能を使う）
- **投稿**: Zenn/Qiita に記事を公開したら同日に LinkedIn でもシェア
- **プロフィールの「概要」欄**: 「金融機関向け Azure セキュリティ・DX コンサルタント。FISC/ISMAP 対応の設計実績あり。」というポジショニングを明示する（実績が積まれたら随時更新）

### カンファレンス登壇

登壇実績は「経験者」として認識されるための最速経路の一つ。以下のコミュニティは無料・ライトニングトーク（5分）から参加できる。

| コミュニティ | 種類 | 対象認定・テーマ |
|-----------|------|--------------|
| [JAWS-UG](https://jaws-ug.jp/)（AWS ユーザーグループ） | 月次勉強会・年次 re:Invent 報告会等 | AWS SAA・SCS の学習記録、金融セキュリティ |
| [JAZUG](https://jazug.connpass.com/)（Japan Azure User Group） | 月次勉強会 | Azure AZ-104・AZ-500 の学習記録、Sentinel 活用 |
| JAWS-UG 金融/UFUG（金融系ユーザーグループ） | 年数回 | 金融DX・FISC・ISMAP をテーマにした登壇が歓迎される |
| [Cloudflare Connect](https://www.cloudflare.com/events/) | 年次イベント | Zero Trust・Workers の実装経験を発表 |
| AWS re:Invent Japan 報告会 | 年次（1月頃） | AWS Security 系の最新情報共有 |

ライトニングトーク（5分）の内容例：「AZ-500 合格後に実装した Azure Key Vault + Conditional Access の金融ユースケース」など、認定と実装を組み合わせた短い発表は参加者に響きやすい。

---

## 6. 月額コスト見積もり

### 学習インフラコスト（月額）

| 項目 | 月額 | 備考 |
|------|------|------|
| Azure サブPJ（SWA Free + Cosmos DB Free） | $0 | Azure 無料アカウント（$200 クレジット）を最初に活用 |
| AWS サブPJ（S3 + CloudFront + Lambda + RDS） | $11〜$19 | RDS の db.t4g.micro が最大コスト項目 |
| Cloudflare 教養用（Workers Paid） | $5 | アカウント単位 $5/月 |
| **インフラ合計** | **$16〜$24/月（約2,400〜3,600円）** | |

### 学習・認定コスト（年間 → 月額換算）

| 項目 | 年間コスト | 月額換算 |
|------|----------|---------|
| 認定受験料（年間 3〜4 試験、1試験あたり $165〜$300） | $600〜$1,000 | $50〜$83 |
| Microsoft Learn（完全無料） | $0 | $0 |
| AWS Skill Builder（無料プランで十分） | $0 | $0 |
| Udemy（セール時購入 $15〜$25/コース × 3〜4コース） | $60〜$100 | $5〜$8 |
| 書籍（年間 3〜5 冊 × 3,000〜5,000円） | $80〜$180 | $7〜$15 |
| 模擬試験（Microsoft 公式・Whizlabs 等） | $50〜$100 | $4〜$8 |
| **学習・認定合計** | **$790〜$1,380/年** | **$66〜$115** |

### 総合計

| 区分 | 月額 |
|------|------|
| インフラ（クラウドアカウント） | $16〜$24 |
| 学習・認定（月額換算） | $66〜$115 |
| **合計** | **$82〜$139/月（約12,000〜21,000円）** |

この金額は「月額コスト見積もり（概算）」として前節に示した $90〜$170 のレンジ内に収まる。RDS を停止できる期間（AWS 学習が終わった後）は $5〜$10 まで圧縮可能。

### コスト最適化のポイント

- Azure の最初の3ヶ月は「Azure 無料アカウント（$200 クレジット）」を使い切ることでほぼ無料
- RDS はサブPJ 学習が終わったら **スナップショットを取って削除**。再開時にスナップショットから復元する（削除期間中は課金なし）
- Budget アラート設定: AWS・Azure 双方で $10/$20/$50 の3段階アラートを必ず設定し、事故防止する

---

## 7. 案件獲得までのタイムライン

### 6ヶ月目（AZ-104 取得後）

「Azure Administrator ができます」と自信を持って言えるレベル。ただしこの段階での金融案件への書類通過率は低い。フリーランスエージェント（レバテック・テクフリ・Midworks 等）への登録と、エントリー案件への応募を開始する段階として位置づける。

- 応募可能な案件: Azure インフラ構築補助・Microsoft 365 管理支援・クラウド移行補助
- 月額単価目安: 50〜70万円（補助的なロール）
- ネクストアクション: AZ-500 学習開始と並行して、フリーランスエージェント2〜3社に登録

### 12ヶ月目（AZ-500 取得後）

Azure セキュリティを語れる。この段階でブログ記事が5〜8本公開されていれば、書類選考でポートフォリオとして提示できる。金融セキュリティ案件での書類通過率が上昇し、面談でのアピールポイントが増える。

- 応募可能な案件: クラウドセキュリティ評価支援・Azure 移行プロジェクトのセキュリティレビュー・Sentinel 導入支援
- 月額単価目安: 70〜90万円
- ネクストアクション: FISC/ISMAP 特化記事をブログに公開。LinkedIn での流入を確認。SAA 取得に向けた AWS 学習開始

### 18ヶ月目（SAA + SCS 取得後）

Azure + AWS の両軸を持ち、金融特化の知識（FISC・ISMAP・監査ログ設計）も習得。ホワイトペーパー or 設計ガイド形式のアウトプットが公開されていれば、提案書のサンプルとして使える。この段階で「金融DX専門のクラウドセキュリティコンサルタント」というポジショニングが確立し始める。

- 応募可能な案件: 金融機関向けクラウドセキュリティ設計・マルチクラウド環境のセキュリティ統合設計
- 月額単価目安: 80〜100万円
- ネクストアクション: カンファレンス登壇実績を積む。設計提案テンプレートの作成開始

### 24ヶ月目（AZ-305 or SC-100 取得後）

設計リード級。Azure + AWS のアーキテクト認定・セキュリティ専門認定を複数保有し、ブログ記事20本+・GitHub での設計テンプレート公開・カンファレンス登壇実績が揃う。この段階で月100万円+ の金融DX案件リードポジションへの応募が現実的になる。

- 応募可能な案件: 金融機関向け DX アーキテクト（設計リード）・セキュリティアーキテクト・CISO 支援コンサルタント
- 月額単価目安: 100〜130万円
- 長期目標: CISSP（5年実務経験が必要）の受験準備。FISC / ISMAP の深掘り継続

---

## 8. リスクと対策

| リスク | 発生可能性 | 影響度 | 対策 |
|--------|----------|--------|------|
| **学習時間の確保ができない時期が続く** | 高 | 中 | 月の目標を「認定合格」ではなく「学習時間30時間確保」に切り替える。認定受験は時期をずらす |
| **認定試験に落ちる** | 中 | 中 | 模擬試験で80%安定して取れるまで本受験しない。1回落ちたら3ヶ月後に再受験（冷却期間として活用） |
| **金融案件の市場縮小** | 低〜中 | 高 | AWS / Cloudflare の知識を「保険」として持つ。製造業・医療・公共の案件にも転用できる知識セット |
| **認定取得しても実績がないと案件取れない** | 中 | 高 | 認定取得と同時にサブPJ完成・ブログ記事公開を必ずセットにする。「認定だけ持ち実装経験なし」は避ける |
| **ブログ継続が途切れる** | 高 | 中 | 月1本を最低ラインとする。「完璧な記事」を目指さず「学習メモ公開」レベルでも出す |
| **学習コストが予算を超える** | 低 | 低 | AWS RDS を使わない期間はサーバーを削除。Udemy はセール（最大90%オフ）以外では買わない |
| **技術トレンドの変化（Azure / AWS の仕様変更）** | 中 | 低 | 認定は2〜3年で更新が必要。公式ドキュメントを定期的に確認する習慣を持つ |
| **LinkedIn・ブログからの案件流入がゼロ** | 中 | 中 | フリーランスエージェント（レバテック・テクフリ）と並行して進める。ブログ流入だけに依存しない |

---

## 9. 次のアクション

### 今週中

- [ ] Microsoft Learn アカウント作成・AZ-900 ラーニングパス開始（[学習パス](https://learn.microsoft.com/ja-jp/training/paths/az-900-describe-cloud-concepts/)）
- [ ] AWS アカウント登録（[無料アカウント](https://aws.amazon.com/jp/free/)）と Budget アラート設定（$5/$10/$20）
- [ ] Azure 無料アカウント開設（[Azure 無料アカウント](https://azure.microsoft.com/ja-jp/free/)、$200 クレジット付き）と Budget アラート設定
- [ ] Zenn アカウント作成（[zenn.dev](https://zenn.dev)）

### 今月中

- [ ] AZ-104 のラーニングパスを Microsoft Learn でスタート
- [ ] Azure 学習用サブPJ（Static Web Apps + Entra External ID）の環境構築に着手
- [ ] Zenn に「Azure 学習開始記事」を1本公開

### 3ヶ月以内

- [ ] AZ-104 受験（模擬試験80%超えが条件）
- [ ] Azure 学習用サブPJを GitHub に公開
- [ ] Zenn に記事2本公開
- [ ] フリーランスエージェント（レバテック・テクフリ等）に登録・市場感把握

---

## 付録: 参考リンク

### 公式学習リソース

| リソース | URL |
|---------|-----|
| Microsoft Learn（Azure 認定）| https://learn.microsoft.com/ja-jp/training/ |
| AZ-104 学習ガイド | https://learn.microsoft.com/ja-jp/credentials/certifications/resources/study-guides/az-104 |
| AZ-500 学習ガイド | https://learn.microsoft.com/ja-jp/credentials/certifications/resources/study-guides/az-500 |
| AWS Skill Builder | https://skillbuilder.aws/ |
| AWS Security Specialty | https://aws.amazon.com/jp/certification/certified-security-specialty/ |

### 認定・単価の参考情報

| リソース | URL |
|---------|-----|
| Azure Certification Roadmap 2026 | https://www.myexamcloud.com/blog/azure-certification-roadmap-2026-az900-az104-az305.article |
| AWS Certification Roadmap 2026 | https://k21academy.com/aws-cloud/aws-certification-roadmap/ |
| AZ-104 コスト・単価 | https://passitexams.com/articles/az-104-certification-cost-salary-and-jobs/ |
| AZ-305 最高単価 | https://passitexams.com/articles/highest-paying-microsoft-azure-certifications/ |
| AWSフリーランス単価相場 | https://bizdev-tech.jp/aws-freelance/ |
| クラウドエンジニア年収 | https://infla-lab.com/blog/cloud-engineer-annual-income/ |

### 金融・セキュリティ関連規制

| リソース | URL |
|---------|-----|
| FISC 安全対策基準 | https://www.fisc.or.jp/ |
| ISMAP クラウドサービスリスト | https://www.ismap.go.jp/ |
| OWASP LLM Top 10 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ |
| NIST SP 800-61（インシデントレスポンス） | https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final |

### コミュニティ

| リソース | URL |
|---------|-----|
| JAWS-UG | https://jaws-ug.jp/ |
| JAZUG（Japan Azure User Group） | https://jazug.connpass.com/ |
| Cloudflare Connect | https://www.cloudflare.com/events/ |
| Zenn | https://zenn.dev |
| Qiita | https://qiita.com |

---

## 本レポートの限界

1. **認定受験料は変動する**: Microsoft / AWS ともに年に1〜2回程度、価格改定・試験バージョン変更がある。最新情報は公式サイトで確認する
2. **案件単価には個人差が大きい**: 経験年数・交渉力・スキルの組み合わせによって 2〜3倍のブレがある。ここに示した数値は「参考値」として扱う
3. **金融市場の動向**: 金融機関のDX投資は経済環境・規制変更によって変動する。24ヶ月の計画は半年ごとに見直すことを推奨する
4. **公知情報ベースの推計**: FISC・ISMAP の具体的な運用実態（どの項目で審査が厳しいか等）は、実際の案件経験がないと把握できない。案件を1本取った後に計画を修正することを前提としている
5. **Azure / AWS の仕様変更**: クラウドサービスは月次で機能追加・価格改定がある。特に AI/ML 関連（Azure OpenAI・Bedrock）は変化が速い

---

```yaml
# handoff
handoff:
  - to: secretary
    context: "社長への提示と artifacts 登録を依頼。本レポートは focus-you とは独立した社長個人の学習計画であることを明示して提示する"
    tasks:
      - "本レポート（finance-dx-learning-roadmap.md）を社長に提示"
      - "artifacts テーブルに title='金融大企業DX案件獲得 学習ロードマップ（24ヶ月計画）' description='Azure主軸+AWS副軸でフリーランス金融DX案件月100万円+を目指す個人学習・認定・実績作り計画。focus-youとは独立。' として登録"
  - to: pm
    context: "社長が承認した場合、学習タスクをチケット化する。承認前はチケット作成しない"
    tasks:
      - "社長承認後: 「AZ-104 学習開始」タスクを登録（優先度: 高、期限: 1ヶ月後）"
      - "社長承認後: 「Azure 無料アカウント開設 + Budget アラート設定」タスクを登録（優先度: 高、期限: 今週中）"
      - "社長承認後: 「Zenn アカウント作成」タスクを登録（優先度: 通常、期限: 今週中）"
      - "社長承認後: 「Azure サブPJ着手（Static Web Apps + Entra External ID）」タスクを登録（優先度: 通常、期限: 1ヶ月後）"
```
