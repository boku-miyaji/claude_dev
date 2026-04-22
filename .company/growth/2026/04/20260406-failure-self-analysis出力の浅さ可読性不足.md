# self-analysis出力の浅さ・可読性不足

- **type**: `failure`
- **date**: 2026-04-06
- **category**: quality / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, llm-prompt, ui, llm-retroactive, llm-classified

## what_happened
社長からself-analysis出力について『結果が浅い、概要レベル過ぎ、平文で読む気が出ない』とフィードバック。より示唆に富んだ踏み込んだ分析コメントとMarkdownによる視覚的な強弱表現が求められた。

## root_cause
出力プロンプト設計が概要レベル止まりで、深い洞察を引き出す指示が不足。フォーマット指定もプレーンテキスト前提

## countermeasure
プロンプトに深掘り分析指示とMarkdown強弱ルールを追加する方向

<!-- id: 85205c31-e230-4f22-adda-5e999dc80ee4 -->
