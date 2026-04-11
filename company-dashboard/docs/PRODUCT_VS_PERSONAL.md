# プロダクト vs パーソナル 機能分離マップ

> 作成日: 2026-04-11
> 目的: focus-you をプロダクトとして切り出すための境界線を明確にする

## 原則

| | プロダクト（focus-you） | パーソナル（HD/CEO） |
|---|---|---|
| **対象ユーザー** | 一般ユーザー | 社長のみ |
| **中心データ** | diary_entries | prompt_log |
| **テーマ** | 自己理解・幸せ・物語 | 仕事管理・生産性 |
| **実装方式** | Edge Function (API) | Claude Code hooks + バッチ |
| **依存** | Supabase のみ | Claude Code CLI 必須 |

**判定基準: `prompt_log` に依存するか？**
- YES → パーソナル（Claude Code ユーザーしか持たない）
- NO、かつ `diary_entries` 中心 → プロダクト

---

## 機能分類

### プロダクト機能（diary中心、API実装）

| 機能 | テーブル | 実装 | 状態 |
|------|---------|------|------|
| 日記の記入・閲覧 | `diary_entries` | フロントエンド | 実装済み |
| 感情分析（Plutchik + PERMA+V） | `emotion_analysis` | Edge Function | 実装済み |
| ストーリー（物語の弧） | `story_memory`, `story_moments` | `narrator-update` EF | 実装済み |
| 週次ナラティブ | `weekly_narratives` | hooks | 実装済み |
| 夢・願望リスト | `wishlist`, `dreams` | フロントエンド | 実装済み |
| 目標管理 | `goals` | フロントエンド | 実装済み |
| 習慣トラッカー | `habits`, `habit_logs` | フロントエンド | 実装済み |
| 日記リズム分析 | `diary_entries` | `diary-rhythm` EF | 実装済み |
| 自己分析（MBTI/Big5等） | `self_analysis`, `diary_entries` | hooks + EF | 実装済み |
| カレンダー連携 | `calendar_events` | `google-calendar-proxy` EF | 実装済み |
| ニュース収集 | `news_items` | `news-collect` / `news-learn` EF | 実装済み |
| 成長記録 | `growth_events` | フロントエンド | 実装済み |

**プロダクト用テーブル:**
```
diary_entries, emotion_analysis, story_memory, story_moments,
weekly_narratives, dreams, wishlist, goals, habits, habit_logs,
calendar_events, growth_events, news_items, news_preferences,
intelligence_sources, self_analysis, shared_stories, tab_clicks
```

### パーソナル機能（仕事管理、Claude Code依存）

| 機能 | テーブル | 実装 | 依存 |
|------|---------|------|------|
| 稼働リズム（グラフ） | `prompt_log` | フロントエンド(legacy.ts) | prompt_log |
| 稼働リズム（示唆） | `ceo_insights` | `work-rhythm-update.sh` hook | prompt_log |
| プロンプト履歴 | `prompt_log`, `prompt_sessions` | legacy.ts | prompt_log |
| APIコスト分析 | `api_cost_log`, `execution_metrics` | legacy.ts | prompt_log |
| AIチャット（Agent） | `conversations`, `messages` | `ai-agent` EF | Claude Code |
| タスク管理 | `tasks`, `comments` | legacy.ts | 仕事管理 |
| PJ会社管理 | `companies`, `categories` | legacy.ts | 仕事管理 |
| 請求・経費・財務 | `invoices`, `expenses`, `tax_payments` | legacy.ts | 仕事管理 |
| ナレッジ管理 | `knowledge_base` | legacy.ts | Claude Code |
| 部署評価 | `evaluations`, `departments` | legacy.ts | 仕事管理 |
| 成果物管理 | `artifacts`, `artifact_comments` | legacy.ts | 仕事管理 |
| 設定同期 | `claude_settings` | hooks | Claude Code |
| CEO分析 | `ceo_insights` | `daily-analysis-batch.sh` | prompt_log |
| スラッシュコマンド | `slash_commands` | legacy.ts | Claude Code |

**パーソナル用テーブル:**
```
prompt_log, prompt_sessions, ceo_insights, api_cost_log,
execution_metrics, conversations, messages, tasks, comments,
companies, categories, invoices, expenses, time_entries,
tax_payments, recurring_expenses, projects, knowledge_base,
evaluations, departments, artifacts, artifact_comments,
claude_settings, slash_commands, career_history,
portfolio_projects, services, tech_stack, secretary_notes,
pipeline_runs, correction_log
```

### 混在している機能（要分離）

| 機能 | プロダクト部分 | パーソナル部分 | 対応方針 |
|------|-------------|-------------|---------|
| Insights ページ | 日記リズム | 稼働リズム + ceo_insights | セクション単位で表示制御 |
| Blueprint ページ | growth_events, diary | knowledge_base, pipeline_runs | タブ単位で表示制御 |
| 朝のブリーフィング | 日記・感情・カレンダー | prompt_log, ceo_insights | prompt_log有無で分岐 |
| Intelligence ページ | news_items | secretary_notes | セクション分離 |
| Activity Log | 汎用ログ | 仕事アクション記録 | action typeで分離 |

---

## Edge Function 分類

### プロダクト（デプロイ必須）
```
diary-rhythm          日記リズム分析
narrator-update       物語の弧 + テーマ検出
google-calendar-proxy カレンダー連携
news-collect          ニュース収集
news-learn            ニュースフィードバック
```

### パーソナル（社長環境のみ）
```
ai-agent              AIチャット（タスク・ナレッジ操作）
```

---

## プロダクト切り出し時のアーキテクチャ

```
[プロダクト（focus-you）]

ユーザー → Next.js フロントエンド
              ↓
         Supabase Edge Functions（API）
              ↓
         Supabase DB（プロダクト用テーブルのみ）

  データフロー:
    日記を書く → emotion_analysis → story_memory → weekly_narrative
                                  → diary-rhythm（リズム分析）
                                  → self_analysis（自己分析）

[パーソナル（HD/CEO）]

社長 → Claude Code CLI
         ↓
       hooks（prompt-log, work-rhythm-update, daily-analysis-batch）
         ↓
       Supabase DB（パーソナル用テーブル）
         ↓
       legacy.ts（ダッシュボード表示）
```

---

## フロントエンドの表示制御方針

プロダクト版では、パーソナル機能を**非表示**にする。

```typescript
// 判定方法: prompt_log にデータがあるか
const hasPromptLog = (await supabase.from('prompt_log').select('id').limit(1)).data?.length > 0;

// または: user_settings にフラグを持つ
const isPersonalMode = userSettings?.mode === 'personal';
```

| ページ | プロダクト版 | パーソナル版 |
|--------|------------|------------|
| Today | カレンダー + 日記 + 感情 | + タスク + ブリーフィング |
| Journal | 日記一覧 | 同じ |
| Story | 物語の弧 | 同じ |
| Dreams | 夢・願望 | 同じ |
| Habits | 習慣 | 同じ |
| Goals | 目標 | 同じ |
| Self Analysis | 性格分析 | 同じ |
| Insights | 日記リズムのみ | + 稼働リズム + CEO分析 |
| Tasks | **非表示** | タスク管理 |
| Companies | **非表示** | PJ会社管理 |
| Finance | **非表示** | 請求・経費 |
| Knowledge | **非表示** | ナレッジ |
| Prompts | **非表示** | プロンプト履歴 |
| Blueprint | growth_eventsのみ | フル表示 |

---

## 次のアクション

1. **フロントエンドの表示制御**: `prompt_log` の有無でパーソナル機能を出し分け
2. **Todayページの分離**: ブリーフィングからprompt_log依存を除去したプロダクト版を作成
3. **Insightsページの分離**: 日記リズムをメインに、稼働リズムはパーソナルのみ
4. **Edge Functionの追加**: 現在フロントエンドで計算しているプロダクト機能をAPI化
   - 感情分析のバッチ処理
   - 週次ナラティブの自動生成
   - 自己分析の定期更新
