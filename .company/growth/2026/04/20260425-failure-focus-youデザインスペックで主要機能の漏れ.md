# focus-youデザインスペックで主要機能の漏れ

- **type**: `failure`
- **date**: 2026-04-25
- **category**: quality / **severity**: high
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, auto-detected, daily-batch, llm-classified

## what_happened
focus-you-design-spec.htmlに夢・ゴール・目標機能が記載されておらず、モバイルTODAY画面の体験も悪い状態だった。AI自動検出（日記→夢の種）、HabitFrequency、TodayIdeasCard昇格UI、archiveStoryMemoryByType、Roots narrative生成等の重要機能が抜けていた

## root_cause
モックアップ作成時に既存focus-you機能との対応表チェックが不足

## countermeasure
各画面ごとに機能対応表で1つずつ移行確認するプロセスを追加

<!-- id: f1353142-8a59-41d1-8876-ee00858e3e76 -->
