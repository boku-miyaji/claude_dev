# 2026-04-15 意思決定ログ

## DEC-2026-04-15-01: Requests 画像添付用 Storage バケット

**文脈**: Requests ページに画像添付機能を実装するにあたり、当初は既存 `chat-attachments` バケットの流用を指示していた。

**発覚**: 実装時に `chat-attachments` バケットが Supabase 上に存在しなかったことが判明。

**決定**: `request-attachments` バケットを新規作成し、そのまま維持する。

**根拠**:
- 用途が明確に分離されている（チャット添付 vs リクエスト添付）ため、バケットを分けた方が RLS ポリシーもシンプル
- すでにマイグレーション（062）で作成・適用済み
- RLS は `foldername[1] = auth.uid()` で user 分離されており、セキュリティ的に問題なし

**影響範囲**:
- `company-dashboard/src/lib/requestAttachments.ts` が `request-attachments` バケットを参照
- `supabase-migration-062-request-attachments.sql` で作成
- 将来 Claude 連携を実装する際、このバケット名を前提とすること

---

## DEC-2026-04-15-02: Google Calendar 取得の仕様

**文脈**: 週表示で予定が一部欠落していた問題の根本原因調査と修正。

**原因**（3点複合）:
1. `maxResults=50` デフォルトが低すぎ、週あたりの予定数に対して溢れていた
2. Edge Function の通常フローで `nextPageToken` を処理していなかった
3. 1カレンダーの取得失敗を `continue` で無言スキップしており、欠落に気づけなかった

**決定**:
- `maxResults` デフォルトを 250（Google Calendar API 最大値）に引き上げる
- 各カレンダーで `nextPageToken` を末尾までループ（最大10ページ）
- 失敗したカレンダーを `failed_calendars[]` で返し、UI に警告バッジを表示する
- silent failure を恒久的に廃止する

**根拠**:
- Auto Memory `feedback_no_jargon_no_meta` と `feedback_edge_function_deploy` に沿って、失敗は必ず明示する
- 4カレンダー並列取得（acesinc/xyz/primary/gangsters）が前提の設計のため、1本の欠落が致命的になりやすい

**影響範囲**:
- `company-dashboard/supabase/functions/google-calendar-proxy/index.ts`
- `company-dashboard/src/lib/calendarApi.ts`（戻り値が `{ events, failedCalendars, partial }` に変更される破壊的変更）
- `company-dashboard/src/hooks/useGoogleCalendar.ts`、`useTodaySchedule.ts`、`useTodayTimeline.ts`、`pages/Calendar.tsx`、`pages/Story.tsx` が追従
