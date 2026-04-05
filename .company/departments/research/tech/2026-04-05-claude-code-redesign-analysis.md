# Claude Code アーキテクチャに基づく本社設定の再設計分析

**調査日**: 2026-04-05 | **調査チーム**: 技術調査 | **ステータス**: completed

---

## 1. 現状分析: 設定と Claude Code アーキテクチャの適合度

### 1.1 CLAUDE.md（方針ファイル）

**現状**:
- `/workspace/.claude/CLAUDE.md`: 約20行（良好）
- `/workspace/.company/CLAUDE.md`: 約65行（許容範囲だがやや長い）

**アーキテクチャとの適合度**: 良好

Claude Code は CLAUDE.md を「助言的（advisory）」に扱う。遵守率は約80%で、100%ではない。現在の `.claude/CLAUDE.md` は簡潔でルール参照テーブルに留めており、推奨パターンに合致している。

ただし `.company/CLAUDE.md` は「秘書の口調」「パーソナライズ」など、全てのセッションで必要ではない情報を含んでいる。CLAUDE.md はセッション開始時に必ず読み込まれるため、毎回コンテキストウィンドウを消費する。

**問題点**:
- `.claude/rules/` 内の7ファイルも**全て無条件ロード**されている（paths frontmatter なし）。`pipeline.md`, `handoff.md`, `knowledge-accumulation.md`, `skill-management.md`, `coding-style.md`, `commit-rules.md`, `hd-operations.md` の全てが毎セッション読み込まれる
- 合計すると、rules 7ファイル + CLAUDE.md 2ファイル + `.company/CLAUDE.md` で、セッション開始時点で大量のテキストがコンテキストに注入される

**参考**: [Claude Code Rules: Stop Stuffing Everything into One CLAUDE.md](https://medium.com/@richardhightower/claude-code-rules-stop-stuffing-everything-into-one-claude-md-0b3732bca433) | [Best Practices](https://code.claude.com/docs/en/best-practices)

---

### 1.2 Hooks（ライフサイクル制御）

**現状**: 26個のスクリプト、settings.json に7つのイベントタイプで設定

| イベント | フック数 | async | 評価 |
|---------|---------|-------|------|
| SessionStart | 4 | 3 async, 1 sync | 良好 |
| UserPromptSubmit | 2 | 1 async, 1 sync | 良好 |
| PreToolUse (Bash) | 1 | sync | 良好 |
| PostToolUse (Edit/Write) | 3 | all async | 良好 |
| PostToolUse (全ツール) | 1 | async | 良好 |
| PreCompact | 1 | sync | 改善余地あり |
| PostCompact | 1 | sync | 改善余地あり |
| Stop | 2 | 1 sync, 1 async | 良好 |
| PermissionRequest | 1 | sync | 良好 |

**アーキテクチャとの適合度**: 高い

Hooks は Claude Code の6構成要素のうち「決定論的（deterministic）」な唯一の手段。「CLAUDE.md に書いても守られない」ルールを Hooks で強制するのがハーネスエンジニアリングの核心。

**良い設計**:
- `bash-guard.sh`: 危険コマンドの決定論的ブロック（exit 2）
- `permission-guard.sh`: 権限レベルに応じた段階的制御
- `pre-compact-save.sh` / `post-compact-restore.sh`: コンパクション対策
- `prompt-log.sh`: 全プロンプトの非同期記録（ブロックしない）
- `tool-collector.sh`: ツール使用の可観測性確保
- `claude-md-size-guard.sh`: CLAUDE.md 肥大化の自動検出

**問題点・改善余地**:

1. **PreCompact の保存内容が薄い**: 現在は固定テンプレートのJSON（リマインダー3行）のみ保存。PostCompact の `compact_summary`（Claude が生成した要約）を活用していない
2. **ハンドオフ検出が Hooks 化されていない**: 現在は CLAUDE.md/rules の「助言」のみ。PostToolUse (Edit|Write) で成果物ファイルのハンドオフパターンを検出し、additionalContext で通知する仕組みが可能
3. **未使用スクリプトの存在**: `freshness-check.sh`, `artifact-sync.sh`, `company-sync.sh`, `company-sync-check.sh` 等は settings.json の hooks に登録されておらず、手動/スキル経由でのみ使用。整理が必要

**参考**: [Hooks reference](https://code.claude.com/docs/en/hooks) | [How I Automated My Entire Claude Code Workflow with Hooks](https://dev.to/ji_ai/how-i-automated-my-entire-claude-code-workflow-with-hooks-5cp8)

---

### 1.3 Sub-agents（部署エージェント）

**現状**: `.claude/agents/` に8ファイル

| Agent | tools | model | maxTurns | 評価 |
|-------|-------|-------|----------|------|
| dept-ai-dev.md | 9ツール（Agent含む） | 未指定 | 未指定 | 改善必要 |
| dept-sys-dev.md | 7ツール | 未指定 | 未指定 | 改善必要 |
| dept-research.md | 7ツール | 未指定 | 未指定 | 改善必要 |
| dept-pm.md | 不明 | 未指定 | 未指定 | 改善必要 |
| dept-materials.md | 不明 | 未指定 | 未指定 | 改善必要 |
| dept-ux-design.md | 不明 | 未指定 | 未指定 | 改善必要 |
| dept-intelligence.md | 不明 | 未指定 | 未指定 | 改善必要 |
| dept-qa.md | 不明 | 未指定 | 未指定 | 改善必要 |

**アーキテクチャとの適合度**: 低い（最大の改善ポイント）

Claude Code の sub-agent は以下のフロントマター設定を持てる:
- `model:` — haiku（軽量・高速）/ sonnet / opus / inherit
- `maxTurns:` — 実行ターン数の上限
- `tools:` / `disallowedTools:` — ツールの許可/拒否
- `permissionMode:` — 権限モード
- `hooks:` — サブエージェント固有の hooks
- `mcpServers:` — 使用する MCP サーバー
- `skills:` — ロードするスキル
- `isolation:` — コンテキスト分離レベル

**問題点**:

1. **model 未指定**: 全エージェントが親のモデルを継承。リサーチ部やPM部は `model: sonnet` で十分な場合が多く、コスト最適化の余地がある
2. **maxTurns 未指定**: 暴走リスク。リサーチ部なら `maxTurns: 15`、QA部なら `maxTurns: 20` 等の制限が推奨
3. **最小権限の未適用**: 例えばリサーチ部に `Bash` は不要、QA部に `WebSearch` は不要。現状は「全部署が必要以上のツールにアクセス可能」
4. **AI開発部が Agent ツールを持つ**: sub-agent が sub-agent を呼ぶことは Claude Code では不可。`Agent` をツールリストに含めても機能しない
5. **hooks/skills フロントマターの未活用**: サブエージェント固有の hooks や skills をロードできるが未使用

**参考**: [Create custom subagents](https://code.claude.com/docs/en/sub-agents) | [A Mental Model for Claude Code](https://levelup.gitconnected.com/a-mental-model-for-claude-code-skills-subagents-and-plugins-3dea9924bf05)

---

### 1.4 Skills（オンデマンドナレッジ）

**現状**: 10個のスキル

| スキル | description の質 | 評価 |
|--------|-----------------|------|
| company | 詳細、trigger あり | 良好 |
| auto-prep | 詳細、trigger あり | 良好 |
| diary | 不明 | 要確認 |
| invoice | 不明 | 要確認 |
| no-edit | 不明 | 要確認 |
| permission | 不明 | 要確認 |
| register | 不明 | 要確認 |
| weekly-digest | 不明 | 要確認 |
| design-principles | 不明 | 要確認 |
| webapp-demo-generator | 不明 | 要確認 |

**アーキテクチャとの適合度**: 概ね良好

Skills はオンデマンドロードであり、CLAUDE.md のコンテキスト消費を回避する正しいパターン。`description` がスキル選択の唯一の手がかりとなるため、曖昧な description はスキルが呼ばれない原因になる。

**問題点**:
- description の品質が不明なスキルが多い（今回のスコープ外で要確認）
- SKILL.md のサイズが大きい場合（company SKILL.md は 15,000+ トークン）、呼ばれた時点でコンテキストを大きく消費する

---

### 1.5 settings.json（Permissions）

**現状**: `allow` リストが192行、`deny` リストなし

**アーキテクチャとの適合度**: 低い

**問題点**:

1. **deny ルールがゼロ**: Claude Code の権限評価は `deny > ask > allow` の順。deny が最優先で、セキュリティの基盤。`.env` ファイルの読み取り、秘密鍵、credentials ディレクトリへのアクセスを deny で明示的にブロックすべき
2. **allow リストの肥大化**: 192行のうち、一度きりの操作（特定ファイルの cp, register コマンド等）が多数混入。これらはセッション限りの許可で十分だったが、恒久的な allow に追加されている
3. **Supabase アクセストークンがハードコード**: `SUPABASE_ACCESS_TOKEN=sbp_...` が settings.json に平文で記録されている（3行）。セキュリティリスクが高い
4. **additionalDirectories の肥大化**: 16ディレクトリ。プラグインキャッシュの複数バージョンが混在
5. **壊れた Read パターン**: `Read(//workspace/{gsub\\(/ /**)` 等、AWKの出力が誤って許可パターンに入り込んでいる

**参考**: [Configure permissions](https://code.claude.com/docs/en/permissions) | [Claude Code settings.json: Complete config guide](https://www.eesel.ai/blog/settings-json-claude-code)

---

### 1.6 Rules（自動読み込みルール）

**現状**: `.claude/rules/` に7ファイル、全て paths frontmatter なし（無条件ロード）

| ファイル | 行数 | 全セッションで必要か |
|---------|------|-------------------|
| coding-style.md | ~20 | コード変更時のみ |
| commit-rules.md | ~50 | コミット時のみ |
| skill-management.md | ~30 | スキル管理時のみ |
| hd-operations.md | ~60 | /company 使用時のみ |
| handoff.md | ~50 | パイプライン実行時のみ |
| knowledge-accumulation.md | ~40 | フィードバック時のみ |
| pipeline.md | ~50 | タスク実行時のみ |

**アーキテクチャとの適合度**: 中程度

**問題点**:
- 7ファイル全てが無条件ロード。実際には `coding-style.md` は `*.ts, *.tsx, *.py` 等のファイル作業時のみ必要。`commit-rules.md` は `git` 操作時のみ必要
- Claude Code は `paths` フロントマターで条件付きロードをサポートしている。活用すればセッション開始時のコンテキスト消費を約40%削減できる（推測）
- ただし、`pipeline.md` と `handoff.md` は秘書が常に参照するため無条件でもよい

**参考**: [Use .claude/rules/ for Conditional Instructions](https://tipsforclaude.com/tips/rules-directory-conditional/) | [How Claude Code rules actually work](https://joseparreogarcia.substack.com/p/how-claude-code-rules-actually-work)

---

## 2. 改善提案（優先度付き）

### P0: セキュリティ（即時対応）

| # | 対象ファイル | 変更内容 |
|---|------------|---------|
| 1 | `.claude/settings.json` | `deny` ルールを追加: `Read(**/.env)`, `Read(**/*.key)`, `Read(**/*secret*)`, `Bash(curl*token*)` |
| 2 | `.claude/settings.json` | ハードコードされた `SUPABASE_ACCESS_TOKEN` 3行を削除。環境変数またはシークレット管理に移行 |
| 3 | `.claude/settings.json` | 壊れた Read パターン（`Read(//workspace/{gsub\\(/ /**)`等）を削除 |

### P1: Sub-agent 最適化（高インパクト）

| # | 対象ファイル | 変更内容 |
|---|------------|---------|
| 4 | `.claude/agents/dept-research.md` | frontmatter に追加: `model: sonnet`, `maxTurns: 15`, `disallowedTools: [Bash, Agent]` |
| 5 | `.claude/agents/dept-pm.md` | frontmatter に追加: `model: sonnet`, `maxTurns: 10`, `disallowedTools: [Bash, Agent, WebFetch]` |
| 6 | `.claude/agents/dept-ai-dev.md` | `Agent` をツールリストから削除（sub-agent は sub-agent を呼べない）。`maxTurns: 25`, `model: inherit` |
| 7 | `.claude/agents/dept-sys-dev.md` | `maxTurns: 30`, `model: inherit`, `disallowedTools: [WebSearch]` |
| 8 | `.claude/agents/dept-qa.md` | `model: sonnet`, `maxTurns: 20`, `disallowedTools: [WebSearch, WebFetch, Agent]` |
| 9 | `.claude/agents/dept-intelligence.md` | `model: haiku`, `maxTurns: 10`（情報収集は軽量モデルで十分な場合が多い） |
| 10 | `.claude/agents/dept-materials.md` | `model: sonnet`, `maxTurns: 20` |
| 11 | `.claude/agents/dept-ux-design.md` | `model: sonnet`, `maxTurns: 15` |

### P2: コンテキスト効率化（中インパクト）

| # | 対象ファイル | 変更内容 |
|---|------------|---------|
| 12 | `.claude/rules/coding-style.md` | paths frontmatter 追加: `paths: ["**/*.ts", "**/*.tsx", "**/*.py", "**/*.js"]` |
| 13 | `.claude/rules/commit-rules.md` | paths frontmatter 追加: `paths: ["**/.git/**", "**/COMMIT_EDITMSG"]`（仮説: git 操作時にトリガーされるか要検証） |
| 14 | `.claude/rules/skill-management.md` | paths frontmatter 追加: `paths: ["**/.claude/skills/**", "**/SKILL.md"]` |
| 15 | `.claude/rules/knowledge-accumulation.md` | paths frontmatter 追加: `paths: ["**/.claude/knowledge/**"]` |
| 16 | `.claude/settings.json` の allow | 一度きりの操作コマンド（`register`, 特定 `cp`, 特定 `Bash(SUPABASE_ACCESS_TOKEN=...)`）を削除してリストをスリム化 |
| 17 | `.claude/settings.json` の additionalDirectories | 未使用のプラグインキャッシュディレクトリを整理 |

### P3: Hooks 強化（中インパクト）

| # | 対象ファイル | 変更内容 |
|---|------------|---------|
| 18 | `.claude/hooks/post-compact-restore.sh` | PostCompact の `compact_summary` を読み取り、additionalContext に含める（現在は固定テンプレートのみ） |
| 19 | `.claude/hooks/pre-compact-save.sh` | 現在の進行中タスクID、パイプライン状態を動的に保存する（Supabase から取得） |
| 20 | 新規: `.claude/hooks/handoff-detect.sh` | PostToolUse (Edit|Write) で成果物ファイルのハンドオフパターンを grep し、検出時に additionalContext で通知 |
| 21 | 未登録スクリプトの整理 | `freshness-check.sh`, `company-sync.sh` 等を hooks ディレクトリから別の場所（`scripts/`）に移動、または settings.json に登録 |

### P4: 運用改善（低インパクト・長期）

| # | 対象 | 変更内容 |
|---|------|---------|
| 22 | `.company/CLAUDE.md` | 「秘書の口調」「パーソナライズ」セクションを `/company` スキルの SKILL.md 内に移動し、CLAUDE.md をさらに短縮 |
| 23 | 全 SKILL.md | description の品質を監査。「いつ使うか」が description に凝縮されているか確認 |
| 24 | agent 定義 | 各 agent の `skills:` フロントマターで、その部署が使うスキルを明示的に指定 |

---

## 3. 限界の明示

### 確認できなかったこと

| 項目 | 理由 | 精度を上げるために必要な情報 |
|------|------|--------------------------|
| rules の paths による条件付きロードの実効性 | git 操作やコミット時にどの paths パターンがトリガーされるか、公式ドキュメントに明確な記述なし | 実際に paths 付き rules を設定し、`/cost` で token 消費量を比較するテスト |
| sub-agent の model 指定のコスト影響 | 具体的なトークン単価・レートリミットは環境依存 | 実運用で sonnet/haiku を指定した部署の実行結果を比較 |
| PostCompact の compact_summary フィールドの正確なフォーマット | 2026年4月時点で、compact_summary が全ての環境で利用可能か未確認（GitHub Issues に feature request が存在） | 実際に PostCompact hook で `compact_summary` を出力してフォーマットを確認 |
| SKILL.md の読み込みトークン量 | company SKILL.md は 15,000+ トークンだが、実際にどこまでロードされるか不明 | `/cost` でスキル呼び出し前後のトークン消費を計測 |
| deny ルールの実効性 | 一部環境で deny が無視されるバグ報告あり | テスト用の deny ルールを設定し、実際にブロックされるか検証 |
| 各スキルの description 品質 | 今回のスコープ外で大半のスキルの SKILL.md を未読 | 全 SKILL.md を読み、description が十分か監査 |

### 推測・仮説

- **仮説**: rules の条件付きロードで初期コンテキスト消費を30-40%削減できる。ただし、Claude Code が paths マッチングをどのタイミングで行うか（ファイル編集時のみ or セッション中の参照含む）で効果が異なる
- **仮説**: sub-agent の model を sonnet に下げても、リサーチ・PM・QAの品質は維持できる。opus が必要なのは AI開発部とシステム開発部の複雑な実装タスクのみ
- **仮説**: settings.json の allow リストを半分にスリム化しても運用に支障はない。一度きりのコマンドはセッション内許可で対応すべき

---

## 4. 壁打ちモードへの導線

以下の問いかけで深掘りが可能です:

1. **コスト vs 品質のトレードオフ**: 「リサーチ部を sonnet にした場合、調査レポートの品質低下は許容範囲か？まず1回試して比較する？」
2. **rules の条件付きロード**: 「pipeline.md と handoff.md は全セッションで必要だが、他の5ファイルは条件付きにする方針でよいか？」
3. **セキュリティ優先度**: 「settings.json のハードコード token は即座に削除すべきだが、代替の認証方法（.env + hooks の source）で問題ないか？」
4. **ハンドオフ Hook 化**: 「ハンドオフ検出を PostToolUse Hook にすると、成果物の全ファイルを grep する負荷がかかる。async で問題ないか、それとも特定パスのみに絞るか？」
5. **allow リストの棚卸し**: 「一度きりコマンドを削除すると、次回同じ操作時にダイアログが出る。permission-guard.sh の safe モードで自動許可できるか？」

---

## 5. 結論とネクストアクション

### 結論

現在の `.claude/` 設定は、Claude Code のハーネスエンジニアリング原則の多くを実践しているが、**sub-agent の最小権限**と**settings.json のセキュリティ**に重大なギャップがある。特に:

1. 全 sub-agent が model/maxTurns 未指定で、コスト最適化と暴走防止ができていない
2. deny ルールがゼロで、アクセストークンが平文で settings.json に残っている
3. rules の無条件ロードがコンテキストウィンドウを不要に消費している

### ネクストアクション

| 順序 | アクション | 担当 | 期限目安 |
|------|----------|------|---------|
| 1 | P0（セキュリティ）を即時実施 | システム開発部 or 社長 | 今日中 |
| 2 | P1（sub-agent 最適化）の設計レビュー | 社長壁打ち | 今週中 |
| 3 | P2（コンテキスト効率化）の paths 追加 + テスト | システム開発部 | 今週中 |
| 4 | P3（Hooks 強化）の PostCompact 改善 | システム開発部 | 来週 |
| 5 | P4（運用改善）のスキル監査 | リサーチ部 or PM部 | 来週 |

---

## Sources

- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Configure permissions](https://code.claude.com/docs/en/permissions)
- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Claude Code Architecture Explained: Agent Loop, Tool System, and Permission Model](https://dev.to/brooks_wilson_36fbefbbae4/claude-code-architecture-explained-agent-loop-tool-system-and-permission-model-rust-rewrite-41b2)
- [A Mental Model for Claude Code: Skills, Subagents, and Plugins](https://levelup.gitconnected.com/a-mental-model-for-claude-code-skills-subagents-and-plugins-3dea9924bf05)
- [Claude Code Rules: Stop Stuffing Everything into One CLAUDE.md](https://medium.com/@richardhightower/claude-code-rules-stop-stuffing-everything-into-one-claude-md-0b3732bca433)
- [Use .claude/rules/ for Conditional Instructions](https://tipsforclaude.com/tips/rules-directory-conditional/)
- [Claude Code settings.json: Complete config guide](https://www.eesel.ai/blog/settings-json-claude-code)
- [How I Automated My Entire Claude Code Workflow with Hooks](https://dev.to/ji_ai/how-i-automated-my-entire-claude-code-workflow-with-hooks-5cp8)
- [Effective harnesses for long-running agents (Anthropic)](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Claude Code Agent Skills 2.0](https://medium.com/@richardhightower/claude-code-agent-skills-2-0-from-custom-instructions-to-programmable-agents-ab6e4563c176)
- [How Claude Code rules actually work](https://joseparreogarcia.substack.com/p/how-claude-code-rules-actually-work)
- [Claude Code Context Backups: Beat Auto-Compaction](https://claudefa.st/blog/tools/hooks/context-recovery-hook)

## ハンドオフ

### -> システム開発部への依頼
- [ ] P0 セキュリティ改善の実施（settings.json の deny 追加、token 削除、壊れたパターン削除）
- [ ] P1 sub-agent frontmatter の更新（model, maxTurns, disallowedTools の追加）
- [ ] P2 rules への paths frontmatter 追加 + テスト

### -> PM部への依頼
- [ ] 上記改善案をタスクチケットに分割（P0/P1/P2/P3/P4）
- [ ] P0 の期限設定（即日）
