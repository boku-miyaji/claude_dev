# intelligence_suggestions 設計書

**作成日**: 2026-04-19
**目的**: 情報収集部が出す「focus-you への示唆」を蓄積・管理する仕組み

## 背景

情報収集部のレポート（`.company/departments/intelligence/reports/*.md`）の `## 💡 focus-you への示唆` セクションが毎回生成されるが、「流れていってしまう」問題があった。過去示唆をダッシュボードで一覧管理し、社長がチェック→採用/却下→実装済みマークまで追えるようにする。

## ステータスフロー

```
      ┌────────┐
      │  new   │  情報収集部が生成直後
      └───┬────┘
          │ チェック（気になる）
          ├────────────────► tasks にINSERT（type=request, title=[insight] ...）
          │
      ┌───▼────┐
      │checked │  CLIの /company で見える状態
      └───┬────┘
          │ 社長が判断
          │
     ┌────┼────────────────┐
     │    │                │
 ┌───▼───┐│          ┌─────▼─────┐
 │adopted│           │ rejected  │
 └───┬───┘           └───────────┘
     │ 実装完了
 ┌───▼──────────┐
 │ implemented  │
 └──────────────┘

 [別ルート] new → dismissed（不要、見たくもない／チェック経由なし）
```

- **new**: 生成直後
- **checked**: 社長が「気になる」マーク。`tasks` に INSERT 済
- **adopted**: 採用（正式に実装予定）
- **rejected**: 検討したうえで却下
- **dismissed**: 不要、そもそも検討対象外（チェックせず直接削除）
- **implemented**: 実装完了

## スキーマ

```sql
CREATE TABLE intelligence_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 本体
  title TEXT NOT NULL,
  description TEXT,

  -- 属性
  priority TEXT CHECK (priority IN ('high','medium','low')),
  effort TEXT CHECK (effort IN ('small','medium','large')),
  category TEXT,  -- algorithm / architecture / ux / cost / competition / design / other

  -- ソース（どのレポートから来たか）
  source_report_path TEXT,
  source_report_date DATE,
  source_urls JSONB DEFAULT '[]'::jsonb,  -- 関連URL配列

  -- ステータス
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','checked','adopted','rejected','implemented','dismissed')),

  -- tasks リンク（checked にしたとき INSERT される tasks.id）
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  -- タイムスタンプ
  checked_at TIMESTAMPTZ,
  adopted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  implemented_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intelligence_suggestions_status ON intelligence_suggestions(status);
CREATE INDEX idx_intelligence_suggestions_source_date ON intelligence_suggestions(source_report_date DESC);
CREATE INDEX idx_intelligence_suggestions_priority ON intelligence_suggestions(priority);

-- updated_at トリガー（既存パターンに合わせる）
CREATE TRIGGER trg_intelligence_suggestions_updated
  BEFORE UPDATE ON intelligence_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS（既存 tasks/ceo_insights と同パターン）
ALTER TABLE intelligence_suggestions ENABLE ROW LEVEL SECURITY;
```

RLS ポリシーは既存の `ceo_insights` / `tasks` と揃える（anon SELECT 可、INSERT/UPDATE は ingest-key 経由）。

## 情報収集部レポート構造（拡張）

レポート末尾の `## 💡 focus-you への示唆` セクションに加え、YAML ブロックで構造化示唆を埋め込む：

```yaml
# suggestions
suggestions:
  - title: "Opus 4.7 × Claude Design による design → code → narrative pipeline"
    description: "dashboard UI ブラッシュアップ + design intent 引継ぎ改善"
    priority: medium
    effort: medium
    category: design
    source_urls:
      - https://www.anthropic.com/news/claude-design-anthropic-labs
  - title: "Memory Management Framework の昇格（MIA パターン）"
    description: "knowledge 昇格の論理性向上。prompt_log → knowledge_base にreflectionステップ追加"
    priority: high
    effort: medium
    category: algorithm
    source_urls:
      - https://arxiv.org/abs/2604.04503
```

情報収集部 CLAUDE.md を更新し、`## 💡 focus-you への示唆` Markdown セクションとは別に、この YAML ブロックも必ず末尾に追加する。レポート生成後、スクリプトが YAML をパースして `intelligence_suggestions` テーブルに INSERT する。

## チェック時のタスク生成

社長がダッシュボードで「チェック」ボタンを押したとき、以下を実行:

1. `intelligence_suggestions.status = 'checked'`, `checked_at = now()` に更新
2. `tasks` テーブルに INSERT:
   - `title`: `[insight] ${suggestion.title}`
   - `description`: `${suggestion.description}\n\nSource: ${source_report_path}\nURLs: ${source_urls joined}`
   - `type`: `request`
   - `status`: `open`
   - `priority`: suggestion.priority に対応（high→urgent, medium→normal, low→low）
   - `tags`: `['from-intelligence', 'insight', suggestion.category]`
   - `company_id`: null（HD配下）
3. 返ってきた `tasks.id` を `intelligence_suggestions.task_id` に保存

## ダッシュボード UI（/insights タブ追加）

既存 `/insights` ページにタブ「Suggestions」を追加:

- **デフォルトビュー**: status=new/checked のみ表示、dismissed/rejected/implemented は非表示
- **フィルタ**: status, priority, category, source_report_date 範囲
- **各行の操作ボタン**:
  - `new` 状態: 「チェック」「削除」
  - `checked` 状態: 「採用」「却下」、元のタスクへのリンク
  - `adopted` 状態: 「実装済みにマーク」
- **並び順**: priority DESC → source_report_date DESC

## 過去レポートからの移行

`scripts/intelligence/migrate-past-suggestions.py` を作成:

1. `.company/departments/intelligence/reports/*.md` を走査
2. 各ファイルの `## 💡 focus-you への示唆` セクションを抽出
3. LLM（claude CLI）でパース → 構造化
4. 既存の `intelligence_suggestions` に同一 title + source_report_path がなければ INSERT
5. status は `new`（社長が未チェック扱い）
