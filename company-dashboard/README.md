# focus-you Dashboard

PJ会社（プロジェクト単位の仮想組織）を一元管理する Web ダッシュボード。
Supabase (PostgreSQL + Auth) + Vercel (静的ホスティング) で構成。

**本番URL**: https://claude-dev-virid.vercel.app/

## ドキュメント

| ドキュメント | 内容 |
|------------|------|
| [アーキテクチャ](docs/architecture.md) | 全体構成・外部サーバー関係・データフロー |
| [Hook の仕組み](docs/hooks.md) | 自動同期（設定・プロンプト・スキル・権限） |
| [ファイル構成](docs/files.md) | 各ファイルの役割・settings.json・PJ会社ディレクトリ・マイグレーション |
| [DB テーブル](docs/database.md) | 全テーブル一覧（組織・AI・財務） |

---

## 何が自動で行われるか

| あなたの行動 | 自動処理 | 表示先 |
|------------|---------|-------|
| Claude Code を起動 | 設定・MCP・CLAUDE.md・全スキルを同期 | Settings / Commands |
| 何か入力する | プロンプトを記録・タグ付け | Prompts |
| プラグイン追加/削除 | 次のセッション起動で反映 | Settings |

## スラッシュコマンド

| コマンド | 機能 |
|---------|------|
| `/company` | HD秘書・タスク管理・組織運営・ナレッジ |
| `/invoice` | 売上・経費・稼働時間・税金管理 |
| `/no-edit` | ファイル編集せず調査・回答のみ |
| `/permission` | 現在の権限レベルを表示 |

## 画面一覧

| 画面 | 内容 |
|------|------|
| Dashboard | KPI・PJ会社一覧・直近アクティビティ |
| Inbox | タスク・コメント追加 |
| Tasks | 全社横断タスクボード |
| Companies | PJ会社の管理 |
| Org Chart | 組織ツリー図 |
| Portfolio | サービス・実績・技術 |
| Finance | 売上・経費・稼働・税金（6タブ） |
| Career | キャリア目標 |
| Knowledge | AIが学んだルール |
| Prompts | 全入力履歴 |
| Insights | 行動分析 |
| Commands | スキル一覧（カテゴリ別） |
| Settings | 設定・Plugins・MCP・権限・CLAUDE.md |
| [How it Works](how-it-works) | 仮想カンパニーシステムの運営ガイド（アーキテクチャ・データ管理・改善サイクル） |

---

## クイックスタート

### 1. Supabase プロジェクト作成

[supabase.com](https://supabase.com) → New Project → Region: Tokyo
→ **Project URL** と **Publishable Key** をメモ

### 2. DB セットアップ

SQL Editor で `supabase-setup.sql` を実行（全テーブル一括）

### 3. 接続情報を設定

```js
// company-dashboard/index.html
var SUPABASE_URL = 'https://xxxxx.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_xxxxx';
```

```bash
# .claude/hooks/supabase.env
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_xxxxx"
```

### 4. GitHub OAuth

[github.com/settings/developers](https://github.com/settings/developers) → OAuth App 作成
→ Callback: `https://xxxxx.supabase.co/auth/v1/callback`
→ Supabase Authentication → Providers → GitHub 有効化

### 5. Vercel デプロイ

[vercel.com](https://vercel.com) → Import → Framework: Other → Deploy
→ Supabase URL Configuration に Vercel URL を設定

### 6. 動作確認

Vercel URL → Sign in with GitHub → ダッシュボード表示

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| 404 | `vercel.json` がルートにあるか確認 |
| ログインできない | Supabase Site URL が Vercel URL と一致しているか |
| Settings が空 | セッション再起動で Hook が自動同期 |
| Commands が空 | migration-007 を適用 → セッション再起動 |
| Finance が空 | migration-008 を適用 → `/invoice` でデータ登録 |
