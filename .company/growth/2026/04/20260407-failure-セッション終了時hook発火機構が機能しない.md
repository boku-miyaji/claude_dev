# セッション終了時hook発火機構が機能しない

- **type**: `failure`
- **date**: 2026-04-07
- **category**: automation / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, hook, llm-retroactive, llm-classified

## what_happened
growth-detector.sh のようにセッション終了時に発火させる仕組みが他になく、現状の実装では実質機能していない可能性が高いと指摘。Hookイベントの設計見直しが必要。

## root_cause
Stop hookの仕様理解不足（毎レスポンス後発火であってセッション終了時ではない）

<!-- id: c0751bc8-df9b-4f4b-b0af-cc6b92741eff -->
