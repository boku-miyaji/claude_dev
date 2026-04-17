---
description: Claude Code Hook イベントの発火タイミング仕様。Hook の追加・削除・変更時に参照必須。
globs: [".claude/settings.json", ".claude/hooks/**"]
---

# Hook イベント発火仕様

## イベント一覧

| イベント | 発火タイミング | 頻度 | 用途例 |
|---------|-------------|------|--------|
| **SessionStart** | セッション開始時 | 1回/セッション | auto-pull, config-sync |
| **UserPromptSubmit** | ユーザーがプロンプトを送信した時 | 毎プロンプト | prompt-log, growth-detector |
| **PreToolUse** | ツール実行前 | 毎ツール実行 | bash-guard |
| **PostToolUse** | ツール実行後 | 毎ツール実行 | post-edit-check, docs-sync-guard |
| **Stop** | **Claude のレスポンス完了後** | **毎レスポンス** | auto-push, session-summary |
| **PreCompact** | Context Compaction 前 | 必要時 | pre-compact-save |
| **PostCompact** | Context Compaction 後 | 必要時 | post-compact-restore |
| **PermissionRequest** | 許可が必要なツール実行時 | 該当時 | permission-guard |

## 重要: Stop は「セッション終了」ではない

**Stop = 各レスポンス完了後に毎回発火する。** exit 時だけではない。

- クラッシュ・切断時は発火しないが、正常な各レスポンス後には毎回発火する
- auto-push.sh をここに置くことで、毎レスポンス後に未コミット変更が自動保存される
- 「クラッシュで発火しないから信頼できない」は誤り。蓄積される未コミット変更は最大1レスポンス分
