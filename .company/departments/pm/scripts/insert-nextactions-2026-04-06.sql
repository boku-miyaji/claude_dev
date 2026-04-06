-- ハンドオフ: リサーチ部ネクストアクション10項目をタスク化
-- 実行日: 2026-04-06
-- Supabase Project: akycymnahqypmtsfqhtr

-- P0施策（4項目）: 期限 2026-04-13（1週間）
-- P1施策（3項目）: 期限なし（依存関係に基づいて調整）
-- P2施策（3項目）: 期限なし（将来実装）

INSERT INTO tasks (company_id, title, description, priority, status, assigned_to, due_date, tags, created_at, created_by)
VALUES
  (
    'hd',
    '[ops] settings.json の allow リストを共通/PJ固有に分離',
    'Claude Code公式アーキテクチャとHD設計の差分分析より。
現状: 200行超の巨大なallow リストに PJ固有のパターンが混在している。
提案:
- settings.json（git管理）: 全PJ共通の許可パターンのみ
- settings.local.json（gitignore）: サーバー/PJ固有の許可パターン
- permission-guard.sh の safe モードを活用し、破壊的操作以外はHookで自動許可

ネクストアクション3.1参照。
ソース: https://code.claude.com/docs/en/how-claude-code-works

依存: なし
コンテキスト: 公式ドキュメントは settings.json を「チーム共有の設定」と位置づけている。',
    'high',
    'open',
    'sys-dev',
    '2026-04-13',
    'ops, architecture, settings, permission-model, sys-dev',
    NOW(),
    'pm'
  ),
  (
    'hd',
    '[ops] 各 Sub-agent の model/maxTurns/effort を最適化',
    'Claude Code公式アーキテクチャとHD設計の差分分析より。
現状: 全Agent が model:sonnet, maxTurns:15 で画一的。
提案（表3.2参照）:
- リサーチ部: opus, maxTurns:20, effort:high
- AI開発部: opus, maxTurns:20, effort:high
- システム開発部: sonnet, maxTurns:15, effort:medium
- PM部: haiku, maxTurns:10, effort:low, background:true
- 情報収集部: haiku, maxTurns:10, effort:low, background:true
- UXデザイン部: sonnet, maxTurns:15, effort:medium
- 資料制作部: sonnet, maxTurns:15, effort:medium
- QA部: sonnet, maxTurns:10, effort:medium

追加で disallowedTools を活用（リサーチ部/情報収集部: read-only）

根拠: 公式は「Control costs by routing tasks to faster, cheaper models like Haiku」と明示。
ソース: https://code.claude.com/docs/en/sub-agents

依存: なし
コンテキスト: 秘書 + 社長判断で最適値を決定する。',
    'high',
    'open',
    'secretary',
    '2026-04-13',
    'ops, architecture, sub-agents, cost-optimization, secretary',
    NOW(),
    'pm'
  ),
  (
    'hd',
    '[ops] Pre/PostCompact Hook の強化 + Compact Instructions 追加',
    'Claude Code公式アーキテクチャとHD設計の差分分析より。
現状: pre-compact-save.sh が保存する内容が最小限（日付とリマインダーのみ）。
CLAUDE.md が Compaction を生き残ることを前提にした設計になっていない。

提案:
1. CLAUDE.md に「Compact Instructions」セクションを追加: 「パイプライン進行中のステップ」「処理中のタスクID」等、Compaction で保持すべき情報の指示を記載
2. pre-compact-save.sh の強化: 現在のパイプラインステップ、処理中タスクID、直近の決定事項サマリを保存
3. 即時永続化の徹底: 意思決定・学びをファイルに書く運用は正しいが、「書くタイミング」をHookで強制できる（PostToolUse で判定）

根拠: 「Instructions from early in the conversation may be lost. Put persistent rules in CLAUDE.md rather than relying on conversation history.」
ソース: https://code.claude.com/docs/en/memory

重要な発見: 公式ドキュメントによると「CLAUDE.md fully survives compaction」。つまり CLAUDE.md に書いてある内容は退避不要。HD の Pre/PostCompact Hook は「セッション固有の動的状態」の退避にのみ必要。

依存: なし
コンテキスト: Compaction後のコンテキスト喪失が最も困るシーンの詳細確認で優先度が変わる可能性',
    'high',
    'open',
    'sys-dev',
    '2026-04-13',
    'ops, architecture, compaction, context-management, sys-dev',
    NOW(),
    'pm'
  ),
  (
    'hd',
    '[ops] Auto Memory の状態確認と独自ナレッジシステムとの役割分担決定',
    'Claude Code公式アーキテクチャとHD設計の差分分析より。
現状の問題:
- 公式 Auto Memory (MEMORY.md) が存在し、HD独自の ~/.claude/knowledge/ (YAML) + Supabase knowledge_base と並行稼働
- 学習が分散し、重複や矛盾のリスクがある

提案:
- Auto Memory を有効化（現在の状態を確認し、明示的に on にする）
- 独自 knowledge/ ディレクトリは「昇格候補の管理台帳」に特化（Auto Memory が自動蓄積、knowledge/ は社長承認済みの確定ルールのみ）
- Supabase knowledge_base は分析・可視化用の二次ストアとして位置づけ（SSOT は MEMORY.md + rules/）

根拠: 「Auto memory lets Claude accumulate knowledge across sessions without you writing anything.」公式が自動学習機構を提供しているため、独自実装との役割分担が必要。
ソース: https://code.claude.com/docs/en/memory

依存: 社長壁打ち
コンテキスト: Auto Memory の現在の有効/無効状態を確認が必要',
    'normal',
    'open',
    'secretary',
    null,
    'ops, architecture, memory, knowledge-base, secretary',
    NOW(),
    'pm'
  ),
  (
    'hd',
    '[ops] SubagentStart/Stop Hook の設計・実装',
    'Claude Code公式アーキテクチャとHD設計の差分分析より。
現状: SubagentStart/Stop イベントが未使用。
提案:
- SubagentStart: 部署Agent起動時の自動ログ + コンテキスト注入
- SubagentStop: 部署Agent完了時の成果物自動検証 + ハンドオフ検出

期待効果:
- 委譲の可観測性向上
- 現在手動で行っている完了検証を自動化

根拠: 公式が SubagentStart/Stop を提供しているのは、まさに HD のようなマルチAgent構成を想定しているため。
ソース: https://code.claude.com/docs/en/hooks

依存: タスク#2（Sub-agent最適化）完了後
コンテキスト: Hook設計と実装詳細はタスク#2の model/maxTurns/effort 最適化決定後に進める',
    'normal',
    'open',
    'sys-dev',
    null,
    'ops, architecture, hooks, sub-agents, automation, sys-dev',
    NOW(),
    'pm'
  ),
  (
    'hd',
    '[ops] @import の導入（委譲テンプレート等）',
    'Claude Code公式アーキテクチャとHD設計の差分分析より。
現状: `.company/references/` のドキュメント（委譲テンプレート、ブリーフィング手順等）は、必要時に手動 Read している。

提案:
- `.company/CLAUDE.md` に `@references/agent-delegation-template.md` を追加
- 部署 Agent の system prompt に `@.company/departments/{dept}/CLAUDE.md` 相当の情報を frontmatter で直接記述（現在は「起動時に Read せよ」という指示のみ）

注意: @import は CLAUDE.md のコンテキストを増やすため、必要最小限に。

根拠: 「Imported files are expanded and loaded into context at launch alongside the CLAUDE.md that references them.」
ソース: https://code.claude.com/docs/en/memory

依存: なし
コンテキスト: どのドキュメントを @import すべきか優先順位付けが必要',
    'normal',
    'open',
    'secretary',
    null,
    'ops, architecture, memory, documentation, secretary',
    NOW(),
    'pm'
  ),
  (
    'hd',
    '[ops] HTTP Hook への Supabase 書き込み移行検討',
    'Claude Code公式アーキテクチャとHD設計の差分分析より。
現状: prompt-log.sh, config-sync.sh, session-summary.sh 等で各スクリプトが独自に curl で Supabase に書き込んでいる。認証情報のロード（supabase-check.sh）も各スクリプトで重複。

提案:
- Supabase 書き込みを HTTP hook に移行（type: "http" + url + headers）
- allowedEnvVars で認証情報を渡す
- Shell スクリプトの curl 呼び出しを排除

トレードオフ: HTTP hook は JSON ペイロードの柔軟性が shell スクリプトより低い。タグ付けロジック等の複雑な前処理は shell に残す必要がある。

根拠: 公式が HTTP hook を提供しているのは、外部サービス連携の簡潔化のため。
ソース: https://code.claude.com/docs/en/hooks

依存: なし
コンテキスト: 実装コストと簡潔性のトレードオフを秘書が判断',
    'normal',
    'open',
    'sys-dev',
    null,
    'ops, architecture, hooks, supabase, sys-dev',
    NOW(),
    'pm'
  ),
  (
    'hd',
    '[ops] path-specific rules の導入',
    'Claude Code公式アーキテクチャとHD設計の差分分析より。
提案: `.claude/rules/` のファイルに `paths` frontmatter を追加し、関連ファイル操作時のみロードされるようにする。

例:
```yaml
# .claude/rules/commit-rules.md
---
paths:
  - "**/.git/**"
  - "**/package.json"
---
```

効果: コンテキストウィンドウの節約。現在6ファイルが常時ロードされているが、commit-rules は git 操作時のみ必要。

優先度: P2（将来的な最適化）

コンテキスト: 実装時期はコンテキストウィンドウ圧迫状況に応じて判断',
    'low',
    'open',
    'secretary',
    null,
    'ops, architecture, rules, context-optimization, secretary',
    NOW(),
    'pm'
  ),
  (
    'hd',
    '[ops] Explore 相当の軽量 Agent 追加',
    'Claude Code公式アーキテクチャとHD設計の差分分析より。
提案: コードベース探索専用の Agent を追加

定義例:
```yaml
---
name: Explorer
description: コードベース探索専用。ファイル検索、パターン検索、構造理解に使用。
tools: [Read, Glob, Grep]
model: haiku
maxTurns: 10
effort: low
---
```

効果: 現在リサーチ部や秘書が行っている「まず構造を把握する」フェーズを軽量に実行可能。

優先度: P2（将来的な最適化）

依存: タスク#2（Sub-agent最適化）完了後
コンテキスト: Agent定義テンプレートとしてどんな情報が必要かを秘書が設計',
    'low',
    'open',
    'secretary',
    null,
    'ops, architecture, agents, exploration, secretary',
    NOW(),
    'pm'
  ),
  (
    'hd',
    '[research] Agent Teams 機能の調査',
    'Claude Code公式アーキテクチャとHD設計の差分分析より。
提案: 公式が2026年に追加した「Agent Teams」機能（複数Agent が独立セッションで並行稼働し相互通信する）の詳細調査。

目的: HD のパイプライン並列実行との関係性を確認。Agent Teams を使えば、秘書がパイプラインを管理する負荷が減る可能性あり。

調査内容:
- Agent Teams の公式ドキュメント詳読
- HD のパイプライン（A-E）をAgent Teams で実装した場合のアーキテクチャ検討
- 現在の委譲テンプレートとの違い
- 実装コストと効果の検証

優先度: P2（将来的な最適化）

依存: なし
コンテキスト: リサーチ部が調査後、秘書が「導入すべきか」を判断',
    'low',
    'open',
    'research',
    null,
    'research, ops, architecture, agent-teams, investigation',
    NOW(),
    'pm'
  );
