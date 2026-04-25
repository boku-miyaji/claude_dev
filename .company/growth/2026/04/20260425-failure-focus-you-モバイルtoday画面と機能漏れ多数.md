# focus-you モバイルTODAY画面と機能漏れ多数

- **type**: `failure`
- **date**: 2026-04-25
- **category**: quality / **severity**: high
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, design, auto-detected, daily-batch, llm-classified

## what_happened
focus-you-design-spec.html を精査したところ、モバイルのTODAY画面が酷い状態であり、夢・ゴール・目標等の主要機能、AI 自動検出（日記→夢の種）、HabitFrequency、TodayIdeasCard 昇格 UI、Roots narrative 等が漏れていた。既存 focus-you と項目が一致しない問題も発覚。

## root_cause
壁打ちを経ずに設計仕様書化を進めたため、現行プロダクトとの機能対応表が作られていなかった

## countermeasure
各画面ごとに機能対応表を作って移行漏れを丁寧に確認、Dreams & Goals 等を追加、未実装/ベータ機能を整理

## result
アルファ実装に進む方針決定、壁打ちは翌日継続

<!-- id: dce1e3cf-257b-422e-ae6b-a9550917cf3f -->
