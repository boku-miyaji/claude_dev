# バッチ分類プロンプトが[correction]として誤検出

- **type**: `failure`
- **date**: 2026-04-13
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch

## what_happened
バッチ処理用の分類プロンプト(Classify each prompt...)とfailure分析プロンプト自身が、failure signal収集機構により[correction]シグナルとして大量に誤記録されている

## root_cause
failure signal検出ロジックがシステム内部のバッチLLM呼び出し（分類・分析タスク）をユーザーからの修正指示と区別できていない。プロンプト内容ベースの検出ではメタ的な自己参照ループが発生する

## countermeasure
failure signal収集時にバッチ処理プロンプト（claude --print 経由のシステム呼び出し）を除外する。CLAUDE_BATCH_MODE等の環境変数でフィルタ、またはプロンプトソース(user/system)で判別する

<!-- id: 3e54384b-e429-4404-9f86-5c39981cf852 -->
