# カレンダーの30分スナップとドラッグ伸縮修正

- **type**: `countermeasure`
- **date**: 2026-04-15
- **category**: quality / **severity**: low
- **status**: active
- **source**: daily-digest
- **tags**: calendar, ux-fix
- **commits**: 2e53d69

## what_happened
カレンダーで30分単位スナップと、ポップアップ表示中のドラッグ伸縮挙動を修正。

## root_cause
ポップアップとドラッグのイベント競合

## countermeasure
スナップ刻みとドラッグハンドリングを調整

## result
編集操作の精度が向上

<!-- id: 5f334bb3-d2d7-459c-8467-f07e1350296f -->
