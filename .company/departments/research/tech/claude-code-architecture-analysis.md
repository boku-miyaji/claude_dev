# Claude Code 公式アーキテクチャ vs HD設計 差分分析書

- ステータス: completed
- 作成日: 2026-04-06
- 担当: リサーチ部 技術調査チーム
- 対象: HD（ホールディングス）全社運用設計

---

## 1. 現行HD設計の概要

### 1.1 全体アーキテクチャ

HDは Claude Code の上に「バーチャル企業」を構築している。主要構成要素は以下の通り。

| レイヤー | 実装 | 役割 |
|---------|------|------|
| **組織構造** | `.company/CLAUDE.md` + `departments/*/CLAUDE.md` | 10部署の役割定義、運営ルール |
| **Sub-agent 定義** | `.claude/agents/dept-*.md` | 8部署分のAgent定義（frontmatter + system prompt） |
| **Hook 群** | `.claude/hooks/` (29ファイル) | セッション管理、記録、権限制御、鮮度チェック |
| **ルール群** | `.claude/rules/` (6ファイル) | コミット規約、コーディング規約、パイプライン、ナレッジ蓄積 |
| **同期スクリプト** | `scripts/company/` (6ファイル) | registry同期、スキル同期、バリデーション |
| **外部永続化** | Supabase | prompt_log, tasks, activity_log, knowledge_base, artifacts 等 |
| **パイプライン** | `.claude/rules/pipeline.md` | A-E の5パターン、部署間連携フロー |
| **委譲テンプレート** | `.company/references/agent-delegation-template.md` | Sub-agent へのコンテキスト受け渡し仕様 |

### 1.2 Hook の責務配置（現行）

| Hook イベント | スクリプト | 責務 | sync/async |
|--------------|-----------|------|-----------|
| SessionStart | `auto-pull.sh` | git pull | async |
| SessionStart | `session-start-marker.sh` | タイムスタンプ記録 | sync |
| SessionStart | `supabase-status.sh` | Supabase接続確認 | async |
| SessionStart | `config-sync.sh` | settings/MCP/CLAUDE.md/スキル/company同期 | async |
| SessionStart | `knowledge-lint.sh` | ナレッジ整合性チェック | async |
| SessionStart | `doc-freshness-check.sh` | ドキュメント鮮度チェック | async |
| UserPromptSubmit | `prompt-log.sh` | プロンプトをSupabaseに記録 + タグ付け | async |
| UserPromptSubmit | `company-pull.sh` | `/company` コマンド時のgit pull | sync |
| PreToolUse(Bash) | `bash-guard.sh` | 危険コマンドブロック | sync |
| PermissionRequest | `permission-guard.sh` | 権限レベルに応じた自動判定 | sync |
| PostToolUse(Edit/Write) | `post-edit-check.sh` | 編集後チェック | async |
| PostToolUse(Edit/Write) | `artifact-auto-sync.sh` | 成果物自動同期 | async |
| PostToolUse(Edit/Write) | `claude-md-size-guard.sh` | CLAUDE.mdサイズ監視 | async |
| PostToolUse(Edit/Write) | `docs-sync-guard.sh` | ドキュメント同期警告 | async |
| PostToolUse(all) | `tool-collector.sh` | ツール使用ログ蓄積 | async |
| PreCompact | `pre-compact-save.sh` | セッション状態をJSONに退避 | sync |
| PostCompact | `post-compact-restore.sh` | additionalContextで状態再注入 | sync |
| Stop | `auto-push.sh` | git push | sync |
| Stop | `session-summary.sh` | セッションサマリ記録 | async |

### 1.3 Sub-agent 設計（現行）

8部署分のAgent定義ファイルが `.claude/agents/` に存在。frontmatter で以下を指定:

- `tools`: 使用可能ツールのリスト
- `model`: sonnet（コスト効率）
- `maxTurns`: 15（固定値）

**委譲時**: 秘書（メインAgent）が `agent-delegation-template.md` に沿ってコンテキスト、タスク、前ステップ成果物、適用ルールを手動で構築して渡す。

### 1.4 Context Compaction 対策（現行）

- `pre-compact-save.sh`: `.company/secretary/.session-state.json` に日時とリマインダーを保存
- `post-compact-restore.sh`: `additionalContext` で「Compaction発生。ファイルを確認せよ」と再注入
- ルール上: 「意思決定は即時永続化」（`hd-operations.md`）

---

## 2. Claude Code 公式アーキテクチャとの差分

### 2.1 Agentic Loop

| 観点 | 公式設計 | HD現行 | 評価 |
|------|---------|--------|------|
| 基本ループ | gather context → take action → verify results → repeat | pipeline.md で5パターン定義、部署単位で分業 | **整合**: パイプラインは公式ループの「組織的な拡張」として妥当 |
| 中断・再指示 | ユーザーがいつでも中断可能 | checkpoint 方式で社長確認ポイントを設定 | **整合**: checkpoint は公式の「interrupt and steer」の構造化版 |
| 自律的判断 | Claude が次のステップを自律決定 | ルールで判断基準を事前定義（パイプライン選択テーブル） | **軽微なズレ**: 過度に事前定義すると Claude の自律判断力を制限する可能性 |

### 2.2 Context Loading

| 観点 | 公式設計 | HD現行 | 評価 |
|------|---------|--------|------|
| CLAUDE.md 階層 | managed → project → user → local、ディレクトリ上方探索 | `.company/CLAUDE.md` (65行) + `.claude/CLAUDE.md` (20行) + `rules/` (6ファイル) | **整合**: 適切に分離されている |
| CLAUDE.md サイズ | 200行以下推奨 | `.company/CLAUDE.md` 65行、各rules 30-100行 | **整合**: 範囲内 |
| rules/ の活用 | path-specific frontmatter でオンデマンドロード可能 | `paths` frontmatter 未使用、全ルールが常時ロード | **改善余地**: path-specific rules を活用していない |
| Sub-directory CLAUDE.md | サブディレクトリの CLAUDE.md はファイル読み込み時にオンデマンドロード | `.company/departments/*/CLAUDE.md` は Agent 起動時に手動で Read | **整合**: 意図的に手動制御 |
| Auto Memory | `MEMORY.md` に自動学習、200行/25KB制限 | `~/.claude/knowledge/` に手動YAML蓄積 + Supabase `knowledge_base` | **ズレ**: 公式のAuto Memoryと並行して独自システムを運用。重複リスクあり |
| @import | `@path/to/file` でCLAUDE.mdから他ファイルをインポート可能 | 未使用。references/ は委譲時に手動Read | **改善余地**: @import で参照ドキュメントの自動ロードが可能 |
| `claudeMdExcludes` | 不要なCLAUDE.mdを除外可能 | 未使用 | **中立**: 現状はモノレポではないため不要 |

### 2.3 Tool Execution & Permission Model

| 観点 | 公式設計 | HD現行 | 評価 |
|------|---------|--------|------|
| Permission modes | Default / Auto-accept edits / Plan / Auto の4段階 | `permission-guard.sh` で full/safe/strict の3段階 | **整合**: 公式4段階を3段階に簡略化。実用上は十分 |
| settings.json allow | パターンベースの事前許可 | 200行超の巨大なallowリスト | **要改善**: 許可ルールが肥大化。PJ固有のパターンが混在 |
| PreToolUse の新API | `permissionDecision: allow/deny/ask/defer` + `updatedInput` | `bash-guard.sh` で exit 2 (block) のみ使用 | **改善余地**: 新しい `permissionDecision` API を活用していない |
| read-only 自動承認 | Read系ツールは自動承認が前提 | `Read(/workspace/**)` 等で明示的に許可 | **整合**: 明示的許可は冗長だが安全 |
| deny リスト | パターンベースの拒否 | `.env`, `.key`, `*secret*`, `*credentials*` を拒否 | **整合**: 適切 |

### 2.4 Sub-agent（Task tool）

| 観点 | 公式設計 | HD現行 | 評価 |
|------|---------|--------|------|
| 独立コンテキスト | 各Sub-agentは親の会話を参照不可。独立した会話+ツールセット | 委譲テンプレートで必要情報を全て渡す設計 | **整合**: 公式設計の理解が正しく反映されている |
| ビルトインAgent | Explore(Haiku,read-only)、Plan(read-only)、General-purpose(全ツール) | 全Agent が sonnet + maxTurns:15 で統一 | **改善余地**: Explore/Plan 相当の軽量Agent未定義。model指定が画一的 |
| Agent Memory | Sub-agentごとに persistent memory を持てる | 未使用 | **改善余地**: 長期学習が蓄積されない |
| ツール制限 | `tools` / `disallowedTools` で精密に制御可能 | `tools` のみ使用。disallowedTools 未使用 | **軽微**: 現状は十分だが、disallowedTools の方が安全な場合もある |
| background 実行 | frontmatter `background: true` でバックグラウンド実行可能 | pipeline.md で「run_in_background=true」と言及するが、frontmatter未設定 | **改善余地**: background frontmatter を Agent 定義に反映すべき |
| isolation | `isolation: true` でワーカーツリー分離可能 | 未使用 | **中立**: 現時点では不要 |
| maxTurns | タスクの複雑さに応じて調整可能 | 全Agent 15固定 | **改善余地**: リサーチ(多ステップ)とPM(少ステップ)で差をつけるべき |
| effort | `effort: "low"/"medium"/"high"` で推論深度を制御可能 | 未使用 | **改善余地**: Haiku系Agent に effort:low を設定可能 |
| skills | Agent ごとに読み込むスキルを指定可能 | 未使用 | **改善余地**: 部署固有スキルをAgent定義に組み込める |

### 2.5 Hook システム

| 観点 | 公式設計 | HD現行 | 評価 |
|------|---------|--------|------|
| イベント数 | 23+イベント（SessionStart, InstructionsLoaded, SubagentStart, SubagentStop, TaskCreated, TaskCompleted 等） | 8イベント使用（SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PreCompact, PostCompact, Stop） | **改善余地**: 新イベント（InstructionsLoaded, SubagentStart/Stop, TaskCreated/Completed, SessionEnd）を活用していない |
| Hook タイプ | command, http, prompt, agent の4種類 | command のみ使用 | **改善余地**: prompt hook（LLM評価）、agent hook（Sub-agent起動）が未活用 |
| `if` 条件 | `Bash(git *)` 等のパターンマッチ | `matcher` のみ使用 | **軽微**: `if` の方が細粒度だが、現状 matcher で十分 |
| `once` フラグ | 1回だけ実行 | 未使用 | **中立** |
| `statusMessage` | カスタムスピナーメッセージ | 未使用 | **中立**: UX改善に使える |
| HTTP hook | 外部エンドポイントへPOST | 未使用（全てshellスクリプト経由でcurl） | **改善余地**: Supabase書き込みをHTTP hookに置き換えれば簡潔化可能 |
| SessionEnd | セッション完全終了時 | Stop のみ使用（SessionEnd は別イベント） | **確認必要**: Stop と SessionEnd の使い分けが不明確 |

### 2.6 Context Window Management

| 観点 | 公式設計 | HD現行 | 評価 |
|------|---------|--------|------|
| Compaction 対策 | CLAUDE.md はCompaction後も再ロードされる。会話中の指示は消失 | `pre-compact-save.sh` + `post-compact-restore.sh` で独自退避・復元 | **重要な発見**: 公式ドキュメントによると「CLAUDE.md fully survives compaction」。つまり CLAUDE.md に書いてある内容は退避不要。HD の Pre/PostCompact Hook は「セッション固有の動的状態」の退避にのみ必要 |
| Compact Instructions | CLAUDE.md に「Compact Instructions」セクションを書くと圧縮時の保持指示になる | 未使用 | **改善余地**: 重要ルールの保持率を上げられる |
| `/compact` フォーカス | `/compact focus on X` で特定トピックに集中した圧縮が可能 | 未使用 | **中立**: 手動操作 |
| スキルの遅延ロード | スキルは description のみロード、本体はオンデマンド | `disable-model-invocation` 未設定のスキルあり | **改善余地**: 不要なスキルの自動ロードを防止できる |

---

## 3. 改善提案（優先度付き）

### P0: 高優先度（即効性が高く、設計の根幹に関わる）

#### 3.1 settings.json の allow リスト整理

**現状の問題**: 200行超の巨大な allow リストに PJ 固有のパターン（`pdftotext`, `sed -i` の特定ファイル指定等）が混在している。

**提案**:
- `settings.json`（git管理）: 全PJ共通の許可パターンのみ
- `settings.local.json`（gitignore）: サーバー/PJ固有の許可パターン
- `permission-guard.sh` の safe モードを活用し、破壊的操作以外は Hook で自動許可

**根拠**: 公式ドキュメントは `settings.json` を「チーム共有の設定」、`settings.local.json` を「個人設定」と位置づけている。
- ソース: https://code.claude.com/docs/en/how-claude-code-works

#### 3.2 Sub-agent 定義の最適化

**現状の問題**: 全Agent が `model: sonnet`, `maxTurns: 15` で画一的。

**提案**:

| Agent | model | maxTurns | effort | background | 理由 |
|-------|-------|----------|--------|-----------|------|
| リサーチ部 | opus | 20 | high | false | 深い分析が必要 |
| AI開発部 | opus | 20 | high | false | 複雑な設計・実装 |
| システム開発部 | sonnet | 15 | medium | false | 標準的な実装 |
| PM部 | haiku | 10 | low | true | チケット作成は軽量 |
| 情報収集部 | haiku | 10 | low | true | 情報取得は軽量 |
| UXデザイン部 | sonnet | 15 | medium | false | 分析+提案 |
| 資料制作部 | sonnet | 15 | medium | false | 文書作成 |
| QA部 | sonnet | 10 | medium | false | テスト実行・検証 |

追加で `disallowedTools` を活用:
- リサーチ部: `disallowedTools: [Edit, Write, Bash]`（read-only + web のみ）
- 情報収集部: `disallowedTools: [Edit, Write, Bash]`

**根拠**: 公式ドキュメントは「Control costs by routing tasks to faster, cheaper models like Haiku」と明示。
- ソース: https://code.claude.com/docs/en/sub-agents

#### 3.3 Context Compaction 対策の再設計

**現状の問題**: `pre-compact-save.sh` が保存する内容が最小限（日付とリマインダーのみ）。また CLAUDE.md が Compaction を生き残ることを前提にした設計になっていない。

**提案**:
1. **CLAUDE.md に「Compact Instructions」セクションを追加**: 「パイプライン進行中のステップ」「処理中のタスクID」等、Compaction で保持すべき情報の指示を記載
2. **pre-compact-save.sh の強化**: 現在のパイプラインステップ、処理中タスクID、直近の決定事項サマリを保存
3. **即時永続化の徹底**: 意思決定・学びをファイルに書く運用は正しいが、「書くタイミング」を Hook で強制できる（PostToolUse で判定）

**根拠**: 「Instructions from early in the conversation may be lost. Put persistent rules in CLAUDE.md rather than relying on conversation history.」
- ソース: https://code.claude.com/docs/en/memory

### P1: 中優先度（効率改善、設計の洗練）

#### 3.4 Auto Memory と独自ナレッジシステムの統合

**現状の問題**: 
- 公式 Auto Memory (`MEMORY.md`) が存在し、HD独自の `~/.claude/knowledge/` (YAML) + Supabase `knowledge_base` と並行稼働
- 学習が分散し、重複や矛盾のリスクがある

**提案**:
- **Auto Memory を有効化**（現在の状態を確認し、明示的に on にする）
- **独自 knowledge/ ディレクトリ** は「昇格候補の管理台帳」に特化（Auto Memory が自動蓄積、knowledge/ は社長承認済みの確定ルールのみ）
- **Supabase knowledge_base** は分析・可視化用の二次ストアとして位置づけ（SSOT は MEMORY.md + rules/）

**根拠**: 「Auto memory lets Claude accumulate knowledge across sessions without you writing anything.」公式が自動学習機構を提供しているため、独自実装との役割分担が必要。
- ソース: https://code.claude.com/docs/en/memory

#### 3.5 Hook の新イベント活用

**現状の問題**: 23+の公式イベントのうち8つしか使っていない。

**優先的に導入すべきイベント**:

| イベント | 用途 | 期待効果 |
|---------|------|---------|
| `SubagentStart` | 部署Agent起動時の自動ログ + コンテキスト注入 | 委譲の可観測性向上 |
| `SubagentStop` | 部署Agent完了時の成果物自動検証 + ハンドオフ検出 | 現在手動で行っている完了検証を自動化 |
| `TaskCreated` | タスク作成時の自動バリデーション | タスク品質の均一化 |
| `TaskCompleted` | タスク完了時の自動記録 | Supabase 更新の自動化 |
| `InstructionsLoaded` | どの CLAUDE.md / rules が読み込まれたかのログ | デバッグ・可観測性向上 |
| `SessionEnd` | セッション完全終了時の最終同期 | Stop と SessionEnd の使い分け明確化 |

**根拠**: 公式が SubagentStart/Stop を提供しているのは、まさに HD のようなマルチAgent構成を想定しているため。
- ソース: https://code.claude.com/docs/en/hooks

#### 3.6 @import の活用

**現状の問題**: `.company/references/` のドキュメント（委譲テンプレート、ブリーフィング手順等）は、必要時に手動 Read している。

**提案**:
- `.company/CLAUDE.md` に `@references/agent-delegation-template.md` を追加
- 部署 Agent の system prompt に `@.company/departments/{dept}/CLAUDE.md` 相当の情報を frontmatter で直接記述（現在は「起動時に Read せよ」という指示のみ）

**注意**: @import は CLAUDE.md のコンテキストを増やすため、必要最小限に。

**根拠**: 「Imported files are expanded and loaded into context at launch alongside the CLAUDE.md that references them.」
- ソース: https://code.claude.com/docs/en/memory

#### 3.7 HTTP Hook によるSupabase書き込みの簡潔化

**現状の問題**: `prompt-log.sh`, `config-sync.sh`, `session-summary.sh` 等で各スクリプトが独自に curl で Supabase に書き込んでいる。認証情報のロード（`supabase-check.sh`）も各スクリプトで重複。

**提案**:
- Supabase 書き込みを HTTP hook に移行（`type: "http"` + `url` + `headers`）
- `allowedEnvVars` で認証情報を渡す
- Shell スクリプトの curl 呼び出しを排除

**トレードオフ**: HTTP hook は JSON ペイロードの柔軟性が shell スクリプトより低い。タグ付けロジック等の複雑な前処理は shell に残す必要がある。

**根拠**: 公式が HTTP hook を提供しているのは、外部サービス連携の簡潔化のため。
- ソース: https://code.claude.com/docs/en/hooks

### P2: 低優先度（将来的な最適化）

#### 3.8 path-specific rules の導入

**提案**: `.claude/rules/` のファイルに `paths` frontmatter を追加し、関連ファイル操作時のみロードされるようにする。

例:
```yaml
# .claude/rules/commit-rules.md
---
paths:
  - "**/.git/**"
  - "**/package.json"
---
```

**効果**: コンテキストウィンドウの節約。現在6ファイルが常時ロードされているが、commit-rules は git 操作時のみ必要。

#### 3.9 Explore 相当の軽量 Agent 追加

**提案**: コードベース探索専用の Agent を追加。

```yaml
---
name: Explorer
description: コードベース探索専用。ファイル検索、パターン検索、構造理解に使用。
tools: [Read, Glob, Grep]
model: haiku
maxTurns: 10
effort: low
---
```

**効果**: 現在リサーチ部や秘書が行っている「まず構造を把握する」フェーズを軽量に実行可能。

#### 3.10 prompt hook / agent hook の活用検討

**提案**: 
- `prompt` hook: PostToolUse で「この編集は設計書と整合しているか」を LLM に評価させる
- `agent` hook: SubagentStop で成果物の品質チェックを別 Agent に自動委譲

**注意**: コスト増に注意。全ツール実行に LLM 評価を挟むと過剰になる。

---

## 4. 限界の明示

### 分析できなかったこと

1. **実際のトークン消費量**: CLAUDE.md + rules + Hook 出力の合計が context window の何%を占めているかは `/context` コマンドでの実測が必要
2. **Hook の実行時間**: 各 Hook の実行時間とセッション起動への影響は計測が必要（特に config-sync.sh は多数の curl を含む）
3. **Auto Memory の現在の状態**: `~/.claude/projects/<project>/memory/MEMORY.md` の内容と、独自 knowledge/ との重複度は未確認
4. **Agent Teams**: 公式が2026年に追加した「Agent Teams」機能（複数Agent が独立セッションで並行稼働し相互通信する）の詳細は未調査。HD のパイプライン並列実行との関係性を別途調査すべき

### 確認すれば精度が上がる情報

- 社長が最も「コンテキスト不足」を感じるシーン（Compaction後？Agent委譲後？）
- 現在の Auto Memory の有効/無効状態
- Hook 実行エラーの頻度（`~/.claude/logs/` の分析）
- 各 Sub-agent の平均実行ターン数（maxTurns: 15 は適切か、足りないか）

---

## 5. 結論

### HD設計の評価サマリ

HD の設計は Claude Code 公式アーキテクチャと**概ね整合**している。特に以下の点は優れている:

1. **委譲テンプレートの設計**: 「Sub-agent は親の会話を参照不可」という公式制約を正しく理解し、全コンテキストを渡す仕組みを構築済み
2. **Hook の責務分離**: 「記録は Hook、判断は /company」の分離原則は公式のベストプラクティスに合致
3. **即時永続化の思想**: Context Compaction 対策として「重要情報は即座にファイルに書く」は公式が推奨するアプローチそのもの

一方、以下の領域で**公式の新機能を活用しきれていない**:

1. **Sub-agent の model/effort/maxTurns の最適化**（P0: コスト削減 + 品質向上）
2. **settings.json の肥大化**（P0: 保守性低下リスク）
3. **新 Hook イベントの未活用**（P1: SubagentStart/Stop で自動検証が可能に）
4. **Auto Memory との統合**（P1: 独自ナレッジシステムとの重複解消）

### 設計変更の方向性

**「Claude Code の仕組みに乗る」** ことが最も効率的。独自実装を減らし、公式機能で代替できるものは代替する。

---

## 6. ネクストアクション

| # | アクション | 担当 | 優先度 | 依存 |
|---|-----------|------|--------|------|
| 1 | `settings.json` の allow リストを共通/PJ固有に分離 | システム開発部 | P0 | なし |
| 2 | 各 Sub-agent の model/maxTurns/effort を最適化 | 秘書 + 社長判断 | P0 | なし |
| 3 | Pre/PostCompact Hook の強化 + Compact Instructions 追加 | システム開発部 | P0 | なし |
| 4 | Auto Memory の状態確認と独自ナレッジシステムとの役割分担決定 | 秘書 | P1 | 社長壁打ち |
| 5 | SubagentStart/Stop Hook の設計・実装 | システム開発部 | P1 | #2 完了後 |
| 6 | @import の導入（委譲テンプレート等） | 秘書 | P1 | なし |
| 7 | HTTP Hook への Supabase 書き込み移行検討 | システム開発部 | P1 | なし |
| 8 | path-specific rules の導入 | 秘書 | P2 | なし |
| 9 | Explore 相当の軽量 Agent 追加 | 秘書 | P2 | #2 完了後 |
| 10 | Agent Teams 機能の調査 | リサーチ部 | P2 | なし |

---

## 7. 壁打ちモードへの導線

社長が深掘りする際の問いかけ例:

1. **「Compaction で一番困っているのはどのシーン？」** → P0 の Compaction 対策の具体的な方向性が決まる
2. **「Agent の model を変えるとコストはどう変わる？」** → opus/sonnet/haiku の使い分け基準を定量化できる
3. **「独自ナレッジシステム（knowledge/）は今どれくらい活用されている？」** → Auto Memory との統合方針が決まる
4. **「Hook の実行でセッション起動が遅いと感じることはある？」** → Hook 最適化の優先度が決まる
5. **「Agent Teams を使えば、秘書がパイプラインを管理する負荷が減るのでは？」** → アーキテクチャの根本的な再設計の検討に進める

---

## ソース

- [How Claude Code works - 公式ドキュメント](https://code.claude.com/docs/en/how-claude-code-works)
- [Hooks - 公式ドキュメント](https://code.claude.com/docs/en/hooks)
- [Sub-agents - 公式ドキュメント](https://code.claude.com/docs/en/sub-agents)
- [Memory (CLAUDE.md / Auto Memory) - 公式ドキュメント](https://code.claude.com/docs/en/memory)
- [How the agent loop works - Claude API Docs](https://platform.claude.com/docs/en/agent-sdk/agent-loop)
- [Claude Code Architecture Deep Dive - WaveSpeedAI](https://wavespeed.ai/blog/posts/claude-code-architecture-leaked-source-deep-dive/)
- [Inside Claude Code's Architecture - DEV Community](https://dev.to/oldeucryptoboi/inside-claude-codes-architecture-the-agentic-loop-that-codes-for-you-cmk)

```yaml
# handoff
handoff:
  - to: pm
    tasks:
      - "上記ネクストアクションをタスクチケットに分割"
      - "P0施策の期限設定（1週間以内を推奨）"
  - to: sys-dev
    context: "settings.json分離、Sub-agent最適化、Hook強化の実装"
    tasks:
      - "settings.json の allow リスト分離（共通 vs PJ固有）"
      - "SubagentStart/Stop Hook の設計"
```
