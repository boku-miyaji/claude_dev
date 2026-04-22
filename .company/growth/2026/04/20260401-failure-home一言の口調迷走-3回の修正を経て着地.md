# HOME一言の口調迷走 — 3回の修正を経て着地

- **type**: `failure`
- **date**: 2026-04-01
- **category**: process / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: process, llm, prompt-engineering, guardrails
- **commits**: f3a8da3, 13b5d9d, fa5f761, 29692a5, 837c3a9, 18f3344

## what_happened
Home画面のAI一言メッセージが「業務報告」「タメ口」「実行不可能な約束」を繰り返し、社長から3回連続で修正指示が入った。

## root_cause
LLMに丸投げするとプロンプトの意図を外れやすい。特に「感情に寄り添う」と「実行できない約束をしない」のバランスがLLM単独では取れなかった。

## countermeasure
プロンプトに【絶対禁止】リストを明記。深夜は無条件で休息メッセージ（LLMに判断させない）。日記・CEOインサイト・セッション履歴をコンテキストとして注入。

## result
「LLMに自由度を与えすぎない」という教訓。ガードレール（禁止リスト）+ コンテキスト注入 + 時間帯ルールの3層で安定した出力に。

<!-- id: ad0a8f3d-140b-49a2-bc3f-0ab69ae61a3f -->
