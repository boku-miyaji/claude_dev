# プロダクト vs パーソナル 機能分離マップ

> 作成日: 2026-04-11
> 更新日: 2026-04-11
> 目的: focus-you をプロダクトとして切り出すための境界線を明確にする

## 原則

| | プロダクト（focus-you） | パーソナル（HD/CEO） |
|---|---|---|
| **対象ユーザー** | 一般ユーザー | 社長のみ |
| **中心データ** | diary + AI chat + tasks | Claude Code CLI ログ |
| **テーマ** | 自己理解・幸せ・物語・日常管理 | Claude Code 運用・仕事自動化 |
| **実装方式** | Edge Function (API) + フロントエンド | Claude Code hooks + バッチ |
| **依存** | Supabase のみ | Claude Code CLI 必須 |

**判定基準: Claude Code CLI に依存するか？**
- YES → パーソナル（CLI がないと動かない）
- NO → プロダクト

---

## 機能分類

### プロダクト機能（API実装、一般ユーザー向け）

| 機能 | テーブル | 実装 | 状態 |
|------|---------|------|------|
| **日記** | | | |
| 日記の記入・閲覧 | `diary_entries` | フロントエンド | 実装済み |
| 感情分析（Plutchik + PERMA+V） | `emotion_analysis` | Edge Function | 実装済み |
| 日記リズム分析 | `diary_entries` | `diary-rhythm` EF | 実装済み |
| **物語** | | | |
| ストーリー（物語の弧） | `story_memory`, `story_moments` | `narrator-update` EF | 実装済み |
| 週次ナラティブ | `weekly_narratives` | hooks | 実装済み |
| **自己分析** | | | |
| 自己分析（MBTI/Big5等） | `self_analysis`, `diary_entries` | hooks + EF | 実装済み |
| 日記ベースのインサイト | `ceo_insights`(※diary由来分) | Edge Function | 実装済み |
| **目標・習慣** | | | |
| 夢・願望リスト | `wishlist`, `dreams` | フロントエンド | 実装済み |
| 目標管理 | `goals` | フロントエンド | 実装済み |
| 習慣トラッカー | `habits`, `habit_logs` | フロントエンド | 実装済み |
| 成長記録 | `growth_events` | フロントエンド | 実装済み |
| **タスク** | | | |
| タスク管理 | `tasks`, `comments` | フロントエンド | 実装済み |
| **AIチャット** | | | |
| AIチャット（Agent） | `conversations`, `messages` | `ai-agent` EF | 実装済み |
| チャット履歴 | `prompt_log`(※chat由来分) | フロントエンド | 実装済み |
| **その他** | | | |
| カレンダー連携 | `calendar_events` | `google-calendar-proxy` EF | 実装済み |
| ニュース収集 | `news_items` | `news-collect` / `news-learn` EF | 実装済み |

**プロダクト用テーブル:**
```
diary_entries, emotion_analysis, story_memory, story_moments,
weekly_narratives, dreams, wishlist, goals, habits, habit_logs,
calendar_events, growth_events, news_items, news_preferences,
intelligence_sources, self_analysis, shared_stories, tab_clicks,
tasks, comments, conversations, messages,
ceo_insights (diary由来のカテゴリのみ)
```

### パーソナル機能（Claude Code CLI 依存）

| 機能 | テーブル | 実装 | なぜパーソナルか |
|------|---------|------|----------------|
| 稼働リズム（グラフ+示唆） | `prompt_log`, `ceo_insights` | legacy.ts + hook | CLI の利用タイミングから算出 |
| プロンプト履歴（CLI分） | `prompt_log`, `prompt_sessions` | legacy.ts | CLI のプロンプトログ |
| APIコスト分析 | `api_cost_log`, `execution_metrics` | legacy.ts | CLI の実行メトリクス |
| PJ会社管理 | `companies`, `categories` | legacy.ts | HD組織構造 |
| 請求・経費・財務 | `invoices`, `expenses`, `tax_payments` | legacy.ts | フリーランス経理 |
| ナレッジ管理 | `knowledge_base` | legacy.ts | CLI のルール蓄積 |
| 部署評価 | `evaluations`, `departments` | legacy.ts | HD人事部 |
| 成果物管理 | `artifacts`, `artifact_comments` | legacy.ts | 部署の成果物 |
| 設定同期 | `claude_settings` | hooks | CLI 設定の永続化 |
| スラッシュコマンド | `slash_commands` | legacy.ts | CLI コマンド管理 |
| パイプライン管理 | `pipeline_runs`, `pipeline_state` | hooks | 部署パイプライン |

**パーソナル用テーブル:**
```
prompt_sessions, api_cost_log, execution_metrics,
companies, categories, invoices, expenses, time_entries,
tax_payments, recurring_expenses, projects, knowledge_base,
evaluations, departments, artifacts, artifact_comments,
claude_settings, slash_commands, career_history,
portfolio_projects, services, tech_stack, secretary_notes,
pipeline_runs, pipeline_state, correction_log, agent_sessions
```

### prompt_log の扱い（混在テーブル）

`prompt_log` は2つのソースからデータが入る:

| ソース | 識別方法 | 所属 |
|--------|---------|------|
| Claude Code CLI | hook (UserPromptSubmit) で自動記録 | パーソナル |
| AIチャット（ダッシュボード） | ai-agent EF 経由で記録 | **プロダクト** |

プロダクト版では `context` や `tags` でフィルタし、チャット由来のみ表示する。

### ceo_insights の扱い（混在テーブル）

| カテゴリ | ソース | 所属 |
|---------|--------|------|
| `work_rhythm` | prompt_log (CLI) | パーソナル |
| `pattern`, `preference`, `strength`, `tendency` | prompt_log (CLI) | パーソナル |
| `mood_cycle`, `trigger`, `correlation`, `value`, `drift` | diary_entries | **プロダクト** |
| `disconnect`, `fading` | diary_entries | **プロダクト** |
| `focus`, `recurring`, `shift`, `blind_spot` | prompt_log (chat含む) | **プロダクト** |

プロダクト版では diary 由来カテゴリのみ表示する。

---

## Edge Function 分類

### プロダクト（デプロイ必須）
```
ai-agent              AIチャット（日記Q&A、タスク操作）
diary-rhythm          日記リズム分析
narrator-update       物語の弧 + テーマ検出
google-calendar-proxy カレンダー連携
news-collect          ニュース収集
news-learn            ニュースフィードバック
```

### パーソナル（社長環境のみ、hooks で実行）
```
work-rhythm-update.sh   稼働リズム示唆更新（/company hook）
daily-analysis-batch.sh  CEO分析バッチ（SessionStart hook）
prompt-log.sh           プロンプト記録（UserPromptSubmit hook）
config-sync.sh          設定同期（SessionStart hook）
```

---

## プロダクト切り出し時のアーキテクチャ

```
[プロダクト（focus-you）]

ユーザー → Next.js フロントエンド
              ↓
         Supabase Edge Functions（API）
              ↓
         Supabase DB（プロダクト用テーブル）

  データフロー:
    日記を書く → emotion_analysis → story_memory → weekly_narrative
                                  → diary-rhythm（リズム分析）
                                  → self_analysis（自己分析）
                                  → ceo_insights（diary由来インサイト）
    AIチャット → prompt_log（chat由来）→ インサイト生成
    タスク → tasks → カレンダー連携

[パーソナル（HD/CEO）= プロダクト + 追加レイヤー]

社長 → Claude Code CLI
         ↓
       hooks（prompt-log, work-rhythm-update, daily-analysis-batch）
         ↓
       Supabase DB（パーソナル用テーブル追加）
         ↓
       legacy.ts（パーソナル専用ページ表示）
```

---

## フロントエンドの表示制御方針

```typescript
// パーソナルモード判定: claude_settings にデータがあるか
const isPersonalMode = (await supabase.from('claude_settings')
  .select('id').limit(1)).data?.length > 0;
```

| ページ | プロダクト版 | パーソナル版で追加されるもの |
|--------|------------|--------------------------|
| Today | カレンダー + 日記 + 感情 + タスク | + ブリーフィング(稼働分析込み) |
| Journal | 日記一覧 | 同じ |
| Story | 物語の弧 | 同じ |
| Dreams | 夢・願望 | 同じ |
| Habits | 習慣 | 同じ |
| Goals | 目標 | 同じ |
| Tasks | タスク管理 | 同じ |
| Self Analysis | 性格分析 | 同じ |
| Insights | 日記リズム + diary由来インサイト | + 稼働リズム + CLI由来インサイト |
| Chat | AIチャット | 同じ |
| Companies | **非表示** | PJ会社管理 |
| Finance | **非表示** | 請求・経費 |
| Knowledge | **非表示** | ナレッジ |
| Prompts | **非表示** | CLI プロンプト履歴 |
| Blueprint | growth_eventsのみ | + knowledge_base, pipeline_runs |

---

## 次のアクション

1. **ceo_insights のカテゴリ分離**: diary由来とCLI由来を明確にフィルタ
2. **Insightsページの表示制御**: isPersonalMode で稼働リズムセクションを出し分け
3. **ai-agent EF の汎用化**: タスク操作・ナレッジ参照をプロダクト版でも使えるように
4. **prompt_log のソース識別**: `source` カラム追加（`cli` / `chat`）で混在を解消
