# Tool使用・時間メトリクスのHook記録を開始

- **type**: `decision`
- **date**: 2026-04-01
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, hook, cost, operations, llm-retroactive, llm-classified

## what_happened
AIチャットとClaude Codeの1文字目到達時間、回答完了時間、使用Tool、スキル呼び出し回数をHookで収集する運用を決定。分析結果はAPI Costsページを拡張して可視化。必要なTool/スキル/時間の最適化のための基礎データ蓄積を目的とする。

<!-- id: 14f09170-bdd7-403d-8594-1e12f51f4157 -->
