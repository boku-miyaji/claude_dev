# focus-you Calendar UIを24時間表示+自動スクロール化

- **type**: `milestone`
- **date**: 2026-04-27
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: focus-you, ui, frontend, auth, auto-detected, daily-digest
- **commits**: 8ffa836b, 3a72b970, 26f05086

## what_happened
focus-youのCalendarビューを0-23時の完全な24時間表示に拡張し、ページロード時に現在時刻へ自動スクロールする挙動を実装。OAuth callbackの自動遷移バグや /calendars endpoint向けの calendar.calendarlist.readonly scope追加も合わせて完了。

## result
早朝・深夜の予定も視認可能になり、現在時刻起点のUXが成立。Google Calendar連携の安定性も向上。

<!-- id: aa48ddbd-18c2-4650-8207-c37ec41ba822 -->
