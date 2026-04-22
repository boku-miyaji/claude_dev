# AIチャット会話履歴の安定化 — tool_call_id問題との6時間の格闘

- **type**: `failure`
- **date**: 2026-04-05
- **category**: quality / **severity**: critical
- **status**: resolved
- **source**: manual
- **tags**: quality, ai-chat, debugging, tool-calling, history, context-loss, focus-you
- **commits**: ac536f4, 9adf4b6, 00b326f, 5a880ee, a005725, 3f13b89, 0361eab, d5da859, 3cf2313

## what_happened
AIチャットの会話コンテキストが途中で消失する問題が発生。debug用ログ追加→原因特定→修正を繰り返し、最終的に6つの問題を発見: (1)中間assistantメッセージのDB未保存、(2)tool_call_idカラム未存在、(3)null contentのフィルタ漏れ、(4)ファイル内容による履歴膨張、(5)toolメッセージとassistantの紐付け不整合、(6)履歴再構築ロジックの脆弱性。

## root_cause
OpenAI APIのFunction Calling仕様で、assistantのtool_callsメッセージ→toolの応答メッセージ→次のassistantメッセージが厳密にペアリングされる必要があるが、中間メッセージをDB保存していなかった。

## countermeasure
tool_call_idカラムをmigration 047で追加。中間assistantメッセージのDB保存、ファイル内容の分離保存、safe history reconstructionロジックを実装。

## result
LLM APIの会話履歴は「全メッセージの厳密なペアリング」が必須。部分的な保存は必ず破綻する。debugログを段階的に追加して原因を絞り込む手法が有効だった。

<!-- id: 99c8c952-8971-4dd2-8179-c5364fb3843e -->
