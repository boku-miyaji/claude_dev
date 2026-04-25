# MAF vs magentic_pipeline 使い分け方針

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
WBIのアーキテクチャ選択を議論し、アジェンダ生成フローはmagentic_pipeline.pyスタイル（明示的オーケストレーション）、AIチャットはdynamic（LLMが自由にツール選択）と使い分ける方針を決定。Claude Codeのような動的型はプロンプト管理が肝。

## result
用途別の実装ガイドライン確立

<!-- id: 8192e348-733f-4e40-9e19-5525b771ba41 -->
