# 統合タイムライン + GCal Tasks連携の追加

- **type**: `milestone`
- **date**: 2026-04-10
- **category**: architecture / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: timeline, gcal, tasks, integration, claude-dev
- **commits**: 6668b7a

## what_happened
ダッシュボードに統合タイムラインを実装し、Google Calendar Tasks APIと連携。締め切り付きタスクと日中タスクの両方を管理できるようにした。useTodayTimeline/googleTasksApi等8ファイル1400行超の追加。

## root_cause
タスクには締切ありと日中実施があり、GCal同期できる部分/できない部分を明確に分けて管理したいという要求

## countermeasure
GCal Tasks APIをcalendar eventsと統合したタイムラインhookを新設

## result
タスクとカレンダーイベントを一つのタイムラインで閲覧可能に

<!-- id: 0eca6be8-9330-4ac1-8184-e68d92eabe03 -->
