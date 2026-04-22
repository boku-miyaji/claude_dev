# AIチャットが過去会話を理解できない

- **type**: `failure`
- **date**: 2026-04-05
- **category**: quality / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, llm-prompt, ui, llm-retroactive, llm-classified

## what_happened
AIチャットでファイルアップロードなしの通常会話でも、過去の会話文脈を明らかに理解できていない挙動。社長から「まだ明らかに過去の会話を理解していない」と再度指摘。

## root_cause
会話履歴のコンテキスト連携が不十分

<!-- id: 31cb5cef-2b64-489c-98e9-366ce6b7397a -->
