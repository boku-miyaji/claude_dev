# AIチャットをlegacy HTMLからReactへ移植

- **type**: `decision`
- **date**: 2026-04-12
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, frontend, ui, llm-retroactive, llm-classified

## what_happened
legacy HTMLとReactの機能差を比較調査した上で、AIチャットのReact移植を決定。Google Calendar風UI・ドラッグ編集・カレンダー選択などlegacy機能の完全復元も同時に実施する方針。

## result
UIの主要機能がReact側に統一され、legacyとの二重実装解消へ

<!-- id: 25acea6e-04e0-4d2d-99f1-f15740710fa3 -->
