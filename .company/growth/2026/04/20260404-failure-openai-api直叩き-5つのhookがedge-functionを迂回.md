# OpenAI API直叩き — 5つのhookがEdge Functionを迂回

- **type**: `failure`
- **date**: 2026-04-04
- **category**: architecture / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: architecture, security, edge-function, openai, api-pattern, focus-you
- **commits**: f6bdc22

## what_happened
モバイルから日記を書いたらOpenAI API keyエラーが発生。調査すると、感情分析・ブリーフィング・夢検出・週次ナラティブ・自己分析の5つのhookがブラウザから直接api.openai.comを叩いていた。

## root_cause
AI機能を追加する際に「とりあえず動く」ことを優先し、既存のEdge Function経由パターンを無視して直接APIを叩くコードを書いてしまった。同じミスが5回繰り返された。

## countermeasure
Edge Functionにcompletion mode（会話管理なしの軽量エンドポイント）を追加。共通ヘルパー(edgeAi.ts)を作成し、全hookを統一的にEdge Function経由に修正。モデルもgpt-5-nanoに統一。

## result
API呼び出しパターンが統一され、APIキーがサーバー側のみに。共通ヘルパーにより今後同じミスが起きにくい構造に。「同じミスを5回した」という教訓をナレッジとして記録済み。

<!-- id: 5c87e49f-d44a-43d0-9e37-c52adc06d9a9 -->
