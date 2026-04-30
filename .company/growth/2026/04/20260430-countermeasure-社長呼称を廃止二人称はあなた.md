# 「社長」呼称を廃止、二人称は『あなた』

- **type**: `countermeasure`
- **date**: 2026-04-30
- **category**: communication / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, tone, auto-detected, daily-batch, llm-classified

## what_happened
ユーザーから「私のことを社長と呼ぶのはやめて欲しい」と明示的に指示。/company 起動時のブリーフィング含め全文脈で適用。

## root_cause
既存ルール・テンプレートに「社長」呼称が広く埋め込まれていた

## countermeasure
二人称は「あなた」または無主語。固有名詞呼称も使わない。Auto Memory に上書き済み（feedback_honorific.md）

## result
Auto Memory 反映済み。今後のテンプレ・スキルから「社長」を除去する横展開が必要

<!-- id: 046f7f74-9374-408d-960c-b95dd3d9de98 -->
