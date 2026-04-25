# focus-you設計モックの致命的欠落

- **type**: `failure`
- **date**: 2026-04-25
- **category**: quality / **severity**: high
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, process, auto-detected, daily-batch, llm-classified

## what_happened
focus-youのデザイン精査で、モバイルTODAY画面の品質が酷い、夢/ゴール/目標等の主要機能が反映されていない、現行focus-youと項目構成が食い違う等、モックの完成度・網羅性に重大な問題。実装に進めない状態。

## root_cause
デザイナーが既存機能を全画面で精査せず、モックを単独で進めた。機能対応表の比較確認を省略

## countermeasure
全画面で機能対応表を作り移行確認、未実装はベータ表記/削除して再精査

<!-- id: f5ea1b5f-f31b-40b4-89a0-86194f52b93f -->
