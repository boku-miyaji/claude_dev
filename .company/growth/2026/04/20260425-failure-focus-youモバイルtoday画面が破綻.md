# focus-youモバイルTODAY画面が破綻

- **type**: `failure`
- **date**: 2026-04-25
- **category**: quality / **severity**: high
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, mobile, auto-detected, daily-batch, llm-classified

## what_happened
focus-youのデザイン精査中、モバイル版TODAY画面のレイアウト/UXが破綻していると社長から指摘（『モバイルのTODAY画面がひどい』）。デスクトップ版中心の検証でモバイルが置き去りにされていた。

## root_cause
モバイル前提の設計・検証が不十分。デスクトップ動作確認のみで進んでいた

<!-- id: 3b2e376f-9af6-420b-9f08-845e1bdf07d2 -->
