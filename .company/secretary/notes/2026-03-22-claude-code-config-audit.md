# Claude Code 設定管理チェックリスト（タスク#4）

## 管理すべき設定ファイル一覧

### コア設定（定期チェック対象）

| ファイル | スコープ | チェック内容 |
|---------|---------|-------------|
| `.claude/settings.json` | プロジェクト共有 | permissions, hooks, env, plugins |
| `.claude/settings.local.json` | ローカル個人 | ローカル上書き設定 |
| `~/.claude/settings.json` | ユーザー全体 | グローバルデフォルト |
| `.claude/CLAUDE.md` | プロジェクト指示 | 200行以内か、内容が最新か |
| `~/.claude/CLAUDE.md` | ユーザー指示 | グローバルルール |
| `.mcp.json` | MCP設定 | サーバー動作確認、認証有効 |

### Hook設定（現在利用中）

| Hook | ファイル | 確認事項 |
|------|---------|---------|
| UserPromptSubmit | prompt-log.sh | Supabase記録動作 |
| SessionStart | config-sync.sh | 設定同期動作 |
| SessionStart | company-sync-check.sh | 会社突合チェック |
| PermissionRequest | permission-guard.sh | パーミッション制御 |

### 利用可能だが未使用のHookイベント

| イベント | 用途案 |
|---------|-------|
| PreToolUse | 危険なツール使用の事前警告 |
| PostToolUse | 成功した操作のログ蓄積 |
| Stop | セッション終了時のサマリー生成 |
| SubagentStart/Stop | サブエージェント利用状況の追跡 |
| ConfigChange | 設定変更の自動検知・ダッシュボード反映 |
| PreCompact/PostCompact | コンテキスト圧縮の追跡 |

### プラグイン（現在有効）

| プラグイン | 状態 | チェック内容 |
|-----------|------|-------------|
| company@ai-company | 有効 | 自作。スキル定義が最新か |
| document-skills | 有効 | 公式。バージョン確認 |
| frontend-design | 有効 | 公式 |
| context7 | 有効 | 公式。MCP接続確認 |
| serena | 有効 | 公式。MCP接続確認 |
| pr-review-toolkit | 有効 | 公式 |
| github | 有効 | 公式。認証確認 |
| code-review | 有効 | 公式 |
| security-guidance | 有効 | 公式 |
| supabase | 有効 | 公式。MCP接続確認 |
| commit-commands | 有効 | 公式 |

## 定期チェック実施案

### チェック頻度

| チェック項目 | 頻度 | 方法 |
|-------------|------|------|
| Hook動作確認 | セッション開始毎（自動） | company-sync-check.sh |
| 設定同期 | セッション開始毎（自動） | config-sync.sh |
| MCP接続確認 | 週次 | 手動 or Hookで自動化 |
| プラグインバージョン | 月次 | 手動確認 |
| CLAUDE.md見直し | 月次 | 内容の陳腐化チェック |
| パーミッション棚卸 | 月次 | 不要な許可の削除 |

### 自動化候補（今後のHook拡張）

1. **ConfigChange Hook**: settings.json が変わったらダッシュボードに自動反映
2. **Stop Hook**: セッション終了時に作業サマリーをSupabaseに保存
3. **SubagentStop Hook**: サブエージェント利用状況を記録し、コスト可視化

## 次のステップへの申し送り

- 現在のHookは4つ。ConfigChange, Stop, SubagentStop の追加を検討
- permissions.allow が44行と多い。棚卸して不要なものを整理すべき
- MCP接続の死活監視は未実装。週次チェック or Hookでの自動化を検討
