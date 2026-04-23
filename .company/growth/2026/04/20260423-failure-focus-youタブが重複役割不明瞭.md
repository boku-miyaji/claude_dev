# focus-youタブが重複・役割不明瞭

- **type**: `failure`
- **date**: 2026-04-23
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, auto-detected, daily-batch, llm-classified

## what_happened
focus-youダッシュボードのタブ数が増え、insights/self-analysis/manualなど機能の重複や役割分担が不明瞭になってきた。growthがClaude Code側の機能かダッシュボード側か境界も曖昧で、整理が必要な状態。

## root_cause
機能追加の度にタブを増やす運用で、情報設計の全体整合性を取らずにいたため

<!-- id: ebe38b08-fb19-43e6-8012-ad00c246a357 -->
