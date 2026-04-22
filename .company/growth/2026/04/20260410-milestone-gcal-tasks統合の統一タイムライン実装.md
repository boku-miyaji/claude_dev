# GCal Tasks統合の統一タイムライン実装

- **type**: `milestone`
- **date**: 2026-04-10
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: timeline, gcal, google-tasks, dashboard, claude-dev
- **commits**: 6668b7a

## what_happened
ダッシュボードのTodayビューにGoogle Calendar予定とGoogle Tasksを統合した統一タイムラインを実装。締切ありタスクと日中実施タスクの両方を管理可能にし、同期可能/不可の境界を明確化した。

## root_cause
タスクには締切型と日中実施型があり、GCal同期可能な部分と不可な部分を分けて管理したいという要望

## countermeasure
useTodayTimeline.ts/googleTasksApi.ts/calendarApi.tsを新規追加しSidebarとApp.tsxを刷新

## result
予定とタスクが1つのタイムラインに集約され、管理方針が整理された

<!-- id: b69ab362-10e7-46c2-9952-6ced1d85b8c2 -->
