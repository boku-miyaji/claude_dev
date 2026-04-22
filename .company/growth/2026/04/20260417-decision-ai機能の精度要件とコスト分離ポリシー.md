# AI機能の精度要件とコスト分離ポリシー

- **type**: `decision`
- **date**: 2026-04-17
- **category**: architecture / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, llm-prompt, cost, llm-retroactive, llm-classified

## what_happened
AI機能群（朝ブリーフィング、Narrator、タグ付け等）が機能重複・名前不明瞭・冗長生成の問題を抱えている。社長が「自己理解系=精度大事、裏の分析系=多少精度落ちてOK」の二分論を提示し、機能整理とモデル選択・コスト試算のやり直しを指示。

## result
精度×用途で機能を二分し、モデル選択の根拠を明確化する方針が確立

<!-- id: 742e8466-d517-4abe-9ac5-bf4757314314 -->
