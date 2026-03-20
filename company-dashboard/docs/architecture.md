# アーキテクチャ

## 全体構成

```
┌──────────────────────────────────────────────────────────────┐
│ Claude Code (ローカル)                                        │
│                                                              │
│  .claude/settings.json ── Hook設定・権限・プラグイン            │
│  .claude/.mcp.json ────── MCP サーバー設定                     │
│  .claude/CLAUDE.md ────── プロジェクト指示書                    │
│  .claude/hooks/ ──────── 自動同期スクリプト群                   │
│  plugins/company/skills/ ── カスタムスキル (SKILL.md)           │
│                                                              │
│  ┌─────────────────────────────────────┐                     │
│  │ Hook (自動・バックグラウンド)          │                     │
│  │  SessionStart  → config-sync.sh     │                     │
│  │  UserPromptSubmit → prompt-log.sh   │── Supabase REST API │
│  │  PermissionRequest → permission-guard│                     │
│  └─────────────────────────────────────┘                     │
│                                                              │
│  ┌─────────────────────────────────────┐                     │
│  │ スキル (手動)                         │                     │
│  │  /company   → 組織・タスク管理        │                     │
│  │  /invoice   → 財務管理               │── Supabase REST API │
│  │  /no-edit   → 読み取り専用モード       │                     │
│  │  /permission→ 権限管理（表示のみ）     │                     │
│  └─────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
        │                              │
        │  Supabase REST API           │  git push
        ▼                              ▼
┌──────────────────┐          ┌──────────────┐
│ Supabase          │          │ GitHub        │
│  PostgreSQL       │          │  リポジトリ    │
│  GitHub OAuth     │          └──────┬───────┘
│  RLS              │                 │ Webhook
└────────┬─────────┘                 ▼
         │ JS Client          ┌──────────────┐
         ▼                    │ Vercel        │
┌──────────────────┐          │  静的ホスティング│
│ ダッシュボード      │◀─────── │  自動デプロイ  │
│  PC / スマホ       │          └──────────────┘
└──────────────────┘
```

---

## 外部サーバーとの関係

| サーバー | 役割 |
|---------|------|
| **Supabase** | DB（PostgreSQL）、認証（GitHub OAuth）、RLS、Hook・スキルからの REST API アクセス先 |
| **Vercel** | index.html の静的ホスティング。GitHub push → 自動デプロイ |
| **GitHub** | ソースコード管理、OAuth プロバイダー、push → Vercel Webhook |
| **Google Calendar** | MCP サーバー経由で接続。`/invoice sync` で `[仕事]` イベントから稼働取得 |

---

## データフロー

## マルチサーバー対応

複数のサーバーや同一サーバーの別ディレクトリで開発する場合、それぞれが独立したレコードとして管理される。

```
識別子 = hostname:project_dir

例:
  server-a:/workspace         → "server-a:/workspace"
  server-a:/home/user/proj-b  → "server-a:/home/user/proj-b"
  server-b:/workspace         → "server-b:/workspace"
```

| ファイル | 共有/ローカル | git管理 | 内容 |
|---------|:---:|:---:|------|
| `settings.json` | 共有 | ✅ | hooks, plugins, env, marketplaces |
| `settings.local.json` | ローカル | ❌ | マシン固有のパス, 権限 |
| `.mcp.json` | 共有 | ✅ | MCP サーバー設定 |

`config-sync.sh` は両方を読み取り、マージして Supabase に同期する（`permissions.allow` は結合、他はローカルが優先）。

---

## データフロー

| 何が | どこから | どこへ | いつ | どうやって |
|------|---------|-------|------|-----------|
| 設定（plugins/permissions/hooks） | `settings.json` + `settings.local.json` | Supabase `claude_settings` | セッション起動時 | `config-sync.sh` |
| MCP サーバー一覧 | `.mcp.json` | Supabase `claude_settings` | セッション起動時 | `config-sync.sh` |
| CLAUDE.md 内容 | `.claude/CLAUDE.md` | Supabase `claude_settings` | セッション起動時 | `config-sync.sh` |
| スキル一覧 | 全 SKILL.md | Supabase `slash_commands` | セッション起動時 | `sync-slash-commands.sh` |
| ユーザー入力 | Claude Code | Supabase `prompt_log` | 入力ごと | `prompt-log.sh` |
| タスク・コメント | `/company` | Supabase `tasks`/`comments` | 手動操作時 | Supabase MCP |
| 請求書・経費 | `/invoice` | Supabase `invoices`/`expenses` | 手動操作時 | REST API |
| 稼働時間 | Google Calendar | Supabase `time_entries` | `/invoice sync` | Calendar MCP → REST |
| ダッシュボード表示 | Supabase | ブラウザ | ページ表示時 | Supabase JS Client |
