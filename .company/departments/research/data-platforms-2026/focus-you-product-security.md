# focus-you 商用版・多ユーザー前提のセキュリティ要件再評価 — 個人向けジャーナリングSaaS視点

**調査日**: 2026-04-17
**対象PJ**: focus-you（HD自社プロダクト、個人向けジャーナリング/感情ダッシュボードSaaS）
**調査依頼**: 商用版・多ユーザー前提でのセキュリティ要件を**個人向けプロダクト視点**で再評価。法人B2B要件（SOC 2, ISO 27001, KMS BYOK/HYOK, SIEM, CISSP 等）は持ち込まない。
**前提レポート（重複回避対象）**: `/workspace/.company/departments/research/data-platforms-2026/security-architecture.md`
**Sister Doc**: 上記は「学習・キャリア視点での全体知識体系」。本レポートは「個人向けプロダクトとしてのリリース可否判断」に特化する。

---

## TL;DR（結論先出し）

1. **競合の業界標準は「at rest 自動暗号化 + TLS + パスコード/生体ロック」が最低ライン**。E2EE は Day One・Journey・Notesnook・Standard Notes のみが提供しており、**業界の必須要件ではない**。focus-you の現状（at rest AES-256 + TLS 1.3 + Supabase RLS）はすでに **Reflectly / Reflection.app / Stoic / Daylio と同等水準**。
2. **個人向けジャーナリングSaaSの差別化軸として E2EE はあるが、focus-you は AI 分析が価値中核 → E2EE は不採用が合理的**。代わりに「サーバ側最小権限 + 漏洩時のキーローテ可能設計 + ユーザー目線で透明な権限ポリシー」で勝負する。
3. **リリース前必須は5項目に絞れる**：(a) プライバシーポリシー/利用規約/Cookie同意、(b) データ削除フロー（連鎖削除）、(c) データエクスポート、(d) MFA有効化、(e) セキュリティヘッダ（CSP/HSTS/Permissions-Policy）。これだけで GDPR・改正個人情報保護法・改正電気通信事業法（外部送信規律）の最低ラインはクリアできる。
4. **競合事故事例は2024-2025で報告ゼロ**。日記アプリ全体が「機微データを扱うゆえに各社注意深く運営している」業界。focus-you も同水準で問題ないが、漏洩時の通知体制（72時間）は事前に文書化必須。
5. **過剰投資を回避すべき項目**: SOC 2 Type 2、ISO 27001、Bug Bounty、外部 Pentest（30万〜100万円）、HSM/BYOK、Splunk SIEM、Vercel Enterprise、Supabase Enterprise — 全て**個人向けフェーズでは不要**。ユーザー数 1万を超えてから検討。
6. **3年以内の推定実装工数**: リリース前必須 80-120h、リリース後3ヶ月以内推奨 80-160h、将来オプション 200h+。社長1人で対応可能な範囲。

---

## Section 1: 公知情報

### A. 個人向けジャーナリングSaaS の競合セキュリティ実装ライン

#### A-1. 主要7アプリの実装比較

| アプリ | at rest 暗号化 | TLS | E2EE | パスコード/生体 | MFA | データ削除（GDPR第17条） | データエクスポート（GDPR第20条） | 取得認証 |
|---|---|---|---|---|---|---|---|---|
| **Day One** | ✓ AES-256 | ✓ TLS 1.3 | **✓ AES-GCM-256（v4.2以降デフォルト）** | ✓ パスコード/Face/Touch ID | △（要確認） | ✓ 5日リカバリ後完全削除 | ✓ JSON/PDF/Markdown | 公表なし |
| **Journey** | ✓ | ✓ | **✓ asymmetric E2EE（Cloud Sync限定、有効化で検索無効化）** | ✓ パスコード/biometric | △ | ✓ | ✓ JSON/DOCX | 公表なし |
| **Reflection.app** | ✓「bank-level encryption」 | ✓ TLS | ✗（明記なし） | ✓ | △ | ✓（GDPR準拠と明記） | ✓ | 公表なし |
| **Reflectly** | ✓ | ✓ | ✗ | ✓ パスコード/生体（端末側） | ✗ | ✓（GDPR準拠と明記） | ✓ | EU GDPR準拠 |
| **Stoic / How We Feel** | ✓ | ✓ | ✗ | ✓ パスコードロック | ✗ | △ | △ | 公表なし |
| **Daylio** | ✓ | ✓ | ✗ | ✓ パスコード | ✗ | ✓ | ✓ JSON/CSV | 公表なし |
| **Notesnook**（参考: ノートアプリだが同領域） | ✓ | ✓ | **✓ XChaCha20-Poly1305 + Argon2、ゼロ知識** | ✓ Vault per-note password | ✓ | ✓ | ✓ | OSS（透明性で代替） |
| **Standard Notes**（参考） | ✓ | ✓ | **✓ E2EE デフォルト、第三者監査済** | ✓ | ✓ | ✓ | ✓ | 第三者監査公開 |

#### A-2. ここから読み取れる業界標準ライン

**「個人向けジャーナリングSaaSのセキュリティ最低ライン」は以下に集約できる**:

1. **at rest 暗号化**: 全社必須（クラウドプロバイダ任せでOK、AES-256）
2. **TLS 1.2+**: 全社必須
3. **パスコード/生体ロック**: アプリ側で実装、ほぼ全社あり
4. **GDPR データ削除/エクスポート**: 主要全社対応（明記しているのは Day One/Reflectly/Reflection.app）
5. **E2EE**: **オプション/差別化要素**。Day One・Journey・Notesnook・Standard Notes の4社のみ。**Reflectly, Reflection.app, Stoic, Daylio はE2EE不採用**
6. **MFA**: ほとんどのアプリは未対応 or オプション。OAuth/Apple Sign In に頼る形が多い
7. **第三者認証取得**: 大手以外はほぼ取得なし。プライバシーポリシー / 利用規約で代替

→ **focus-you の現状（at rest AES-256 + TLS 1.3 + Supabase RLS + GitHub OAuth）はすでに業界標準ライン**を満たしている。**E2EE は採用していないが、Reflectly/Reflection.app/Stoic と同水準で問題ない**。

#### A-3. E2EE の決定的トレードオフ（なぜ多くの競合が採用しないか）

**Day One ですら、E2EE 有効化中は以下の制約**:
- Day One Sync 経由のクライアント間同期データのみ E2EE。日付・時間・画像のメタデータ・統計は E2EE 対象外
- 「Discover」（共有エントリ閲覧）等の一部サーバ側機能は無効化

**Journey の場合**:
- E2EE は Journey Cloud Sync 限定（Google Drive 同期は対象外）
- **E2EE 有効化で検索機能が無効化される**（しかも有効化は不可逆）

**学術論文の指摘** ([arxiv.org/abs/2412.20231](https://arxiv.org/abs/2412.20231)):
- 「E2EE と AI モデルの組み合わせは根本的に相容れない」
- 「E2EE データを用いた共有 AI モデルの学習は E2EE と互換性がない」
- 解決策はオンデバイス処理 or 機密処理環境（confidential computing）に限られる

**focus-you の判断軸**:
- focus-you の価値中核は**感情分析・narrator・タスク統合・AI チャット** = サーバ側 AI 処理が前提
- E2EE 採用 → AI 機能が動かない or オンデバイス LLM が必要（小型モデル限定で品質低下）
- → **E2EE は focus-you に不適合**。代わりに「**サーバ側でアクセスできるが、最小権限で運用し、漏洩時に即時キーローテ可能な設計**」を取るのが合理的

ソース:
- [Day One End-to-End Encryption FAQ](https://dayoneapp.com/guides/day-one-sync/end-to-end-encryption-faq/)
- [Day One Privacy & Security FAQs](https://dayoneapp.com/privacy-faqs/)
- [Journey End-to-end Encrypted Journal](https://journey.cloud/end-to-end-encrypted-journal)
- [Journey E2EE Help](https://help.journey.cloud/en/article/end-to-end-encryption-cirdzr/)
- [Reflection.app Privacy Knowledge Base](https://faq.reflection.app/article/64-are-my-entries-private-and-secure)
- [Reflectly Privacy GDPR](https://reflectly-journal-ai-diary.updatestar.com/)
- [Notesnook Architecture](https://notesnook.com/)
- [Standard Notes E2EE](https://standardnotes.com/)
- [How To Think About E2EE and AI - arXiv](https://arxiv.org/abs/2412.20231)
- [Privacy-First Journaling Apps Comparison - Medium](https://medium.com/@didrik.hellman23/privacy-first-journaling-apps-how-the-main-options-actually-compare-7e21a316be2c)
- [Best Encrypted Journal Apps 2026 - CortexOS](https://cortexos.app/blog/best-encrypted-journal-app/)

---

### B. 個人向けSaaS が法的に必須なもの（日本＋EU＋US ユーザーがいる前提）

#### B-1. 法令別「focus-you に最低限必要な実装」マトリクス

| 法令 | 適用条件 | focus-you に必要な実装 | 実装難易度 |
|---|---|---|---|
| **改正個人情報保護法（日本）** | 日本ユーザーがいる時点で適用 | (1) プライバシーポリシー（利用目的明示）、(2) 安全管理措置の公表、(3) 開示請求対応窓口、(4) 削除請求対応、(5) 第三者提供の同意（Supabase/Vercel/OpenAI 等の海外移転を含む） | 中（テキスト整備中心） |
| **改正電気通信事業法 外部送信規律（日本、2023年6月施行）** | Webサイト/アプリ運営者は基本全社対象 | (1) 外部送信される情報の通知/公表（Cookie・Supabase・分析ツール等の一覧）、(2) ユーザーが容易に知りうる状態に置く | 中（公表ページ作成） |
| **GDPR（EU ユーザー含む）** | EU 居住者ユーザーがいる時点で適用 | (1) 同意取得（事前のCookie拒否）、(2) データポータビリティ（第20条）、(3) 削除権（第17条、1ヶ月以内対応）、(4) 訂正権、(5) 72時間以内の漏洩通知体制、(6) DPA（Data Processing Agreement）整備 | 高（実装と運用の両方必要） |
| **CCPA / CPRA（カリフォルニア州）** | カリフォルニア居住者ユーザーがいる時点で適用（年売上25M USD以下なら義務軽減） | (1) Do Not Sell オプション、(2) 削除権、(3) 開示権 | 低〜中 |
| **特定電子メール法（日本）** | メール配信時 | (1) 送信者情報、(2) オプトアウト方法、(3) 配信停止リンク | 低 |
| **COPPA（米国）** | 13歳未満を対象にする場合 | (1) 親権者の検証可能な同意、(2) 厳格な情報収集制限。**13歳未満禁止（利用規約で明記）の方が現実的** | 高（実装回避が現実解） |
| **GDPR 8条（EU）** | 16歳未満（加盟国により13歳まで引き下げ可）に「情報社会サービス」を提供する場合 | 親権者同意の検証努力義務。**16歳未満禁止が現実解** | 高（実装回避） |

#### B-2. 改正個人情報保護法 2026年改正で focus-you に追加で求められる可能性

**[個人情報保護委員会 2026年1月公表方針](https://jtrustc.co.jp/knowledge/hogohou-kaisei-2601/)** に基づく:

1. **6ヶ月以内に削除されるデータも開示請求対象に** → 一時的な分析ログ・キャッシュも開示対象になる可能性。設計時に「ユーザーがアクセスできるデータ範囲」を明確化しておく
2. **安全管理措置の公表義務化** → プライバシーポリシーに「どんな安全管理措置を取っているか」を具体的に書く（暗号化、アクセス制御、ログ監査、インシデント対応等）
3. **Cookie・越境移転規制の強化見込み** → Supabase（米国 AWS）への保存、Vercel（米国）配信、OpenAI（米国）への AI 推論委託を「越境移転」として個別同意取得が必要になる可能性

→ **2026年中に動向監視。プライバシーポリシーは改正対応しやすい構造で書いておく**

#### B-3. 改正電気通信事業法 外部送信規律の実装（日本展開時必須）

**[2023年6月16日施行](https://www.azx.co.jp/blog/6431)**。focus-you も対象:

| 項目 | 実装内容 |
|---|---|
| 通知/公表 | 「外部送信される情報の一覧」ページを作成。例:「Supabase（米国）にユーザーIDと日記本文を保存」「OpenAI/Anthropic API（米国）に日記本文の一部を AI 推論のため送信」「Google Calendar API に予定情報を送信」等 |
| 公表場所 | プライバシーポリシー内 or サイト下部リンクから容易にアクセス可能 |
| オプトアウト | 法定要件を満たすオプトアウト機構があれば例外。focus-you は AI 機能オフオプションを用意するなら活用可能 |

ソース:
- [改正個人情報保護法 2026年改正の方向性 - Jtrustc](https://jtrustc.co.jp/knowledge/hogohou-kaisei-2601/)
- [改正電気通信事業法 Cookie規制 - AZX](https://www.azx.co.jp/blog/6431)
- [総務省 外部送信規律](https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/gaibusoushin_kiritsu.html)
- [GDPR Compliance for SaaS 2026 - Feroot](https://www.feroot.com/blog/gdpr-saas-compliance-2025/)
- [GDPR Article 17/20 SaaS Implementation - Secure Privacy](https://secureprivacy.ai/blog/data-processing-agreements-dpas-for-saas)
- [子どものデータ保護 国際動向 - 長島・大野・常松](https://www.noandt.com/publications/publication20230616-1/)

---

### C. focus-you の現状ギャップ分析（商用版多ユーザー前提）

#### C-1. 現状の総合評価表

| 領域 | 現状実装 | 商用版での評価 | 優先度 | 推定工数 |
|---|---|---|---|---|
| **at rest 暗号化** | Supabase AES-256 自動 | ✓ 業界標準 | - | 0h |
| **in transit 暗号化** | Vercel/Supabase 自動 TLS 1.3 | ✓ 業界標準 | - | 0h |
| **Supabase RLS** | 全テーブル適用、anon キー全権限削除済（018, 035）| ✓ 業界トップクラス | - | 0h |
| **Edge Function 認証** | verify_jwt=false + 関数内 getUser() | ✓ ES256対応済 | - | 0h |
| **Google refresh token 暗号化** | AES-256-GCM 個別暗号化 | ✓ 適切 | - | 0h |
| **GitHub OAuth ログイン** | Supabase Auth 連携済 | ✓ | - | 0h |
| **パスワード強度** | Supabase Auth デフォルト（最小6文字）| ✗ 弱い。最小10文字+複雑度+漏洩パスワード検査が必要 | リリース前必須 | 2-4h |
| **パスワードリセットフロー** | Supabase 標準 | △ レート制限の追加検証必要 | リリース前必須 | 2h |
| **MFA（TOTP）** | Supabase Auth 標準対応だが**有効化されていない可能性** | ✗ オプション提供必須 | リリース前必須 | 4-8h |
| **セッション管理** | Supabase 標準（JWT 1時間 + refresh token） | △ 同時ログイン上限・「全デバイスからログアウト」UIが未実装 | リリース後3ヶ月 | 8h |
| **アカウント削除フロー** | 不明（要確認） | ✗ 連鎖削除（Supabase 全テーブル + Storage + Vector + ログ）が必要 | **リリース前必須** | 16-24h |
| **データエクスポート** | 不明（要確認） | ✗ JSON or Markdown でユーザーが自分の全データをダウンロード可能に | リリース前必須（GDPR第20条） | 8-16h |
| **レートリミット** | 不明 | ✗ Edge Function は Supabase レート制限のみ。アプリ層レート制限が必要 | リリース後3ヶ月 | 8-16h |
| **監査ログ（軽量）** | Supabase auth events のみ | ✗ ユーザーログイン履歴・セッション情報をユーザー本人が見られる UI が望ましい | リリース後3ヶ月 | 8-16h |
| **不正検知** | なし | △ 連続ログイン失敗カウント、地理的に異常なログイン通知（軽量で OK） | 将来 | 16h |
| **セキュリティヘッダ（CSP, HSTS, Permissions-Policy, etc.）** | vercel.json に X-Content-Type, X-Frame のみ | ✗ CSP・HSTS・Permissions-Policy・Referrer-Policy 未設定 | リリース前必須 | 4-8h |
| **Bot/スクレイピング対策** | Vercel Firewall 標準 + Supabase 標準レート制限 | △ Cloudflare Turnstile を sign-up に追加推奨（無料・無制限） | リリース後3ヶ月 | 4-8h |
| **依存関係脆弱性スキャン** | GitHub Dependabot（要確認） | △ 適切 | - | 確認のみ |
| **プライバシーポリシー** | 未作成（要確認） | ✗ **法的必須**。改正個人情報保護法 + 外部送信規律対応必要 | **リリース前必須** | 8-16h |
| **利用規約** | 未作成（要確認） | ✗ 13歳/16歳未満禁止、機微情報取扱の同意、責任範囲を明記 | **リリース前必須** | 8-16h |
| **Cookie 同意バナー** | 未作成 | ✗ EU 提供時必須。日本のみなら外部送信規律のみで OK | リリース前必須（EU提供時） | 8h |
| **漏洩時通知体制** | なし | ✗ 72時間以内通知のフロー（誰が、何を、どう連絡するか）を文書化 | リリース前必須 | 4h |
| **アプリ層 E2EE** | なし | △ **focus-you では不採用が合理的**（AI 機能と矛盾） | 不要 | - |

#### C-2. 漏洩リスク高項目の厳しめ評価

##### (1) パスワード強度・リセットフロー

**現状**: Supabase Auth デフォルト = 最小6文字、複雑度要件なし。漏洩パスワード検査なし。

**商用版に求められるライン**:
- 最小10文字 + 複雑度（英数記号混在）or **パスフレーズ（25文字以上）許容**
- HaveIBeenPwned API での漏洩パスワード検査（Supabase は対応していないため自前実装 or Auth0/Clerk 移行検討）
- リセットメール: 30分有効、1回のみ使用可能、レート制限（1時間に5回まで）

**focus-you の現実解**:
- Supabase の `Auth Policies` でパスワード最小長を10に設定（Dashboard で即変更可能）
- 漏洩検査は**v2 で十分**（リリース前必須ではない）。それより MFA 有効化を優先

##### (2) セッション管理

**現状**: JWT 1時間 + refresh token 自動更新。同時ログイン上限なし。「他のデバイスからログアウト」UI なし。

**商用版に求められるライン**:
- ユーザーが「現在ログイン中のセッション一覧」を見られる UI
- 「他のデバイスからログアウト」ボタン（refresh token 全失効）
- アイドルタイムアウト（24時間 or 7日無操作で再ログイン要求）

**focus-you の現実解**:
- v1 は Supabase 標準のままでOK（個人ユーザーは1〜2デバイスが普通）
- v1.1 で「セッション一覧 UI」を追加（ユーザーが見られると安心感が大きい）

##### (3) アカウント削除フロー（最重要）

**現状**: 削除フローが不明。Supabase auth.users を削除しても他テーブルが残る可能性大。

**商用版に求められるライン**（GDPR 第17条「忘れられる権利」、改正個人情報保護法 削除請求権）:

```
[削除確定] 押下後の処理:
1. tasks, diary_entries, emotion_analysis, ceo_insights, narrator_updates 等
   全テーブルから user_id 一致レコードを物理削除
2. Supabase Storage の画像・添付ファイルを Storage API で削除
3. Vector embeddings（pgvector or Vector Buckets）を Storage API で削除
4. Google refresh token 含む暗号化済みトークンを削除
5. 監査ログから個人特定可能情報を削除（or 匿名化）
6. バックアップからの削除は別途記載（多くの SaaS は「次回バックアップローテで削除」とする）
7. 完全削除完了の確認メールをユーザーに送信
8. 30日のグレースピリオド（Day One は5日）を設けて誤操作対策
```

**focus-you の現実解**:
- **リリース前に必ず実装**。`DELETE /functions/v1/delete-account` を Edge Function として作成
- Supabase の `auth.users` への `ON DELETE CASCADE` 制約を全テーブルに設定（マイグレーションで一括追加）
- Storage と Vector は別途 Storage API で削除する関数を呼ぶ（CASCADE では削除されない）
- 推定工数: 16-24h（テスト含む）

##### (4) データエクスポート

**現状**: 不明（おそらく未実装）。

**商用版に求められるライン**（GDPR 第20条データポータビリティ）:
- ユーザーが自分の全データを JSON or Markdown でダウンロード可能
- 1ヶ月以内に対応（GDPR 規定）。**自動化すれば即時提供**で問題解決

**focus-you の現実解**:
- 「設定 > データエクスポート」ボタンを追加。Edge Function で全テーブル + Storage を JSON にまとめて zip 化
- 推定工数: 8-16h

##### (5) Supabase RLS の網羅性チェック

**現状**: 全テーブル RLS 適用済み（018, 035）。

**商用版に求められるライン**:
- **マルチテナント前提のテストケース**: User A でログインしたとき、User B のデータが SELECT/UPDATE/DELETE 全部で取得できないことを自動テスト
- RLS パフォーマンス: `auth.uid() = user_id` のような RLS には btree index を必須化（100倍高速化）
- Service Role Key（あれば）を使う Edge Function は最小限に

**focus-you の現実解**:
- Playwright 等で「User A → User B のデータアクセス試行 → 全部失敗」をテスト化
- index は既存のマイグレーションで対応済みかを確認
- 推定工数: 8h（テスト整備）

##### (6) Edge Function のレート制御

**現状**: Supabase Auth は標準でレート制限あり。Edge Function 自体のレート制限は明示的設定が必要。

**商用版に求められるライン**:
- AI チャット（OpenAI 課金）: ユーザーごとに 1日100回 / 1時間20回 程度
- パスワードリセット: 1IPあたり 1時間5回
- 一般 API: ユーザーごとに 1分100回

**focus-you の現実解**:
- Supabase 公式ガイド: [Edge Functions + Upstash Redis でレート制限](https://supabase.com/docs/guides/functions/examples/rate-limiting)
- v1 は Supabase Auth 標準レート制限 + 主要 Edge Function に簡易レート制限（メモリベースでOK）
- 推定工数: 8-16h

ソース:
- [Supabase RLS Best Practices - Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Supabase Security Misconfigurations - Stingrai](https://www.stingrai.io/blog/supabase-powerful-but-one-misconfiguration-away-from-disaster)
- [Supabase Multi-Factor Authentication](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase Rate Limiting Edge Functions](https://supabase.com/docs/guides/functions/examples/rate-limiting)
- [Supabase CASCADE ON DELETE Guide - CloseFuture](https://www.closefuture.io/blogs/supabase-on-delete-cascade)
- [Supabase Vector Buckets Storage](https://supabase.com/docs/guides/storage/vector/introduction)
- [Day One Account Deletion 5-day Recovery](https://dayoneapp.com/privacy-policy/)
- [Vercel Security Headers](https://vercel.com/docs/cdn-security/security-headers)
- [Cloudflare Turnstile Free Unlimited](https://www.cloudflare.com/application-services/products/turnstile/)
- [Cloudflare Turnstile Supabase Integration](https://github.com/orgs/supabase/discussions/43520)

---

### D. 商用化前 必須 / 推奨 / オプション の3段階整理

#### D-1. リリース前必須（早期リリースを妨げない最小限）

**期間**: リリース2〜4週間前 / 推定工数: 80-120h

| # | 項目 | 工数 | 理由 |
|---|---|---|---|
| 1 | **プライバシーポリシー作成**（個情法 + 外部送信規律対応） | 8-16h | 法的必須。テンプレあり |
| 2 | **利用規約作成**（13歳/16歳未満禁止、責任範囲、AI 利用条件） | 8-16h | 法的必須 |
| 3 | **Cookie 同意バナー**（EU 提供時のみ） | 8h | EU 提供しないなら不要 |
| 4 | **アカウント削除フロー**（連鎖削除 + Storage + Vector + 30日グレース） | 16-24h | GDPR 第17条 + 個情法削除権 |
| 5 | **データエクスポート**（JSON or Markdown） | 8-16h | GDPR 第20条 |
| 6 | **MFA 有効化**（Supabase Auth TOTP オプション提供） | 4-8h | パスワード+OAuth だけでは不安。標準で実装済み機能を有効化するだけ |
| 7 | **セキュリティヘッダ**（CSP, HSTS, Permissions-Policy, Referrer-Policy, X-Frame-Options） | 4-8h | XSS / Clickjacking / 情報漏洩対策。vercel.json に書くだけ |
| 8 | **パスワード強度設定**（Supabase Dashboard で最小10文字に設定） | 1h | 設定変更のみ |
| 9 | **漏洩時通知体制の文書化**（誰が・何を・どう連絡するか） | 4h | GDPR 72時間 + 個情法対応 |
| 10 | **RLS マルチテナントテスト**（User A → User B データ取得不可テスト） | 8h | RLS 漏れの最終確認 |
| **合計** | | **69-127h** | |

#### D-2. リリース後3ヶ月以内推奨

**期間**: リリース後の継続的改善 / 推定工数: 80-160h

| # | 項目 | 工数 | 理由 |
|---|---|---|---|
| 1 | **レートリミット**（Edge Function ごと、ユーザーごと） | 8-16h | DoS / API 乱用防止 |
| 2 | **Cloudflare Turnstile**（sign-up と password reset に） | 4-8h | Bot 対策（無料・無制限） |
| 3 | **セッション一覧 UI**（自分のログイン中デバイスを見られる） | 8h | 安心感大幅向上 |
| 4 | **「他のデバイスからログアウト」機能** | 4-8h | 同上 |
| 5 | **軽量監査ログ**（ユーザーが自分のログイン履歴を見られる） | 8-16h | 個情法対応 + ユーザー安心感 |
| 6 | **連続ログイン失敗ブロック**（10回失敗で30分ブロック等） | 4-8h | ブルートフォース対策 |
| 7 | **メール通知**（新デバイスログイン、パスワード変更時） | 8-16h | 不正検知 |
| 8 | **依存関係スキャン強化**（Snyk or Dependabot 自動 PR） | 4h | 設定のみ |
| 9 | **OAuth grants 監査**（Google Calendar/Tasks の権限スコープ最小化） | 4-8h | 最小権限原則 |
| **合計** | | **52-92h** | |

#### D-3. 将来オプション（成長後 or 不要）

**ユーザー数 1,000〜10,000 で検討、それ以下では不要**:

| # | 項目 | 必要性 | コメント |
|---|---|---|---|
| **E2EE（日記本文）** | × 不適合 | AI 機能と矛盾。focus-you は採用しない |
| **WAF（Cloudflare 前段）** | △ オプション | Vercel Firewall + Supabase で十分。攻撃が増えたら検討 |
| **Bug Bounty Program** | △ ユーザー1万超 | HackerOne / Bugcrowd は最低 $500/月。早すぎ |
| **外部 Pentest** | △ ユーザー1万超 | 30万〜100万円。社内 OWASP Top 10 セルフチェックで代替可能 |
| **SOC 2 Type 2** | × 不要 | 個人向けには過剰。B2B 拡張時のみ |
| **ISO 27001** | × 不要 | 同上 |
| **Vercel Enterprise** | × 不要 | Pro $20/月で十分 |
| **Supabase Enterprise** | × 不要 | Pro $25/月で十分 |
| **HSM / BYOK / HYOK** | × 不要 | 法人金融案件のみ |
| **Splunk SIEM** | × 不要 | Supabase ログ + 軽量 Slack 通知で十分 |

---

### E. 「日記」という機微データの取り扱い

#### E-1. focus-you が扱う機微情報の整理

| データ種別 | 機微度 | 漏洩時の影響 | focus-you での扱い |
|---|---|---|---|
| **日記本文** | **最高** | 個人の内面・人間関係・職場情報・健康状態が露出 | DB 保存・AI 推論に使用 |
| **感情分析結果** | 高 | メンタルヘルス情報（要配慮個人情報相当） | DB 保存・narrator で使用 |
| **AI チャット履歴** | 高 | 相談内容が露出 | DB 保存 |
| **タスク** | 中 | 仕事・予定が露出 | DB 保存 |
| **Google Calendar** | 中 | 予定・人間関係が露出 | API 連携、refresh token は AES-256-GCM で個別暗号化済 |
| **Google Tasks** | 中 | 同上 | 同上 |

#### E-2. focus-you の機微データ取扱原則（提案）

E2EE を採用しない代わりに、**「最小権限・透明性・即時対応」の3原則**で運用:

1. **最小権限**:
   - サーバ側で日記本文に触れるのは `emotion_analysis` 関数と `narrator-update` 関数の2つに限定
   - その他の関数は日記本文を SELECT しない（RLS + Edge Function 側のクエリで担保）
   - OpenAI/Anthropic API への送信は「分析対象エントリのみ、それ以外は送らない」を明記

2. **透明性**:
   - プライバシーポリシーに「サーバ側でアクセス可能な範囲」を明記
   - 「ユーザーが自分のデータがどう使われているか」をダッシュボードで可視化（v1.1 で）
   - 監査ログ: ユーザー本人が「いつ何のデータがどの関数で使われたか」を見られる

3. **即時対応**:
   - 漏洩時の72時間通知体制を事前文書化
   - 暗号化キーローテのリハーサル実施（Supabase の機能でローテ可能）
   - インシデント発生時の対外コミュニケーションテンプレート準備

#### E-3. E2EE 不採用の対外説明（プライバシーポリシー文言案）

> **focus-you では、AI による感情分析・narrator による日記の意味づけ・チャットによる対話を提供するため、サーバ側で日記内容にアクセスできる設計としています。** これは Day One や Journey 等が提供するエンドツーエンド暗号化（E2EE）モードとは異なります。
>
> その代わりに以下の運用を行います:
> - 日記本文にアクセスする処理は `emotion_analysis` と `narrator-update` の2つの関数に限定し、それ以外の処理は日記本文を読みません
> - OpenAI/Anthropic への AI 推論時、対象エントリ以外は送信しません
> - データの保存・通信・バックアップはすべて AES-256 + TLS 1.3 で暗号化します
> - ユーザーは自分のデータがいつ・どの処理で使われたかをダッシュボードで確認できます（v1.1）
> - 万一の漏洩時には72時間以内に該当ユーザーに通知し、暗号化キーをローテします

---

## Section 2: 限界の明示

### 2-1. 個情法 2026年改正の最新動向

- 個人情報保護委員会の改正方針は **2026年1月公表段階**。実際の法案提出は2026年通常国会、施行は1〜2年後と見込まれる
- **Cookie・越境移転の追加規制**は方向性のみ示されており、具体的な実装要件は今後発表
- focus-you のプライバシーポリシーは「将来の改正に対応しやすい構造」（追記しやすいセクション分割）で書く

### 2-2. 競合の内部実装は公開情報の範囲のみ

- Day One・Journey の E2EE 実装詳細は公開情報あるが、**Reflectly・Reflection.app・Stoic・Daylio は「encryption あり」の声明のみ**で詳細未公開
- 「at rest 暗号化」と書かれていてもサーバ側で復号可能か、E2EE か、判断不可なケース多し
- focus-you 比較は「公表情報の範囲」での横並び評価に留まる

### 2-3. 国別の法令対応は社長の事業判断による

- 日本のみ提供 → 改正個人情報保護法 + 外部送信規律 + 特定電子メール法のみ
- EU 含む → GDPR + Cookie 同意 + DPA 整備で工数 +40-80h
- US カリフォルニア含む → CCPA で工数 +8-16h
- **「最初は日本のみ」が最小コスト**。EU 提供は需要が見えてから判断

### 2-4. 競合の漏洩事故報告ゼロの解釈

- 2024-2025 で Day One・Journey・Reflectly・Reflection.app・Stoic・Daylio の漏洩事故報告は確認できず
- これは「業界全体が安全」という意味ではなく、**「報告されていない or 検出されていない」可能性**もある
- 個人向けジャーナリングは攻撃対象としての魅力（金銭的）が低いため、**標的型攻撃よりは設定ミス・内部漏洩のリスクが高い**と推測される

### 2-5. 実装工数の見積もりは社長の実装スピード依存

- 上記工数は「経験ある実装者」前提
- Supabase Edge Function、Vercel 設定、CSP デバッグの経験次第で 1.5〜2倍に膨らむ可能性
- 「リリース前必須 80-120h」は **2週間〜1ヶ月のスプリント1本**を想定

### 2-6. 本レポートの限界

- 2026年4月現在のスナップショット
- E2EE 周辺の AI 連携技術（confidential computing, on-device LLM）は急速進化中。1年後には選択肢が変わる可能性
- 競合のセキュリティ実装は変更される。リリース前に最新情報を再確認推奨

---

## Section 3: 壁打ちモードへの導線

### 社長が次に判断すべき問い

#### 問い1: 公開する地域はどこまでか?

| 選択肢 | 必要対応 | 追加工数 | 推奨度 |
|---|---|---|---|
| **A. 日本のみ**（β段階） | 改正個情法 + 外部送信規律 + 特定電子メール法 | 0h（必須項目に含む） | ◎ MVP に最適 |
| **B. 日本 + 英語圏（米国・カナダ・豪州・英国）** | A + CCPA 対応 + 英語版プライバシーポリシー | +16-24h | ○ 第2段階 |
| **C. 日本 + EU 含む** | A + GDPR + Cookie 同意バナー + DPA + 72時間通知 | +40-80h | △ 需要見えてから |

→ **MVP は日本のみ**で start し、需要に応じて拡張する戦略を推奨

**社長への問い**: 初期ターゲットユーザーは日本人を想定しているか、それとも英語圏も含むか?

---

#### 問い2: 日記本文の E2EE をやるか?

| 観点 | E2EE 採用 | E2EE 不採用（focus-you 現状） |
|---|---|---|
| **AI 機能（感情分析・narrator・チャット）** | × オンデバイス LLM 限定 → 大幅な品質低下 | ◎ サーバ側 LLM フル活用可能 |
| **検索機能** | × 暗号化検索は実装複雑、または無効化 | ◎ 標準的な PostgreSQL 検索可能 |
| **ユーザーへの安心感（ブランド差別化）** | ◎ Day One・Standard Notes 並のポジション獲得 | △ Reflectly/Reflection.app と同水準 |
| **実装コスト** | 高（40-80h + 継続メンテナンス） | 0h |
| **復旧不可能リスク** | ユーザーがキー紛失 → データ完全消失 | バックアップから復旧可能 |
| **Day One のスタンス** | E2EE 採用、ただし AI 機能は限定的 | - |
| **Notesnook のスタンス** | 完全 E2EE、AI 機能なし | - |

**焦点ポイント**: focus-you の価値中核は **AI 分析・narrator・チャット** = サーバ側 AI 処理が前提。**E2EE は採用しないのが合理的**。

代わりに「**透明性 + 最小権限 + 漏洩時即時対応**」の3点でブランド構築する。

**社長への問い**: focus-you の差別化軸として、E2EE よりも「AI が深く理解してくれる」体験を優先する方針で合っているか?

---

#### 問い3: 想定ユーザー規模は?

| 規模 | セキュリティ投資ライン |
|---|---|
| **〜100ユーザー（β）** | リリース前必須項目のみ。Supabase/Vercel 無料枠で十分 |
| **〜1,000ユーザー** | 必須 + 推奨3ヶ月項目（レートリミット、Turnstile、監査ログ）。Supabase Pro $25/月、Vercel Pro $20/月 |
| **〜10,000ユーザー** | 上記 + Cloudflare Pro 前段（$20/月）、依存関係スキャン強化、軽量 SIEM（Datadog or Logflare） |
| **10万ユーザー超** | 外部 Pentest、Bug Bounty、本格的監査ログ、SOC 2 Type 1 検討 |

**社長への問い**: focus-you の1年目の到達目標ユーザー数は?

---

#### 問い4: 未成年（13-18歳）を許可するか?

| 選択肢 | 必要対応 |
|---|---|
| **A. 18歳以上のみ**（推奨） | 利用規約に明記。年齢確認は登録時の自己申告でOK |
| **B. 13歳以上**（GDPR 16歳ライン超え） | GDPR 加盟国で親権者同意取得が必要。実装複雑 |
| **C. 13歳未満も許可** | COPPA 対応（親権者の検証可能な同意）。**事実上不可能** |

**推奨**: **18歳以上のみに限定**。学生需要があるなら「16歳以上、ただし16-18歳は親権者同意推奨」程度の文言。

**社長への問い**: focus-you のターゲットユーザー像は社会人想定か、学生も含むか?

---

#### 問い5: 万一の漏洩時の対応プランを事前に用意するか?

**推奨**: **必ず用意する**。事故が起きてから準備するのは絶対に間に合わない。

**最低限の文書化項目**（リリース前に作成、4-8h で完了）:
1. **検知**: 誰が・どうやって異常を察知するか（Supabase ログ監視、ユーザーからの問い合わせ）
2. **初動**: 漏洩確認後30分以内に何を止めるか（Edge Function 停止、API キーローテ、Supabase RLS 強化）
3. **通知**:
   - GDPR: 72時間以内にデータ保護当局通知 + 該当ユーザーに通知
   - 改正個人情報保護法: 漏洩等の事案発生時、速やかに個人情報保護委員会に報告 + 本人通知
4. **対外コミュニケーション**: ブログ・Twitter での声明テンプレート（「いつ・何が・どこまで影響・何をしたか・今後どうするか」の5W1H）
5. **原因究明**: ポストモーテム作成、再発防止策の公表

**社長への問い**: 漏洩時のコミュニケーション窓口は社長単独か、それとも誰かに相談する体制を作るか?

---

#### 問い6: AI 機能の透明性をどこまで開示するか?

focus-you の AI 処理は OpenAI / Anthropic API を利用する設計（推測）。

**選択肢**:

| 選択肢 | プライバシーポリシーへの記載 |
|---|---|
| **A. 詳細開示** | 「日記本文の一部を OpenAI/Anthropic API（米国）に送信して感情分析を行います。各社のデータポリシーは [OpenAI Privacy](https://openai.com/policies/privacy-policy)・[Anthropic Privacy](https://www.anthropic.com/privacy) を参照」 |
| **B. 最小開示** | 「AI 分析のため第三者サービスを利用します」 |

**推奨**: **A 詳細開示**。改正個情法の「越境移転に関する同意取得」と外部送信規律に対応するためにも、具体的な送信先と用途を明記すべき。

**社長への問い**: AI 機能の透明性開示で「ユーザーの安心感」と「説明の煩雑さ」のバランスをどう取るか?

---

## ネクストアクション（提案）

### 即時実行（社長判断不要）

1. **本レポートを社長と15分の壁打ち**: 上記 問い1〜6 のうち優先度の高い3つを決める

### 社長判断後

2. **PM 部に「リリース前必須セキュリティ項目10件」をタスク起票**:
   - プライバシーポリシー / 利用規約 / Cookie 同意の3点セット作成
   - アカウント削除フロー（Edge Function + マイグレーション）
   - データエクスポート（Edge Function + UI）
   - MFA 有効化 + パスワード強度設定（Supabase Dashboard）
   - セキュリティヘッダ（CSP, HSTS, Permissions-Policy）の vercel.json 設定
   - 漏洩時通知体制の文書化
   - RLS マルチテナントテストの整備

3. **追加リサーチが必要な領域**:
   - **focus-you のアカウント削除フロー現状調査**: マイグレーションを精査し、CASCADE 設定漏れを特定（調査部に依頼）
   - **focus-you の依存関係スキャン現状確認**: Dependabot の設定状況、CI 統合状況（システム開発部に依頼）
   - **Supabase の最新パスワード強度設定**: Dashboard 経由で即変更可能か、API 経由が必要か（システム開発部に依頼）

4. **資料化**:
   - 本レポートの「リリース前必須項目」を **focus-you のセキュリティ宣言ページ**（ランディングページの一部）として資料制作部に展開
   - 「focus-you はあなたのデータをこう守ります」のユーザー向け説明ページを作成

---

## 出典まとめ（一覧）

### 競合ジャーナリングアプリのセキュリティ
- https://dayoneapp.com/guides/day-one-sync/end-to-end-encryption-faq/
- https://dayoneapp.com/privacy-faqs/
- https://dayoneapp.com/privacy-policy/
- https://dayoneapp.com/features/end-to-end-encryption/
- https://medium.com/day-one/end-to-end-encryption-for-day-one-sync-af4ba31fb36e
- https://journey.cloud/end-to-end-encrypted-journal
- https://help.journey.cloud/en/article/end-to-end-encryption-cirdzr/
- https://blog.journey.cloud/journey-builds-on-privacy-commitment-with-further-app-security-user-protection/
- https://faq.reflection.app/article/64-are-my-entries-private-and-secure
- https://www.reflection.app/blog/best-journaling-apps
- https://reflectly-journal-ai-diary.updatestar.com/
- https://notesnook.com/
- https://standardnotes.com/
- https://medium.com/@didrik.hellman23/privacy-first-journaling-apps-how-the-main-options-actually-compare-7e21a316be2c
- https://cortexos.app/blog/best-encrypted-journal-app/
- https://bestjournalingapps.com/blog/journaling-app-privacy/
- https://deepjournal.app/blog/end-to-end-encryption-explained-for-journaling-2026
- https://journalinginsights.com/best-secure-journal-app/

### E2EE と AI のトレードオフ
- https://arxiv.org/abs/2412.20231
- https://arxiv.org/html/2412.20231v2
- https://eprint.iacr.org/2024/2086.pdf
- https://medium.com/@lotussavy/ai-end-to-end-encryption-and-privacy-a-looming-collision-467721feacd4

### 法令（日本）
- https://jtrustc.co.jp/knowledge/hogohou-kaisei-2601/
- https://www.businesslawyers.jp/articles/1485
- https://www.ushijima-law.gr.jp/client-alert_seminar/client-alert/20260109appi/
- https://www.azx.co.jp/blog/6431
- https://privtech.co.jp/blog/law/revised-telecommunications-business-law-cookie.html
- https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/gaibusoushin_kiritsu.html
- https://blog.jpac-privacy.jp/gaibusoushin_kiritsu/
- https://blog.jpac-privacy.jp/proposedamendmentstothepersonalinformationprotectionact_2503/
- https://blog.jpac-privacy.jp/proposedamendmentstothepersonalinformationprotectionact_2601/
- https://j-net21.smrj.go.jp/law/20221223.html
- https://unitis.jp/articles/12105/

### 法令（GDPR / CCPA）
- https://www.feroot.com/blog/gdpr-saas-compliance-2025/
- https://secureprivacy.ai/blog/data-processing-agreements-dpas-for-saas
- https://secureprivacy.ai/blog/gdpr-compliance-2026
- https://www.orbiqhq.com/eu-regulations/gdpr-article-28-32-33-34
- https://complydog.com/blog/gdpr-for-saas-companies-complete-compliance-guide
- https://www.zluri.com/blog/software-as-a-service-gdpr
- https://qualysec.com/gdpr-compliance-requirement-for-saas-platform/
- https://www.cookieyes.com/blog/gdpr-for-saas/
- https://www.reform.app/blog/best-practices-gdpr-compliant-data-deletion
- https://titanapps.io/blog/gdpr-data-deletion-request-template
- https://www.probackup.io/blog/gdpr-and-backups-how-to-handle-deletion-requests
- https://getaround.tech/gdpr-account-deletion/

### Cookie 同意
- https://www.clym.io/blog/gdpr-cookie-consent-checklist-with-new-eu-guidance-updated
- https://secureprivacy.ai/blog/cookie-consent-implementation
- https://secureprivacy.ai/blog/global-cookie-consent-trends-2026
- https://www.cookieyes.com/blog/eu-cookie-compliance/
- https://cookiebanner.com/blog/the-complete-guide-to-cookie-banner-2026-edition/
- https://privacychecker.pro/blog/cookie-banner-requirements-2026

### 未成年保護（COPPA / GDPR Art.8）
- https://www.trustnow.co.jp/blog/childrens-privacy/
- https://help.adjust.com/en/article/coppa-compliance
- https://www.noandt.com/publications/publication20230616-1/
- https://www.criteo.com/jp/blog/are-you-ready-for-childrens-personal-data-protection-restrictions/
- https://www.kiteworks.com/ja/risk-compliance-glossary/coppa-childrens-online-privacy-protection-act/

### Supabase RLS / セッション / MFA
- https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- https://www.stingrai.io/blog/supabase-powerful-but-one-misconfiguration-away-from-disaster
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/functions/examples/rate-limiting
- https://supabase.com/docs/guides/auth/auth-mfa
- https://supabase.com/docs/guides/auth/auth-mfa/totp
- https://supabase.com/docs/guides/storage/vector/introduction
- https://supabase.com/docs/guides/storage/management/delete-objects
- https://www.closefuture.io/blogs/supabase-on-delete-cascade
- https://supaexplorer.com/best-practices/supabase-postgres/security-rls-basics/

### Vercel / セキュリティヘッダ / CSP
- https://vercel.com/docs/cdn-security/security-headers
- https://www.stackhawk.com/blog/react-content-security-policy-guide-what-it-is-and-how-to-enable-it/
- https://oneuptime.com/blog/post/2026-01-15-content-security-policy-csp-react/view
- https://ismycodesafe.com/learn/web-security/http-security-headers
- https://digiqt.com/blog/reactjs-security-best-practices/

### Bot 対策
- https://www.cloudflare.com/application-services/products/turnstile/
- https://blog.cloudflare.com/turnstile-ga/
- https://github.com/orgs/supabase/discussions/43520
- https://blog.logto.io/best-captcha-provider

### Solo Developer / Indie Hacker SaaS Security
- https://atlantsecurity.com/learn/saas-security-best-practices-the-complete-technical-guide-for-2026/
- https://www.reco.ai/learn/saas-security-best-practices
- https://www.xoance.com/saas-security-checklist-2026/
- https://peiko.space/blog/article/saas-security-checklist-before-launch
- https://www.tldl.io/resources/indie-hacker-saas-stack-2026

---

# handoff
handoff:
  - to: materials
    context: |
      本レポート（focus-you-product-security.md）と既存の security-architecture.md を統合し、
      「focus-you 単独インフラ・セキュリティレポート（焦点単独版）」の作成材料として使う。
      個人向けプロダクト視点を一貫して保ち、法人エンプラ要件を持ち込まない。
      特に Section 1-D（リリース前必須/推奨/オプション3段階）と Section 1-E（機微データ取扱原則）が
      ユーザー向けの「セキュリティ宣言ページ」素材になる。
    tasks:
      - "本レポートの Section 1-D を元に focus-you のセキュリティロードマップ図を作成"
      - "Section 1-E を元に「focus-you はあなたのデータをこう守ります」のユーザー向けランディングセクション草案"
      - "競合との対比表（Section 1-A-1）をビジュアル化"
  - to: secretary
    context: |
      社長への提示・壁打ち。Section 3 の問い1〜6 のうち、最優先で判断すべき3つを抽出して
      15分セッションを設定する。判断結果を意思決定ログに記録し、リリース前必須項目の
      タスク起票（PM 部）につなげる。
    tasks:
      - "問い1〜6 を社長に提示し、優先判断3つを決定"
      - "判断結果を secretary/notes/2026-04-17-decisions.md に記録"
      - "PM 部に「リリース前必須セキュリティ項目」のタスク起票を依頼"
  - to: 調査部
    context: |
      focus-you の現状確認が必要な3項目。本レポートの推測ベースの記述を実態に基づいて
      アップデートするための内部調査。
    tasks:
      - "focus-you のアカウント削除フロー現状: Supabase マイグレーションで CASCADE 設定の網羅性確認"
      - "focus-you の依存関係スキャン現状: GitHub Dependabot の有効化状況、自動 PR 設定確認"
      - "focus-you のパスワード強度設定: Supabase Dashboard の現状値確認、変更手順確認"
