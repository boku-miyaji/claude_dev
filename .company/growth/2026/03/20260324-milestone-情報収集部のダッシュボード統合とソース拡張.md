# 情報収集部のダッシュボード統合とソース拡張

- **type**: `milestone`
- **date**: 2026-03-24
- **category**: automation / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: intelligence, dashboard, feedback-loop, claude-dev
- **commits**: 7573ea2, 735261f, e413833, a71eea7, 4a75a0f

## what_happened
情報収集部の成果がシステムに反映されず見れないという指摘を受け、Sources 管理タブ・Markdown レンダリング・body カラム対応・ソーススコアリングを追加。ブログ/技術記事/GitHub/HN へソースを拡張し、X は制約付きで末尾に移動。

## root_cause
収集結果のカラム名不一致とダッシュボード側のレンダリング未対応で、収集しても閲覧導線がなかった

## countermeasure
migration 019/020 でソース管理+スコアリング、marked.js で Markdown 表示、Sources タブ新設

## result
情報収集部の出力がダッシュボードから直接閲覧・評価できるようになり、フィードバックループが回る状態に

<!-- id: 566f5d01-0bf2-4b6a-8871-e14fd3ed162f -->
