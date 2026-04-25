# 未使用skillの全面見直し・無効化

- **type**: `decision`
- **date**: 2026-04-25
- **category**: organization / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, tooling, auto-detected, daily-batch, llm-classified

## what_happened
現在のskillを全面棚卸しし、使っていないもの（pptx系/diary/weekly-digest/auto-prep等）を無効化。design・zenn等は残す。skill使用時に必ずカウントできる仕組みを入れて運用が回るように改善要求。

## root_cause
skillの稼働率が見えず、使われていないものが放置されていた

## countermeasure
skill利用カウントの仕組み導入とdescription標準化

<!-- id: b8a461cc-4f6a-407c-a285-322afc6fc6d6 -->
