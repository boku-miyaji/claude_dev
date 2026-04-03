# MCP Tool Poisoning 攻撃 調査レポート

- **ステータス**: completed
- **調査日**: 2026-04-03
- **チーム**: 技術調査
- **調査者**: リサーチ部

---

## 1. 公知情報ベースの分析

### 1.1 Tool Poisoning とは何か

Tool Poisoning は、MCP (Model Context Protocol) サーバーのツール定義（description / schema / metadata）に悪意ある指示を埋め込み、LLMエージェントの挙動を乗っ取る攻撃手法である。Prompt Injection の一種だが、**ユーザー入力ではなくツールのメタデータが攻撃ベクトル**になる点が特徴的。

2025年4月6日に Invariant Labs が初めて体系的に公開した。

- 出典: [MCP Security Notification: Tool Poisoning Attacks - Invariant Labs (2025-04-06)](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks)
- 出典: [Model Context Protocol has prompt injection security problems - Simon Willison (2025-04-09)](https://simonwillison.net/2025/Apr/9/mcp-prompt-injection/)

#### 攻撃の仕組み

1. **悪意あるMCPサーバー**がツールを公開する。ツール名は無害に見える（例: `get_fact_of_the_day`）
2. ツールの **description フィールドに隠し指示**を埋め込む。UIにはツール名しか表示されないが、LLMはdescription全文を読む
3. LLMがツール一覧をコンテキストに読み込んだ時点で、隠し指示が作用する。**そのツールが呼ばれなくても**、コンテキストに入るだけで攻撃が成立しうる
4. LLMは「正規の指示」と「ツール定義に紛れた悪意ある指示」を区別できず、従ってしまう

#### 攻撃の亜種

| 亜種 | 説明 |
|------|------|
| **Tool Shadowing** | 正規ツールと同名/類似名のツールを偽装し、呼び出しを横取りする |
| **Rug Pull** | 初回は無害なツール定義を提供し、承認後に悪意ある定義に差し替える |
| **Schema Poisoning** | ツールのパラメータ定義（JSON Schema）自体を改ざんし、無害な操作が破壊的操作にマッピングされるようにする |
| **Full-Schema Poisoning** | description だけでなく、パラメータ名・型・列挙値など**スキーマ全体**が攻撃面になる |
| **Cross-Origin Escalation** | 悪意あるサーバーが、同一エージェントに接続された**別の正規サーバー**のツールを操作するよう指示する |

- 出典: [OWASP MCP03:2025 - Tool Poisoning](https://owasp.org/www-project-mcp-top-10/2025/MCP03-2025%E2%80%93Tool-Poisoning)
- 出典: [Poison everywhere: No output from your MCP server is safe - CyberArk](https://www.cyberark.com/resources/threat-research-blog/poison-everywhere-no-output-from-your-mcp-server-is-safe)

### 1.2 どのような被害が起こりうるか

#### 実証された攻撃シナリオ

| シナリオ | 内容 | 出典 |
|----------|------|------|
| **WhatsApp メッセージ窃取** | `whatsapp-mcp` サーバーに接続した環境で、Rug Pull 型攻撃により過去のメッセージ履歴が攻撃者の電話番号に転送される | [Invariant Labs (2025-04)](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks) |
| **SSH鍵・認証情報窃取** | 毒入り `add()` ツールが SSH鍵と `mcp.json` の認証情報を読み取り、数学関数のパラメータにエンコードして攻撃者に送信 | [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/) |
| **npm パッケージ偽装** | 2025年9月、Postmark のメールサービスを偽装した npm パッケージが、全メールを攻撃者にBCC送信 | [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/) |
| **GitHub データ窃取** | GitHub MCP サーバー経由でプライベートリポジトリの情報が漏洩 | [Docker Blog - MCP Horror Stories](https://www.docker.com/blog/mcp-horror-stories-github-prompt-injection/) |

#### 被害の分類

- **機密情報の漏洩**: SSH鍵、APIキー、認証トークン、チャット履歴、プライベートリポジトリ
- **権限昇格**: 正規ツールの権限を悪用して本来許可されていない操作を実行
- **データ破壊**: スキーマ改ざんにより、アーカイブ操作がDELETE操作にマッピングされる
- **サプライチェーン攻撃**: 信頼された依存関係を通じて組織全体に波及

#### LLMモデル別の脆弱性（MCPTox ベンチマーク）

MCPTox は45の実サーバー・353ツール・1312テストケースで20のLLMを評価した初の体系的ベンチマーク。

| モデル | 攻撃成功率 | 備考 |
|--------|-----------|------|
| o1-mini | **72.8%** | 最も脆弱 |
| DeepSeek-R1 | **60%超** | 高脆弱性 |
| Claude 3.7 Sonnet | 比較的低い | 拒否率は最高だが**3%未満** |

**重要な知見**: より高機能なモデルほど脆弱性が高い傾向がある。指示追従能力が高いほど、悪意ある指示にも従いやすい。

- 出典: [MCPTox: A Benchmark for Tool Poisoning Attack on Real-World MCP Servers (arxiv, 2025)](https://arxiv.org/abs/2508.14925)

### 1.3 現在知られている対策方法

#### A. ツールレベルの対策

| 対策 | 説明 | ツール/手法 |
|------|------|------------|
| **Tool Pinning** | 初回スキャン時にツール定義のハッシュを保存し、変更を検知。Rug Pull を防止 | [mcp-scan (Invariant Labs)](https://github.com/invariantlabs-ai/mcp-scan) |
| **ツール定義のスキャン** | プロンプトインジェクション・ツールポイズニング・Cross-Origin Escalation を検出 | mcp-scan: `uvx mcp-scan@latest` |
| **スキーマ署名** | ツール定義に電子署名（JWS/COSE/PKI）を付与し、改ざんを検知 | OWASP推奨 |
| **入力バリデーション** | ツールメタデータに対する危険パターン・隠しコマンドのフィルタリング | カスタム実装 |

- 出典: [Introducing MCP-Scan - Invariant Labs](https://invariantlabs.ai/blog/introducing-mcp-scan)
- 出典: [mcp-scan GitHub](https://github.com/invariantlabs-ai/mcp-scan)

#### B. アーキテクチャレベルの対策

| 対策 | 説明 |
|------|------|
| **最小権限の原則** | 各ツールに必要最小限の権限のみ付与。過剰な権限は攻撃面を拡大する |
| **サンドボックス/隔離** | MCPサーバーをDockerコンテナ内で実行し、ローカル認証情報へのアクセスを遮断 |
| **ツールレジストリ・ガバナンス** | 登録ワークフロー、検証済みID、暗号署名、セキュリティ証明を管理する集中レジストリ |
| **Agent Gateway** | セキュアな仲介層として検証を強制 |
| **コンテキスト検証** | 各境界でコンテキストのソース・構造を検証してからエージェントに渡す |

- 出典: [Solo.io - Prevent MCP Tool Poisoning With a Registration Workflow](https://www.solo.io/blog/prevent-mcp-tool-poisoning-with-registration-workflow)
- 出典: [Enterprise-Grade Security for MCP (arxiv)](https://arxiv.org/html/2504.08623v1)

#### C. 標準・フレームワーク

- **OWASP MCP Top 10**: MCPの重大脆弱性を体系化。Tool Poisoning は MCP03:2025 に分類
  - 出典: [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/)
- **OWASP Agentic AI Top 10**: エージェント型AIの脅威モデルを包括的に整理
  - 出典: [The Real-World Attacks Behind OWASP Agentic AI Top 10 - BleepingComputer](https://www.bleepingcomputer.com/news/security/the-real-world-attacks-behind-owasp-agentic-ai-top-10/)

### 1.4 Claude Code / MCP Server 環境での具体的な防御策

#### Claude Code のパーミッション機構

Claude Code には allow / ask / deny の3層パーミッションモデルがある。

```json
{
  "permissions": {
    "allow": ["Read", "Glob", "Grep"],
    "deny": ["mcp__untrusted_server__*", "Bash(curl*)"]
  }
}
```

| 設定 | 用途 |
|------|------|
| `allow` | 100%安全なコマンドのみ。echo, ls 等 |
| `deny` | 核シールド。未検証MCPサーバーのツール、curl、機密ファイルアクセスをブロック |
| `ask` | デフォルト。実行前にユーザー確認を求める |

- 出典: [Configure permissions - Claude Code Docs](https://code.claude.com/docs/en/permissions)
- 出典: [Claude Code Security Best Practices - Backslash](https://www.backslash.security/blog/claude-code-security-best-practices)

#### 推奨する具体的防御手順

**1. MCPサーバーの事前スキャン**

```bash
# mcp-scan で全MCPサーバーのツール定義をスキャン
uvx mcp-scan@latest

# ツール定義の詳細確認
uvx mcp-scan@latest inspect

# 安全と確認したツールをホワイトリスト登録
uvx mcp-scan@latest whitelist TOOL_NAME HASH
```

**2. パーミッションの最小化**

- 信頼できないMCPサーバーのツールは `deny` に明示的に追加
- `mcp__*` パターンで未承認サーバーを一括ブロック可能
- ファイルアクセスパターンで機密ファイル（`~/.ssh/*`, `~/.aws/*`, `mcp.json`）をブロック

**3. サンドボックス化**

- MCPサーバーは Docker コンテナ内で実行
- ホストのファイルシステム・認証情報へのアクセスを最小限に制限

**4. 定期的な再スキャン**

- mcp-scan の Tool Pinning により、ツール定義の変更（Rug Pull）を検知
- CI/CD に組み込むか、定期的に手動実行

**5. MCPサーバーの選定基準**

- 公式・検証済みのサーバーを優先
- npm/PyPI 上の非公式パッケージは特に注意（Postmark偽装事例あり）
- GitHub Stars / メンテナの身元 / セキュリティ監査の有無を確認

- 出典: [How to Secure Claude Code MCP Integrations in Production - Prefactor](https://prefactor.tech/blog/how-to-secure-claude-code-mcp-integrations-in-production)
- 出典: [MCP Security Vulnerabilities - Practical DevSecOps (2026)](https://www.practical-devsecops.com/mcp-security-vulnerabilities/)
- 出典: [Claude Code Security - MintMCP](https://www.mintmcp.com/blog/claude-code-security)

---

## 2. 限界の明示

### わかっていないこと / 確認すれば精度が上がること

| 項目 | 状況 |
|------|------|
| **Claude Code の内部防御機構の詳細** | Anthropic が内部でどの程度 Tool Poisoning 対策をモデルレベルで組み込んでいるかは非公開。MCPTox では Claude 3.7 Sonnet の拒否率が最高だったが3%未満であり、モデルレベルの防御は不十分と推定される |
| **MCP 仕様自体のセキュリティロードマップ** | MCP 仕様にツール署名・検証を組み込む計画があるかは現時点で公式発表なし |
| **自社環境で利用中の具体的なMCPサーバー一覧** | 実際にどのサーバーを接続しているかにより、リスクレベルが大きく変わる |
| **MCPTox のClaude Opus 4.6系の結果** | ベンチマークは主に2025年時点のモデルが対象。現在使用中のモデルでの攻撃成功率は不明 |
| **企業環境での実被害事例** | 公開されている事例は研究者によるPoCが中心。実際の企業被害は報告が少ない（仮説: 発生していても非公開の可能性） |

### 推測・仮説

- **仮説**: Tool Poisoning は現時点では「研究段階」から「実攻撃初期段階」に移行しつつある。npm偽装パッケージの事例（2025年9月）が実害の始まりと考えられる
- **仮説**: MCPの普及が進むほど攻撃のインセンティブが高まるため、2026年後半にかけてサプライチェーン型の攻撃が増加する可能性が高い
- **推測**: Claude Code の `ask` モードはRug Pull に対して一定の防御力を持つが、ユーザーが「常に許可」を選択してしまうと無力化される

---

## 3. 壁打ちモードへの導線

### 深掘りできる問いかけ例

1. **自社環境の棚卸し**: 「現在接続しているMCPサーバーの一覧と、それぞれの信頼レベルはどうなっているか？ mcp-scan を実行して確認してみるか？」

2. **パーミッション設計**: 「Claude Code の permissions.deny に何を追加すべきか？ 現在の `.claude.json` の設定を確認して、推奨deny一覧を作成するか？」

3. **リスク許容度の判断**: 「MCPサーバーの利便性とセキュリティリスクのトレードオフをどう考えるか？ 特定のサーバーは切断すべきか？」

4. **運用プロセスの整備**: 「新しいMCPサーバーを追加する際の承認フロー（mcp-scan実行 -> ツール定義確認 -> ホワイトリスト登録）を標準化するか？」

5. **セキュリティ部への展開**: 「この調査結果をセキュリティ部のポリシーに反映し、MCPサーバー利用ガイドラインを策定するか？」

6. **クライアント環境への適用**: 「受託開発コンサルとして、クライアントにMCPセキュリティのアドバイスを提供する需要はあるか？」

---

## 結論

MCP Tool Poisoning は、LLMエージェントのツール連携における**構造的な脆弱性**である。ツール定義がLLMのコンテキストに直接注入される設計上、プロンプトインジェクションの新たな攻撃面となっている。2025年4月の初回公開以降、OWASP MCP Top 10 への採録（MCP03:2025）、MCPTox ベンチマークによる定量評価（主要LLMで60-73%の攻撃成功率）、実際のサプライチェーン攻撃事例と、急速に現実的な脅威として認知が進んでいる。

現時点ではモデルレベルの防御は不十分（拒否率3%未満）であり、**インフラ・運用レベルでの多層防御**が必須。

## ネクストアクション

| 優先度 | アクション | 担当候補 |
|--------|-----------|---------|
| **高** | `uvx mcp-scan@latest` を実行し、現在接続中のMCPサーバーのセキュリティ状態を確認 | 技術調査 / セキュリティ部 |
| **高** | Claude Code の `permissions.deny` に機密ファイルパターンと未検証MCPサーバーを追加 | セキュリティ部 |
| **中** | MCPサーバー追加時の承認フロー（スキャン -> 確認 -> ホワイトリスト）を策定 | セキュリティ部 |
| **中** | 定期スキャン（週次）の自動化を検討 | システム開発部 |
| **低** | クライアント向けMCPセキュリティアドバイザリの作成を検討 | リサーチ部 / PM |

---

## 参考文献一覧

- [MCP Security Notification: Tool Poisoning Attacks - Invariant Labs (2025-04-06)](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks)
- [Model Context Protocol has prompt injection security problems - Simon Willison (2025-04-09)](https://simonwillison.net/2025/Apr/9/mcp-prompt-injection/)
- [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/)
- [OWASP MCP03:2025 - Tool Poisoning](https://owasp.org/www-project-mcp-top-10/2025/MCP03-2025%E2%80%93Tool-Poisoning)
- [MCPTox: A Benchmark for Tool Poisoning Attack on Real-World MCP Servers (arxiv)](https://arxiv.org/abs/2508.14925)
- [MCP Tools: Attack Vectors and Defense Recommendations - Elastic Security Labs](https://www.elastic.co/security-labs/mcp-tools-attack-defense-recommendations)
- [Poison everywhere: No output from your MCP server is safe - CyberArk](https://www.cyberark.com/resources/threat-research-blog/poison-everywhere-no-output-from-your-mcp-server-is-safe)
- [Protecting against indirect prompt injection attacks in MCP - Microsoft](https://developer.microsoft.com/blog/protecting-against-indirect-injection-attacks-mcp)
- [MCP Security Vulnerabilities - Practical DevSecOps (2026)](https://www.practical-devsecops.com/mcp-security-vulnerabilities/)
- [MCP Security in 2026 - MCP Playground](https://mcpplaygroundonline.com/blog/mcp-security-tool-poisoning-owasp-top-10-mcp-scan)
- [Configure permissions - Claude Code Docs](https://code.claude.com/docs/en/permissions)
- [Claude Code Security Best Practices - Backslash](https://www.backslash.security/blog/claude-code-security-best-practices)
- [How to Secure Claude Code MCP Integrations in Production - Prefactor](https://prefactor.tech/blog/how-to-secure-claude-code-mcp-integrations-in-production)
- [Introducing MCP-Scan - Invariant Labs](https://invariantlabs.ai/blog/introducing-mcp-scan)
- [mcp-scan GitHub](https://github.com/invariantlabs-ai/mcp-scan)
- [Prevent MCP Tool Poisoning With a Registration Workflow - Solo.io](https://www.solo.io/blog/prevent-mcp-tool-poisoning-with-registration-workflow)
- [Enterprise-Grade Security for MCP (arxiv)](https://arxiv.org/html/2504.08623v1)
- [Docker Blog - MCP Horror Stories](https://www.docker.com/blog/mcp-horror-stories-github-prompt-injection/)
- [MCP Tool Poisoning: From Theory to Local PoC - Amine Raji (2026-02)](https://medium.com/data-science-collective/mcp-tool-poisoning-from-theory-to-local-proof-of-concept-159dd29e624b)
- [Claude Code Security - MintMCP](https://www.mintmcp.com/blog/claude-code-security)
- [The Vulnerable MCP Project](https://vulnerablemcp.info/)
