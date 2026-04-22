# AI Chat — Anthropic対応を作って即削除

- **type**: `failure`
- **date**: 2026-03-31
- **category**: architecture / **severity**: low
- **status**: resolved
- **source**: manual
- **tags**: architecture, ai, anthropic, yagni, cors
- **commits**: 83f4d06

## what_happened
AI ChatにOpenAIとAnthropicのデュアルプロバイダー対応を実装したが、Anthropic APIはブラウザからの直接呼び出しにCORS制限がありEdge Functionが必要。結局OpenAIのみに絞って削除。

## root_cause
「両方対応しておけば便利だろう」という推測で実装したが、実際にはAnthropicはCORS問題で使えなかった。

## countermeasure
OpenAIのみに絞り、Anthropicの選択肢を削除。

## result
YAGNI。「使うかもしれない」機能は作らない。特にAPI連携は実際に動くか先に検証してから組み込む。

<!-- id: 02d52f54-fbc9-4363-9b33-d6ae1b0c5183 -->
