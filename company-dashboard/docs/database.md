# DB テーブル一覧

## 組織・タスク

| テーブル | 用途 | 書き込み元 |
|---------|------|-----------|
| `categories` | 大分類 | `/company` |
| `companies` | PJ会社 | `/company` |
| `departments` | 部署 | `/company` |
| `tasks` | タスク・TODO | `/company` / Inbox |
| `comments` | コメント | Web / `/company` |
| `evaluations` | 部署評価 | `/company` |
| `activity_log` | アクティビティ | 各種操作 |

## AI・ナレッジ

| テーブル | 用途 | 書き込み元 |
|---------|------|-----------|
| `prompt_log` | 全入力履歴 | `prompt-log.sh` (Hook) |
| `ceo_insights` | 行動分析 | `/company` |
| `knowledge_base` | ルール蓄積 | `/company` |
| `claude_settings` | 設定スナップショット | `config-sync.sh` (Hook) |
| `slash_commands` | スキル一覧 | `sync-slash-commands.sh` (Hook) |

## ポートフォリオ・キャリア

| テーブル | 用途 | 書き込み元 |
|---------|------|-----------|
| `services` | 提供サービス | `/company` |
| `portfolio_projects` | 実績 | `/company` |
| `tech_stack` | 技術スタック | `/company` |
| `career` | キャリア目標 | `/company` |

## 財務

| テーブル | 用途 | 書き込み元 |
|---------|------|-----------|
| `projects` | 案件マスター | `/invoice` |
| `invoices` | 請求書（売上） | `/invoice` |
| `expenses` | 経費 | `/invoice` |
| `time_entries` | 稼働時間 | `/invoice sync` (Calendar) |
| `tax_payments` | 税金スケジュール | `/invoice tax` |
