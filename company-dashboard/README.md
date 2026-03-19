# 宮路HD Dashboard

PJ会社を一元管理する Web ダッシュボード。
Supabase (PostgreSQL + Auth) + Vercel (静的ホスティング) で構成。
PC・スマホ同一URLで利用可能。

## アーキテクチャ

```
スマホ / PC (ブラウザ)
    ↕ Supabase JS Client (REST + Realtime)
Supabase (PostgreSQL + GitHub OAuth + RLS per user)
    ↕ Supabase MCP Plugin
Claude Code (/company コマンド)
```

## セキュリティ

- **GitHub OAuth** でログイン認証
- **RLS (Row Level Security)** で全テーブルに `user_id` フィルター
- 他人がログインしても自分のデータは見えない
- Publishable Key はフロントエンド公開用（Stripe 公開キーと同じ設計）

## 前提条件

- GitHub アカウント
- [Supabase](https://supabase.com) アカウント（無料）
- [Vercel](https://vercel.com) アカウント（無料）

## セットアップ手順

### Step 1: リポジトリをフォーク

1. このリポジトリを **Fork**（または `git clone`）
2. ローカルに clone:

```bash
git clone https://github.com/<your-username>/claude_dev.git
cd claude_dev
```

### Step 2: Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) に GitHub でログイン
2. **New Project** をクリック

   | 項目 | 値 |
   |------|-----|
   | **Name** | `miyaji-hd`（任意） |
   | **Database Password** | 安全なパスワード |
   | **Region** | `Northeast Asia (Tokyo)` |

3. 作成完了後、**Project Settings > API** で以下をメモ:

   | 項目 | 例 |
   |------|-----|
   | **Project URL** | `https://xxxxx.supabase.co` |
   | **Publishable Key** | `sb_publishable_xxxxx` |

### Step 3: DB スキーマを実行

1. Supabase Dashboard → 左メニュー **SQL Editor**
2. **New query** をクリック
3. [`supabase-setup.sql`](supabase-setup.sql) の内容を **まるごと** コピペ
4. **Run** をクリック
5. `Success. No rows returned` と表示されればOK

> **重要**: 必ず一度に全部実行してください。分割するとテーブル参照エラーが出ます。

### Step 4: Supabase 接続情報を設定

`company-dashboard/index.html` を編集（CONFIG セクション）:

```js
var SUPABASE_URL = 'https://xxxxx.supabase.co';    // ← Step 2 の URL
var SUPABASE_ANON_KEY = 'sb_publishable_xxxxx';     // ← Step 2 の Publishable Key
```

> **Publishable Key は公開用キーです。** フロントエンドにハードコードするのが正しい使い方です。セキュリティは RLS（user_id によるデータ分離） + GitHub OAuth が担保します。

### Step 5: GitHub OAuth App を作成

1. [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. 入力:

   | 項目 | 値 |
   |------|-----|
   | **Application name** | `宮路HD`（任意） |
   | **Homepage URL** | `https://example.vercel.app`（Step 7 で発行後に更新してもOK） |
   | **Authorization callback URL** | `https://xxxxx.supabase.co/auth/v1/callback` |

   > `xxxxx` は Step 2 の Project URL のホスト部分。

3. **Register application** → **Client ID** をメモ
4. **Generate a new client secret** → **Client Secret** をメモ

### Step 6: Supabase で GitHub 認証を有効化

1. Supabase Dashboard → **Authentication** → **Providers** → **GitHub**
2. **Enable Sign in with GitHub** をオン
3. Step 5 の **Client ID** と **Client Secret** を入力 → **Save**

### Step 7: Vercel にデプロイ

1. [vercel.com](https://vercel.com) に **GitHub でログイン**
2. **Add New Project** → フォークしたリポジトリを **Import**
3. 設定画面:

   | 項目 | 値 |
   |------|-----|
   | **Framework Preset** | `Other` |
   | **Root Directory** | 変更不要（リポジトリルート） |
   | **Build Command** | 空欄（Override OFF） |
   | **Output Directory** | 空欄（Override OFF） |

   > リポジトリルートの `vercel.json` が `"outputDirectory": "company-dashboard"` を指定済み。

4. **Deploy** → 完了後に URL が発行される（例: `https://xxx.vercel.app`）

> `main` に push するたびに Vercel が自動で再デプロイします。

### Step 8: リダイレクト URL を設定

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. 設定:

   | 項目 | 値 |
   |------|-----|
   | **Site URL** | Step 7 の Vercel URL |
   | **Redirect URLs** | 同じ Vercel URL を追加 |

3. **Save**
4. （任意）Step 5 の GitHub OAuth App の **Homepage URL** も Vercel URL に更新

### Step 9: commit & push

```bash
git add company-dashboard/index.html
git commit -m "fix: set Supabase credentials"
git push origin main
```

Vercel が自動で再デプロイします。

### Step 10: 動作確認

1. Vercel URL にアクセス
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
| **Settings** | Claude Code設定閲覧・ダッシュボード設定 | ○ |

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
| **ログイン後にデータが空** | 正常。まだデータ未投入。Inbox からタスクを追加してみてください |
| **RLS エラー** | SQL Editor で `select * from pg_policies` を実行し `own_data` ポリシーが8件あるか確認 |
| **他人にデータが見えないか心配** | 全テーブルに `user_id` + RLS `auth.uid() = user_id` で保護済み。別アカウントでログインして確認可 |

## ファイル構成

```
company-dashboard/
├── index.html                              SPA (HTML + CSS + JS)
├── supabase-setup.sql                      新規インストール用スキーマ
├── supabase-migration-001-add-user-id.sql  既存DB用マイグレーション
└── README.md                               This file

vercel.json                                 Root config (→ company-dashboard/)
```
