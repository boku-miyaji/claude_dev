# バッチ分類/成長分析プロンプトのJSON出力が不安定

- **type**: `failure`
- **date**: 2026-04-16
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch, claude-dev
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
prompt分類と成長イベント抽出のバッチが繰り返し'correction'シグナルを発生させており、期待するJSON構造で返ってこない

## root_cause
プロンプトにJSONスキーマ例・出力制約（配列のみ/コードフェンス禁止）が明示されておらず、LLMが前置きや曖昧なタグを返している可能性が高い

## countermeasure
バッチプロンプトに厳密なJSON Schema例と『JSON配列のみ、前置き禁止』を明記し、パース失敗時は1回だけ再プロンプトするリトライを追加

<!-- id: 6f626835-f1c4-4a1e-aea3-09fedc689249 -->
