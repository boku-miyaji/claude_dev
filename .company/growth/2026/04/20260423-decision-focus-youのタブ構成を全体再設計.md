# focus-youのタブ構成を全体再設計

- **type**: `decision`
- **date**: 2026-04-23
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, auto-detected, daily-batch, llm-classified

## what_happened
focus-youのタブが増えすぎ、重複や役割不明（insights, self-analysis, manual, growth等）が発生。設計思想に沿って全体のタブ構成を見直し、news機能はclaude code側に寄せる可能性を含めて統合・分担を再検討する方針を決定。

<!-- id: c30bc714-0560-46ee-b277-f13732e3003c -->
