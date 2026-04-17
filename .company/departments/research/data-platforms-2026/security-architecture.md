# focus-you セキュリティ・アーキテクチャ調査と移行戦略 — 大企業DX案件で戦える知識への投資

**調査日**: 2026-04-17
**対象PJ**: focus-you（HD自社プロダクト、Vercel + Supabase、React/Vite SPA）
**調査依頼**: 個人開発から大企業DXまで通じるセキュリティ知識の体系化と、focus-youを学習場として活用する移行戦略

---

## TL;DR（結論先出し）

1. **focus-you の現状は「個人開発として標準的、商用化前にやるべきこと多数」**。Supabase RLS / Vercel Headers の最小設定はあるが、CSP・監査ログ・脅威モデリング・ログ保持戦略は未整備。
2. **「大企業DXで戦える」の解像度を上げる必要あり**。金融・公共・製造業では要求が大きく違う。仮説として **「金融・公共系SIerが受けるエンプラ案件」を狙うなら、IAM設計・暗号化（KMS/HSM/BYOK）・監査ログ設計・ネットワーク分離（VPC/Private Endpoint）・ゼロトラスト** がコア4領域。
3. **focus-you を「セキュリティ実験場」にする戦略は妥当**。ただし「個人情報を扱う日記アプリ」という性質上、最低限のラインは厳しめ（暗号化・データ最小化・E2EE検討・越境移転対応）に引き上げる必要がある。
4. **認定はAWS Security Specialty（短期）+ CISSP（中期）の二段構え**が最もROI高い。日本のエンプラ案件では「資格よりPoC実績」だが、大企業の調達基準では資格が「足切りライン」になる。
5. **Phase 1（即対応・1-2週間）/ Phase 2（商用化前・1-3ヶ月）/ Phase 3（スケール時・6ヶ月以上）** の3段階ロードマップを後述。

---

## Section 1: 公知情報

### A. 個人開発から大企業まで通じるセキュリティ実装パターン

#### A-1. 認証・認可（OAuth 2.1, OIDC, SAML, IDaaS）

**プロトコル選定の原則**

| プロトコル | 用途 | 想定読者 | 補足 |
|---|---|---|---|
| **OAuth 2.1** | 認可（API アクセス権付与） | モバイル・SPA・サーバ間連携 | OAuth 2.0 のベストプラクティスを取り込んだ統合版。PKCE 必須化、Implicit Flow 廃止 |
| **OIDC** | 認証（誰かを確認） | クラウドネイティブ・SSO | OAuth 2.0 上に identity layer を載せる。JWT ベース、JSONなのでモダン |
| **SAML 2.0** | エンタープライズ認証 | レガシーSaaS、AD FS連携 | XML ベース、ServiceNow / Workday / Salesforce Classic で必須 |
| **SCIM** | ユーザープロビジョニング | エンプラの自動入退社 | SAML/OIDC とセット。ID基盤の自動同期 |

**重要な実装ベストプラクティス**:
- SAML アサーションは **HSM-backed 証明書**で署名
- OIDC トークンは **15分の短命**に設定し refresh token で更新
- SCIM は **AES-256で暗号化**したペイロードで送信
- 大企業は3プロトコルを **同時運用**するため、プロトコル選定よりも **gov（governance）の一貫性**が重要

**IDaaS プロバイダ比較（focus-you 視点）**

| プロバイダ | 強み | 弱み | 月額（10,000 MAU） | 推奨ケース |
|---|---|---|---|---|
| **Auth0** | エンプラSSO（SAML）、HIPAA、巨大エコシステム | Okta買収後に値上げ・無料枠縮小 | $500+ | エンプラSaaS、SAML SSO必須 |
| **Clerk** | DX最高、Next.js/React 即統合、UI完備 | エンプラSAML設定の柔軟性は劣る | ~$100 | スタートアップ、モダンスタック |
| **Supabase Auth** | DB + Auth + RLS の統合、無料枠50K MAU | エンプラSSO（SAML）の深い設定が弱い | ~$25 | 既にSupabase利用、コスト重視 |
| **AWS Cognito** | AWSエコシステム、大量MAUで安価 | UX設計負荷高、ドキュメントが分散 | ~$50 | AWS本格活用組織 |
| **Microsoft Entra ID** | Office 365 / Azure ユーザに最適 | 非Microsoft環境では学習コスト | M365 E5に同梱 | エンプラMicrosoft組織 |

ソース:
- [SAML vs OIDC vs OAuth 2.0 - AppGovScore](https://www.appgovscore.com/blog/saml-vs-oidc-vs-oauth-2.0-strategic-identity-protocols-explained)
- [SSO Protocols Deep Dive - Gupta Deepak](https://guptadeepak.com/sso-deep-dive-saml-oauth-and-scim-in-enterprise-identity-management/)
- [Clerk vs Auth0 vs Supabase 2026 - AppStackBuilder](https://appstackbuilder.com/blog/clerk-vs-auth0-vs-supabase-auth)
- [Auth Pricing Wars - Zuplo](https://zuplo.com/learning-center/api-authentication-pricing)

#### A-2. ゼロトラスト（BeyondCorp, Cloudflare Zero Trust, Entra Conditional Access）

**ゼロトラストの原則**: 「誰も信頼せず、毎回検証」。VPN/ペリメータ廃止、すべてのアクセスを認証 + 認可 + デバイスポスチャ検証。

| ZTNA プラットフォーム | 強み | 弱み | 価格 | 推奨ケース |
|---|---|---|---|---|
| **Cloudflare Zero Trust (Access)** | 任意のクラウド/IdP対応、50ユーザまで無料 | 深い identity 機能はAzureに劣る | $7/user/月〜 | マルチクラウド、IdP非依存 |
| **Microsoft Entra Private Access** | Conditional Access、Identity Protection、PIM | Microsoftスタック前提 | M365 E5に同梱 | Microsoft組織、既にE5 |
| **Google BeyondCorp Enterprise** | Google Workspace との深い統合 | GWS外では恩恵薄い | $6/user/月〜 | Google Workspace組織 |
| **AWS Verified Access** | AWSアプリへの専用アクセス | AWSアプリ限定 | $0.05/時間 | AWS集中組織 |

**focus-you 視点の判断**: 個人開発・初期スタートアップでは **Cloudflare Zero Trust の50ユーザ無料枠** が最も学習コスパ高。Vercel前段にCloudflare WAF + Zero Trust を置いて学べる。

ソース:
- [Zero Trust Access Compared - InventiveHQ](https://inventivehq.com/blog/cloudflare-access-vs-aws-verified-access-vs-azure-entra-vs-google-beyondcorp)
- [Best Zero Trust Providers 2026 - Axis Intelligence](https://axis-intelligence.com/best-zero-trust-security-providers-2026/)
- [Cloudflare SASE with Microsoft Reference Architecture](https://developers.cloudflare.com/reference-architecture/architectures/cloudflare-sase-with-microsoft/)
- [Conditional Access Implementation in Entra - Virtualization Review](https://virtualizationreview.com/articles/2025/11/06/expert-explains-conditional-access-and-zero-trust-implementation-in-microsoft-entra.aspx)

#### A-3. WAF / DDoS（Cloudflare, AWS Shield, Azure Front Door, Vercel Firewall）

| プロバイダ | WAF | DDoS | Bot Protection | 価格目安 | focus-you 視点 |
|---|---|---|---|---|---|
| **Cloudflare** | Free〜全プランWAF含む。Pro $20/月で実用 | 全プラン無制限DDoS（無料含む） | Pro以上で標準 | $0〜200/月 | **コスパ最強**。Vercel前段に置く価値大 |
| **AWS Shield Standard + WAF** | WAFは別料金（$5/月+ルール課金） | Standardは無料、Advancedは$3,000/月 | AWS Bot Control 別料金 | $5〜数百/月 | AWSアプリ前提なら有力 |
| **Azure Front Door + WAF** | Premium SKUでManaged ruleset | Basicは無料、Standardは追加料金 | Premium SKU | $35〜300+/月 | Azureスタック前提 |
| **Vercel Firewall** | Hobby/Pro でDDoS無料、WAFカスタムルール40個（Pro） | 全プラン無料 | Bot Filter（Pro） | $0/月（Pro含む） | **focus-youで即試せる**。Vercelに閉じる |

**重要な気づき**:
- **AWS は2025年11月に CloudFront flat-rate プラン**を導入（Business $200/月でCDN+WAF+DDoS+DNS+Logsバンドル）。ただしDDoS Response Teamや高度L7保護は Shield Advanced（$3,000/月）が必要
- **Cloudflare の Pro $20/月** は AWS換算で $85〜400/月相当の機能を含む。100M req/月想定で
- **Vercel Firewall は標準装備**だがVercelデプロイアプリのみ保護。**外部攻撃面の事前ブロック**は Cloudflare 等を前段に置く必要がある
- 大企業DX案件では **Akamai / F5 / Imperva** が標準（Cloudflare/AWSは新興扱いの組織もある）

ソース:
- [Web Security Compared: Cloudflare vs AWS vs Azure - InventiveHQ](https://inventivehq.com/blog/cloudflare-vs-aws-shield-vs-azure-ddos-vs-google-cloud-armor-web-security-comparison)
- [Cloud Pricing Decoded - InventiveHQ](https://inventivehq.com/blog/cloud-pricing-models-compared-cloudflare-aws-azure-gcp-total-cost)
- [Vercel Firewall Pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing)
- [Vercel Pricing 2026](https://vercel.com/pricing)
- [Edge Security Showdown: Vercel vs Cloudflare - DEV Community](https://dev.to/simplr_sh/edge-security-showdown-vercel-firewall-vs-cloudflare-protecting-your-modern-web-app-29m0)

#### A-4. シークレット管理（Vault, AWS Secrets Manager, Azure Key Vault, Doppler）

| ツール | 強み | 弱み | 価格 | focus-you 視点 |
|---|---|---|---|---|
| **HashiCorp Vault** | 動的シークレット、最高機能、マルチクラウド | 運用負荷高、k8s前提も | OSS無料、HCP有料 | 学習価値高、focus-youで導入は過剰 |
| **AWS Secrets Manager** | IAM/Lambda統合、自動rotation | AWS前提 | $0.40/シークレット/月 + $0.05/10K calls | AWS本格活用なら標準 |
| **Azure Key Vault** | Microsoft統合、key/cert/secret一元管理 | Azure前提 | $0.03/10K operations | Azure本格活用なら標準 |
| **Doppler** | DX最高、CI/CD統合楽 | エンプラの監査要件は弱い | 無料〜$7/user/月 | **focus-you に最適**、即導入可能 |
| **Infisical** | OSS + マネージド両対応、E2EE | 新興、エコシステム小 | 無料〜$8/user/月 | OSS派 |

**focus-you の現状**:
- Supabase Edge Function の env (Supabase secrets) で管理
- ローカル開発は `.env` ファイル
- **改善余地**: Doppler / Infisical を導入するとローカル/開発/本番のシークレット同期が一元化できる（**学習価値あり**）

ソース:
- [Top 5 Secrets Management Tools 2026](https://guptadeepak.com/top-5-secrets-management-tools-hashicorp-vault-aws-doppler-infisical-and-azure-key-vault-compared/)
- [Vault vs AWS vs Azure 2025 Guide](https://sanj.dev/post/hashicorp-vault-aws-secrets-azure-key-vault-comparison)
- [Secrets Management Pricing Breakdown 2026](https://www.cybersectool.com/blog/secrets-management-pricing-breakdown-2026)

#### A-5. ネットワーク分離（VPC, VNet, Private Endpoint）

**原則**: 「Default deny, explicit allow」。デフォルト拒否、必要なものだけ明示的に許可。

| 概念 | AWS | Azure | 説明 |
|---|---|---|---|
| 仮想ネットワーク | VPC | VNet | クラウド内の論理的に分離されたネットワーク |
| プライベート接続 | VPC Endpoint / PrivateLink | Private Endpoint / Private Link | サービスにインターネット経由せず接続 |
| サブネット分離 | Private/Public Subnet | Private/Public Subnet | DB/App は private、ALB/Front は public |
| サービスメッシュ | App Mesh / EKS | Service Fabric / AKS | サービス間通信の制御・暗号化 |

**focus-you の現状**: Vercel + Supabase は両方マネージド・パブリックエンドポイント。**Supabase は Pro プラン以上で IPv4 アドレス制限可能**だが、private endpoint は Enterprise plan 以上。

**学習目標**: AWSフリーティアでVPC + private subnet + RDS + EC2 + NAT Gateway を1度組むことで、エンプラ標準のネットワーク分離が体感できる（**focus-you とは別の学習PJ**として）。

ソース:
- [Azure Private Endpoints Best Practices 2026](https://supertechman.com.au/azure-private-endpoints-explained-in-2026-real-world-examples-and-best-practices/)
- [Compare Amazon VPC vs Azure VNet - TechTarget](https://www.techtarget.com/searchcloudcomputing/tip/Compare-Amazon-VPC-vs-Azure-VNet-for-private-networking)
- [Cloud Security Best Practices 2026 - ATLAS Advisory](https://atlas-advisory.eu/en/insights/cloud-security-best-practices)

#### A-6. ログ・監査（SIEM, CloudTrail, Azure Monitor, Datadog）

| ツール | 強み | 弱み | 価格 | focus-you 視点 |
|---|---|---|---|---|
| **Splunk Enterprise Security** | エンプラ標準、深い調査機能、SOC運用最適 | 高額（10s of $/GB） | 要見積（数百万〜） | エンプラ案件で出会う |
| **Datadog Cloud SIEM** | ログ・監視・APM一元、$15/host〜 | エンプラ深度はSplunk未満 | $15/host/月 + $0.10/GB/月 | スタートアップ最有力 |
| **Microsoft Sentinel** | Azure統合、AWS/GCPコネクタあり | 非Azure環境では複雑化 | 取り込みデータ量課金 | Microsoft組織標準 |
| **AWS CloudTrail / GuardDuty** | AWS監査の標準。CloudTrailは無料枠あり | AWS外は別ツール | CloudTrail Lake $2.50/GB | AWS活用組織は必須 |
| **OpenSearch (ELK)** | OSS、自由度高い | 自前運用負荷高 | OSS無料 | コスト重視・運用力あり |

**重要な観点**:
- 監査ログの **保持期間** はコンプライアンス次第（SOC 2 = 1年、ISO 27001 = 3年、PCI DSS = 1年だがログ保持の証跡は別途必要）
- **「ログ取得 ≠ 検知」**。SIEM のルール設計と SOC 運用が本体
- スタートアップは **Datadog or Sentinel + Slack 通知** 程度で十分。エンプラ案件で「Splunk使えます」と言えると強い

ソース:
- [Datadog vs Splunk 2026 - StationX](https://www.stationx.net/splunk-vs-datadog/)
- [Azure Sentinel vs Splunk vs Datadog - Exodata](https://exodata.io/azure-sentinel-vs-splunk-vs-datadog/)

#### A-7. 暗号化（TLS, mTLS, KMS, BYOK/HYOK）

| 概念 | 説明 | 適用層 |
|---|---|---|
| **TLS 1.3** | 通信の暗号化（ブラウザ↔サーバ） | 必須・全アプリ |
| **mTLS** | クライアント認証付きTLS。サーバだけでなくクライアントも証明書提示 | サーバ間通信、ゼロトラスト |
| **KMS (Key Management Service)** | クラウド提供の鍵管理。AWS KMS / Azure Key Vault / Google Cloud KMS | データ at rest 暗号化の根本 |
| **BYOK (Bring Your Own Key)** | 自社で鍵生成、CSPにアップロードして使う。鍵は CSP 内KMS/HSM で管理。CSP は復号可能 | 規制要件（金融・医療） |
| **HYOK (Hold Your Own Key)** | 鍵を完全に自社環境（HSM/オンプレ）に保持。CSP は鍵に触れない | 最高レベル統制（防衛・公共） |
| **Envelope Encryption** | データ暗号化キー（DEK）を、マスターキー（KEK）で暗号化する2層構造 | KMS実装の標準パターン |

**focus-you の現状**:
- TLS: Vercel / Supabase が自動で TLS 1.3
- データ at rest: Supabase が AES-256 で自動暗号化
- **追加検討余地**: 日記内容の **アプリケーション層 E2EE**（クライアント側でユーザーパスフレーズで暗号化）。商用化時の差別化要因になる

**大企業案件での重要度**:
- 金融: BYOK 必須、HYOK 検討
- 公共: HYOK / オンプレHSM 必須なケースあり
- 一般エンプラ: KMS + 適切なIAM で十分

ソース:
- [Cloud Encryption: BYOK vs HYOK - Thales](https://cpl.thalesgroup.com/blog/encryption/cloud-encryption-key-management-byok-hyok)
- [BYOK CYOK HYOK - Cryptomathic](https://www.cryptomathic.com/blog/what-is-the-difference-between-byok-cyok-hyok)
- [Choosing a Cloud Key Management Model - CSA](https://cloudsecurityalliance.org/blog/2026/01/05/choosing-the-right-key-responsibility-model)

#### A-8. コンプライアンス（SOC2, ISO27001, ISO27017, PCI-DSS, GDPR, 個人情報保護法）

| 規格 | 対象 | focus-you への適用度 | 取得難易度 | 取得期間 |
|---|---|---|---|---|
| **SOC 2 Type 2** | サービスプロバイダ全般、Trust Services Criteria（5基準） | 商用化時に必須レベル | 中（ツール活用で6-12ヶ月） | 6-12ヶ月+運用期間6ヶ月 |
| **ISO 27001:2022** | 情報セキュリティマネジメント全般、93統制 | エンプラB2B商用化時 | 中〜高 | 6-12ヶ月 |
| **ISO 27017** | クラウド固有のセキュリティ | クラウドサービス事業者 | 中 | ISO27001+α |
| **ISO 27018** | クラウドにおける個人情報保護 | 個人情報を扱うクラウド | 中 | ISO27001+α |
| **PCI DSS 4.0** | カード決済情報保有者 | focus-you には不要（決済はStripeに委譲する設計が一般） | 高 | 12ヶ月+ |
| **GDPR** | EU居住者の個人データ | EUユーザに提供するなら必須 | 中（実装次第） | 即時対応必要 |
| **改正個人情報保護法（日本）** | 日本居住者の個人情報 | 日本展開時必須。2026年中に再改正予定 | 中 | 即時対応必要 |
| **HIPAA** | 米国の医療情報 | focus-you には不要（医療データなら必須） | 高 | 12ヶ月+ |

**focus-you 視点の優先度**:
1. **改正個人情報保護法（日本）** — 即時対応必要。日記データは「機微情報含むケース」あり
2. **GDPR** — EU提供前に必須。Cookie同意、データ削除要求対応、越境移転対応
3. **SOC 2 Type 2** — エンプラ商用化時の足切りライン
4. **ISO 27001** — SOC 2 と並行 or 後追い
5. **PCI DSS / HIPAA** — focus-you には不要

**重要な現状認識**:
- Supabase は **SOC 2 Type 2 取得済み**だが **ISO 27001 は未取得**。Supabase Enterprise Plan で「ISO 27001 統制を顧客と協働で実装」可能
- GDPR の「データ削除要求」は Supabase RLS だけでは不十分。**削除ロジック・バックアップ削除・ログ削除を実装**する必要がある
- 日本の改正個人情報保護法は **2026年中に再改正予定**。Cookie・越境移転（AWS/Vercelは米国）に追加規制の見込み

ソース:
- [SOC 2 Compliance Checklist 2026 - Scytale](https://scytale.ai/center/soc-2/the-soc-2-compliance-checklist/)
- [ISO 27001 Checklist - SecureLeap](https://www.secureleap.tech/blog/iso-27001-checklist-for-audit)
- [Supabase SOC 2 Compliance](https://supabase.com/docs/guides/security/soc-2-compliance)
- [Supabase ISO 27001 Discussion](https://github.com/orgs/supabase/discussions/17659)
- [PCI DSS vs GDPR - ISMS.online](https://www.isms.online/pci-dss/vs-gdpr/)
- [日本 改正個人情報保護法 越境移転 - 新日本法規](https://www.sn-hoki.co.jp/articles/article1201314/)
- [2026年改正方針 - JPAC BLOG](https://blog.jpac-privacy.jp/proposedamendmentstothepersonalinformationprotectionact_2601/)

---

### B. IaC（Infrastructure as Code）の選択肢

| ツール | 言語 | マルチクラウド | 学習価値 | focus-you適合度 |
|---|---|---|---|---|
| **Terraform** | HCL | ◎（市場シェア32.8%、最大エコシステム） | ◎（業界標準） | △（focus-you規模では過剰） |
| **OpenTofu** | HCL（Terraform互換） | ◎ | ◎（Linux Foundation 管理、ライセンス問題回避） | △ |
| **Pulumi** | TypeScript / Python / Go / C# | ◎ | ○（プログラミング体験は最高） | ○（TypeScript経験を活かせる） |
| **AWS CDK** | TypeScript / Python ほか | ✗（AWS専用） | ○（AWS集中ならベスト） | ✗ |
| **Azure Bicep** | DSL | ✗（Azure専用） | ○（Azure集中なら） | ✗ |
| **Crossplane** | YAML（Kubernetes CRD） | ◎ | ○（プラットフォームエンジニアリング） | ✗（k8s前提） |

**重要な背景情報**:
- 2023年に HashiCorp が Terraform を **MPL（OSS）から BSL（商用制限）に変更**。これに反発して Linux Foundation 主導で **OpenTofu** がフォーク。OpenTofu は既存の `.tf` ファイルをそのまま使える
- 2026年現在、新規プロジェクトでは **OpenTofu を選ぶケースが増えている**
- Pulumi は **実行速度・スケーラビリティで Terraform/OpenTofu を上回る**ベンチマーク結果あり

**focus-you 視点の判断**:
- **focus-you 本体に IaC を導入する意味は薄い**。Vercel と Supabase は両方マネージド、設定項目が少ない。Terraform Cloud にコードを書いても価値は限定的
- **学習目的なら別PJで AWS Free Tier に Pulumi (TypeScript) で構築**するのがおすすめ。VPC + RDS + EC2 + ALB + IAM + WAF を一通り IaC 化する経験は大企業案件で必ず効く
- **Cloudflare のリソース管理に Terraform/OpenTofu** を使うのは focus-you でも実用的（DNS, Workers, R2, Zero Trust の設定をコード化）

ソース:
- [Top 10 IaC Tools 2026 - DEV Community](https://dev.to/inboryn_99399f96579fcd705/top-10-iac-tools-for-devops-in-2026-which-one-wins-for-multi-cloud-terraform-pulumi-opentofu-hfb)
- [Terraform Alternatives 2026 - Encore](https://encore.dev/articles/terraform-alternatives)
- [AWS CDK vs Terraform 2026 - Towards The Cloud](https://towardsthecloud.com/blog/aws-cdk-vs-terraform)
- [IaC Comparison 2026 - DasRoot](https://dasroot.net/posts/2026/01/infrastructure-as-code-terraform-opentofu-pulumi-comparison-2026/)

---

### C. 大企業DX案件で評価される「セキュリティスキルセット」

#### C-1. 必須知識（足切りライン）

| 領域 | 具体的スキル | 学習方法 |
|---|---|---|
| **IAM設計** | 最小権限原則、ロール設計、Service Control Policy、ABAC/RBAC | AWS IAM / Azure RBAC を実プロジェクトで設計する |
| **ネットワーク設計** | VPC/VNet設計、Subnet分割、Routing、NAT、Security Group/NSG | AWS Free Tierで実構築 |
| **暗号化** | TLS設定、KMS運用、BYOK/HYOK、暗号スイート選定 | KMSで実際にキーを作って運用してみる |
| **ログ設計** | 何を取るか、保持期間、改ざん防止、SIEM 連携 | CloudTrail + S3 + GuardDuty で1度設計する |
| **監査対応** | SOC2 / ISO27001 のエビデンス収集、ヒアリング応答 | 実案件 or Vanta / Drata で擬似体験 |
| **インシデントレスポンス** | 検知 → 封じ込め → 根絶 → 復旧 → 教訓の5フェーズ | NIST SP 800-61 を読む |

#### C-2. あると強い知識（差別化）

| 領域 | 具体的スキル | 学習方法 |
|---|---|---|
| **脅威モデリング（STRIDE）** | システムをDFDで描き、6種の脅威（Spoofing/Tampering/Repudiation/Info Disclosure/DoS/Elevation of Privilege）を網羅的に検討 | Microsoft Threat Modeling Tool / OWASP Threat Dragon |
| **プライバシー脅威モデリング（LINDDUN）** | 7種のプライバシー脅威（Linking/Identifying/Non-repudiation/Detecting/Data Disclosure/Unawareness/Non-compliance） | LINDDUN.org の公式チュートリアル |
| **ペネトレーションテスト** | OWASP Top 10、Burp Suite、攻撃者視点 | TryHackMe / HackTheBox |
| **DevSecOps** | SAST/DAST/SCAをCIに組み込む、Snyk/Semgrep/Trivy | GitHub Actions でCIを組む |
| **クラウドガバナンス** | Landing Zone、Control Tower、Azure Policy、Tag戦略 | AWS Well-Architected Framework を読む |
| **AI/LLMセキュリティ** | Prompt Injection、Data Leakage、OWASP LLM Top 10 | OWASP LLM Top 10 / Anthropic の publication |

#### C-3. 認定（Certifications）

| 認定 | 受験料 | 期間（学習〜合格） | 年収インパクト | focus-you 視点での優先度 |
|---|---|---|---|---|
| **CompTIA Security+** | $400 | 2-3ヶ月 | 入門。新卒〜SOC analyst レベル | △（基礎固めならOK） |
| **AWS Certified Security - Specialty (SCS-C03)** | $300 | 3-6ヶ月 | $18,000〜$25,000/年（米） | **◎（最高ROI）** |
| **AZ-500（Azure Security Engineer Associate）** | $165 | 3-6ヶ月 | 同上 | ○（Azure案件狙うなら） |
| **CCSP (Certified Cloud Security Professional)** | $599 | 6-12ヶ月 | 平均 $148,009（米） | ○（クラウドセキュリティ専門） |
| **CISSP** | $749 | 12-24ヶ月（5年実務経験必須） | $130,000〜$170,000（米） | ◎（中期、シニア証明） |
| **CISA / CISM** | $700 | 6-12ヶ月 | 監査人キャリア | △（監査志向ならOK） |

**日本市場の現実**:
- 大企業の調達 RFP で「資格保有者数」が評価項目になることがある（特に金融・公共）
- ただし **「資格があるが実務経験がない」** より **「資格はないが PoC実績がある」** の方が現場では評価される
- **AWS Security Specialty は最短ルート**: focus-you の AWS版を作れば実務経験 + 認定が同時に取れる

#### C-4. 個人プロダクトで「実務として」習得する方法

1. **focus-you を Multi-account AWS Organization 構成にする**
   - dev/stg/prd を別アカウントに分ける（IAM・請求の分離）
   - SCP（Service Control Policy）で "Deny by default" を体感する

2. **CloudTrail + GuardDuty + Security Hub の3点セットを有効化**
   - CloudTrail の logs を S3 に集約（暗号化 + バージョニング + Object Lock）
   - GuardDuty の findings を SNS 経由で Slack 通知
   - Security Hub で AWS Foundational Security Best Practices を有効化

3. **自分で Threat Model を1枚書く**
   - focus-you の DFD を Excalidraw / Miro で描く
   - STRIDE で脅威を列挙、優先度を付ける
   - LINDDUN で プライバシー脅威も同様に
   - 結果をチームに発表 or zenn 等に公開する

4. **Pentest を受ける（or 自分で擦る）**
   - HackTheBox / TryHackMe で攻撃者視点を学ぶ
   - 商用化前に外部 pentest（30万〜100万円）を受ける

5. **コンプライアンスツールで擬似体験**
   - Vanta / Drata の14日トライアルで SOC 2 のコントロールを設計してみる
   - Compliance posture の自動収集（GitHub の MFA 強制、IAM の MFA 必須など）の仕組みを体感する

ソース:
- [Cybersecurity Certification Roadmap 2026 - ExamCert](https://www.examcert.app/blog/cybersecurity-certification-roadmap-2026/)
- [Top Cybersecurity Certifications 2026 - SecITHub](https://secithub.com/cybersecurity-certifications-2026-part-2/)
- [STRIDE Threat Model Guide - Practical DevSecOps](https://www.practical-devsecops.com/what-is-stride-threat-model/)
- [LINDDUN Privacy Engineering](https://linddun.org/)
- [CCSP Certification Guide 2026 - FlashGenius](https://flashgenius.net/blog-article/ccsp-certification-guide-2026-cost-exam-prep-and-roi)
- [Is CISSP Worth It 2026 - ExamCert](https://www.examcert.app/blog/is-cissp-worth-it-2026/)

---

### D. focus-you に適した移行戦略

#### D-1. 現状の課題棚卸し

| 領域 | 現状 | 課題レベル |
|---|---|---|
| **Supabase RLS** | 全テーブルにRLS適用済み（rules/supabase-access.md記載） | ✓ OK |
| **API キー管理** | Supabase Edge Function env 経由（client側に出さない設計） | ✓ OK |
| **Edge Function 認証** | `verify_jwt = false` + 関数内で `sb.auth.getUser(jwt)` で検証 | ✓ OK（ES256対応） |
| **CSP（Content Security Policy）** | vercel.json に `X-Content-Type-Options`, `X-Frame-Options` のみ。**CSP未設定** | ✗ 改善必要 |
| **CORS** | Edge Function 側で実装（要確認） | △ 棚卸し必要 |
| **シークレット管理** | Supabase secrets + ローカル `.env` | △ Doppler等で一元化の余地 |
| **監査ログ** | Supabase の `auth events` のみ（カスタムログ未整備） | ✗ 改善必要 |
| **アプリケーションログ** | console.log のみ（収集なし） | ✗ 改善必要 |
| **依存関係スキャン** | GitHub Dependabot のみ（要確認） | △ Snyk/Trivy追加余地 |
| **暗号化（at rest）** | Supabase で AES-256（自動） | ✓ OK |
| **暗号化（in transit）** | Vercel/Supabase 自動 TLS 1.3 | ✓ OK |
| **アプリ層 E2EE** | 未実装（日記内容も Supabase で復号可能） | △（商用化時の差別化検討） |
| **WAF / DDoS** | Vercel Firewall（DDoS無料、WAFカスタムルールなし） | △ Cloudflare 前段の検討余地 |
| **MFA / 2FA** | Supabase Auth 標準対応だが有効化要確認 | △ 商用化前に必須 |
| **個人情報保護法対応** | プライバシーポリシー・Cookie同意未確認 | ✗ 確認・整備必要 |
| **GDPR対応** | データ削除要求の実装未確認 | ✗ EU提供前に必要 |
| **脅威モデル** | 未作成 | ✗ 学習目的でも作成価値大 |
| **Pentest** | 未実施 | △ 商用化前に必要 |

#### D-2. 段階的強化ロードマップ

##### Phase 1: 即対応（1-2週間）

**目標**: 「個人開発として恥ずかしくない最低ライン」+ 学習着手

| タスク | 工数 | 学習価値 | 実用価値 |
|---|---|---|---|
| 1. **CSP ヘッダ設定**（vercel.json に追加） | 2-4h | ◎ | ◎ |
| 2. **Threat Model（STRIDE）作成** — DFDを描いて1枚 | 4-8h | ◎ | ○ |
| 3. **Privacy Threat Model（LINDDUN）作成** | 4-8h | ◎ | ○（日記アプリだから特に） |
| 4. **依存関係スキャン強化** — Snyk or Dependabot 設定確認 | 2h | ○ | ◎ |
| 5. **MFA 有効化**（Supabase Auth で） | 2h | ○ | ◎ |
| 6. **プライバシーポリシー / 利用規約 / Cookie ポリシーの草案** | 8-16h | ○ | ◎（商用化必須） |
| 7. **アプリケーションログ収集の仕組み**（Supabase テーブル or Logflare） | 4-8h | ◎ | ◎ |

##### Phase 2: 商用化前（1-3ヶ月）

**目標**: 「個人ユーザに展開できる安全性」+ 大企業視点での説明能力獲得

| タスク | 工数 | 学習価値 | 実用価値 |
|---|---|---|---|
| 1. **Cloudflare 前段配置**（Vercel手前にCloudflare WAF + Bot Protection） | 8-16h | ◎ | ◎ |
| 2. **Cloudflare Zero Trust の50ユーザ無料枠で社内サービス保護を体験** | 8h | ◎ | ○ |
| 3. **Doppler or Infisical でシークレット一元管理** | 8-16h | ◎ | ○ |
| 4. **GDPR / 個人情報保護法対応**（データ削除API、エクスポート、Cookie同意UI） | 40-80h | ○ | ◎（必須） |
| 5. **アプリ層 E2EE のPoC**（日記の本文だけ E2EE、検索は不可になるトレードオフ込み） | 40-80h | ◎ | ◎（差別化） |
| 6. **Pentest（自前 or 外部）** — OWASP Top 10 をfocus-youに対して実施 | 40h（自前） | ◎ | ◎ |
| 7. **AWS Security Specialty 受験準備**（focus-youのAWS版PoCをセットで） | 200h | ◎ | ◎ |
| 8. **SOC 2 Type 1 readiness**（Vanta/Drataのトライアルで体験） | 40-80h | ◎ | △ |

##### Phase 3: スケール時（6ヶ月以上）

**目標**: 「エンプラ B2B 案件で出せる」レベル

| タスク | 工数 | 学習価値 | 実用価値 |
|---|---|---|---|
| 1. **Supabase Enterprise Plan 移行**（Private Endpoint, IPv4制限, ISO27001 統制協働） | 移行作業 | ◎ | ◎ |
| 2. **SIEM 導入**（Datadog Cloud SIEM か Sentinel） | 80-160h | ◎ | ◎ |
| 3. **SOC 2 Type 2 取得** | 6-12ヶ月 + 200万〜500万円 | ◎ | ◎ |
| 4. **ISO 27001 取得** | 6-12ヶ月 + 200万〜500万円 | ◎ | ○ |
| 5. **CISSP 受験**（5年実務経験必須） | 受験準備300h | ◎ | ◎ |
| 6. **Bug Bounty Program** 開設（HackerOne / Bugcrowd） | 設計40h + 報奨金 | ◎ | ◎ |

#### D-3. 「過剰投資にならない」ライン

**focus-you の現フェーズ（個人開発、ユーザ自分のみ）では以下は過剰**:
- ❌ HSM / BYOK / HYOK
- ❌ SOC 2 Type 2 / ISO 27001 取得（年間数百万）
- ❌ HashiCorp Vault フル運用
- ❌ Splunk Enterprise Security
- ❌ Multi-account AWS Organization（学習目的なら別PJで）
- ❌ Pentest 外部委託（自前TryHackMe で十分）
- ❌ Bug Bounty Program

**やるべき最低ライン**:
- ✓ CSP / セキュリティヘッダ完備
- ✓ MFA 有効化
- ✓ Threat Model 1枚（STRIDE + LINDDUN）
- ✓ プライバシーポリシー
- ✓ 依存関係スキャン

---

### E. プロバイダ別セキュリティ機能の標準装備度

| 機能 | Vercel | Cloudflare | AWS | Azure |
|---|---|---|---|---|
| **WAF** | Pro標準（カスタム40ルール）/ Enterprise（1,000ルール） | Pro $20/月で実用、Enterprise でManaged ruleset | WAF $5/月+ルール課金（Web ACL別途） | Front Door Premium SKU $35〜 |
| **DDoS** | 全プラン無料（L3/L4） | 全プラン無料・無制限 | Shield Standard 無料、Advanced $3,000/月 | Standard 有料、Basic 無料 |
| **Bot Protection** | Pro標準 | Pro以上で標準 | AWS Bot Control 別料金 | Front Door Premium SKU |
| **Identity 統合度** | Vercel Marketplace（Auth0等）連携 | Cloudflare Access が任意IdP対応 | Cognito + IAM Identity Center | Entra ID（深い） |
| **監査ログ保持期間** | Pro 30日 / Enterprise 1年〜 | Pro 30日 / Business 1年 | CloudTrail Lake 90日標準、最大10年 | Activity Logs 90日標準、Storage連携で長期 |
| **コンプライアンス認定** | SOC 2 Type 2 (Enterprise), HIPAA BAA, ISO 27001 | SOC 2 Type 2, ISO 27001, PCI DSS | 全主要認定 | 全主要認定 |
| **Private Endpoint** | Enterprise plan のみ | Cloudflare Tunnel 全プラン | VPC Endpoint 標準 | Private Endpoint 標準 |
| **mTLS サポート** | Enterprise | Enterprise | API Gateway mTLS | Application Gateway mTLS |

**focus-you 視点の判断**:
- **Vercel + Cloudflare 前段** が学習・コスト両面で最有力。Cloudflare Pro $20/月で大企業案件で使う機能の **8割は体験できる**
- **AWS / Azure** は学習目的で別PJで触るのが効率良い。focus-you 全体を AWS に移すのは ROI 低い

ソース:
- [Vercel Pricing](https://vercel.com/pricing)
- [Cloudflare Plans](https://www.cloudflare.com/plans/)
- [Cloud Pricing Decoded - InventiveHQ](https://inventivehq.com/blog/cloud-pricing-models-compared-cloudflare-aws-azure-gcp-total-cost)
- [AWS WAF vs Cloudflare 2026 - TrustRadius](https://www.trustradius.com/compare-products/aws-waf-vs-cloudflare)

---

## Section 2: 限界の明示

### 2-1. 「大企業DXで戦える」は会社・案件で要求が大きく違う

- **金融（銀行・保険・証券）**: FISC安全対策基準、PCI DSS、暗号化（BYOK/HYOK）、監査ログ保持7年、第三者監査必須
- **公共（中央省庁・自治体）**: ISMAP、政府情報システムのためのセキュリティ評価制度、HSM必須なケースあり、データレジデンシー（国内のみ）
- **製造業**: 工場系OTセキュリティ（IEC 62443）、ICSとIT統合、サプライチェーンセキュリティ
- **医療**: HIPAA（米）、3省2ガイドライン（日）、PHI 保護、暗号化必須
- **一般エンプラ B2B SaaS**: SOC 2 Type 2 が事実上の足切り、ISO 27001 で加点

→ **どこを狙うかで重視する領域が変わる**。「大企業DX全部」を1つの軸では語れない。

### 2-2. セキュリティは「やりすぎ」も問題

- **コスト**: SOC 2 Type 2 + ISO 27001 で年間500万〜1000万のランニング（監査+ツール+人件費）
- **開発速度の低下**: 統制が増えるほどリリースサイクルは遅くなる
- **過剰なセキュリティは UX を破壊**: MFA を毎回要求、長いパスワード要件 → 離脱率上昇
- **「リスクベース」の思考が必要**: 何をどこまで守るか、誰から守るかを定義してから対策を選ぶ

### 2-3. 個人開発で完全な実務環境を再現するのは難しい

- **チーム運用が学べない**: CSIRT/SOC 運用、インシデント対応のチーム連携は1人では体験不可
- **本物の攻撃に晒されない**: Bug Bounty を開設しない限り、本物の攻撃者と対峙する経験は積めない
- **規制当局・監査人とのやり取り**: PCI QSA、ISMS 審査員との実コミュニケーションは実案件のみ
- **巨大スケールの問題**: 1秒10万req のWAF設計、PB級ログ分析は個人では再現不可

→ **個人開発で学べるのは「設計と実装の手触り」まで**。「運用と組織」は別途、転職 or 副業 or 受託で経験する必要あり

### 2-4. 認定取得と Applied Skills は別物

- **CISSP保有でも実務できないケース多数**: 試験合格 ≠ 設計能力
- **逆に CISSP なしでも超優秀な実務家**: 大企業はそういう人を Auth0 / GitHub から spotting している
- **両方持つのが最強**: 認定（信頼の最初の橋渡し）+ 実績（OSS / 公開ブログ / 公開Pentest writeups）
- **focus-you の戦略**: AWS Security Specialty は **focus-you の AWS版を作る = 実務経験 + 認定**を同時達成可能。CISSP は5年実務後

### 2-5. この調査の限界

- **法制度（特に日本の改正個人情報保護法）は2026年中に再改正予定**。最新動向は適時フォローアップが必要
- **AI/LLM セキュリティ領域は急速進化中**。OWASP LLM Top 10 は2024年版だが、Anthropic/OpenAI の最新ガイダンスは月次で更新される
- **「2026年4月現在」のスナップショット**。1年後には別の最適解になっている可能性あり

---

## Section 3: 壁打ちモードへの導線

### 社長が次に判断すべき問い

#### 問い1: focus-you を「セキュリティ実験場」にするか、本体は最小構成で別PJで学ぶか？

**選択肢A: focus-you をセキュリティ実験場にする**
- メリット: 1つのプロダクトで深く学べる、ポートフォリオとしても説明しやすい、商用化と学習が両立
- デメリット: 個人ユーザ前提のプロダクトに過剰機能を入れて開発速度が落ちるリスク
- 推奨ケース: 商用化を **真剣に視野**、かつエンプラ B2B も狙う

**選択肢B: focus-you は最小構成、別PJで学ぶ**
- メリット: focus-you はリリーススピード優先、学習PJで「やりすぎ」を許容できる
- デメリット: 学習PJはモチベ続かないリスク、ポートフォリオ説明が分散
- 推奨ケース: focus-you は **個人プロダクト or 教材化** を主軸、エンプラ案件は別領域で経験積む

**選択肢C: focus-you は B2C / B2B 両立**
- focus-you の B2C 版（個人ユーザ）は最小構成、B2B 版（チーム機能）は SOC 2 ready から作る
- 推奨ケース: ユーザ獲得後に B2B 拡張する戦略を取る

→ **どの選択肢を取るか**、社長の **3年後のキャリア像** から逆算すると見えやすい

#### 問い2: どの業界・案件を狙うかで重視するセキュリティ領域は変わる

| 業界 | 重視領域 | focus-you で学べる領域 |
|---|---|---|
| **金融（銀行/証券）** | 暗号化（BYOK/HYOK）、監査ログ7年、第三者認証 | △ Supabase Enterprise + KMS で一部学べる |
| **公共（省庁/自治体）** | ISMAP、データレジデンシー、HSM | ✗ AWS GovCloud等は実体験困難 |
| **医療** | HIPAA / 3省2ガイドライン、PHI暗号化 | ○ E2EE実装で学べる |
| **製造業（IoT/OT）** | OTセキュリティ、サプライチェーン | ✗ focus-youでは学べない |
| **一般エンプラ B2B SaaS** | SOC 2、Multi-tenancy、SSO | ◎ focus-you で学べる |

→ **どの業界を狙うか**、社長のクライアント実績・ネットワークから現実的な選択を

#### 問い3: 学習の進捗指標として具体的マイルストーン

提案する指標:
- [ ] **Threat Model（STRIDE + LINDDUN）を自分で1枚書ける**（Phase 1で達成可能）
- [ ] **Pentest（自前）で OWASP Top 10 を網羅的にチェックして報告書を書ける**（Phase 2）
- [ ] **AWS Security Specialty 取得**（Phase 2の終盤）
- [ ] **SOC 2 Type 1 readiness 達成**（Phase 2 - 3）
- [ ] **CISSP 取得**（Phase 3、5年実務後）
- [ ] **Bug Bounty を1件発見・報告**（任意のサービスに対して）
- [ ] **OSS のセキュリティ脆弱性を1件発見・PR提出**

→ どのマイルストーンが社長の **3年後の自己像** に最も貢献するか?

#### 問い4: 個人情報を扱う以上、最低限のラインはどこか

focus-you は **日記** を扱うため、機微情報を含む可能性が高い:
- 健康情報（睡眠、気分、ストレス）
- 政治・宗教・思想に関する記述
- 第三者（家族・同僚）の情報
- 性的指向・人種に関する情報

**最低限のラインの提案**:
1. **データ最小化**: 必要なものだけ取る、保存期間を定める（自動削除）
2. **アクセス制御**: RLS は実装済み。**バックアップへのアクセスも統制**
3. **暗号化**: at rest / in transit は実装済み。**E2EE は商用化前に検討**
4. **削除権**: ユーザが「全データ削除」できる UI と バックエンド処理
5. **ログイン保護**: MFA、不審なログインアラート、セッションタイムアウト
6. **インシデント時の通知体制**: GDPR は72時間以内、改正個人情報保護法も同等
7. **プライバシーポリシー**: 何を取り、どう使い、どう守るかを明記

→ **どこまで厳しくするか**は、商用化のターゲットユーザ層次第（メンタルヘルス領域なら HIPAA 並、一般日記なら GDPR 並）

#### 問い5: 学習投資のリスクヘッジ

- 認定だけ取って実務しないのは ROI 低い
- 実務だけして体系知識ないと「説明力」が弱い
- **理想は: 学習PJ → ブログ/Zenn 公開 → 認定取得 → 実案件 → 反復**
- focus-you は「学習PJ」と「ブログ素材」の役割を兼ねられる

→ ブログ/Zenn 公開を **学習プロセスの強制発火装置**にするのはどうか?

---

## ネクストアクション（提案）

1. **社長と15分の壁打ち**: 上記「問い1〜4」のうち最初に判断すべきものを決める
2. **Phase 1 のタスク化**: PM 部に展開して、CSP・Threat Model・MFA・プライバシーポリシーを2週間スプリントで実装
3. **学習PJの設計**: 別PJで AWS Security Specialty 受験用の練習プロジェクトを並行開始するか判断
4. **追加リサーチが必要な領域**: 
   - 日本の ISMAP の最新動向（公共案件狙うなら）
   - AI/LLM セキュリティ（OWASP LLM Top 10 2026年版 / Anthropic Constitutional AI のセキュリティ含意）
   - focus-you の競合（Day One, Reflection.app, Lite Journal）のセキュリティポジショニング比較

---

## 出典まとめ（一覧）

### 認証・認可
- https://www.appgovscore.com/blog/saml-vs-oidc-vs-oauth-2.0-strategic-identity-protocols-explained
- https://guptadeepak.com/sso-deep-dive-saml-oauth-and-scim-in-enterprise-identity-management/
- https://appstackbuilder.com/blog/clerk-vs-auth0-vs-supabase-auth
- https://zuplo.com/learning-center/api-authentication-pricing
- https://www.authgear.com/post/oidc-vs-saml
- https://www.pomerium.com/blog/sso-oauth2-vs-oidc-vs-saml

### ゼロトラスト
- https://inventivehq.com/blog/cloudflare-access-vs-aws-verified-access-vs-azure-entra-vs-google-beyondcorp
- https://axis-intelligence.com/best-zero-trust-security-providers-2026/
- https://developers.cloudflare.com/reference-architecture/architectures/cloudflare-sase-with-microsoft/
- https://virtualizationreview.com/articles/2025/11/06/expert-explains-conditional-access-and-zero-trust-implementation-in-microsoft-entra.aspx

### WAF / DDoS
- https://inventivehq.com/blog/cloudflare-vs-aws-shield-vs-azure-ddos-vs-google-cloud-armor-web-security-comparison
- https://inventivehq.com/blog/cloud-pricing-models-compared-cloudflare-aws-azure-gcp-total-cost
- https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing
- https://vercel.com/pricing
- https://www.cloudflare.com/plans/
- https://dev.to/simplr_sh/edge-security-showdown-vercel-firewall-vs-cloudflare-protecting-your-modern-web-app-29m0
- https://www.trustradius.com/compare-products/aws-waf-vs-cloudflare

### シークレット管理
- https://guptadeepak.com/top-5-secrets-management-tools-hashicorp-vault-aws-doppler-infisical-and-azure-key-vault-compared/
- https://sanj.dev/post/hashicorp-vault-aws-secrets-azure-key-vault-comparison
- https://www.cybersectool.com/blog/secrets-management-pricing-breakdown-2026

### ネットワーク分離
- https://supertechman.com.au/azure-private-endpoints-explained-in-2026-real-world-examples-and-best-practices/
- https://www.techtarget.com/searchcloudcomputing/tip/Compare-Amazon-VPC-vs-Azure-VNet-for-private-networking
- https://atlas-advisory.eu/en/insights/cloud-security-best-practices

### ログ・監査・SIEM
- https://www.stationx.net/splunk-vs-datadog/
- https://exodata.io/azure-sentinel-vs-splunk-vs-datadog/
- https://www.gartner.com/reviews/market/security-information-event-management/compare/product/datadog-cloud-siem-vs-splunk-enterprise

### 暗号化
- https://cpl.thalesgroup.com/blog/encryption/cloud-encryption-key-management-byok-hyok
- https://www.cryptomathic.com/blog/what-is-the-difference-between-byok-cyok-hyok
- https://cloudsecurityalliance.org/blog/2026/01/05/choosing-the-right-key-responsibility-model

### コンプライアンス
- https://scytale.ai/center/soc-2/the-soc-2-compliance-checklist/
- https://www.secureleap.tech/blog/iso-27001-checklist-for-audit
- https://supabase.com/docs/guides/security/soc-2-compliance
- https://github.com/orgs/supabase/discussions/17659
- https://www.isms.online/pci-dss/vs-gdpr/
- https://www.sn-hoki.co.jp/articles/article1201314/
- https://blog.jpac-privacy.jp/proposedamendmentstothepersonalinformationprotectionact_2601/

### IaC
- https://dev.to/inboryn_99399f96579fcd705/top-10-iac-tools-for-devops-in-2026-which-one-wins-for-multi-cloud-terraform-pulumi-opentofu-hfb
- https://encore.dev/articles/terraform-alternatives
- https://towardsthecloud.com/blog/aws-cdk-vs-terraform
- https://dasroot.net/posts/2026/01/infrastructure-as-code-terraform-opentofu-pulumi-comparison-2026/

### 認定 / スキルセット
- https://www.examcert.app/blog/cybersecurity-certification-roadmap-2026/
- https://secithub.com/cybersecurity-certifications-2026-part-2/
- https://flashgenius.net/blog-article/ccsp-certification-guide-2026-cost-exam-prep-and-roi
- https://www.examcert.app/blog/is-cissp-worth-it-2026/
- https://orca.security/resources/blog/top-5-cloud-security-industry-certifications/

### 脅威モデリング
- https://www.practical-devsecops.com/what-is-stride-threat-model/
- https://linddun.org/
- https://www.cybersecuritydive.com/news/cyber-threat-modeling-framworks-STRIDE-LINDDUN-decision-trees/713587/
- https://www.nist.gov/privacy-framework/linddun-privacy-threat-modeling-framework

### Supabase / SPA セキュリティ
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- https://www.leanware.co/insights/supabase-best-practices
- https://oneuptime.com/blog/post/2026-01-15-content-security-policy-csp-react/view
- https://nextjs.org/docs/app/guides/content-security-policy

### ROI / 過剰投資回避
- https://safe.security/resources/blog/measuring-cybersecurity-roi-a-framework-for-2026-decision-makers/

---

# handoff
handoff:
  - to: pm
    context: "Phase 1（即対応・1-2週間）のタスクを起票検討。社長壁打ち後に確定"
    tasks:
      - "[security] CSP ヘッダ vercel.json 設定（focus-you）"
      - "[security] STRIDE Threat Model 作成（focus-you DFD作成 → 脅威列挙）"
      - "[security] LINDDUN Privacy Threat Model 作成"
      - "[security] Supabase Auth MFA 有効化"
      - "[security] プライバシーポリシー / 利用規約 / Cookie ポリシー草案"
      - "[security] アプリケーションログ収集の仕組み設計"
  - to: 社長
    context: "本レポート Section 3 の壁打ち導線（問い1〜5）について15分セッション希望。判断結果に応じて Phase 1 のタスクスコープを決める"
    tasks:
      - "問い1〜5の中から優先判断する問いを選ぶ"
      - "focus-you の3年後のキャリア像との接続を確認"
