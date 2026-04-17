# AWS vs Azure 徹底比較 — 「大企業DXで戦える知識」をつける個人開発者の選択（2026-04）

> focus-you（React/Vite SPA + Supabase + OpenAI Edge Function 経由）を踏み台に、AWS / Azure のどちらを学習軸にすべきかを、**コスト・学習効果・大企業DX案件での戦闘力・セキュリティ・移行容易性**の5観点で比較する。data-platforms-2026 シリーズの姉妹編として、データ基盤（Snowflake/Databricks/Fabric）の手前にある「アプリ層クラウド」の選択を扱う。

**作成日**: 2026-04-17 / **担当**: HD共通リサーチ部 / **対象PJ**: focus-you / **読者**: 社長本人

---

## 0. 30秒サマリ（先に結論）

- **シェアは日本ではAzureがリード**（Azure 49% / AWS 31% / GCP 20%）。グローバルとは逆転している。「日本の大企業DX」を狙うなら **Azureの優先度が一段高い**。ただし「AWSが負ける」ではなく、「金融・公共・大手SIer・Microsoft 365 ベース企業」のレイヤで Azure 優位、「テック企業・スタートアップ・グローバル展開」レイヤで AWS 優位、と棲み分けがはっきりしている。([Programming Helper](https://www.programming-helper.com/tech/cloud-computing-market-share-2026-aws-azure-google-cloud-analysis), [DEHA Magazine](https://deha.co.jp/magazine/cloud-2026/))
- **focus-you 本体を AWS/Azure に「丸ごと」移行するのは過剰投資**。Vercel(or Cloudflare) + Supabase ベースを維持し、AWS/Azure は **学習用サブPJ** で触るのが最小リスク。
- **学習コストはどちらも個人なら月 $0〜$15** に収まる。Amplify / Static Web Apps / S3+CloudFront はいずれも無料枠が手厚い。「触るだけで赤字」のリスクは GuardDuty を有効化したまま放置するパターン等、特定サービスの無自覚利用に限られる。([AWS Amplify Pricing](https://aws.amazon.com/amplify/pricing/), [Azure Static Web Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/static/))
- **「両方触れ」は理想だが現実非推奨**。インフラ初心者がいきなり2クラウドを並走するとどちらも消化不良になる。**最初の3〜6ヶ月は1つに絞り、認定をマイルストーンとして使う**のが王道。
- 結論の方向性: **「日本のエンプラDX案件に入るなら Azure を主軸、副軸で AWS の SAA」がコスパ最良**。逆に「グローバルSaaSや AI スタートアップ寄り」なら AWS 主軸 + Azure は教養レベル。社長は受託コンサル・フリーランスで日本市場が射程なので、本レポートの推奨は **Azure 主軸**。ただし最終判断は §10 の壁打ち問いで詰める。

---

## 1. 評価軸（5観点）と本レポートの構成

| 軸 | 何を見るか | 本文セクション |
|---|---|---|
| **A. コスト** | focus-you 規模を載せた場合の月額。学習だけの場合の月額 | §3, §4 |
| **B. 学習効果** | 個人開発で得た知識のエンプラ案件への転用度 | §5 |
| **C. 大企業DX観点の戦闘力** | 案件頻出サービス、認定の威力、案件単価 | §6, §7 |
| **D. セキュリティ標準装備度** | 主要サービスの揃い方、デフォルトの強度 | §8 |
| **E. 移行容易性** | 現構成（Supabase）からの摩擦 | §9 |

---

## 2. focus-you 現状アーキテクチャの再確認（前提合わせ）

| レイヤ | 現状 | 想定移行先候補 |
|---|---|---|
| Frontend (React/Vite SPA) | Vercel | AWS Amplify / S3+CloudFront / Azure Static Web Apps |
| Backend ロジック | Supabase Edge Function (Deno) | Lambda / Functions / App Runner / Container Apps |
| OLTP DB | Supabase PostgreSQL (RLS) | RDS for PostgreSQL / Azure Database for PostgreSQL |
| 認証 | Supabase Auth (ES256 publishable key) | Cognito / Microsoft Entra External ID |
| Realtime | Supabase Realtime | API Gateway WebSocket / Azure SignalR |
| ベクター検索 | pgvector | OpenSearch / Azure AI Search |
| LLM | OpenAI gpt-5-nano（Edge Function 経由） | Bedrock / Azure OpenAI |

「移行候補」とは書いたが、§9 で論じる通り **focus-you 本体を移行する必然性はない**。「学習で触る場合、こことここが対応する」という対応表として読む。

---

## 3. 価格比較 — focus-you 規模を載せたら何円か

### 3.1 試算前提（共通）

- 為替: $1 = 150円
- focus-you 規模: 100 MAU、月20万PV、SPAサイズ50MB、API呼び出し50万回/月、データ転送10GB/月（控えめ）
- 学習用「動かすだけ」規模: 月数百PV、データ転送1GB/月以下
- LLM/DB は Supabase + OpenAI 維持（移行しない）
- 月額は AWS/Azure 公式ドキュメントの公開価格に基づく試算（実額は使い方で変動）

### 3.2 学習用（動かすだけ・最小構成）月額

| 構成 | AWS | Azure | 補足 |
|---|---|---|---|
| 静的ホスト+CDN+独自ドメイン | **$1〜$2/月**（S3+CloudFront、Route 53 $0.50/zone）= 約**150〜300円** | **$0/月**（Static Web Apps Free） = 約**0円** | Azure 無料枠が圧倒的に有利。Amplify Hosting も12ヶ月無料枠あり |
| TLS証明書 | 無料（ACM） | 無料（SWA 内蔵） | 両方無料 |
| 認証（〜100 MAU） | **$0**（Cognito Lite 10K MAU 無料枠） | **$0**（Entra External ID 50K MAU 無料枠） | 両方無料、Azure の枠が広い |
| WAF（任意） | $5+$1/rule+$0.6/Mreq = 月**$6〜$30**（約 900〜4,500円） | Front Door Standard で月**約 $35**〜（約 5,250円〜） | AWS WAF の方が小規模では安い |
| **合計（WAFなし）** | **$0〜$2/月（0〜300円）** | **$0/月** | Azure SWA は事実上タダ |
| **合計（WAF込み）** | **$6〜$32/月（900〜4,800円）** | **$35+/月（5,250円+）** | WAF を入れると差が出る |

ソース: [AWS Amplify Pricing](https://aws.amazon.com/amplify/pricing/) / [S3 Pricing](https://aws.amazon.com/s3/pricing/) / [CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/) / [Cognito Pricing](https://aws.amazon.com/cognito/pricing/) / [AWS WAF Pricing](https://aws.amazon.com/waf/pricing/) / [Azure Static Web Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) / [Azure Front Door Pricing](https://azure.microsoft.com/en-us/pricing/details/frontdoor/)

**ポイント**:
- **学習目的なら Azure SWA Free が圧勝**（$0、SLAなしだが学習に問題なし）
- AWS は S3+CloudFront も Amplify Hosting も「数百円/月」レンジ
- WAF を本気で入れると AWS の方が小さい構成では安い（Azure Front Door Standard は月 $35〜のミニマムが効く）

### 3.3 focus-you 本体規模（100 MAU）月額

| 構成要素 | AWS | Azure |
|---|---|---|
| Frontend ホスト+CDN | $1〜$5（S3+CloudFront） / Amplify $5〜$15 | Static Web Apps Free $0 / Standard **$9** |
| Backend (バッチ・API) | Lambda 月$0.5以下（実質無料枠内） / App Runner $5〜$8 | Functions 消費プラン 月$0〜数ドル / Container Apps 無料枠内に収まる可能性高い |
| 認証 | Cognito $0（10K MAU 無料） | Entra External ID $0（50K MAU 無料） |
| DB | **Supabase 維持**（移行しない） | **Supabase 維持** |
| WAF | $6〜$30 | $35+（Standard） / Premium $300+ |
| **WAFなし合計** | **$6〜$28/月（約 900〜4,200円）** | **$0〜$15/月（約 0〜2,250円）** |
| **WAFあり合計** | **$15〜$60/月（約 2,250〜9,000円）** | **$35〜$60/月（約 5,250〜9,000円）** |

ソース: [AWS App Runner](https://aws.amazon.com/apprunner/pricing/) / [AWS Lambda](https://aws.amazon.com/lambda/pricing/) / [Azure Container Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/) / [App Service Static](https://azure.microsoft.com/en-us/pricing/details/app-service/static/)

**ポイント**:
- 100 MAU 規模なら **WAF抜きでどちらも月 $30 以下** に収まる
- Azure SWA Standard は **$9/app/月固定**で SLA・カスタム認証連携・10GB ストレージ・1TB 帯域がついてくる。コスパは抜群
- AWS Lambda + S3+CloudFront は「使った分だけ」で実質月数ドル、無料枠で済むケースも多い
- App Runner は 2026年現在 **メンテナンスモード**との情報あり（[Northflank](https://northflank.com/blog/aws-app-runner-alternatives)）。新規採用は Lambda or ECS Fargate 推奨

### 3.4 中規模（1,000 MAU）に伸びたら

| 要素 | AWS 概算 | Azure 概算 |
|---|---|---|
| Frontend ホスト+CDN | $10〜$30 | SWA Standard $9 + Front Door $35〜 |
| Backend | Lambda $5〜$30 / App Runner $20〜$50 / Fargate $20〜$80 | Functions $5〜$30 / Container Apps $10〜$50 |
| 認証 | Cognito $0（10K MAU 無料枠内） | Entra External ID $0（50K MAU 無料枠内） |
| WAF | $30〜$80 | $50〜$200 |
| GuardDuty / Defender for Cloud | $30〜$100 | Defender Standard $15/server〜 |
| **合計目安** | **$75〜$240/月（約 11,000〜36,000円）** | **$120〜$300/月（約 18,000〜45,000円）** |

ソース: [GuardDuty Pricing](https://aws.amazon.com/guardduty/pricing/) / [Cloud Burn GuardDuty calc](https://cloudburn.io/blog/amazon-guardduty-pricing) / [Microsoft Defender for Cloud](https://azure.microsoft.com/en-us/pricing/details/defender-for-cloud/)

**1,000 MAU でも、focus-you は Vercel+Supabase で組んだ方がトータル安い可能性が高い**（Vercel Pro $20/月 + Supabase Pro $25/月 = $45/月）。AWS/Azure に動かすのは「DX案件で語れる経験を積む」目的に限定すべき。

---

## 4. 価格比較 — 学習プラットフォームとして使う場合

### 4.1 「事故らない」運用ルール（両クラウド共通）

| 事故 | 対策 |
|---|---|
| 無料枠超過の自動課金 | Budget アラート（AWS Billing / Azure Cost Management）で **$5 / $10 / $30** の3段階通知を必ず設定 |
| GuardDuty / Defender 自動有効化忘れ | 触る前に「**学習用は無効化**」を確認。本気の検証期だけ有効化し、終わったら止める |
| Public S3 バケット課金事故 | パブリック書き込み禁止のデフォルトを変えない |
| App Runner / Container Apps の常時起動 | 学習が終わったら Pause か Delete を毎回習慣化 |
| KMS カスタムキー放置 | $1/月/key、削除はスケジュール（7日待機）必須 |

ソース: [AWS Budgets](https://aws.amazon.com/aws-cost-management/aws-budgets/) / [Azure Cost Management](https://azure.microsoft.com/en-us/products/cost-management) / [AWS Secrets Manager / KMS Pricing](https://aws.amazon.com/secrets-manager/pricing/)

### 4.2 学習限定なら月額目安

| 期間 | 想定構成 | AWS | Azure |
|---|---|---|---|
| 月1〜10時間触る | サインアップして触るだけ。リソース消したり止めたりする | **$0〜$3/月** | **$0〜$2/月** |
| 月20〜40時間 | サブPJで小規模 SaaS 構築。常時稼働1サービス | **$5〜$20/月** | **$5〜$15/月** |
| 認定試験勉強の集中期 | 検証用VPC/VNet複数、IaC試行 | **$15〜$50/月** | **$10〜$40/月** |

**結論**: **学習目的なら月 $50 以下に十分収まる**。事故るとしたら「自動有効化された GuardDuty / Defender を放置」「踏み台 EC2/VM を消し忘れ」が代表パターン。Budget アラート 3段階で防御。

---

## 5. 学習効果 — 個人開発の知識はエンプラに転用できるか

### 5.1 「個人開発で身につく知識」と「エンプラ案件で必要な知識」のギャップ

| 知識領域 | 個人開発で得られるか | エンプラで必須か | ギャップの埋め方 |
|---|---|---|---|
| **基本サービス**（コンピュート・ストレージ・DB） | ◎ | ◎ | 個人開発で十分 |
| **IAM / 権限設計** | △（自分用なので雑になりがち） | ◎ 最重要 | 認定（SAA / AZ-104）の学習で補う |
| **ネットワーク**（VPC / VNet / サブネット / プライベートエンドポイント） | × | ◎ 最重要 | 認定（SAA / AZ-104）+ Workshop / Hands-on Lab |
| **マルチアカウント / Landing Zone** | × | ◎ 大企業必須 | Workshops 受講、AWS Control Tower / Azure Landing Zone を構築する経験。個人ではほぼ不可能 |
| **オンプレ接続**（Direct Connect / ExpressRoute） | × | ◎ 大企業必須 | 案件入って初めて触る領域。学習は概念止まり |
| **コスト管理 / FinOps** | △ | ◎ | Cost Explorer / Cost Management を毎月眺める習慣化 |
| **セキュリティサービス** | △ | ◎ | 認定（Security Specialty / AZ-500）+ ハンズオン |
| **CI/CD / IaC**（Terraform / Bicep / CloudFormation） | ○ | ◎ | 個人 PJ で IaC で組み直せば近い |
| **監視・ログ**（CloudWatch / Azure Monitor） | △ | ◎ | 個人 PJ で意識的に設定する |
| **データ分析基盤**（Snowflake / Databricks / Fabric） | data-platforms-2026 で別途学習中 | ◎ DXコンサルでは ML/AI と並ぶ最重要領域 | 既に着手 |

**結論**: **個人開発だけで身につく知識は全体の30〜40%程度**。残り60〜70%は「認定の学習」「Workshop / Hands-on Lab」「実際の案件」で補う必要がある。**個人開発はあくまで「サービスに親しむ・指が動く・公式ドキュメントを読む癖をつける」入り口**として位置づけるべき。

### 5.2 学習リソース比較

| カテゴリ | AWS | Azure |
|---|---|---|
| 公式無料コース | [AWS Skill Builder](https://aws.amazon.com/training/digital/) 600+コース無料 | [Microsoft Learn](https://learn.microsoft.com/) 全コンテンツ無料 |
| ハンズオン | AWS Cloud Quest（RPGスタイル）, Builder Labs, Workshops | Microsoft Learn Sandbox（無料VM）, AZ-104 Lab |
| 認定模試 | Skill Builder 有料サブスク（$29/月） | Microsoft Learn 公式練習問題 |
| 日本語コンテンツ | BlackBelt（YouTube無料）、Skill Builder日本語あり | Microsoft Learn ほぼ全て日本語化済み |
| コミュニティ | JAWS-UG（地域支部多数） | Japan Azure User Group（JAZUG） |

**Azure の方が「日本語ハンズオンの完成度」と「公式無料リソースで完結する度合い」が高い**。AWS は英語前提だがコンテンツの厚みは圧倒的。

### 5.3 学習ロードマップ案（1ヶ月 / 3ヶ月 / 6ヶ月）

#### Azure 主軸ルート（推奨）

| 期間 | 何をやるか | 目標 |
|---|---|---|
| **1ヶ月（Week 1〜4）** | Microsoft Learn の AZ-900 ラーニングパス完走 + focus-you サブPJ を SWA Free にデプロイ | AZ-900 受験 or Skip |
| **3ヶ月（Month 2〜3）** | AZ-104 学習（VNet / Storage / Compute / Identity / Monitor）+ Bicep で IaC 化 | **AZ-104 受験合格** |
| **6ヶ月（Month 4〜6）** | AZ-305（アーキテクチャ）か AZ-500（セキュリティ）に分岐 + Defender for Cloud / Sentinel 体験 | **AZ-305 or AZ-500 受験** |

#### AWS 主軸ルート（副軸候補）

| 期間 | 何をやるか | 目標 |
|---|---|---|
| **1ヶ月** | Skill Builder の Cloud Practitioner Essentials + S3+CloudFront に focus-you サブPJ デプロイ | CLF 受験 or Skip |
| **3ヶ月** | SAA-C03 学習（VPC / EC2 / S3 / RDS / Lambda / IAM / well-architected）+ Terraform で IaC 化 | **SAA 受験合格** |
| **6ヶ月** | SAP-C02（Pro）か Security Specialty に分岐 + GuardDuty / Security Hub 体験 | **SAP or SCS 受験** |

ソース: [Azure 認定資格ロードマップ 2026 - MyExamCloud](https://www.myexamcloud.com/blog/azure-certification-roadmap-2026-az900-az104-az305.article) / [AWS Certification Roadmap 2026](https://k21academy.com/aws-cloud/aws-certification-roadmap/) / [Azure 認定資格 一覧 - meister-kentei](https://meister-kentei.jp/magazine/qualifying/6230/)

#### 「両方やる」場合の現実的プラン

最初の **3ヶ月は1つに集中**し、関連認定（SAA or AZ-104）取得後、もう片方の **エントリー資格（CLF or AZ-900）を1〜2週間で短期学習** するのが消化不良を避ける王道。

---

## 6. 大企業DX観点の戦闘力

### 6.1 日本市場のシェアと案件分布（重要）

- **日本のクラウドシェア（2026推定）**: Azure 49% / AWS 31% / GCP 20%（[Programming Helper 2026](https://www.programming-helper.com/tech/cloud-computing-market-share-2026-aws-azure-google-cloud-analysis)）
- **グローバル**: AWS 29% / Azure 22% / GCP 12%（[Synergy Research 2025Q1, 引用元 Publickey](https://www.publickey1.jp/blog/25/aws30azure2220251synergy_research.html)）
- **業種別の傾向**:
  - **AWS が強い**: テック企業、スタートアップ、ゲーム、メディア、グローバル展開企業
  - **Azure が強い**: 金融、官公庁、教育機関、製造業（特に Microsoft 365 既存ユーザー）、エンタープライズIT全般
- **ISMAP（政府情報システムのクラウドセキュリティ評価）**: AWS / Azure / GCP / Oracle / 国産勢が登録。日本の公共・準公共は ISMAP 登録が事実上必須

ソース: [DEHA Magazine 2026](https://deha.co.jp/magazine/cloud-2026/) / [ITA Japan Cloud Computing](https://www.trade.gov/country-commercial-guides/japan-cloud-computing) / [総務省 情報通信白書 R6](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r06/html/nd218200.html)

### 6.2 案件単価感（フリーランス / 業務委託、日本市場）

| カテゴリ | AWS | Azure |
|---|---|---|
| 初級（経験1〜2年） | 月 25〜45万円 | 月 30〜50万円（案件少ない分、競合少ない） |
| 中級（3〜5年・SAA持ち） | 月 60〜80万円 | 月 60〜85万円 |
| 上級（設計・移行リード・SAP/AZ-305持ち） | 月 80〜120万円 | 月 80〜130万円 |
| AI/ML 掛け合わせ（Bedrock / Azure OpenAI） | 月 90〜150万円 | 月 90〜150万円（特に Microsoft AI Tour 後需要急増） |

ソース: [bizdev-tech 2026 AWSフリーランス](https://bizdev-tech.jp/aws-freelance/) / [freelance-start AWS案件相場](https://freelance-start.com/articles/38) / [infla-lab クラウドエンジニア年収](https://infla-lab.com/blog/cloud-engineer-annual-income/) / [xnetwork クラウドエンジニア単価](https://www.xnetwork.jp/contents/cloud-engineer-unitprice)

**案件単価のトレンド**:
- 「**国内ではAWS案件数が最も多く、フリーランス単価・転職市場の年収水準ともにAWSがやや有利**」（[bizdev-tech 2026]）
- 「**大手企業や官公庁系ではAzure採用も拡大しており、Azureエンジニアは競合が少ない分、専門性を評価されて高年収につながる**」（同）
- **Bedrock / Azure OpenAI など AI 掛け算スキルは2026年に月100万円超案件が現実的**

### 6.3 大企業DXで頻出する「上位サービス」

#### AWS（エンプラ DX 案件で必ず出る）

| サービス | 用途 | 個人で触れる難易度 |
|---|---|---|
| **AWS Organizations** | 複数アカウント管理、SCP（Service Control Policy） | △ 個人で複数アカウント作れば触れる |
| **AWS Control Tower / Landing Zone** | マルチアカウントのガバナンス自動構築。750+ Managed Controls | × 個人ではほぼ不可（複数アカウント前提のセットアップが重い） |
| **AWS IAM Identity Center**（旧 SSO） | エンプラのフェデレーション認証 | △ Azure AD 連携を試せば近い経験 |
| **VPC + Transit Gateway** | エンプラのネットワーク統合 | △ 概念学習はできるが本物のスケールは無理 |
| **Direct Connect** | オンプレ専用線接続 | × 案件入らないと触れない |
| **Security Hub / GuardDuty / Config / CloudTrail** | セキュリティ統合監視 | ○ 個人でも触れる |
| **CloudFormation / CDK** | IaC 標準 | ○ 個人で組める |

ソース: [AWS Control Tower](https://aws.amazon.com/controltower/) / [AWS Control Tower Features](https://aws.amazon.com/controltower/features/)

#### Azure（エンプラ DX 案件で必ず出る）

| サービス | 用途 | 個人で触れる難易度 |
|---|---|---|
| **Microsoft Entra ID**（旧 Azure AD） | エンプラ ID/SSO の事実上の標準 | ◎ Microsoft 365 アカウントで実質常用 |
| **Microsoft Entra External ID** | 顧客向け認証（B2C 後継） | ◎ 個人 PJ にも使える |
| **Azure Landing Zone** | マルチサブスクリプション統合 | △ 個人ではセットアップ重い |
| **Microsoft 365 連携**（Teams / SharePoint / Power Platform） | Microsoft 365 と直接連携 | ◎ Microsoft 365 持っていれば触れる |
| **Microsoft Purview** | データガバナンス（データカタログ・リネージ・分類） | △ ライセンス重い |
| **Microsoft Sentinel** | SIEM/SOAR、エンプラ SOC で標準採用 | △ ログ取り込みでコスト発生 |
| **Microsoft Defender for Cloud** | CSPM、Multi-cloud セキュリティ | ◎ 試用できる |
| **Bicep / ARM Template** | IaC 標準 | ○ 個人で組める |
| **Microsoft Fabric / Synapse** | データ分析基盤（[data-platforms-2026/04-fabric-handson.md](./04-fabric-handson.md) 参照） | ○ Trial でハンズオン可 |

ソース: [Microsoft Secures AI Agents - Techzine](https://www.techzine.eu/news/security/139821/microsoft-secures-ai-agents-with-defender-entra-and-purview/) / [Microsoft Sentinel RSAC 2026](https://techcommunity.microsoft.com/blog/microsoftsentinelblog/what%E2%80%99s-new-in-microsoft-sentinel-rsac-2026/4503971) / [Yamashita 事例](https://www.microsoft.com/ja-jp/customers/story/22430-yamashita-co-ltd-azure) / [日清製粉 Fabric 事例](https://www.microsoft.com/ja-jp/customers/story/26328-nisshin-flour-milling-microsoft-fabric)

### 6.4 「Microsoft 365 親和性」という Azure 最大の武器

日本の大企業 DX で **Azure が選ばれる単一最大の理由**:
- **Microsoft 365（旧 Office 365）が既に入っている**ので、Entra ID の SSO・Teams 連携・SharePoint との接続がゼロ追加コスト
- DX プロジェクトの「ID/権限の起点」が既に Entra ID にあるので、データ基盤・アプリ・分析を Azure に寄せると統合が滑らか
- **Microsoft Agent 365（2026-05 GA予定）** は Defender + Entra + Purview を統合した AI Agent 統制プラットフォームで、エンプラの「エージェント解禁」のデフォルト経路になりそう（[SiliconANGLE](https://siliconangle.com/2026/03/22/microsoft-outlines-agentic-ai-security-strategy-new-defender-entra-purview-capabilities/)）

**逆に、Microsoft 365 を使っていない企業（多くはテック・スタートアップ）では Azure 優位は崩れ、AWS / GCP の選択になる**。社長の射程市場（受託・コンサル・フリーランスで日本のエンプラ）では、Microsoft 365 ベース企業が圧倒的多数なので Azure 親和性が効く。

---

## 7. 認定資格の威力比較

### 7.1 主要認定とパス

| クラウド | エントリー | アソシエイト | プロフェッショナル/エキスパート | スペシャリティ |
|---|---|---|---|---|
| **AWS** | CLF（Cloud Practitioner） | **SAA**（Solutions Architect Associate）/ DVA / SOA | **SAP**（Solutions Architect Professional）/ DOP | **SCS**（Security Specialty）/ Advanced Networking / ML Specialty / AI Practitioner（2026 新設） |
| **Azure** | AZ-900 | **AZ-104**（Administrator）/ AZ-204（Developer）/ AZ-500（Security） | **AZ-305**（Solutions Architect Expert）/ AZ-400（DevOps Expert） | AI-102 / DP-203 / SC-200 など |

ソース: [AWS Certification Path 2026](https://k21academy.com/aws-cloud/aws-certification-roadmap/) / [Azure Certification Roadmap 2026](https://www.myexamcloud.com/blog/azure-certification-roadmap-2026-az900-az104-az305.article) / [AWS January 2026 Updates](https://aws.amazon.com/blogs/training-and-certification/january-2026-new-offerings/)

### 7.2 認定のグローバル平均年収（参考、円換算は $1=150円）

| 認定 | グローバル平均年収（USD） | 円換算 | 出典 |
|---|---|---|---|
| AWS SAA | $125,000 | 約 1,875万円 | [Novelvista](https://www.novelvista.com/blogs/cloud-and-aws/aws-certification-salary) |
| AWS SAP | $155,000 | 約 2,325万円 | [Novelvista](https://www.novelvista.com/blogs/cloud-and-aws/aws-certification-salary) |
| AWS Security Specialty | $158,594 | 約 2,380万円 | [Sailor.sh](https://sailor.sh/blog/aws-security-specialty-salary-2026/) |
| Azure AZ-104 | $90,000〜$140,000 | 約 1,350〜2,100万円 | [PassItExams AZ-104](https://passitexams.com/articles/az-104-certification-cost-salary-and-jobs/) |
| Azure AZ-305 | $130,000〜$200,000 | 約 1,950〜3,000万円 | [PassItExams highest-paying](https://passitexams.com/articles/highest-paying-microsoft-azure-certifications/) |
| Azure AZ-500 | 中央値 $176,000 | 約 2,640万円 | [PassItExams highest-paying] |

**注意**: これは**正社員のグローバル平均**。日本のフリーランス案件単価（§6.2）と単純比較できない。

### 7.3 認定の「履歴書効果」

| 認定 | 案件獲得への効果 |
|---|---|
| **AWS CLF / Azure AZ-900** | 「触ったことあります」の証明。単独では弱い。エントリー段階では有用 |
| **AWS SAA / Azure AZ-104** | **最初の本命**。これがあると「クラウドエンジニア」として案件にエントリーできる |
| **AWS SAP / Azure AZ-305** | 設計リード、移行プロジェクトのリード案件で要求される。単価1段上がる |
| **AWS Security Specialty / Azure AZ-500** | セキュリティ案件の門札。**金融・公共では SC-200 / AZ-500 がほぼ必須** |
| **AWS DOP / Azure AZ-400** | DevOps 案件、CI/CD 移行案件で強い |

**結論**: **学習の進捗指標として認定は強力**。「6ヶ月で SAA / AZ-104」は明確なマイルストーンになる。だが「認定だけで案件獲得」は無理。**実務経験 + 認定 + ポートフォリオ（個人 PJ）の3点セット**が必要。

---

## 8. セキュリティ標準装備度

### 8.1 主要セキュリティサービス対応表

| 機能 | AWS | Azure | コメント |
|---|---|---|---|
| **ID/認証/SSO** | IAM / IAM Identity Center / Cognito | Entra ID / Entra External ID | Azure はエンプラ ID の事実上の標準。AWS は IAM が強力 |
| **WAF** | AWS WAF（$5/ACL + $1/rule + $0.6/Mreq） | Front Door + WAF（Standard $35〜 / Premium $300〜） | 小規模は AWS が安い |
| **DDoS** | Shield Standard（無料）/ Advanced（$3,000/月+ 1年契約） | DDoS Protection Standard 月数千円〜 | 個人では Shield Standard / DDoS Standard で十分 |
| **脅威検知** | GuardDuty（$10〜$100/月、ログ量次第） | Defender for Cloud（$15/server/月〜） | どちらも従量課金、油断すると高い |
| **シークレット管理** | Secrets Manager（$0.40/secret/月）/ Parameter Store（無料） | Key Vault（$0.03/10K操作） | 学習なら Parameter Store / Key Vault Free Tier で十分 |
| **暗号鍵管理** | KMS（AWS-managed 無料、Customer-managed $1/月/key） | Key Vault（同上） | 同等 |
| **SIEM / SOAR** | Security Hub + 3rd Party | Microsoft Sentinel（エンプラ SOC 標準） | Sentinel の方がエンプラで主流 |
| **ガバナンス** | Control Tower / Config / Organizations SCP | Azure Policy / Landing Zone / Purview | Azure Policy は無料で使えて入りやすい |
| **コンプライアンス** | Audit Manager / Artifact | Compliance Manager / Purview | Purview が DX 案件で頻出 |

ソース: [AWS WAF Pricing](https://aws.amazon.com/waf/pricing/) / [AWS Shield Pricing](https://aws.amazon.com/shield/pricing/) / [GuardDuty Pricing](https://aws.amazon.com/guardduty/pricing/) / [Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/) / [Azure Front Door Pricing](https://azure.microsoft.com/en-us/pricing/details/frontdoor/) / [Azure Key Vault Pricing](https://infisical.com/blog/azure-key-vault-pricing) / [Azure Container Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/)

### 8.2 デフォルトの安全度

- **AWS**: 「最初は何も入っていない、自分で入れる」がデフォルト。GuardDuty / WAF / Shield Advanced は明示的に有効化が必要。**個人開発者には自由度が高い反面、忘れると無防備**
- **Azure**: 「Defender for Cloud Free Tier がデフォルト有効」「Entra ID の MFA / Conditional Access が標準提案される」など、デフォルトが少し高い。**初心者には親切だが、Defender Standard を有効化したまま放置すると課金される**

### 8.3 「セキュリティを意識する」観点での学習価値

**両方触ると視野が広がる**が、**1つに絞るなら焦点を:**
- **AWS Security Specialty ルート** = IAM / KMS / GuardDuty / Security Hub / WAF を深掘り。**スタートアップ・テック企業のセキュリティ案件**で武器
- **Azure AZ-500 ルート** = Entra ID / Conditional Access / Defender / Sentinel / Purview を深掘り。**金融・公共・大手 SIer の SOC 案件**で武器

社長の射程市場（日本のエンプラDX）では、**Azure AZ-500 → AZ-305 が認定 ROI の頂点**になる可能性が高い。ただし AWS Security Specialty を持っているとマルチクラウド案件で重宝される。

---

## 9. focus-you 現構成（Supabase）からの移行容易性

### 9.1 移行の基本パターン（AWS）

[Bytebase の移行ガイド](https://www.bytebase.com/blog/how-to-migrate-from-supabase-to-aws/) と [Encore Cloud](https://encore.cloud/resources/migrate-supabase-to-aws) のサービスファースト方式に従うと:

| 順序 | Supabase | AWS 対応 | 摩擦 |
|---|---|---|---|
| 1 | Networking / IAM | VPC + Subnets + IAM Roles | 中（ネットワーク設計が必要） |
| 2 | Auth | Cognito へ移行 | **高**（RLS の `auth.uid()` が動かなくなる、ポリシー全書き換え） |
| 3 | Storage | S3 へ移行 | 低 |
| 4 | Edge Functions | Lambda へ書き換え | 中（Deno → Node.js への書き換え） |
| 5 | Database | RDS for PostgreSQL（pg_dump → pg_restore） | 低 |
| 6 | Realtime | API Gateway WebSocket / AppSync subscriptions 自前実装 | **高**（Supabase Realtime の DB 変更購読を再構築） |
| 7 | pgvector | pgvector on RDS で継続 / OpenSearch | 低 |

### 9.2 Azure の場合

ほぼ同じ構造で、Cognito → Entra External ID、Lambda → Functions、S3 → Blob Storage、RDS → Azure Database for PostgreSQL、Realtime → Azure SignalR + Postgres Logical Replication 自前。**Azure は「Supabase からの移行ガイド」の公式・準公式ドキュメントが AWS よりも少ない**点がやや弱い。

### 9.3 「移行」する意味があるか

**結論: focus-you 本体の移行は推奨しない**。理由:
- Supabase が提供している「**Auth + Realtime + RLS + Edge Function + Postgres + pgvector のフルスタック**」を AWS / Azure で再構築するエンジニアリング負債が SaaS の MRR を食い尽くす
- 移行で得られる「学習価値」は、**focus-you とは別の小プロジェクトで AWS/Azure を触れば代替可能**
- Vercel + Supabase 構成は MAU 1,000 程度までなら**コスト・運用負荷ともに圧勝**

**唯一の例外**: B2B 案件で「弊社は Azure / AWS 限定」「Supabase は使わせられない」という制約が来た場合。その時は focus-you 本体ではなく**派生プロダクト**を Azure/AWS で組む。

---

## 10. 比較マトリクス（総合）

| 観点 | AWS | Azure | 社長の射程市場での優位 |
|---|---|---|---|
| 学習だけの月額 | $0〜$3 | $0〜$2 | **Azure** がわずかに安い |
| 100 MAU 規模の月額 | $6〜$28（WAFなし） | $0〜$15（WAFなし） | **Azure** SWA Standard $9 が抜群 |
| 1,000 MAU 規模の月額 | $75〜$240 | $120〜$300 | AWS が若干安い、ただし両方とも Vercel+Supabase より高い |
| サービスの幅 | ◎（最大手） | ○（追随中） | AWS |
| ドキュメント・コミュニティ | ◎ 英語含めれば最強 | ○ 日本語の充実度が高い | 用途次第 |
| 学習リソース無料度 | ◎ Skill Builder 600+コース | ◎ Microsoft Learn 完全無料 | 互角 |
| 認定の威力（日本） | ◎ SAA は事実上の標準 | ◎ AZ-104 / AZ-305 は金融・公共で強い | **Azure**（社長射程） |
| エンタープライズ案件の親和性 | ○ | ◎ Microsoft 365 連携、Entra ID 標準 | **Azure**（社長射程） |
| スタートアップ・テック親和性 | ◎ | ○ | AWS |
| 日本市場シェア | 31% | **49%** | **Azure** |
| グローバル市場シェア | **29%** | 22% | AWS |
| AI/LLM 統合 | Bedrock | Azure OpenAI（OpenAI 公式提携） | 互角、案件需要は両方急増 |
| セキュリティサービス標準装備度 | 自由度高、自分で組む | デフォルトが少し高い | 用途次第 |
| Supabase からの移行情報の充実度 | ○ | △ | AWS |
| **総合（社長の射程市場 = 日本エンプラ DX）** | **副軸** | **主軸** | — |

---

## 11. 「学習プラットフォーム」としての評価

### 11.1 個人開発を踏み台にする3つのアプローチ

| アプローチ | 内容 | 推奨度 |
|---|---|---|
| **A. focus-you 本体を AWS/Azure に移行** | 痛みが多い、学習効果に対してコスパ悪い | ★ |
| **B. focus-you 本体は Vercel/Supabase 維持、AWS/Azure は学習用サブPJで触る** | 本命。週末プロジェクトで小さな SaaS を組む | ★★★★★ |
| **C. focus-you 本体に AWS/Azure の単機能だけ統合**（例: 画像保存だけ S3、認証だけ Entra External ID） | 局所的な学習。実務寄りの経験になる | ★★★★ |

### 11.2 サブPJのアイデア（AWS/Azure 別）

#### Azure 主軸サブPJ案

1. **「Microsoft 365 連携の社内向け感情分析ダッシュボード」** = Static Web Apps + Functions + Entra ID SSO + Cosmos DB。日本のエンプラで頻出する「M365 連携」を体感できる
2. **「focus-you データの BI 可視化」** = Fabric の OneLake に CSV を流し、Power BI で可視化。data-platforms-2026 と統合
3. **「Defender for Cloud 体験ラボ」** = 意図的に弱い構成を作って Defender が何を検知するかを観察

#### AWS 主軸サブPJ案

1. **「サーバーレス API ポートフォリオ」** = API Gateway + Lambda + DynamoDB + Cognito。SAA / DVA の典型題材
2. **「Bedrock を使った日記要約 Bot」** = Claude on Bedrock + Lambda + S3。AI/LLM 案件単価帯の経験になる
3. **「IaC で Landing Zone 模倣」** = Organizations + Control Tower の縮小版を CloudFormation で組む。SAP の典型題材

---

## 12. 限界の明示（必読）

### 12.1 本レポートの不確実性

- **料金は2026年4月時点の公開価格**。為替変動（$1=150円換算）、AWS/Azure 双方の頻繁な料金改定、リージョン差異により実額はブレる
- **「学習効果」「案件単価」は個人差が極めて大きい**。経験年数・他スキル（特に AI/データ・要件定義・英語）との掛け算で 2倍〜3倍 変動する
- **「日本市場シェア 49% Azure / 31% AWS」は調査会社により数字が異なる**。Synergy Research（グローバル）と日本独自調査（DEHA Magazine 等）で集計範囲が違う点に注意。本レポートは「Azure が日本のエンプラで強い」というトレンド方向の指針として読む
- **「焦点」は社長の射程市場（日本のエンプラ受託・コンサル・フリーランス）に基づく**。スタートアップやグローバル展開を主戦場にするなら、AWS 主軸推奨に逆転する
- **AI/LLM 周りは2026年中に大きく動く**。Bedrock / Azure OpenAI / Microsoft Agent 365 / AWS Cloud Quest の AI 統合などはレポート作成後 3ヶ月で大きく変わる可能性。半年に1回見直すのが妥当

### 12.2 公知情報だけでは決められない論点

- **社長の「学習に投下できる時間」**: 週末だけ vs 平日夜含む、で 1ヶ月 vs 3ヶ月の差は大きい
- **既存案件パイプラインに AWS / Azure 案件があるか**: 既に話が進んでいる案件があるならそちらを優先
- **法人化したときの「触る環境」**: Microsoft 365 を法人で契約するなら Azure 親和性がさらに上がる
- **Supabase と Vercel の継続意思**: 商用化フェーズで「自社管理に寄せたい」のか「マネージドに乗り続けたい」のか
- **「日本市場 vs グローバル市場」のどちらを 5 年スパンで見るか**: focus-you の英語版展開計画があるか

### 12.3 「AWS vs Azure」以外で検討すべき選択肢

本レポートは AWS と Azure に絞ったが、以下も視野に入る:

- **GCP**: AI/ML（Vertex AI / Gemini）に強い。日本シェアは20%と一定の存在感。データ分析（BigQuery）は世界クラス
- **Cloudflare**: フロントエンド + Workers + D1 + R2 で Vercel/AWS の対抗。料金が圧倒的に安い
- **Vercel + Supabase 維持 + 認定取得**: 今のスタックを変えず、AWS/Azure は認定+ハンズオンだけで知識補強。**最小投資・最小事故・最大効率**の選択肢

---

## 13. 壁打ち導線（社長が次に判断すべき問い）

社長が腹落ちして自分の解釈に昇華するための問いリスト。順番に答えてほしい。

### 13.1 戦略レベルの問い

1. **「主戦場は日本のエンプラ DX 案件で確定か？」**
   - YES → Azure 主軸 + AWS 副軸
   - NO（グローバル / スタートアップも視野） → AWS 主軸 + Azure 副軸 or 両方均等
2. **「focus-you の商用化はB2C個人向けで確定か、B2B 含むか？」**
   - B2C のみ → 現スタック（Vercel+Supabase）維持で十分
   - B2B 含む → 「弊社は Azure / AWS 限定」要求に対応する派生プロダクト を計画
3. **「最初の認定取得を 6ヶ月以内のマイルストーンに置くか？」**
   - YES → 認定をペースメーカーに学習設計
   - NO → 「触ったことある」レベルで止める。焦らない

### 13.2 戦術レベルの問い

4. **「focus-you 本体を移行する選択肢は本当に外していいか？」** → §9 の議論で「外す」推奨だが、社長の感覚を聞きたい
5. **「学習用サブPJを始めるとして、どのアイデアが一番ワクワクするか？」** → §11.2 のリストから1つ選ぶ
6. **「Microsoft 365 法人契約の予定はあるか？」** → あるなら Azure 親和性がさらに加速
7. **「AI/LLM（Bedrock / Azure OpenAI）を案件単価上げの武器にしたいか？」** → YES なら Bedrock or Azure OpenAI のハンズオンを認定学習と並走

### 13.3 実行レベルの問い

8. **「最初の3ヶ月の学習時間（週あたり）は何時間確保できるか？」**
   - 5時間以下 → AZ-900 / CLF までで止める
   - 10時間以上 → AZ-104 / SAA 受験を3ヶ月後に設定
9. **「Budget アラート $5/$10/$30 を最初に設定する習慣にするか？」** → YES（事故防止の前提）
10. **「学習ログをどこに残すか？」** → secretary/notes / company-dashboard / Zenn 公開、いずれにしても可視化

---

## 14. ネクストアクション（社長への提案）

### 即（今週中）

- [ ] §13 の問いリストに社長が回答 → リサーチ部にフィードバック
- [ ] 主軸クラウドを Azure / AWS のどちらにするか決定
- [ ] AWS / Azure の **無料アカウント登録**（まだなら）+ **Budget アラート $5/$10/$30 設定**

### 1ヶ月以内

- [ ] 主軸クラウドの **エントリー認定（CLF or AZ-900）** に着手 or Skip 判断
- [ ] focus-you 規模感の **学習用サブPJ アイデア** を §11.2 から1つ選定
- [ ] サブPJを Static Web Apps Free / S3+CloudFront に **デプロイして触る**（最低1回）

### 3ヶ月以内

- [ ] 主軸クラウドの **アソシエイト認定（AZ-104 or SAA-C03）** 受験
- [ ] サブPJで **IaC（Bicep or Terraform / CloudFormation）** を組む
- [ ] Defender for Cloud / GuardDuty を1日だけ有効化して **挙動を観察**（その後止める）

### 6ヶ月以内

- [ ] **AZ-305 or AZ-500（Azure）** / **SAP or SCS（AWS）** に進む or 副軸クラウドのエントリー認定
- [ ] 学習成果を **ポートフォリオ化**（GitHub / Zenn / company-dashboard の Blueprint に反映）
- [ ] 案件獲得への接続（フリーランスエージェント or 既存ネットワーク）

---

## 15. 関連レポート

- [`07-focus-you-production-platform.md`](./07-focus-you-production-platform.md) — focus-you をデータ基盤側でスケールさせる場合の評価（Snowflake / Databricks / Fabric）
- [`01-concept-comparison.md`](./01-concept-comparison.md) — データ基盤3強の思想比較
- [`04-fabric-handson.md`](./04-fabric-handson.md) — Microsoft Fabric ハンズオン（Azure 主軸ルートと連動）
- [`06-ai-integration/00-ai-landscape-2026.md`](./06-ai-integration/00-ai-landscape-2026.md) — Bedrock / Azure OpenAI を含む AI 統合ランドスケープ

---

## 16. 出典一覧

### AWS 価格・サービス

- [AWS Amplify Pricing](https://aws.amazon.com/amplify/pricing/)
- [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [Amazon CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)
- [AWS App Runner — メンテナンスモードの議論](https://northflank.com/blog/aws-app-runner-alternatives)
- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [AWS Pricing Calculator](https://calculator.aws/)
- [Amazon Cognito Pricing](https://aws.amazon.com/cognito/pricing/)
- [AWS WAF Pricing](https://aws.amazon.com/waf/pricing/)
- [AWS Shield Pricing](https://aws.amazon.com/shield/pricing/)
- [Amazon GuardDuty Pricing](https://aws.amazon.com/guardduty/pricing/)
- [AWS Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/)
- [AWS Control Tower](https://aws.amazon.com/controltower/) / [Features](https://aws.amazon.com/controltower/features/)

### Azure 価格・サービス

- [Azure Static Web Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/static/)
- [Azure App Service Pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/windows/)
- [Azure Container Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/)
- [Azure Front Door Pricing](https://azure.microsoft.com/en-us/pricing/details/frontdoor/)
- [Azure Key Vault Pricing 解説](https://infisical.com/blog/azure-key-vault-pricing)
- [Azure Static Web Apps Plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans)
- [Microsoft Defender for Cloud / Sentinel / Entra / Purview RSAC 2026](https://siliconangle.com/2026/03/22/microsoft-outlines-agentic-ai-security-strategy-new-defender-entra-purview-capabilities/)
- [Microsoft Sentinel RSAC 2026 update](https://techcommunity.microsoft.com/blog/microsoftsentinelblog/what%E2%80%99s-new-in-microsoft-sentinel-rsac-2026/4503971)

### 認定資格

- [AWS Certification Roadmap 2026 - Hakia](https://hakia.com/skills/aws-certifications-roadmap/)
- [AWS Certification Roadmap 2026 - K21Academy](https://k21academy.com/aws-cloud/aws-certification-roadmap/)
- [AWS Skill Builder](https://aws.amazon.com/training/digital/)
- [AWS January 2026 Certification Updates](https://aws.amazon.com/blogs/training-and-certification/january-2026-new-offerings/)
- [Azure Certification Roadmap 2026 - MyExamCloud](https://www.myexamcloud.com/blog/azure-certification-roadmap-2026-az900-az104-az305.article)
- [AZ-104 学習ガイド (Microsoft Learn)](https://learn.microsoft.com/ja-jp/credentials/certifications/resources/study-guides/az-104)
- [Microsoft 認定資格 難易度・学習時間（meister-kentei）](https://meister-kentei.jp/magazine/qualifying/6230/)
- [AWS 認定 Salary 2026 (Novelvista)](https://www.novelvista.com/blogs/cloud-and-aws/aws-certification-salary)
- [AWS Security Specialty Salary 2026 (Sailor.sh)](https://sailor.sh/blog/aws-security-specialty-salary-2026/)
- [Azure 認定 Salary（PassItExams）](https://passitexams.com/articles/highest-paying-microsoft-azure-certifications/)
- [AZ-104 Career Guide (mscertquiz)](https://mscertquiz.com/blog/is-az-104-worth-it)

### 市場シェア・案件単価

- [Cloud Computing Market Share 2026 - Programming Helper](https://www.programming-helper.com/tech/cloud-computing-market-share-2026-aws-azure-google-cloud-analysis)
- [DEHA Magazine 2026年クラウド市場](https://deha.co.jp/magazine/cloud-2026/)
- [Synergy Research 2025Q1（Publickey 引用）](https://www.publickey1.jp/blog/25/aws30azure2220251synergy_research.html)
- [総務省 情報通信白書 R6](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r06/html/nd218200.html)
- [ITA Japan Cloud Computing](https://www.trade.gov/country-commercial-guides/japan-cloud-computing)
- [bizdev-tech 2026 AWSフリーランス相場](https://bizdev-tech.jp/aws-freelance/)
- [freelance-start AWS案件相場](https://freelance-start.com/articles/38)
- [infla-lab クラウドエンジニア年収](https://infla-lab.com/blog/cloud-engineer-annual-income/)
- [xnetwork クラウドエンジニア単価](https://www.xnetwork.jp/contents/cloud-engineer-unitprice)

### Supabase からの移行

- [Bytebase: Supabase to AWS migration](https://www.bytebase.com/blog/how-to-migrate-from-supabase-to-aws/)
- [Encore Cloud: Migrate Supabase to AWS](https://encore.cloud/resources/migrate-supabase-to-aws)
- [Albert Kim: Supabase to RDS](https://www.albertkim.ca/blog/blog-07-how-to-migrate-from-supabase-to-rds)
- [Supabase to AWS RDS - Applogika (Medium)](https://medium.com/@contact_62664/migrating-from-supabase-to-aws-rds-a-practical-guide-b6513d98529b)

### Microsoft 365 / Fabric / Purview エンプラ事例

- [日清製粉 Fabric 事例](https://www.microsoft.com/ja-jp/customers/story/26328-nisshin-flour-milling-microsoft-fabric)
- [ヤマシタ Fabric 事例](https://www.microsoft.com/ja-jp/customers/story/22430-yamashita-co-ltd-azure)
- [Microsoft Fabric 概要 (AI 総合研究所)](https://www.ai-souken.com/article/microsoft-fabric-overview)
- [Microsoft AI Tour Tokyo 2026 レポート](https://www.ai-souken.com/article/microsoft-ai-tour-tokyo-2026-report)

---

```yaml
# handoff
handoff:
  - to: secretary
    context: "社長への壁打ち導線（§13 の問いリスト）を提示し、主軸クラウド（Azure or AWS）の意思決定を促す"
    tasks:
      - "§13.1 の戦略レベルの問い 3 問を社長に投げる"
      - "回答に応じて §14 のネクストアクション（即/1ヶ月/3ヶ月/6ヶ月）を tasks テーブルに登録"
      - "意思決定が出たら .company/secretary/notes/2026-04-17-decisions.md に記録"
  - to: pm
    context: "本レポートを成果物として artifacts テーブルに登録し、6ヶ月後（2026-10）に再評価タスクを設定"
    tasks:
      - "artifacts に title='AWS vs Azure 大企業DX観点比較レポート（2026-04）' で登録"
      - "tasks テーブルに『AWS vs Azure レポート再評価』を 2026-10-17 期限で登録"
```
