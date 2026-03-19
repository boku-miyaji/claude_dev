# HD Company Dashboard

PJ会社を一元管理するWebダッシュボード。Supabase + GitHub OAuth。
PC でもスマホでも同じURLで使える。

## アーキテクチャ

```
スマホ / PC (ブラウザ)
    ↕ REST API + Realtime
Supabase (PostgreSQL + Auth + RLS)
    ↕ MCP Plugin / REST
Claude Code (ターミナル)
```

## セットアップ手順（ゼロからデプロイまで）

### Step 1: Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) にログイン（GitHubアカウントでOK）
2. **New Project** をクリック
   - **Name**: `hd-dashboard`（任意）
   - **Database Password**: 安全なパスワードを設定（メモしておく）
   - **Region**: `Northeast Asia (Tokyo)` を選択
3. 作成完了後、**Settings > API** で以下をメモ:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Publishable Key** (anon): `sb_publishable_xxxxx`

### Step 2: DB スキーマを実行

1. Supabase Dashboard の左メニュー → **SQL Editor**
2. **New query** をクリック
3. `company-dashboard/supabase-setup.sql` の内容をまるごとコピペ
4. **Run** をクリック
5. `Success. No rows returned` と表示されればOK

> **注意**: 一度に全部実行してください。分割すると外部キー制約のエラーが出ます。

### Step 3: Vercel にデプロイ

1. [vercel.com](https://vercel.com) に **GitHub アカウントでログイン**
2. **Add New Project** をクリック
3. リポジトリを **Import**（例: `boku-miyaji/claude_dev`）
4. 設定画面:

   | 項目 | 値 |
   |------|-----|
   | **Framework Preset** | `Other` |
   | **Root Directory** | 変更不要（リポジトリルートのまま） |
   | **Build Command** | 空欄のまま（Override OFF） |
   | **Output Directory** | 空欄のまま（Override OFF） |

   > リポジトリルートの `vercel.json` が `"outputDirectory": "company-dashboard"` を指定しているため、Root Directoryの変更は不要です。

5. **Deploy** をクリック
6. デプロイ完了後、URL が発行される（例: `https://xxx.vercel.app`）

> **仕組み**: `main` ブランチに push するたびに Vercel が自動で再デプロイします。

### Step 4: GitHub OAuth App を作成

1. [github.com/settings/developers](https://github.com/settings/developers) にアクセス
2. **OAuth Apps** タブ → **New OAuth App**
3. 以下を入力:

   | 項目 | 値 |
   |------|-----|
   | **Application name** | `HD Dashboard` |
   | **Homepage URL** | Step 3 で発行された Vercel URL |
   | **Authorization callback URL** | `https://xxxxx.supabase.co/auth/v1/callback` |

   > callback URL の `xxxxx` は Step 1 の Supabase Project URL のホスト部分です。

4. **Register application** をクリック
5. **Client ID** をメモ
6. **Generate a new client secret** をクリック → **Client Secret** をメモ

### Step 5: Supabase で GitHub 認証を有効化

1. Supabase Dashboard → **Authentication** → **Providers**
2. **GitHub** を展開
3. **Enable Sign in with GitHub** をオン
4. Step 4 でメモした **Client ID** と **Client Secret** を入力
5. **Save**

### Step 6: Supabase のリダイレクト URL を設定

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. 以下を設定:

   | 項目 | 値 |
   |------|-----|
   | **Site URL** | Vercel URL（例: `https://xxx.vercel.app`） |
   | **Redirect URLs** | 同じ Vercel URL を追加 |

3. **Save**

### Step 7: ダッシュボードの Supabase 接続設定

`company-dashboard/index.html` 内の以下の行を編集:

```js
var SUPABASE_URL = 'https://xxxxx.supabase.co';       // ← Step 1 の URL
var SUPABASE_ANON_KEY = 'sb_publishable_xxxxx';        // ← Step 1 の Publishable Key
```

変更を commit & push すると、Vercel が自動で再デプロイします。

```bash
git add company-dashboard/index.html
git commit -m "fix: set Supabase credentials"
git push origin main
```

### Step 8: 動作確認

1. Vercel URL にアクセス
2. **「Sign in with GitHub」** ボタンをクリック
3. GitHub の認可画面で **Authorize** をクリック
4. ダッシュボードが表示されれば完了

## 使い方

### PC

| セクション | 内容 |
|-----------|------|
| **Dashboard** | KPI概要、PJ会社一覧、直近アクティビティ |
| **Inbox** | タスクやコメントをすばやく追加 |
| **Tasks** | 全社横断のタスクボード（フィルター・編集・完了） |
| **Companies** | PJ会社の管理（作成・編集・アーカイブ） |
| **Settings** | Claude Code設定の閲覧 |

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

秘書がタスクを作成・完了すると、自動で Supabase に反映 → ダッシュボードにリアルタイム表示。

## トラブルシューティング

### 404 NOT_FOUND が出る

- リポジトリルートに `vercel.json` が存在し、`"outputDirectory": "company-dashboard"` が設定されているか確認
- Vercel ダッシュボードで最新のデプロイが成功しているか確認
- 手動で Redeploy: Vercel > Deployments > ... > Redeploy

### ログインボタンを押しても何も起きない

- ブラウザの開発者ツール (F12) > Console でエラーを確認
- Supabase の **Site URL** と **Redirect URLs** が Vercel URL と一致しているか確認
- GitHub OAuth App の **callback URL** が `https://xxxxx.supabase.co/auth/v1/callback` になっているか確認

### ログイン後にデータが表示されない

- Supabase Dashboard > **Table Editor** でテーブルが作成されているか確認
- RLS ポリシーが設定されているか確認（SQL Editor で `select * from pg_policies` を実行）
- `index.html` の `SUPABASE_URL` と `SUPABASE_ANON_KEY` が正しいか確認

### Supabase の接続情報を変更したい

`index.html` 内の `SUPABASE_URL` と `SUPABASE_ANON_KEY` を編集して push するか、
ダッシュボードの Settings セクションで URL と Key を入力して Save。

## ファイル構成

```
company-dashboard/
├── index.html            ← SPA (HTML + CSS + JS in one file)
├── supabase-setup.sql    ← DB schema + indexes + RLS + views
├── vercel.json           ← Vercel deployment config (in subdirectory)
└── README.md             ← This file

vercel.json               ← Root config (points outputDirectory to company-dashboard/)
```

## 今後の拡張予定

- [ ] 評価セクション（部署のKPI可視化）
- [ ] スケジュール / マイルストーン表示
- [ ] Claude Code 設定の編集機能（現在は閲覧のみ）
- [ ] プラグイン管理 UI
- [ ] リアルタイム通知
