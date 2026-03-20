# Hook（自動同期）の仕組み

## 設定場所

`.claude/settings.json` の `hooks` セクションで定義。Claude Code がイベント発火時にシェルスクリプトを実行する。

## 3つの Hook

| Hook イベント | スクリプト | いつ発火 | 何をするか |
|---|---|---|---|
| `SessionStart` | `config-sync.sh` | セッション起動時（1回） | settings.json / .mcp.json / CLAUDE.md を Supabase に同期。さらに `sync-slash-commands.sh` を呼んで全スキルを同期 |
| `UserPromptSubmit` | `prompt-log.sh` | ユーザーが入力するたび | プロンプトを `prompt_log` テーブルに記録。自動タグ付け |
| `PermissionRequest` | `permission-guard.sh` | ツール使用の許可が必要な時 | `permission-level.conf` を読み、レベルに応じて自動承認/拒否 |

## config-sync.sh の詳細

```
セッション起動
  ↓
config-sync.sh 実行
  ├── settings.json を読み取り
  │   ├── plugins (enabledPlugins)
  │   ├── permissions (allow ルール)
  │   ├── hooks 設定
  │   └── env 設定
  ├── .mcp.json を読み取り → MCP サーバー一覧
  ├── .claude/CLAUDE.md を読み取り → 内容全文
  ├── .company/CLAUDE.md を読み取り → HD設定（company_claude_md）
  ├── ↑ 全てを JSON にまとめて claude_settings テーブルに UPSERT
  │
  └── sync-slash-commands.sh を呼び出し
      ├── 7つのソースから SKILL.md をスキャン:
      │   1. plugins/*/skills/*/          (カスタム)
      │   2. .claude/skills/*/            (ワークスペース)
      │   3. ~/.claude/skills/*/          (ユーザー)
      │   4. marketplaces/anthropic-agent-skills/
      │   5. marketplaces/claude-plugins-official/plugins/
      │   6. marketplaces/claude-plugins-official/external_plugins/
      │   7. marketplaces/ai-company/.claude/skills/
      ├── skills-cache.json と比較（差分検知）
      ├── 変更があれば slash_commands テーブルに UPSERT
      └── キャッシュを更新
```

## prompt-log.sh の詳細

```
ユーザーが何か入力
  ↓
prompt-log.sh 実行（async = バックグラウンド）
  ├── stdin から JSON を読み取り（prompt 内容）
  ├── 自動タグ付け（キーワードベース）
  │   "テスト" → ["test"]
  │   "バグ"   → ["debug"]
  │   "設計"   → ["design"]
  └── prompt_log テーブルに POST
```

## Hook ファイル一覧

```
.claude/hooks/
├── supabase.env               Supabase 接続情報（URL + Anon Key）
├── prompt-log.sh              UserPromptSubmit → prompt_log
├── config-sync.sh             SessionStart → claude_settings + slash_commands
├── sync-slash-commands.sh     全スキルスキャン + 差分同期
├── permission-guard.sh        権限レベルに応じた自動承認/拒否
└── skills-cache.json          スキル同期のキャッシュ（差分検知用）
```
