# HD Company Dashboard

PJ会社を一元管理するWebダッシュボード。Supabase + GitHub OAuth。
PC でもスマホでも同じURLで使える。

## セットアップ

### 1. Supabase プロジェクト作成

[supabase.com](https://supabase.com) でプロジェクトを作成し、以下をメモ:
- **Project URL**: `https://xxx.supabase.co`
- **Anon Key**: `eyJ...`（Settings > API > anon key）

### 2. DB スキーマを実行

Supabase Dashboard > SQL Editor > New query に `supabase-setup.sql` の内容をペーストして Run。

### 3. GitHub OAuth を設定

Supabase Dashboard > Authentication > Providers > GitHub:

1. GitHub で OAuth App を作成:
   - [github.com/settings/developers](https://github.com/settings/developers) > New OAuth App
   - **Application name**: HD Dashboard
   - **Homepage URL**: デプロイ後のURL（Step 4 で確定）
   - **Callback URL**: `https://xxx.supabase.co/auth/v1/callback`
2. Client ID と Client Secret を Supabase の GitHub Provider に入力
3. Enable をオンにする

### 4. Vercel にデプロイ

1. [vercel.com](https://vercel.com) にGitHubでログイン
2. 「Add New Project」→ `boku-miyaji/claude_dev` リポジトリを選択
3. 設定:
   - **Root Directory**: `company-dashboard`
   - **Framework Preset**: Other
   - **Build Command**: (空欄のまま)
   - **Output Directory**: `.`
4. 「Deploy」

デプロイ完了後、`https://xxx.vercel.app` のようなURLが発行される。

**デプロイ後:**
- GitHub OAuth App の Homepage URL をVercelのURLに更新する
- Supabase > Authentication > URL Configuration > Site URL にもVercelのURLを設定する

### 5. 初回接続

1. Vercel のURLにアクセス
2. Supabase URL と Anon Key を入力
3. 「Save & Connect」
4. 「Sign in with GitHub」

## 使い方

### PC

- **Dashboard**: KPI概要、PJ会社一覧、アクティビティ
- **Inbox**: タスクやコメントをすばやく追加
- **Tasks**: 全社横断のタスクボード（フィルター・編集・完了）
- **Companies**: PJ会社の管理（作成・編集・アーカイブ）
- **Settings**: Claude Code設定の閲覧

### スマホ

- 画面下部のナビバーで切り替え
- **Inbox** がメイン: 思いついたタスクやメモをすぐ追加
- タスクの完了チェックも可能

### Claude Code との連携

ターミナルで `/company` を実行すると、秘書が Supabase からデータを取得:

```
/company          → HD秘書（全社ダッシュボード）
/company ai       → AI会社秘書（Supabaseからタスク取得）
```

秘書がタスクを作成・完了すると、自動でSupabaseに反映 → ダッシュボードにリアルタイム表示。

## アーキテクチャ

```
スマホ / PC (ブラウザ)
    ↕ REST API + Realtime
Supabase (PostgreSQL + Auth)
    ↕ MCP Plugin / REST
Claude Code (ターミナル)
```

## ファイル構成

```
company-dashboard/
├── index.html            ← SPA (HTML + CSS + JS in one file)
├── vercel.json           ← Vercel deployment config
├── supabase-setup.sql    ← DB schema
└── README.md             ← This file
```
