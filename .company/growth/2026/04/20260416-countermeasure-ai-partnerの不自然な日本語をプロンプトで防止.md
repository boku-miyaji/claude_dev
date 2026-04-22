# AI Partnerの不自然な日本語をプロンプトで防止

- **type**: `countermeasure`
- **date**: 2026-04-16
- **category**: quality / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: ai-partner, プロンプト改善, 日本語品質, Edge Function
- **commits**: 45bac51

## what_happened
AI Partnerが生成する日本語に不自然な表現が混入する問題に対し、ai-agent Edge Functionのシステムプロンプトを強化して自然な日本語出力を誘導するよう修正した。

## root_cause
LLMのデフォルト出力が日本語として硬い・不自然な表現になりやすく、既存プロンプトでは十分に制御できていなかった

## countermeasure
プロンプトに日本語の自然さに関する明示的な指示を追加し、不自然な表現パターンを抑制

## result
AI Partnerの日本語品質が向上

<!-- id: b7cd8dc2-3161-43c2-95f4-4dea9cb0be84 -->
