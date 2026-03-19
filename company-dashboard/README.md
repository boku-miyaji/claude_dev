# 宮路HD Dashboard

PJ会社を一元管理する Web ダッシュボード。
Supabase (PostgreSQL + Auth) + Vercel (静的ホスティング) で構成。
PC・スマホ同一URLで利用可能。

## アーキテクチャ

```
スマホ / PC (ブラウザ)
    ↕ Supabase JS Client (REST + Realtime)
Supabase (PostgreSQL + GitHub OAuth + RLS)
    ↕ Supabase MCP Plugin
Claude Code (/company コマンド)
```

## 前提条件

- GitHub アカウント
- [Supabase](https://supabase.com) アカウント（無料）
- [Vercel](https://vercel.com) アカウント（無料）

## セットアップ手順

### Step 1: Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) に GitHub でログイン
2. **New Project** をクリック
   - **Name**: `miyaji-hd`（任意）
   - **Database Password**: 安全なパスワードを設定
   - **Region**: `Northeast Asia (Tokyo)`
3. 作成完了後、**Project Settings > API** で以下をメモ:

   | 項目 | 例 |
   |------|-----|
   | **Project URL** | `https://xxxxx.supabase.co` |
   | **Publishable Key** | `sb_publishable_xxxxx` |

### Step 2: DB スキーマを実行

1. Supabase Dashboard → 左メニュー **SQL Editor**
2. **New query** をクリック
3. [`supabase-setup.sql`](supabase-setup.sql) の内容を **まるごと** コピペ
4. **Run** をクリック
5. `Success. No rows returned` と表示されればOK

> **重要**: 必ず一度に全部実行してください。分割するとテーブル参照エラーが出ます。

### Step 3: Vercel にデプロイ

1. [vercel.com](https://vercel.com) に **GitHub でログイン**
2. **Add New Project** → リポジトリを **Import**
3. 設定画面:

   | 項目 | 値 |
   |------|-----|
   | **Framework Preset** | `Other` |
   | **Root Directory** | 変更不要（リポジトリルート） |
   | **Build Command** | 空欄（Override OFF） |
   | **Output Directory** | 空欄（Override OFF） |

   > リポジトリルートの `vercel.json` が `"outputDirectory": "company-dashboard"` を指定済みです。

4. **Deploy** → 完了後に URL が発行される（例: `https://xxx.vercel.app`）

> `main` に push するたびに Vercel が自動で再デプロイします。

### Step 4: GitHub OAuth App を作成

1. [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. 入力:

   | 項目 | 値 |
   |------|-----|
   | **Application name** | `宮路HD` |
   | **Homepage URL** | Step 3 の Vercel URL |
   | **Authorization callback URL** | `https://xxxxx.supabase.co/auth/v1/callback` |

   > `xxxxx` は Step 1 の Project URL のホスト部分。

3. **Register application** → **Client ID** をメモ
4. **Generate a new client secret** → **Client Secret** をメモ

### Step 5: Supabase で GitHub 認証を有効化

1. Supabase Dashboard → **Authentication** → **Providers** → **GitHub**
2. **Enable Sign in with GitHub** をオン
3. Step 4 の **Client ID** と **Client Secret** を入力 → **Save**

### Step 6: リダイレクト URL を設定

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. 設定:

   | 項目 | 値 |
   |------|-----|
   | **Site URL** | Step 3 の Vercel URL |
   | **Redirect URLs** | 同じ Vercel URL を追加 |

3. **Save**

### Step 7: Supabase 接続情報を設定

1. デプロイした Vercel URL にアクセス
2. 初回は **Setup 画面** が表示される
3. Step 1 でメモした **Project URL** と **Publishable Key** を入力
4. **Save & Connect** をクリック

> 接続情報はブラウザの localStorage に保存されます。ソースコードにはハードコードされないので、リポジトリを public にしても安全です。
> 設定変更は Dashboard の **Settings** 画面からいつでも可能です。

### Step 8: 動作確認

1. Setup 完了後、ログイン画面が表示される
2. **「Sign in with GitHub」** をクリック
3. GitHub で **Authorize**
4. ダッシュボードが表示されれば完了

## 画面構成

| 画面 | 内容 | スマホ対応 |
|------|------|-----------|
| **Dashboard** | KPI概要・PJ会社一覧・直近アクティビティ | ○ |
| **Inbox** | タスク追加・コメント追加（メイン入力画面） | ○ |
| **Tasks** | 全社横断タスクボード（フィルター・編集・完了） | ○ |
| **Companies** | PJ会社の作成・編集・アーカイブ・カテゴリ管理 | ○ |
| **Settings** | Claude Code設定閲覧・Supabase接続設定 | ○ |

## Claude Code 連携

ターミナルで `/company` を実行すると、秘書が Supabase のデータと連動:

```
/company          → HD秘書（全社ダッシュボード表示・タスク管理）
/company ai       → AI会社秘書（PJ固有のコンテキストで作業）
```

## トラブルシューティング

| 症状 | 原因・対処 |
|------|-----------|
| **404 NOT_FOUND** | リポジトリルートに `vercel.json` があるか確認。Vercel で Redeploy を試す |
| **ログインボタンが反応しない** | Supabase の Site URL / Redirect URLs が Vercel URL と一致しているか確認 |
| **ログイン後にデータが空** | SQL Editor で `select count(*) from companies` を実行。0 なら正常（まだデータ未投入） |
| **RLS エラー** | `select * from pg_policies` で RLS ポリシーが8件あるか確認。なければ `supabase-setup.sql` を再実行 |
| **接続情報を変更したい** | `index.html` を編集して push、または Settings 画面で入力して Save |

## ファイル構成

```
company-dashboard/
├── index.html            SPA (HTML + CSS + JS in one file)
├── supabase-setup.sql    DB schema + indexes + RLS + views + functions
└── README.md             This file

vercel.json               Root config (outputDirectory → company-dashboard/)
```
