# Vercel vs Cloudflare 徹底比較 — focus-you 移行先評価（2026-04）

> focus-you（個人開発のWebダッシュボード／React+Vite SPA／Supabase バックエンド／現状 Vercel ホスティング）の移行先として、**Vercel と Cloudflare** をフラットに比較する。社長の意思決定軸は「学習効果」「セキュリティ」「価格」「大企業DX市場での通用度」。

**作成日**: 2026-04-17 / **担当**: HD共通リサーチ部 / **対象PJ**: focus-you（個人向け日記・感情分析・AI対話SaaS、将来的に「個人の幸せ・物語」軸での商用化想定）

---

## 0. エグゼクティブサマリ（30秒版）

- **現在のfocus-you規模（個人開発・トラフィック小）では、Vercel Hobby と Cloudflare Free のどちらでも月額 $0 で動く**。コスト差は問題にならない
- **商用化後、1TB帯域を超えた瞬間に Vercel と Cloudflare の差が爆発する**: Vercel Pro 1TB超過 = $0.15/GB、Cloudflare = **常に egress $0**。10TB帯域なら Vercel +$1,350 vs Cloudflare $5
- **学習価値・大企業DX通用度では Cloudflare が上**: Workers/R2/D1/Zero Trust のスタックは AWS Lambda の知識と地続きで、エンタープライズ案件で「触ったことがある」と言える幅が広い。Vercel は Next.js 文脈に閉じた知識
- **セキュリティの「標準装備度」も Cloudflare が圧倒的に上**: Cloudflare Free でも DDoS 無制限・WAF 基本ルール・Bot Fight Mode が無料。Vercel Free は Bot Filter は来たが、本格 WAF（OWASP Top 10 ルールセット）は **Enterprise 限定**
- **focus-you の現実解（社長の意思決定）**:
  - **「最小コスト＋学習効果重視」を選ぶなら Cloudflare Pages + Workers 移行**。月 $5 で帯域フリー、Workers/R2/D1 を触れば DX市場で語れる
  - **「現状維持＋商用化見極め」なら Vercel Pro $20 のまま**。ただし MAU 増加時の overage を毎月モニタする運用が必要
  - **学習目的で第3案: 並行運用**。本番は Vercel 維持、prototype/branch deploy を Cloudflare で並走させる。月+$5 で Cloudflare スキル獲得

---

## 1. Vercel（公知情報）

### 1.1 プラン体系（2026-04時点）

| プラン | 月額 | 用途 | 商用利用 |
|---|---|---|---|
| Hobby | $0 | 個人・非営利 | **不可**（Fair Use Guideline で禁止） |
| Pro | $20/seat/月（$20 usage credit 込み） | スタートアップ・小〜中規模 | 可 |
| Enterprise | Custom（営業見積もり） | 大企業・SLA要 | 可 |

**重要な制約**:
- Hobby は2024年に Fair Use Policy が厳格化され、**スポンサー付きOSSや収益化サイトもアップグレード必須**
- focus-you は商用化前提なので Hobby は実質「学習用Sandbox」止まり

[Vercel Pricing](https://vercel.com/pricing) / [Vercel Hobby docs](https://vercel.com/docs/plans/hobby)

### 1.2 含まれるリソース

| 項目 | Hobby | Pro |
|---|---|---|
| Fast Data Transfer（帯域） | 100 GB/月 | 1 TB/月 |
| Edge Requests | 1M/月 | 10M/月 |
| Function 呼び出し（Active CPU） | 4 時間/月 | $20 credit 内に含まれる |
| Provisioned Memory | 360 GB-hrs/月 | $20 credit 内 |
| Image Transformations | 5,000/月 | $20 credit 内 |
| Blob Storage | 1 GB/月 | $0.023/GB |
| Build時間（Turbo machine） | 制限あり | $0.126/分（2026-02以降のデフォルト） |
| Team seats（dev） | 1 | $20/seat/月（追加） |
| Viewer seats | — | 無制限・無料 |
| SSO（SAML） | — | $300/月 add-on |

### 1.3 オーバーレート（Pro超過時の単価）

| リソース | 単価 |
|---|---|
| Fast Data Transfer | **$0.15/GB**（1TB超過分） |
| Edge Requests | $2.00/百万（10M超過分） |
| Active CPU | $0.128/CPU-時 |
| Provisioned Memory | $0.0106/GB-時 |
| Function Invocations | $0.60/百万 |
| Image Transformations | $5.00/千枚（5K超過分） |
| Build時間（Turbo） | $0.126/分 |

**実例**: 1TB→10TBで月+$1,350、急に bot トラフィックや SNS バズが来た時の overage が痛い。Medium 記事 [$46,485 for a Static Website](https://medium.com/@gsoumyadip2307/46-485-for-a-static-website-vercel-pricing-is-getting-wild-35c4d61a89a9) は極端例だが、**Pro $20 → $300 に化ける事例**は珍しくない（[Schematic blog](https://schematichq.com/blog/vercel-pricing)、[Truefoundry](https://www.truefoundry.com/blog/understanding-vercel-ai-gateway-pricing)）

### 1.4 セキュリティ機能（プラン別）

| 機能 | Hobby | Pro | Enterprise |
|---|---|---|---|
| DDoS Mitigation（L3/L4） | ◯ 無料 | ◯ 無料 | ◯ |
| Vercel Firewall（基本） | ◯ | ◯ | ◯ |
| カスタム Firewall ルール数 | 3 | 40 | 1,000 |
| Bot Filter（ワンクリック） | ◯ 無料（2025〜） | ◯ | ◯ |
| AI Bot Ruleset | ◯ | ◯ | ◯ |
| Attack Challenge Mode | ◯ | ◯ | ◯ |
| BotID | ◯ | ◯ | ◯ |
| **OWASP Top 10 Managed Ruleset** | — | — | **◯ Enterprise 限定** |
| Advanced Deployment Protection | — | $150/月 add-on | ◯ |
| WAF observability dashboard | — | — | ◯ |
| Audit logs | — | — | ◯ |
| Secure Compute（VPC peering） | — | — | ◯ |

[Vercel Security](https://vercel.com/security) / [Vercel Firewall docs](https://vercel.com/docs/vercel-firewall) / [Bot Management](https://vercel.com/docs/bot-management)

### 1.5 監視・ログ・Observability

| 機能 | Hobby | Pro | Enterprise |
|---|---|---|---|
| Runtime/Build/Function ログ | 制限あり | ◯ | ◯ |
| Web Analytics | ◯ 基本 | ◯ 詳細 | ◯ |
| Speed Insights（RUM） | — | ◯ | ◯ |
| Observability Plus | — | ◯（2026-04-03以降は自動有効） | ◯ |
| Vercel Drains（OTel/外部出力） | — | ◯ $0.50/GB | ◯ |
| Datadog/Logflare統合 | — | ◯ | ◯ |

[Vercel Observability](https://vercel.com/products/observability) / [Vercel Drains](https://vercel.com/blog/introducing-vercel-drains)

### 1.6 認定・コンプライアンス

| 認定 | Vercel |
|---|---|
| SOC 2 Type 2 | ◯（Security, Confidentiality, Availability） |
| ISO 27001:2022 | ◯ |
| GDPR | ◯（EU SCC + UK Addendum） |
| HIPAA（BAA） | ◯（Enterprise契約で BAA 締結可） |
| PCI DSS v4.0 | ◯（SAQ-D + SAQ-A AOC） |
| EU-U.S. Data Privacy Framework | ◯ |
| TISAX AL2（自動車業界） | ◯ |
| FedRAMP | ✕（米政府調達不可） |

[Vercel Compliance](https://vercel.com/docs/security/compliance) / [Trust Center](https://security.vercel.com/)

### 1.7 メリット・デメリット

**メリット**
- Next.js との統合が完璧（focus-you は React+Vite なので恩恵小）
- ゼロ設定でデプロイ完了、git push → preview URL の体験は業界最速級
- Preview deployments + Comments のレビュー体験が秀逸
- Vercel Drains で OTel 出力できるので外部監視ツールと統合しやすい
- 営業されるとき「Vercel使ってます」は通じる。Next.js文脈の事実上の標準

**デメリット**
- **帯域 overage が高い**（$0.15/GB、Cloudflare の事実上ゼロと比較してケタ違い）
- **本格 WAF は Enterprise 限定**（OWASP Top 10 Managed Ruleset）。中小規模で WAF カスタマイズが必要なら割高
- Hobby の商用利用禁止。MVP で「Hobbyで節約」が効かない
- AWS依存（Vercel CDN は AWS 上）。AWS障害でVercelも止まる
- 大企業DX市場では Next.js 周辺以外で語れない（Vue/Svelte でも動くが市場では Next.js プラットフォーム認識）

---

## 2. Cloudflare（公知情報）

### 2.1 プラン体系（2026-04時点）

Cloudflareは「**Application Services（Free/Pro/Business/Enterprise）**」と「**Developer Platform（Workers/Pages, Free/Paid）**」が別軸の課金体系。focus-youの文脈では両方関係する。

#### Application Services

| プラン | 月額 | 主用途 |
|---|---|---|
| Free | $0 | 個人サイト・小規模、DDoS無制限 |
| Pro | $25/月（per domain） | 中小ビジネス、画像最適化、Bot Fight Mode |
| Business | $250/月（per domain） | 中規模、PCI、カスタム証明書 |
| Enterprise | Custom | Bot Management、Zero Trust、SLA |

#### Developer Platform（Workers + Pages）

| プラン | 月額 | 内訳 |
|---|---|---|
| Free | $0 | Workers 100K req/日、Pages **無制限静的帯域** |
| Paid | $5/月（アカウント単位） | Workers 10M req/月、CPU 30M ms/月含む |

[Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) / [Pages Pricing](https://developers.cloudflare.com/pages/functions/pricing/) / [Cloudflare Plans](https://www.cloudflare.com/plans/)

### 2.2 Workers/Pages 含まれるリソース（2026-04）

| 項目 | Workers Free | Workers Paid |
|---|---|---|
| Workers リクエスト | 100K/日 | 10M/月含む（追加 $0.30/百万） |
| CPU 時間/呼び出し | 10ms上限 | 制限緩和、30M CPU-ms 含む（追加 $0.02/百万 ms） |
| Pages 静的帯域 | **無制限** | **無制限** |
| Pages ビルド | 500/月 | 5,000/月 |
| Workers KV 読み取り | 100K/日 | 10M/月 含む（追加 $0.50/百万） |
| Workers KV 書き込み | 1K/日 | 1M/月 含む（追加 $5/百万） |
| Workers KV ストレージ | 1 GB | 1 GB 込み（追加 $0.50/GB-月） |
| D1 行読み | 5M/日 | 25B/月 含む（追加 $0.001/百万） |
| D1 行書き | 100K/日 | 50M/月 含む（追加 $1.00/百万） |
| D1 ストレージ | 5 GB | 5 GB 込み（追加 $0.75/GB-月） |
| R2 ストレージ | 10 GB-月 | $0.015/GB-月（10GB含む） |
| R2 Class A 操作 | 1M/月 | $4.50/百万（1M含む） |
| R2 Class B 操作 | 10M/月 | $0.36/百万（10M含む） |
| **R2 egress（外向き）** | **$0** | **$0** |
| Workers AI | 10K Neurons/日 | $0.011/1K Neurons |

[R2 Pricing](https://developers.cloudflare.com/r2/pricing/) / [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

### 2.3 セキュリティ機能（プラン別）

| 機能 | Free | Pro $25 | Business $250 | Enterprise |
|---|---|---|---|---|
| **DDoS Mitigation** | ◯ 無制限 | ◯ | ◯ | ◯ |
| Universal SSL | ◯ | ◯ | ◯ | ◯ |
| WAF Managed Ruleset | — | ◯ 基本 | ◯ + Free OWASP | ◯ + Cloudflare Managed |
| **WAF カスタムルール** | — | 20 | 100 | 1,000+ |
| **Rate Limiting** | ◯ 制限あり | ◯ | ◯ + 高度 | ◯ |
| Bot Fight Mode（基本） | ◯ | ◯ | ◯ | ◯ |
| **Bot Management（ML score）** | — | — | — | ◯ Enterprise add-on |
| Page Rules | 3 | 20 | 50 | 125+ |
| Cloudflare Turnstile（CAPTCHA代替） | ◯ 無料 | ◯ | ◯ | ◯ |
| Image Optimization | — | ◯ | ◯ | ◯ |
| **Zero Trust Free（最大50ユーザ）** | ◯ | ◯ | ◯ | ◯ |

**重要な事実**: **Cloudflare Free でも DDoS Mitigation は無制限**。これは業界異常値で、Vercel Free の DDoS が「自動だが規模制限あり」とは違う設計思想（[Cloudflare Plans](https://www.cloudflare.com/plans/)）

[Cloudflare WAF docs](https://developers.cloudflare.com/waf/get-started/) / [Bot Management](https://developers.cloudflare.com/bots/get-started/bot-management/)

### 2.4 監視・ログ・Observability

| 機能 | Free | Paid |
|---|---|---|
| Workers Observability（メトリクス・ログ） | ◯ | ◯ |
| Logpush（外部出力） | — | ◯ Enterprise（Workers Paid別） |
| Log Explorer（GA） | — | Enterprise |
| Web Analytics（プライバシー配慮） | ◯ 無料 | ◯ |
| Workers Trace Events | ◯ 制限 | ◯ |
| Grafana連携 | — | ◯（Logpush経由） |

[Workers Observability blog](https://blog.cloudflare.com/introducing-workers-observability-logs-metrics-and-queries-all-in-one-place/) / [Logpush docs](https://developers.cloudflare.com/workers/observability/logs/logpush/)

### 2.5 認定・コンプライアンス

| 認定 | Cloudflare |
|---|---|
| SOC 2 Type 2 / SOC 3 | ◯ |
| ISO 27001:2013 | ◯（2019年から継続） |
| ISO 27701:2019 | ◯（**processor + controller 両方**、業界先行事例） |
| ISO 27018 | 評価中（ロードマップ） |
| PCI DSS Level 1 | ◯（Merchant + Service Provider両方、年次） |
| HIPAA（BAA） | ◯（Enterprise） |
| GDPR | ◯ |
| FedRAMP | **In Process**（Moderate baseline、Vercelは無し） |
| C5（独BSI） | ◯ |
| StateRAMP | ◯ |
| 1.1.1.1 第三者プライバシー監査 | ◯ |

[Cloudflare Compliance Updates](https://blog.cloudflare.com/updates-to-cloudflare-security-and-privacy-certifications-and-reports/) / [Trust Hub](https://www.cloudflare.com/trust-hub/compliance-resources/)

### 2.6 メリット・デメリット

**メリット**
- **帯域コストが事実上ゼロ**（R2 egress $0、Pages 静的帯域無制限）。バズったときに財布が燃えない
- **300+データセンター**のグローバルEdge網。日本含む全リージョンで低レイテンシ
- **Workers は V8 isolate**で起動0msに近い（Vercel/Lambda の cold start が無い）
- **Zero Trust 50ユーザまで無料**で、企業向けセキュリティ思想を学べる
- **大企業DX市場での需要急拡大**: Cloudflare Workers の inference req は **YoY +4,000%**（[Yahoo Finance記事](https://finance.yahoo.com/news/cloudflares-workers-platform-lead-next-134900938.html)）、Y Combinator 2025-W コホートの **40%** が Cloudflare 採用
- 認定の網羅性が Vercel より広い（FedRAMP、C5、StateRAMP）
- D1 が SQLite ベースで Lite な OLTP として使え、エッジ近接（Supabase 補完候補）

**デメリット**
- **Bot Management（ML スコア型）は Enterprise add-on**。中規模向け Bot 機能は Bot Fight Mode（簡易）止まり
- Workers の CPU 時間制限（Free 10ms/呼び出し）でやれることが限定。Paid で大幅緩和
- Vercel ほどの Next.js 統合体験はなく、設定が一段増える（wrangler.toml、`compatibility_date`）
- D1 は Beta 期間が長く、本格 OLTP 需要には Supabase の方が成熟
- Pages の Functions（Workers）と Pure Static は別課金体系で初心者は混乱しやすい
- ドキュメントが多すぎて初学者がどこから読むか迷う（公式 docs 量は Vercel の3倍）

---

## 3. 比較マトリクス

### 3.1 価格（focus-you 想定シナリオ別）

#### シナリオA: 個人開発 / 100 MAU 程度（現状）
帯域月 5GB、Function呼び出し 50K/月、ビルド 30回/月

| 項目 | Vercel Hobby | Vercel Pro | Cloudflare Free | Cloudflare Workers Paid |
|---|---|---|---|---|
| 月額（基本） | $0 | $20 | $0 | $5 |
| 帯域（5GB） | 込み | 込み | 込み | 込み |
| Functions | 込み | 込み | 込み | 込み |
| **合計** | **$0** | **$20** | **$0** | **$5** |
| **円換算（1USD=150円）** | **0円** | **3,000円** | **0円** | **750円** |

商用利用想定なら Vercel Hobby は使えないので、現実的には **Vercel Pro $20 vs Cloudflare Workers Paid $5 = 月15ドル差**。

#### シナリオB: 商用化後 / 1,000 MAU
帯域月 100GB、Function呼び出し 5M/月、ビルド 200回/月、画像変換 5K/月

| 項目 | Vercel Pro | Cloudflare Workers Paid |
|---|---|---|
| 月額（基本） | $20（$20 credit 込み） | $5 |
| 帯域（100GB） | 込み（1TB枠内） | 込み（無制限） |
| Functions（5M） | 概算 $5（credit内に収まる可能性高） | 込み（10M枠内） |
| 画像変換（5K） | 込み | Cloudflare Images別 $5 |
| ビルド時間（Turbo, 200回x3min） | 200×3×$0.126 = $76（credit超過分） | 込み（5K枠内） |
| **合計** | **$96** | **$10〜$15** |
| **円換算** | **14,400円** | **1,500〜2,250円** |

**1,000 MAU で月8倍の差**。ただし Vercel の Build Turbo を Standard に戻せば $20 まで圧縮可能（[Vercel Pricing](https://vercel.com/pricing)）

#### シナリオC: スパイク時 / バズ発生 5TB帯域

| 項目 | Vercel Pro | Cloudflare Workers Paid |
|---|---|---|
| 月額（基本） | $20 | $5 |
| 帯域（5TB - 1TB free = 4TB overage） | 4,000GB × $0.15 = **$600** | **$0** |
| **合計** | **$620** | **$5** |
| **円換算** | **93,000円** | **750円** |

**バズった瞬間 Vercel は90,000円飛ぶ**。Cloudflareは変わらず750円。これが「egress $0」の威力。

### 3.2 パフォーマンス

| 項目 | Vercel | Cloudflare |
|---|---|---|
| CDN POP数 | 数百（AWS+独自） | **300+都市** |
| Cold start | Lambda 系 数百ms | V8 isolate **〜0ms** |
| Edge Function 実行場所 | Edge Network（限定） | 全 Workers ロケーション |
| Anycast | ◯ | ◯ |
| 静的アセット配信速度 | 速い | 速い |
| 日本リージョン | ◯（東京） | ◯（東京・大阪） |

体感差は focus-you レベルでは誤差。**スケール時の cold start差** は Cloudflare 有利。

### 3.3 開発者体験（DX）

| 項目 | Vercel | Cloudflare |
|---|---|---|
| git連携 | ◯ 完璧（GitHub/GitLab/Bitbucket） | ◯（Pages も同様） |
| CLI | `vercel` 簡単 | `wrangler` やや学習要 |
| Preview Deploy | ◯ 業界トップ | ◯（branch deploy） |
| 環境変数管理 | UI ベース | wrangler.toml + UI |
| Vite SPA 対応 | ◯ ゼロ設定 | ◯（[Vite plugin tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)） |
| ローカル開発 | `vercel dev` | `wrangler dev`（実際の Workers runtime で動く） |
| 設定の透明性 | UI 中心、隠蔽多め | ファイル中心、明示的 |
| ドキュメント量 | 適量 | 大量 |
| Discord/Community | 大 | 大 |

**focus-you（React+Vite）への適合性**: どちらも対応。Cloudflare の方が「ローカルで実環境を動かせる」分、デバッグしやすい。

### 3.4 ベンダーロックイン度

| 項目 | Vercel | Cloudflare |
|---|---|---|
| 静的ホスティング | 低（git push なら他へ移行可） | 低 |
| Edge Functions / Workers | 中（Vercel Edge Function 独自API） | 中（Workers API 独自だが Web標準寄り） |
| KV/データストレージ | 高（Vercel KV/Blob 独自） | 中（KV/D1/R2 独自だが S3互換あり） |
| 画像最適化 | 中 | 中 |
| 監視・ログ | 中（OTel 出力で逃げられる） | 中（Logpush で逃げられる） |
| 撤退コスト | 中 | 低〜中 |

**Cloudflare の方が「Web標準寄り」のAPI設計**で、撤退時の書き直し範囲が小さい傾向。

### 3.5 学習価値（市場での需要）

| 項目 | Vercel | Cloudflare |
|---|---|---|
| 履歴書での通用度 | 「Next.js + Vercel」で一括理解される | 「Cloudflare Workers/R2/D1」が個別に評価される |
| 求人での頻度（2026） | Next.js プロジェクトに付随 | エッジ・スケール文脈で増加中 |
| エンタープライズ案件 | Next.js + Vercel スタートアップ／中堅 | 大企業DX、CDN置換、Zero Trust 案件 |
| 知識の汎用性 | Next.js 知識に閉じる | AWS Lambda/CloudFront/Cognito の知識と地続き |
| 商用化後の知識転用 | Next.js エコシステム | スケール後にAWS/GCPに移行する知識基盤になる |

**社長のゴール「大企業DXで戦える知識」の観点では Cloudflare 圧勝**。Vercel の知識は「Next.js + Vercel」で1セット、Cloudflare の知識は「Workers + R2 + D1 + Zero Trust + WAF + Bot Management」と単位が分解される。後者の方が**案件遭遇率が高い**。

[Cloudflare AI Adoption Q4 Deep Dive](https://markets.financialcontent.com/stocks/article/stockstory-2026-2-11-net-q4-deep-dive-ai-adoption-and-enterprise-sales-drive-cloudflares-momentum)

### 3.6 セキュリティ標準装備度

| セキュリティ機能 | Vercel | Cloudflare |
|---|---|---|
| DDoS Mitigation 規模 | プラン共通、自動 | **無制限・全プラン共通** |
| WAF 基本 | 全プラン（限定的） | Free 以外で本格的 |
| WAF OWASP Top 10 ルールセット | **Enterprise のみ** | **Pro $25 から** |
| Bot 簡易 | 全プラン | 全プラン |
| Bot ML スコア | Enterprise | Enterprise |
| Rate Limiting | Enterprise（Pro は限定） | **全プラン** |
| Zero Trust | Enterprise | **Free 50ユーザまで** |
| Audit Logs | Enterprise | Pro以上 |

**個人開発レベルでもエンタープライズ並みのセキュリティ思想を学べるのは Cloudflare**。Vercel は Enterprise でしか触れない領域が多い（社長が大企業DXで戦うなら、Vercel経験では不足）

### 3.7 大企業DX観点での通用度

| 観点 | Vercel | Cloudflare |
|---|---|---|
| Zero Trust（SASE） | ✕ | **◎ 業界リーダー** |
| エッジ化案件（CDN置換） | △ | ◎ |
| WAF置換案件 | △ | ◎ |
| Bot対策案件 | △ | ◎ |
| 静的サイトホスティング | ◎ | ◎ |
| Next.jsアプリホスティング | ◎ | △（vinext で対応中） |
| FedRAMP/政府調達 | ✕ | In Process |
| 国際展開（多リージョン） | ◯（AWS依存） | ◎（独自網） |

**社長の「大企業DXコンサル」想定文脈では、Cloudflare の知識ストックの方が圧倒的に売り物になる**。

---

## 4. React/Vite SPA + Supabase 構成での適合性

### 4.1 現状（Vercel）の構成

```
[ブラウザ]
   ↓ HTTPS
[Vercel Edge / CDN]（focus-you 静的アセット配信）
   ↓ React SPA で Supabase JS Client 直接呼び出し
[Supabase: Auth/PostgreSQL/Realtime/Edge Functions]
```

- ビルド成果物 (`dist/`) を Vercel CDN にデプロイ
- Vercel Functions は今のところ未使用、または最小利用
- Supabase Edge Function（OpenAI/Anthropic proxy）を別エンドポイントで呼ぶ
- 認証は Supabase Auth、Vercel は静的ホスティング役

### 4.2 Cloudflare Pages + Workers に移行する場合のパス

#### 最小変更パス（Pure Static）
1. GitHub リポジトリを Cloudflare Pages に接続
2. ビルド設定: `npm run build` → `dist/` を出力
3. SPA ルーティング: `_redirects` か `wrangler.toml` の `not_found_handling: "single-page-application"` 設定
4. カスタムドメインを Cloudflare に向ける
5. **想定工数: 30分〜1時間**

[Cloudflare Pages Vite tutorial](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/) / [React on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)

#### 進化パス（Workers併用）
1. 上記＋Workers で API proxy/Edge logic を実装
2. Supabase Edge Function を Cloudflare Workers に移行する選択肢もあり
3. R2 を画像/添付保存に追加（Supabase Storage 代替）
4. **想定工数: 1〜3日（Workers 設計含む）**

[Cloudflare Vite plugin tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/) / [vinext (Cloudflare Vite plugin)](https://github.com/cloudflare/vinext)

### 4.3 移行手順（Vercel → Cloudflare Pages、focus-you 想定）

```bash
# 1. Cloudflare アカウント作成、Pages ダッシュボードへ
# 2. GitHub 連携、focus-you リポジトリ選択
# 3. ビルド設定:
#    - Framework preset: Vite
#    - Build command: npm run build
#    - Build output: dist
# 4. 環境変数を Cloudflare Pages にコピー（VITE_SUPABASE_URL等）
# 5. _redirects ファイルを public/ に追加:
#    /*   /index.html   200
# 6. デプロイ → preview URL で検証
# 7. カスタムドメイン focus-you.example を Cloudflare に向ける
# 8. Vercel 側のドメイン設定を解除（DNS切替）
# 9. Vercel プロジェクトは1〜2週間並行運用後に削除
```

**並行運用の重要性**: Vercel/Cloudflare 両方にデプロイし、DNSは段階移行。問題があれば即座に Vercel に戻す。

### 4.4 Supabase 連携の考慮点

| 項目 | Vercel | Cloudflare |
|---|---|---|
| Supabase JS Client | ◯ 動く | ◯ 動く |
| Edge Function での Supabase 呼び出し | ◯（Vercel Functions） | ◯（Workers） |
| Realtime（WebSocket） | ◯ | ◯ |
| Auth callback URL | Vercel ドメイン設定 | Cloudflare ドメイン設定 |
| RLS / publishable key | 影響なし | 影響なし |

**Supabaseの設計思想（フロント直叩き、RLSで防御）は両者で動く**。移行で書き換える場所は環境変数とドメイン設定くらい。

---

## 5. 推奨パス（focus-you 文脈での3案）

### 案A: 「学習効果＋最小コスト」を取る → **Cloudflare Pages 移行**
- **コスト**: 月 $0〜$5
- **学習価値**: ◎（Workers/R2/D1/Zero Trust の知識獲得）
- **工数**: 1〜2日
- **リスク**: 移行作業中の DNS 切り替えミス、新しい技術スタックの学習コスト
- **推奨条件**: 社長が「Cloudflareの知識を案件で売れるレベルまで深掘りする」覚悟があるなら

### 案B: 「現状維持＋商用化見極め」 → **Vercel Pro 継続**
- **コスト**: 月 $20（overage 注意）
- **学習価値**: △（Next.js文脈の知識止まり）
- **工数**: 0
- **リスク**: バズ・スパイク時の overage、本格 WAF が Enterprise 必要
- **推奨条件**: 社長が focus-you 開発自体に集中したく、インフラ移行に時間使いたくないなら

### 案C: 「並行運用で学習」 → **Vercel本番＋Cloudflare 学習用 staging**
- **コスト**: 月 $20 + $0（Cloudflare Free）= $20
- **学習価値**: ◎（実環境で両方触れる）
- **工数**: 半日（Cloudflare staging 構築）
- **リスク**: 2環境の同期ズレ
- **推奨条件**: いきなり本番移行は怖いが、Cloudflareの知識は欲しい場合の中間案

---

## 6. 公知情報の限界（何がわからないか）

本レポートは2026-04-17時点の公式価格・公式ドキュメント・解説記事で書いている。以下は確証がない:

1. **Vercel の Build Turbo $0.126/分の overage 実額**: focus-you のビルド時間（Vite SPA で2〜3分想定）と build 頻度（PR数）に強く依存。実測しないと月額化できない
2. **Cloudflare Workers AI の Neuron 単価が "unit-based pricing" に移行中**: 2025-02 のアップデートで「単位ベース」に移行宣言があり、各モデルの実額が個別ページに分散している。focus-you で具体的にどのモデルを使うかで $/1Kリクエストが変わる
3. **Cloudflare の Bot Management（ML score型）の正確な月額**: Enterprise add-on としか公開されておらず、focus-you 規模での見積もりは Cloudflare 営業に問い合わせ必須
4. **Vercel と Cloudflare の SLA保証範囲の差**: Vercel Enterprise は 99.99%、Cloudflare Enterprise は契約による。focus-you が B2B 売りに回ったとき、SLA要件が Pro 相当（99.9%）で足りるか Enterprise が必要かは契約次第
5. **focus-you の実トラフィック分布**: 100/1,000/10,000 MAU で帯域・関数呼び出しがどう増えるかは仮定。日記アプリの典型値は「閲覧 > 書き込み > 集計バッチ」のはず
6. **競合プラットフォーム**: Netlify, Render, Fly.io, Deno Deploy はスコープ外。比較するなら別レポート必要
7. **Cloudflare Pages の Function（Workers）と Workers 単独の境界**: 2026年現在、Cloudflare 自身が「Pages Functions ↔ Workers の統合」を進めており、APIや課金が変わる可能性あり

**精度を上げるために社長が確認すべきこと**:
- [ ] 現状 Vercel の Usage ダッシュボードで focus-you の月次帯域・Function呼び出し実績を確認
- [ ] Cloudflare Free アカウントを作って focus-you を staging デプロイし、ビルド時間・帯域を実測
- [ ] focus-you の想定トラフィック（MAU x 平均PV/MAU）を見積もり、シナリオB/C のどこに着地するかを決める
- [ ] 商用化時に「セキュリティ要件として何を約束するか」を決める（B2C なら WAF Pro 程度、B2B なら Enterprise WAF + Audit Log）

---

## 7. 壁打ちモードへの導線（社長に確認したい論点）

### 論点1: 「学習効果」と「最小コスト」のどちらを優先するか

本レポートは両方並列で扱ったが、**現時点の focus-you は両立可能**:

- **個人開発フェーズ（〜100 MAU）では、Cloudflare Free が「最小コスト＝$0」かつ「学習効果＝Workers/R2/D1 触れる」を両立する**。Vercel Hobby は商用化縛りで先がない
- ただし、**Cloudflare 移行に1〜2日の工数**を払う覚悟があるかは別問題

**問い**: 「社長は今週末、Cloudflare staging を立てて触ってみる時間ありますか？ なければ Vercel Pro 継続で『次の3ヶ月で1日確保』を予約してください」

### 論点2: 商用化のタイムラインと、その時点での技術スタックは

本レポートの試算は「100→1,000→10,000 MAU」を仮定したが、**この時間軸が1年か3年かで推奨が変わる**:

- **1年で1,000 MAU 想定** → 今のうちに Cloudflare に移行して Workers/R2 の知識ストックを稼ぐ価値大
- **3年で 1,000 MAU 想定** → Vercel 維持、商用化目処が立った時点で再評価
- **そもそも商用化しない / 学習PJ位置付け** → Cloudflare 移行は「学習として正解」、コスト$0で得るものが大きい

**問い**: 「focus-you の商用化、社長の頭の中で『いつまでに MRR いくら』の絵はありますか？ 無いなら、その絵を描くことが基盤選定より先」

### 論点3: 大企業DXで戦うなら、どの認定・知識が最も価値あるか

本レポートで「Cloudflare の方が大企業DX市場で通用度高い」と書いたが、**社長が狙う案件の業種で答えが変わる**:

- **金融・医療**: HIPAA + PCI DSS + ISO 27701 = Cloudflare（FedRAMP も追加で在米政府向け）
- **自動車**: TISAX = Vercel が認定持ち（Cloudflareは未確認）
- **MS365 系大企業**: Fabric/Azure 連携の方が刺さる（Vercel/Cloudflare ともに直接競合せず）
- **AI/エッジ系スタートアップ**: Cloudflare Workers/Workers AI がブームの中心

**問い**: 「社長が今後3年で営業したい大企業DX案件、業種を1つ選ぶなら何ですか？ そこから逆算すると、どの認定・知識を優先すべきかが見えます」

### 論点4: セキュリティに「個人開発レベル」と「企業レベル」のどちらを今選ぶか

- **個人開発レベル**: Vercel Hobby/Pro の「自動 DDoS + Bot Filter」で十分。WAFカスタムは不要
- **企業レベル**: Cloudflare Pro $25 で OWASP Top 10 + Rate Limiting + WAFカスタム20個。学習価値も得られる
- **完全エンタープライズ**: Vercel Enterprise / Cloudflare Enterprise（営業見積もり）で Bot ML、Audit Logs、Secure Compute

**問い**: 「focus-you の商用化時、ユーザに『セキュリティについて何を約束したいか』 イメージありますか？ 『日記データの不正アクセス防止』だけなら Pro 相当、『監査ログをユーザに見せる』なら Enterprise 必須」

---

## 8. 結論

### リサーチ部としての明確な推奨

**今やるべきこと（2026-04時点、focus-you 個人開発フェーズ）**:

1. **「案C（並行運用）」を推奨**: Vercel本番を維持しながら、Cloudflare Free でstagingを作る
2. **目的**: (a) Cloudflareの操作感を1〜2週間で体得する、(b) 移行リスクを実環境でゼロに近づける、(c) ベンダー比較の判断材料を「触ったうえで」持つ
3. **学習投資の上限**: 週末1日分（4〜6時間）。これ以上時間をかけるならスケジュール再調整

**3〜6ヶ月後にやること**:
- focus-you の商用化方針が決まったタイミングで「案A（Cloudflare 完全移行）」or 「案B（Vercel継続）」を再選定
- そのタイミングで本レポートの§5を再読し、当時のMAU実績で判断

**やってはいけないこと**:
- 「Cloudflareが安いから今すぐ全移行」は、focus-you 開発の本筋を停滞させる
- 「Vercel高いから Cloudflare」だけの理由で移行 → 学習工数が回収できないと意味がない
- Vercel Hobby に戻す → 商用化縛りで先がない

### 推奨基盤の理由（再掲）

| 項目 | 推奨 | 理由 |
|---|---|---|
| **学習効果重視なら** | Cloudflare | Workers/R2/D1/Zero Trust が DX市場で需要急拡大、知識が分解されて他案件に転用しやすい |
| **最小コスト重視なら** | Cloudflare | egress $0 でスパイク対応に強く、Pages 静的帯域は Free でも無制限 |
| **現状維持・工数最小なら** | Vercel | Pro $20 で十分、Vite SPA がそのまま動く、移行リスクなし |
| **大企業DX案件に売り込むなら** | Cloudflare 知識 | エッジ・WAF・Bot・Zero Trust の各単位で案件化されるため売り物が多い |
| **個人開発の楽しさ重視なら** | どちらでも | Vercel の DX体験は秀逸、Cloudflare の自由度も魅力 |

---

## ネクストアクション

### 短期（今週中）
- [ ] 本レポートを社長が通読し、§7 の4論点に自分なりの答えを出す
- [ ] Vercel Usage ダッシュボードを開いて focus-you の月次実績を確認（帯域・Function呼び出し）
- [ ] Cloudflareアカウントを作成（無料、クレカ不要）

### 中期（今月中）
- [ ] focus-you の Vite ビルドを Cloudflare Pages に staging deploy（半日工数）
- [ ] Workers の `wrangler dev` でローカル開発を1回触る
- [ ] Cloudflare Zero Trust Free を会社サイトに適用してみる（学習）

### 長期（2026 Q2〜Q3）
- [ ] focus-you の商用化方針確定（案A/B/C のどれを採用するか）
- [ ] 採用後、本番DNS切替＋並行運用1週間
- [ ] Vercel/Cloudflare のいずれかに最終統合

---

## 参照ソース（アクセス日: 2026-04-17）

### Vercel 公式
- [Vercel Pricing](https://vercel.com/pricing)
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)
- [Vercel Pricing docs](https://vercel.com/docs/pricing)
- [Vercel Security](https://vercel.com/security)
- [Vercel Firewall docs](https://vercel.com/docs/vercel-firewall)
- [Vercel Bot Management](https://vercel.com/docs/bot-management)
- [Vercel Compliance](https://vercel.com/docs/security/compliance)
- [Vercel Trust Center](https://security.vercel.com/)
- [Vercel Observability](https://vercel.com/products/observability)
- [Vercel Drains](https://vercel.com/blog/introducing-vercel-drains)
- [Vercel ISO 27001 announcement](https://vercel.com/blog/vercel-iso-27001-security)
- [Vercel Migration Guide from Cloudflare](https://vercel.com/kb/guide/migrate-to-vercel-from-cloudflare)
- [Vercel Security Roundup](https://vercel.com/blog/vercel-security-roundup-improved-bot-defenses-dos-mitigations-and-insights)

### Cloudflare 公式
- [Cloudflare Plans](https://www.cloudflare.com/plans/)
- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Pages Functions Pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Workers & Pages Pricing](https://www.cloudflare.com/plans/developer-platform/)
- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Workers KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare WAF Get Started](https://developers.cloudflare.com/waf/get-started/)
- [Cloudflare Bot Management](https://developers.cloudflare.com/bots/get-started/bot-management/)
- [Cloudflare Trust Hub](https://www.cloudflare.com/trust-hub/compliance-resources/)
- [Cloudflare Compliance Updates](https://blog.cloudflare.com/updates-to-cloudflare-security-and-privacy-certifications-and-reports/)
- [Workers Observability](https://blog.cloudflare.com/introducing-workers-observability-logs-metrics-and-queries-all-in-one-place/)
- [Logpush docs](https://developers.cloudflare.com/workers/observability/logs/logpush/)
- [Cloudflare Pages Vite tutorial](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)
- [React on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- [Cloudflare Vite plugin tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)
- [vinext (Cloudflare Vite plugin)](https://github.com/cloudflare/vinext)

### 解説記事・ベンチマーク（クロスチェック用）
- [Vercel Pricing Hidden Costs - Schematic](https://schematichq.com/blog/vercel-pricing)
- [Vercel Pricing 2026 - CheckThat.ai](https://checkthat.ai/brands/vercel/pricing)
- [Vercel Pricing 2026 - Temps](https://temps.sh/blog/vercel-pricing-complete-guide-2026)
- [$46,485 for a Static Website (Vercel)](https://medium.com/@gsoumyadip2307/46-485-for-a-static-website-vercel-pricing-is-getting-wild-35c4d61a89a9)
- [Why Cloudflare is the Best Alternative to Vercel](https://medium.com/@pedro.diniz.rocha/why-cloudflare-is-the-best-alternative-to-vercel-in-2024-an-in-depth-pricing-comparison-7e1d713f8fde)
- [Vercel vs Cloudflare 2026 - DigitalKoncept](https://www.digitalkoncept.in/blog/vercel-vs-cloudflare-hosting-ai-cost-nextjs-vinext-best-practices-2026)
- [Cloudflare vs Vercel - Codegiant](https://blog.codegiant.io/p/cloudflare-vs-vercel)
- [Edge Security Showdown: Vercel vs Cloudflare](https://dev.to/simplr_sh/edge-security-showdown-vercel-firewall-vs-cloudflare-protecting-your-modern-web-app-29m0)
- [Cloudflare Pages vs Netlify vs Vercel 2026](https://danubedata.ro/blog/cloudflare-pages-vs-netlify-vs-vercel-static-hosting-2026)
- [Hosting Platforms Comparison 2026 - GitHub](https://github.com/Wasserpuncher/hosting-platforms-comparison-2026)
- [The Ultimate Edge Migration: Vercel to Cloudflare](https://www.essamamdani.com/blog/the-ultimate-edge-migration-supercharging-your-vercel-projects-on-cloudflare-pages-workers-794540)
- [10 Vercel Alternatives - DigitalOcean](https://www.digitalocean.com/resources/articles/vercel-alternatives)
- [Cloudflare AI Adoption - FinancialContent](https://markets.financialcontent.com/stocks/article/stockstory-2026-2-11-net-q4-deep-dive-ai-adoption-and-enterprise-sales-drive-cloudflares-momentum)

### 同シリーズ内の関連ファイル
- `/workspace/.company/departments/research/data-platforms-2026/07-focus-you-production-platform.md`（focus-you データ基盤評価、本レポートとセット）
- `/workspace/.company/departments/research/data-platforms-2026/00-trial-and-pricing.md`
- `/workspace/.company/departments/research/data-platforms-2026/05-comparison-reflection.md`

---

```yaml
# handoff
handoff:
  - to: materials
    context: "本レポートを基に、社長壁打ち用のVercel vs Cloudflare統合資料を作成。3案（A: Cloudflare移行、B: Vercel維持、C: 並行運用）を意思決定マトリクスとして提示"
    tasks:
      - "意思決定マトリクスのスライド化（3案 × 4軸=コスト/学習/工数/リスク）"
      - "シナリオA/B/Cのコスト比較を1枚で見られるグラフ化"
      - "壁打ち論点4つをディスカッションペーパー化（社長が手元で答えを書ける形式）"
  - to: pm
    tasks:
      - "「Cloudflare staging構築（半日工数）」をTODO化、優先度: 通常、期限: 今月中"
      - "「focus-you Usage実績確認」をTODO化、優先度: 高、期限: 今週中"
      - "「商用化方針確定」をTODO化、優先度: 高、期限: 2026 Q2末"
```
