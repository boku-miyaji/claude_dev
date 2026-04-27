# AGENTS.md — claude_dev (focus-you / aces-rikyu / polaris-circuit / others)

> このファイルは外部 AI agent（Claude Code、Codex CLI、Cursor、その他）が **claude_dev リポジトリで作業する際の共通規約** を定義する。
>
> 二重管理を避けるため、`.claude/CLAUDE.md` はこのファイルへの symlink。Claude Code は `.claude/CLAUDE.md`（= 本ファイル）を読み、ベンダー中立の AI ツールは `AGENTS.md` を読む。実体は1つ。

---

## 0. このリポジトリは何か

- **claude_dev = PJ横断の開発基盤リポジトリ**
- 配下の各 PJ（focus-you / aces-rikyu / polaris-circuit / 他）は独立した実装を持つ
- `.claude/`、`scripts/`、`docs/` 等の横断的なものはここにコミットしてよい
- **個別 PJ 固有のコードは、そのサブディレクトリ内に独立した `.git` がある場合はそちらにコミットする**（詳細: `.claude/rules/commit-rules.md`）

---

## 1. LLM Agent 基本原則（[ultrathink] = 必ず守る）

- **[ultrathink] 実装する前に必ず設計する**。コード書き出す前に何を変えるか整理
- **[ultrathink] 新しい import を追加する前に、既存コードでそのモジュールがどうインポートされているか必ず確認する**
- **[ultrathink] 実装する際はテストコードを作成し、デグレがないことを確認できるようにする**
- 実装後は必ず docs を最新化する
- 実装したら必ず commit する
- **IMPORTANT (focus-you / company-dashboard PJ 限定)**: TodoWrite でタスク作成時、最後のステップに「Blueprint 更新確認」を必ず含める。`company-dashboard/` 配下のコード変更に限り、`company-dashboard/src/pages/Blueprint.tsx` の該当セクションを確認・更新してからタスクを done にする。**他 PJ には Blueprint.tsx を適用しない**（focus-you 固有のダッシュボード）

---

## 2. ルール参照

詳細なルールは `.claude/rules/` に分割されており、Claude Code は文脈に応じて自動読み込みする。Codex/Cursor 等は必要に応じて以下を読みに行くこと。

| ルールファイル | 内容 |
|---------------|------|
| `commit-rules.md` | コミット規約、リポジトリ判定、PR チェックリスト、settings.json 変更時の同コミット必須ルール |
| `coding-style.md` | コーディング規約、新機能ワークフロー、Conventional Commits |
| `knowledge-accumulation.md` | ナレッジ蓄積・昇格ルール、Auto Memory と独自ナレッジの役割分担 |
| `skill-management.md` | スキル追加・同期・整合性チェックのルール |
| `scratch-workspace.md` | モックアップ・壁打ち資料は必ず `scratch/` に置く（git管理外） |
| `prefer-native-tools.md` | Bash 合成コマンドの前に Read/Glob/Grep で代替できないか確認する |
| `supabase-access.md` | Supabase アクセスは必ず `.claude/hooks/api/sb.sh` 経由 |
| `growth-events.md` | 意思決定・失敗・対策・到達は `growth_events` テーブルに記録 |
| `pipeline.md` | パイプライン計画・部署選定・実行順序のルール |
| `handoff.md` | 部署間ハンドオフのフォーマット（YAML） |
| `hook-events.md` | Hook イベント発火タイミング仕様 |
| `hd-operations.md` | HD（仮想カンパニー）運営詳細、責務分離 |

---

## 3. 意思決定の記録: ADR ではなく `growth_events`

このリポジトリでは **ADR（Architecture Decision Record）の代わりに Supabase の `growth_events` テーブル**を使う。

- `event_type='decision'`: 障害を伴わない前向きな意思決定
- `event_type='countermeasure'`: 失敗を受けた対策決定（`parent_id` で failure に紐付け）
- `event_type='failure'`: バグ・障害・ミスが起きた事実
- `event_type='milestone'`: 達成・到達・リリース

**supersedes チェーン**: 古い decision を新 decision で置き換える時は、新レコードを `parent_id` で旧→新を指すように紐付け、旧の `status='superseded'` に更新する。

詳細: `.claude/rules/growth-events.md`

---

## 4. テスト・ビルド・コード健全性

### pre-push gate（自動実行）

`scripts/git-hooks/pre-push.sh` が pre-push hook として動作する。インストール: `bash scripts/setup-git-hooks.sh`

- `company-dashboard/` 配下に変更があれば、`cd company-dashboard && npx tsc --noEmit && npx vitest run --passWithNoTests` を実行
- 失敗したら push をブロック
- **`--no-verify` を使ってこれをバイパスしない**。失敗の根本原因を直してから push する

### Boy Scout Rule

触ったファイルは必ず以前より良い状態で去る。型エラーや未使用 import を残さない。

### TDD（推奨）

新機能・バグ修正は Red → Green → Refactor → Commit のサイクルで進める。例外: 純粋な CSS / ドキュメント変更。

---

## 5. Supabase アクセス

**CLI / Hook / バッチから Supabase を叩くときは、必ず `/workspace/.claude/hooks/api/sb.sh` を使う。** `source supabase.env && curl ...` を直接書かない。

- 承認ダイアログが出ない（`Bash(.claude/hooks/api/sb.sh:*)` で allow 済み）
- URL・ヘッダ・ingest-key の付け忘れを防ぐ
- 詳細とパターン集: `.claude/rules/supabase-access.md`

---

## 6. データの portability（focus-you の哲学）

focus-you は「ユーザーの自己理解・物語・幸せ」を扱う個人プロダクト。**データは原則ユーザーのもの**であり、退会・移行時に持ち帰れる経路を残す。

- `/export-self` スキル: journal / dreams / habits / story / interests を Markdown + YAML frontmatter で zip エクスポート
- DB は集計と連携の利便性のために Supabase を中心に置くが、Markdown export を一級ルートとして維持する
- 商用化時のメッセージ: 「やめても全部持ち帰れる」

これは tolaria（refactoringhq/tolaria）の Files-first 思想からインスパイアされた決定（記録: `growth_events` `decision` 型）

---

## 7. 依頼ステータス報告（Claude Code 限定）

Claude Code セッションでツール（Read/Edit/Write/Bash 等）を 1 つでも使った応答の最後に、必ず Write ツールで `/tmp/claude-req-status.json` を書くこと。

```json
{"status": "done",    "summary": "体験設計ページのExcel記述を削除", "pending": []}
{"status": "partial", "summary": "5件中3件完了",                   "pending": ["versioning削除", "進捗表示追加"]}
```

- `done`: 依頼を全て完了した
- `partial`: 一部完了・残りは pending に列挙
- Q&A（ツール未使用）: 書かなくてよい（Stop hook が自動で `answered` にする）

**このファイルを書かずに終わると `missed`（見落とし）として記録される。**

Codex / Cursor 等は `/tmp/claude-req-status.json` を書く必要はない（Claude Code 固有の hook 連動）。

---

## 8. Compact Instructions（Claude Code 限定）

Context Compaction 後に必ず保持すべき情報:

- 現在実行中のパイプライン（A/B/C/D/E）とそのステップ
- 処理中のタスク ID（Supabase `tasks` テーブル）
- チェックポイントの状態（承認済み / 待ち）
- 直前の社長の指示の要約

---

## 9. UI 規約（focus-you / company-dashboard 限定）

- ブランド色: 紫（focus-you アイコンの `#5046E5` → `#7C6CFF`）。アクセントは紫、`--green` トークンは「達成・健康」のステータス色として独立保持
- レポート本文の Markdown は `var(--text)`（メインカラー）。`var(--text2)` は補足・メタ情報用
- モバイル判定は `@media(max-width:768px)`。`.mobile-nav` は max-width:768px 時のみ `display: block`
- 詳細: `.claude/rules/coding-style.md`

---

## 10. Skills と Slash Commands

スキルのソースオブトゥルース: `~/.claude/plugins/marketplaces/ai-company/` あるいは `/workspace/plugins/company/skills/`（実装上の sync source）。

- 追加: `/workspace/plugins/company/skills/{name}/SKILL.md` を作成 → `bash scripts/company/sync-skills.sh` で `.claude/skills/` に同期 → 次セッションから有効
- 詳細: `.claude/rules/skill-management.md`
- 主な focus-you 関連スキル: `/zenn-from-interests`、`/export-self`、`/company`、`/register`

---

## 参考リンク

- `.claude/rules/`: 詳細ルール群
- `growth_events` テーブル: 意思決定・失敗・対策の正本
- `tolaria`（https://github.com/refactoringhq/tolaria）: Files-first / git-first / AGENTS.md パターンの先行事例
