# NEWS収集のAI暴走 — 質問返し・白画面・パース失敗

- **type**: `failure`
- **date**: 2026-04-01
- **category**: tooling / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: tooling, llm, news, json-output, prompt-engineering
- **commits**: 848a82c, 7f505d0, 9e5f982

## what_happened
ニュース収集ボタンを押すとAIが「どのようなニュースをお探しですか？」と質問返しをしたり、白画面になったり、JSON配列ではなくマークダウンで返したりして、3回連続でバグ修正が必要になった。

## root_cause
LLMへの指示が「ニュースを教えて」と曖昧で、LLMが対話モードに入ってしまった。SSEレスポンスのパースもエッジケースでの処理が甘かった。

## countermeasure
プロンプトに「【指示】質問や確認をせず、即座にJSON配列だけを出力」を明記。出力形式を厳密に指定し、context_mode: none で余計なコンテキストを排除。

## result
LLMへの指示は「何をどの形式で返すか」を徹底的に具体化すべきという教訓。曖昧な指示 = 不安定な出力。

<!-- id: 7213f600-18e1-4c7b-b6be-253da0ed8f7f -->
