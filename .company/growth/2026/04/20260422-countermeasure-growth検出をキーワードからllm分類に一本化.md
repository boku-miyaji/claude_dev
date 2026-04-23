# growth検出をキーワードからLLM分類に一本化

- **type**: `countermeasure`
- **date**: 2026-04-22
- **category**: architecture / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, llm-prompt, automation, auto-detected, daily-digest
- **commits**: 58b1dbc, f580919, 32f8f0c, dd45a02

## what_happened
growth_eventsの自動検出で、キーワードベース判定が見逃しが多くデータが欠落していたため、全ユーザープロンプトをClaude CLI (opus)でfailure/countermeasure/decision/milestone/noiseに分類する方式に切り替え。3/26〜4/21のretroactive backfillも実行して過去分を補完した。

## root_cause
キーワードマッチは「困った」「決めた」等の表層表現に依存するため、微妙な文脈の決定・失敗・対策を取りこぼしていた

## countermeasure
growth-detector.shを全プロンプトraw蓄積に簡素化し、daily-analysis-batchでLLMに分類させてnoise以外をsource='detector'でINSERT。併せてdecision type追加・PJタグフィルタ・self-loop fixも投入

## result
見逃しが大幅に減少し、過去1ヶ月分のbackfillで欠損を補完

<!-- id: b2a9b582-1638-4281-b652-42c658fdc71d -->
