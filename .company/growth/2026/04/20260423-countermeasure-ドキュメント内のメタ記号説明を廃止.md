# ドキュメント内のメタ記号説明を廃止

- **type**: `countermeasure`
- **date**: 2026-04-23
- **category**: communication / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, documentation, ux, auto-detected, daily-batch, llm-classified

## what_happened
R-12, G-1, M1, U等のメタ情報記号をドキュメント内で説明なしに使っていた。社長が「なんのことかわからない」と指摘。

## root_cause
内部管理用の記号を対外ドキュメントに流出させていた。

## countermeasure
メタ情報記号は使わず、もっと丁寧に自然言語で説明する。ドキュメント内を修正。

<!-- id: 6b14cbe3-749a-4036-9fa6-5fae7d92e5c5 -->
