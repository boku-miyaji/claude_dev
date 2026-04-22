# growth-detector に system-generated プロンプトの除外フィルタを追加

- **type**: `countermeasure`
- **date**: 2026-04-22
- **category**: process / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, hook, agent-harness, llm-prompt, manual-record
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
growth-detector.sh の冒頭で、daily-analysis-batch.sh / ceo-insights の内部 LLM 呼び出しに使われる先頭パターン（'Classify each prompt', 'Analyze these failure signals', 'Evaluate HD organization', '日記エントリの下処理', 'あなたは...アナリスト' など）を早期 exit 0 する除外フィルタを追加

## root_cause
daily-analysis-batch.sh が claude --print --model opus で内部プロンプトを流すと、そのプロンプト自体が UserPromptSubmit 経路で growth-detector.sh を通過し、'correction' signal として記録され、次の日も同じ signal を LLM で要約して failure として INSERT、という再帰ループに陥っていた（4/15〜4/21で17件の同一事象が蓄積）

## countermeasure
growth-detector.sh に head -c 200 | grep -qE でシステムプロンプトを早期判定し、マッチしたら exit 0 で即スキップ。signal ファイルに書き込まない

## result
以後の daily-batch 実行で同一事象の増殖が止まる見込み。既存の17件は代表(4d092e0e)に parent_id で紐づけ済み、残り16件は status='recurring' にマーク済み

<!-- id: fc5a05ff-db1d-4bc2-b8ea-4c2f8c72b45e -->
