# 兄弟リポジトリ参照SKILLでモノレポ風運用

- **type**: `decision`
- **date**: 2026-04-02
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, tooling, documentation, llm-retroactive, llm-classified

## what_happened
モノレポにできない事情があっても ../other-repo を rg --files で参照するSKILLを作れば、ナレッジとコンテキストをコンパウンドに蓄積できるという方針を検討。コーディングだけでなく戦略・デザイン文書も対象。ショートカットが指数関数的に濃縮されるメリットを期待。

<!-- id: 1e4c4d09-f394-4f71-b5a5-620a503586cd -->
