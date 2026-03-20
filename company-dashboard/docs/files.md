# ファイル構成と役割

```
/workspace/
├── .claude/                           Claude Code 設定ディレクトリ
│   ├── settings.json                  ★ 共有設定（hooks/プラグイン/env） ← git管理
│   ├── settings.local.json            マシン固有設定（パス/権限） ← gitignore
│   ├── .mcp.json                      MCP サーバー接続設定（google-calendar 等）
│   ├── CLAUDE.md                      プロジェクト指示書（LLMへの恒久ルール）
│   ├── hooks/                         自動実行スクリプト群
│   │   ├── supabase.env               Supabase 接続情報（URL + Anon Key）
│   │   ├── prompt-log.sh              全入力を prompt_log に自動記録
│   │   ├── config-sync.sh             セッション開始時に設定を Supabase に同期
│   │   ├── sync-slash-commands.sh     全スキルをスキャンして slash_commands に同期
│   │   ├── permission-guard.sh        権限レベルに応じた自動承認/拒否
│   │   └── skills-cache.json          スキル同期のキャッシュ（差分検知用）
│   └── plugins/
│       └── marketplaces/              インストール済みマーケットプレイスプラグイン
│
├── plugins/
│   └── company/
│       ├── plugin.json                カスタムプラグイン定義
│       └── skills/
│           ├── company/SKILL.md       /company（組織・タスク管理）
│           ├── invoice/SKILL.md       /invoice（財務管理）
│           ├── no-edit/SKILL.md       /no-edit（読み取り専用）
│           └── permission/SKILL.md    /permission（権限表示）
│
├── company-dashboard/                 ダッシュボード本体
│   ├── index.html                     SPA（HTML + CSS + JS 単一ファイル）
│   ├── supabase-setup.sql             新規インストール用（全テーブル一括）
│   ├── supabase-migration-*.sql       差分マイグレーション（番号順に実行）
│   ├── docs/                          ドキュメント群
│   └── README.md                      概要・クイックスタート
│
└── vercel.json                        Vercel 設定（→ company-dashboard/）
```

## settings.json の構造

```jsonc
{
  "env": { ... },              // 環境変数
  "permissions": {
    "allow": [ ... ],          // 許可ルール
    "additionalDirectories": [ ... ]
  },
  "hooks": {                   // → docs/hooks.md 参照
    "UserPromptSubmit": [ ... ],
    "PermissionRequest": [ ... ],
    "SessionStart": [ ... ]
  },
  "enabledPlugins": { ... },   // インストール済みプラグイン
  "extraKnownMarketplaces": {  // カスタムマーケットプレイス定義
    "ai-company": { ... }
  }
}
```

## PJ会社のディレクトリ構造

```
/workspace/
├── .company/              HD（ホールディングス）のルート
│   ├── registry.md        全PJ会社の一覧・設定
│   └── knowledge/         HD共通のナレッジ
│
├── .company-ai/           AI開発会社
│   ├── README.md          会社概要・部署構成
│   └── knowledge/         PJ固有のナレッジ
│
├── .company-circuit/      回路図PJ会社
├── .company-rikyu/        りきゅうPJ会社
└── ...
```

## マイグレーション一覧

| ファイル | 内容 |
|---------|------|
| `supabase-setup.sql` | **新規セットアップ用**（全テーブル一括） |
| `migration-002` | user_id 削除 |
| `migration-003` | prompt_log + ceo_insights |
| `migration-004` | knowledge_base + CLAUDE.md 可視化 |
| `migration-005` | portfolio + career テーブル |
| `migration-006` | Hook 用 anon RLS ポリシー |
| `migration-007` | slash_commands テーブル |
| `migration-008` | 財務テーブル（projects, invoices, expenses, time_entries, tax_payments） |
| `migration-009` | マルチサーバー対応（claude_settings に server_host カラム追加） |
