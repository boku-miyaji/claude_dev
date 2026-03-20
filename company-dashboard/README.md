# 宮路HD Dashboard

PJ会社（プロジェクト単位の仮想組織）を一元管理する Web ダッシュボード。
Supabase (PostgreSQL + Auth) + Vercel (静的ホスティング) で構成。
PC・スマホ同一URLで利用可能。

## アーキテクチャ

```
スマホ / PC (ブラウザ)
    ↕ Supabase JS Client (REST + Realtime)
Supabase (PostgreSQL + GitHub OAuth + RLS)
    ↕ Supabase MCP Plugin
Claude Code (/company コマンド)
    ↕ 自動 commit & push
全サーバーに反映
```

## セキュリティ

- **各ユーザーが自分の Supabase プロジェクトを持つ**（シングルテナント）
- **GitHub OAuth** でログイン認証
- **RLS** で未認証アクセスをブロック
- Publishable Key はフロントエンド公開用（Stripe 公開キーと同じ設計）

## 前提条件

- GitHub アカウント
- [Supabase](https://supabase.com) アカウント（無料）
- [Vercel](https://vercel.com) アカウント（無料）

---

## クイックスタート（ゼロ → 動作確認まで 約15分）

### Step 1: リポジトリをフォーク

```bash
# Fork してから clone
git clone https://github.com/<your-username>/claude_dev.git
cd claude_dev
```

### Step 2: Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) に GitHub でログイン
2. **New Project** をクリック

   | 項目 | 値 |
   |------|-----|
   | **Name** | 任意（例: `my-hd`） |
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

`company-dashboard/index.html` の冒頭 CONFIG セクションを編集:

```js
var SUPABASE_URL = 'https://xxxxx.supabase.co';    // ← Step 2 の URL
var SUPABASE_ANON_KEY = 'sb_publishable_xxxxx';     // ← Step 2 の Key
```

> Publishable Key は公開用です。セキュリティは RLS + GitHub OAuth が担保します。

### Step 5: GitHub OAuth App を作成

1. [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. 入力:

   | 項目 | 値 |
   |------|-----|
   | **Application name** | 任意（例: `My HD`） |
   | **Homepage URL** | `https://example.vercel.app`（Step 7 で更新可） |
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

---

## 画面構成

| 画面 | 内容 | スマホ |
|------|------|:------:|
| **Dashboard** | KPI概要・PJ会社一覧・直近アクティビティ | ○ |
| **Inbox** | タスク追加・コメント追加（メイン入力画面） | ○ |
| **Tasks** | 全社横断タスクボード（フィルター・編集・完了） | ○ |
| **Companies** | PJ会社の作成・編集・アーカイブ・カテゴリ管理 | ○ |
| **Org Chart** | HD → 会社 → 部署 → チームのツリー組織図 | ○ |
| **Knowledge** | ナレッジベース（LLMデフォルトとの差分ルール蓄積） | ○ |
| **Prompts** | 社長のプロンプト履歴（会社別・日付別） | ○ |
| **Insights** | 社長分析（行動パターン・好み・傾向） | ○ |
| **Settings** | Claude Code 設定・Plugins・Skills・MCP・Permissions・CLAUDE.md | ○ |

### Settings の詳細

| セクション | 内容 |
|-----------|------|
| **Scopes** | 設定スコープ一覧（global / プロジェクト別） |
| **Plugins** | インストール済みプラグインと有効/無効状態 |
| **Skills** | 利用可能なスキル一覧 |
| **MCP Servers** | 接続中の MCP サーバー・ツール数・コマンド |
| **Permissions** | 許可ルール一覧（タイプ別グルーピング） |
| **CLAUDE.md** | 各スコープの CLAUDE.md 内容を展開表示 |
| **Skills Matrix** | 全スコープ横断のプラグイン比較テーブル |

---

## Claude Code 連携

### 2層構造: Hook（常時自動） + `/company`（手動）

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: Hook（常時・自動）                           │
│                                                     │
│  UserPromptSubmit → prompt_log に全入力を自動記録     │
│  SessionStart     → settings/MCP/CLAUDE.md を自動同期 │
│                                                     │
│  ※ /company を打たなくても動作する                     │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ Layer 2: /company（手動）                             │
│                                                     │
│  /company          → HD秘書（タスク管理・新会社作成）   │
│  /company ai       → AI会社秘書（PJ固有で作業）       │
│  /company circuit  → 回路図PJ秘書                    │
│                                                     │
│  起動時: ナレッジ読み込み・コメント確認                  │
│  会話中: 修正指示を検出 → knowledge_base に蓄積        │
│  完了時: git commit & push                           │
└─────────────────────────────────────────────────────┘
```

### `/company` を使うタイミング

| タイミング | 目的 |
|-----------|------|
| **作業開始時** | ナレッジ読み込み、未処理コメント確認 |
| **タスク管理** | TODO作成・進捗更新・優先度変更 |
| **組織運営** | 部署作成・人事評価・壁打ち相談 |
| **分析依頼** | 「分析して」でCEOインサイト生成 |
| **ナレッジ整理** | ルール確認・CLAUDE.md昇格判断 |

### データフロー

```
通常の作業（Hook が自動処理）
  SessionStart → settings/MCP/CLAUDE.md を Supabase に同期
  各入力       → prompt_log に自動記録（タグ付き）

/company 起動時（追加処理）
  ↓ (1) knowledge_base のアクティブルールを読み込み
  ↓ (2) 未処理コメントを確認・通知
  ↓ (3) 修正指示を検出 → knowledge_base に蓄積
  ↓ (4) 作業完了 → git commit & push
  ↓
ダッシュボード（PC / スマホ）にリアルタイム反映
```

### Hook ファイル

```
.claude/hooks/
├── supabase.env       接続情報（URL + Anon Key）
├── prompt-log.sh      UserPromptSubmit → prompt_log
└── config-sync.sh     SessionStart → claude_settings
```

---

## DB テーブル一覧

| テーブル | 用途 |
|---------|------|
| `categories` | 大分類（ディレクトリ単位のグルーピング） |
| `companies` | PJ会社 |
| `departments` | 部署（チーム情報を teams jsonb で保持） |
| `tasks` | タスク・TODO・マイルストーン |
| `comments` | コメント（Web / モバイル / Claude Code から投稿） |
| `evaluations` | 部署評価（5軸: 自律完遂・一発OK・連携効率・目標寄与・稼働率） |
| `activity_log` | アクティビティログ |
| `claude_settings` | Claude Code 設定（plugins / permissions / skills / MCP / CLAUDE.md） |
| `prompt_log` | 社長プロンプト履歴（入力のみ、出力は記録しない） |
| `ceo_insights` | 社長分析（pattern / preference / strength / tendency / feedback） |
| `knowledge_base` | ナレッジ（LLMデフォルトとの差分ルール蓄積、CLAUDE.md 昇格あり） |

---

## トラブルシューティング

| 症状 | 原因・対処 |
|------|-----------|
| **404 NOT_FOUND** | リポジトリルートに `vercel.json` があるか確認。Vercel で Redeploy を試す |
| **ログインボタンが反応しない** | Supabase の Site URL / Redirect URLs が Vercel URL と一致しているか確認 |
| **ログイン後にデータが空** | 正常。Inbox からタスクを追加、または `/company` で秘書を起動してデータを同期 |
| **RLS エラー** | SQL Editor で `select * from pg_policies` を実行。`auth_full` ポリシーが 11 件あるか確認 |
| **Settings が空** | 次のセッション開始時に Hook が自動同期する。急ぐ場合は `/company` を実行 |
| **Org Chart が空** | Companies ページで会社を作成するか、`/company` で秘書に作成してもらう |

---

## ファイル構成

```
company-dashboard/
├── index.html                                  SPA (HTML + CSS + JS, 単一ファイル)
├── supabase-setup.sql                          新規インストール用スキーマ（全テーブル一括）
├── supabase-migration-002-revert-user-id.sql   user_id削除（既存DB用）
├── supabase-migration-003-prompt-log-ceo-insights.sql  プロンプト履歴 + 社長分析
├── supabase-migration-004-knowledge-base.sql   ナレッジベース + CLAUDE.md可視化
├── supabase-migration-005-portfolio-career.sql  ポートフォリオ + キャリア管理
├── supabase-migration-006-hook-anon-policies.sql  Hook用 anon RLSポリシー
└── README.md                                   This file

vercel.json                                     Root config (→ company-dashboard/)
```

> **新規セットアップ**: `supabase-setup.sql` のみ実行すればOK（全テーブル含む）。
> **既存DB更新**: migration ファイルを番号順に実行。
