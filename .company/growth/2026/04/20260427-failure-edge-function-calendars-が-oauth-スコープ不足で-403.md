# Edge Function /calendars が OAuth スコープ不足で 403

- **type**: `failure`
- **date**: 2026-04-27
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: claude-dev, supabase, edge-function, oauth, google-calendar, manual-record

## what_happened
google-calendar-proxy に /calendars (calendarList.list) エンドポイントを追加した際、フロントの GCAL_SCOPES が calendar.events のみで calendar.calendarlist.readonly が欠落していた。Google API が insufficientPermissions で 403 を返し、カレンダー一覧が取得できず予定が表示されなかった。

## root_cause
新エンドポイント追加時に必要 OAuth スコープの再確認をしなかった。calendar.events では calendarList.list を叩けない。

## countermeasure
GCAL_SCOPES に calendar.calendarlist.readonly を追加 + 既存 google_tokens レコードを削除して再認証フローに乗せた。

<!-- id: a3fb2ec0-d6df-423e-b7a0-13a6e534d538 -->
