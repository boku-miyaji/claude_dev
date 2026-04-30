# Calendar 同期停止 + バッチ failure 連発の根本調査

調査日: 2026-04-30
依頼: HD秘書（社長指示でB-C並列のC担当）
スコープ: **系統1（Google Calendar 同期停止）の根本原因のみ**。系統2/3 は別調査。

## 系統1: Google Calendar 同期停止

### 事実（一次ソース確認済み）

**症状の現認:**
- `google_tokens` テーブル: 1行のみ。`user_id=9096d5b4...`、`calendar_ids=[]`（空）、`updated_at=2026-04-27 14:35:23 UTC`（= 4/27 23:35 JST）。
- `calendar_events` テーブル: 直近の `synced_at` は `2026-04-28 08:03:51 UTC`（= 4/28 17:03 JST）。それ以降約 2 日間、**全カレンダーで synced_at が更新されていない**。
- 4/30 朝の予定として残存している `7948nk30gm5btjtqjfcli6lvtv_20260430T010000Z`（"[in] rikyu algo mtg"）は `synced_at=2026-04-27 10:11 UTC`、`status='confirmed'`。社長が Google Calendar 上で削除したはずだが DB には残っている = **削除イベントが proxy 経由で同期されていない**。
- 同期実績のあるカレンダー ID（過去30日）: `yuta.miyaji@acesinc.co.jp`（534件、3日分の sync）/ `yumzzz.my6223@gmail.com`（176件、2日分）/ `yuta.miyaji.xyz@gmail.com`（21件、1日分のみ）。

**設計の確認（コード一次ソース）:**
- `supabase/functions/google-calendar-proxy/index.ts`
  - `getAccessToken(userId)`（line 111-140）: `google_tokens` から **`user_id` で `.single()` 取得** → 復号 → refresh_token で access_token 取得。
  - `handleGetEvents`（line 217-329）: フロントが送ってきた `?calendar_ids=A,B,C` を for-loop で叩く。Edge Function は `google_tokens.calendar_ids` カラムを **読まない**（書き込み専用、read 経路は `handleCheckAuth` のメタ情報返却のみ）。
  - `calendar_ids: []` のとき: フロントの `fetchCalendarEvents` 側（`src/lib/calendarApi.ts:220-224`）で「空 calendar_ids なら Edge Function を叩かず空で return」。**サーバには到達しない。**
  - エラー時挙動: 400/403/exception とも `failedCalendars[]` に追加して継続。NEEDS_AUTH と "Token refresh failed" はゲートウェイで 401 を返す。**サイレントフェイルではないが UI への露出は弱い**（`partial=true` フラグだけ）。
- `src/hooks/useGoogleCalendar.ts`（line 73-75）: `useEffect([authenticated, calendarsLoading, fetchEvents])` でカレンダーページを開いたとき・viewDate/viewMode 変化時に fetch。**インターバル同期なし、サーバ側 cron なし**。同期はユーザーがカレンダー画面を開いている間だけ走る。
- `src/hooks/useUserCalendars.ts`: ログイン後マウント時に Google `/users/me/calendarList` を叩いて、書き込み可能カレンダーを返す。これが `calendarIds` の唯一の供給源。

**スキーマの致命的制約:**
- `supabase-migration-054-google-tokens.sql:5`:
  ```sql
  user_id uuid primary key references auth.users(id) on delete cascade,
  ```
  **PRIMARY KEY が user_id**。1ユーザー = 1 Google アカウント = 1 refresh_token しか保存できない。複数 Google アカウントの並存は構造的に不可能。
- 現在保存されている refresh_token は **yumzzz.my6223@gmail.com のもの**（`auth.users` 突合で確認済み、本書初版で acesinc と推定したのは誤り）。acesinc / yuta.miyaji.xyz の予定が取れていたのは、**yumzzz アカウントが Google 側 calendar-sharing で他2カレンダーへの読み権限を持っているから**。Auto Memory にある「acesinc/xyz/primary/gangsters の4カレンダー全取得」は、3アカウント並列 OAuth ではなく、**yumzzz 1アカウントから sharing 経由で複数カレンダーを横読みする構造**。

**直近の関連変更:**
- 2026-04-27 23:32 JST: commit `3a72b970` で `calendar.calendarlist.readonly` scope を追加。コミットメッセージに「Existing users need to re-authenticate. **google_tokens row was deleted to force the re-auth flow.**」と明記。
- 同日 23:35 JST に `google_tokens.updated_at` が更新（= 再認証完了）。`calendar_ids=[]` のまま保存（`completeCalendarAuth` は 153 行で常に空配列を送る設計）。
- 翌 4/28 17:03 JST を最後に sync 停止。

### 5 Whys

**Q1: なぜ 4/28 17:03 以降 calendar_events が更新されていないのか？**
A1: 同期は「カレンダー画面を開いたとき・viewDate を動かしたとき」にしか走らない。バッチもサーバ側 cron も存在しない。**4/28 17:03 以降カレンダー画面が開かれていない**＝同期トリガー自体が発火していない。

**Q2: なぜカレンダー画面を開かないと同期しない設計なのか？**
A2: `useGoogleCalendar` フック単体で「画面表示用の events 取得」と「DB への upsert（`calendar_events` テーブル）」を兼務している（`index.ts:312-320` で fire-and-forget upsert）。**「表示」と「永続同期」が同じ経路に乗っていて、片方を切ると両方止まる**。

**Q3: なぜ表示と永続同期が分離されていないのか？**
A3: 元々 client-side implicit flow（hourly re-auth）の頃は永続同期という概念がなく、proxy 化したときに backfill エンドポイントだけ追加して「定期同期」レイヤを設けないまま運用に入った。`d5016684 feat: migrate Google Calendar from implicit flow to authorization code flow` 以降、定期同期の cron / webhook（Google Calendar Push Notifications）は未設計。

**Q4: なぜ未設計のまま運用継続できたのか？**
A4: 社長が日中ダッシュボードを開いている時間帯は事実上の「polling」になっており、不在時の同期遅延に気付くフィードバックループが存在しない（モニタリング・アラート・stale 検知ともに無し）。今回は週末 + 別作業中に長時間カレンダーを開かなかったため初めて顕在化した。

**Q5: なぜ「不在時同期遅延に気付かない」状態が放置されたのか？**
A5: そもそも `google_tokens` のスキーマが PK=user_id で「1ユーザー1Google」を強制しており、本来 Auto Memory にある「3アカウント並列取得」設計と乖離している。設計上の前提（マルチアカウント）と実装（シングルトークン + sharing 横読み）の不整合が、cron 設計を後回しにする心理的背景になった可能性が高い。**根本は「設計と実装の乖離をドキュメント化していない」**こと。

### 構造的問題の特定

1. **SPOF**: ブラウザの useEffect が唯一の同期トリガー。Tab を閉じる = 同期停止。
2. **責務混在**: 「UI 表示」と「永続化」が同じパスに同居。
3. **スキーマ仕様乖離**: `google_tokens.user_id PRIMARY KEY` は 1ユーザー1Google 前提。Auto Memory（3アカウント設計）とコード comment（「マルチアカウント対応の入口」: `useUserCalendars.ts:10`）が同時に存在し、現実は sharing 横読みでハック運用。
4. **観測不可**: 同期最終時刻のヘルスチェック / freshness アラートが無い。今回も社長が「rikyu MTG が消えてない」と気付くまで誰も検出しなかった。
5. **削除非反映**: `status='cancelled'` を skip する実装（`index.ts:262`）のため、Google 側で削除されたイベントは **upsert で上書きされず DB に残り続ける**。次回 sync が走らなければ永遠に残る。

### 3層対策（即時 / 構造 / 横展開）

**P0（即時修正、社長の今回の症状解消）:**
- カレンダーページをブラウザで開き、4/28-5/05 の範囲で再 fetch を強制（viewDate を動かすか refetch ボタン）→ proxy が走り、Google 側で削除された rikyu MTG は upsert 対象に含まれず残ったまま。**追加で `cancelled` イベントの DELETE 処理を実装する必要あり**（cancelled も dbRows に入れて status='cancelled' で upsert、UI 側で除外）。
- 暫定: 4/30 の `7948nk30gm5btjtqjfcli6lvtv_20260430T010000Z` を `sb.sh delete calendar_events "?id=eq.7948nk30gm5btjtqjfcli6lvtv_20260430T010000Z"` で手動削除。

**P1（構造的防止）:**
- **GitHub Actions cron で定期同期バッチ**を作る。Edge Function `/backfill` エンドポイントは既に `BACKFILL_SECRET` 認証で存在する（`index.ts:580-654`）。30分ごとに「今日 - 14日」〜「今日 + 60日」を全 calendar_id に対して backfill する worker を `.github/workflows/calendar-sync.yml` として追加。これでブラウザを開かなくても DB が新鮮に保たれる。
- **`calendar_events` テーブルに sync watermark テーブル**（`calendar_sync_state(user_id, calendar_id, last_synced_at, last_sync_status, error)`）を追加し、最終同期時刻を観測可能にする。バッチが書き込み、freshness-policy / morning digest / ブリーフィングで「N時間以上 stale」を警告する。
- **cancelled イベントを DB 反映**: `index.ts:262` の `if (ev.status === "cancelled") continue;` を外し、`status='cancelled'` で upsert → UI 側のフィルタで非表示。これで Google 側の削除が DB に伝わる。
- **スキーマ仕様の明文化**: `google_tokens.user_id PRIMARY KEY` のため 1ユーザー1Google であること、複数カレンダーは Google 側 sharing 経由であることを `supabase/migrations/*.sql` の comment と `.company/design-philosophy.md` に明記。Auto Memory も「並列 OAuth ではなく acesinc 単一アカウント + sharing」に修正。

**P2（横展開）:**
- 同じ「ブラウザを開かないと同期しない」設計が他に無いか横断 grep: `useEffect.*fetch.*upsert` パターン / `fire-and-forget` 系の `.then(() => {})` upsert を全 hook で監査。`calendar_events` と同型のリスクを持つ `news-collect` / `narrator-update` 系を Today レポートが絡む全テーブルでチェック。
- **freshness-policy.yaml に `calendar_events` を追加**: 最新 synced_at が 4 時間を超えたら警告。これで stale を仕組みで検知する（人間の「あれ、消えてないな？」依存を排除）。
- Google Calendar **Push Notifications（webhook）** の検討。`watch` API で channel を張れば Google からの差分 push を受信でき、cron polling より低コスト・低遅延・削除即時反映が可能。次 quarter で評価。

### 関連ファイル（一次ソース）

- `/workspace/company-dashboard/supabase/functions/google-calendar-proxy/index.ts:111-140`（`getAccessToken`、google_tokens 単一行 lookup）
- `/workspace/company-dashboard/supabase/functions/google-calendar-proxy/index.ts:217-329`（`handleGetEvents`、calendar_events upsert）
- `/workspace/company-dashboard/supabase/functions/google-calendar-proxy/index.ts:262`（cancelled スキップ = 削除非反映の元凶）
- `/workspace/company-dashboard/supabase/functions/google-calendar-proxy/index.ts:580-654`（`/backfill` エンドポイント、cron 化に再利用可能）
- `/workspace/company-dashboard/src/hooks/useGoogleCalendar.ts:73-75`（同期トリガーの SPOF）
- `/workspace/company-dashboard/src/lib/calendarApi.ts:220-224`（calendar_ids 空のときショートサーキット）
- `/workspace/company-dashboard/src/lib/calendarApi.ts:139-155`（`completeCalendarAuth`、calendar_ids:[] 固定送信）
- `/workspace/company-dashboard/src/hooks/useUserCalendars.ts`（Google calendarList 取得、マルチアカウント設計の comment が現実と乖離）
- `/workspace/company-dashboard/supabase-migration-054-google-tokens.sql:5`（PK=user_id によるシングルトークン制約）
- `git show 3a72b970`（4/27 の scope 追加 + google_tokens 行削除による再認証強制 → calendar_ids リセット）

## 系統2: News Collection ワークフロー連続失敗

**別調査・対象外**（今回スコープ外）。

## 系統3: growth_events status 後追い更新の不在

**別調査・対象外**（今回スコープ外）。

## まとめ・優先順位

最優先は P1-1（GitHub Actions cron で `/backfill` 定期実行）+ P1-3（cancelled 反映）。この2点だけで「ブラウザ非依存の同期」と「削除の DB 反映」が両立し、今回の症状は仕組みで再発防止される。P0 は手動掃除のみで完了する。P1-2（watermark + freshness）と P2 は次の sprint で並行して入れる。

## ハンドオフ

```yaml
# handoff
handoff:
  - to: sys-dev
    context: |
      Google Calendar 同期が「ブラウザでカレンダーページを開いた時のみ」走る設計のため、
      4/28 17:03 JST 以降 stale。さらに cancelled イベントが DB に反映されない。
      P0 は手動 DELETE、P1 で cron 化と cancelled 反映、P2 で freshness 監視を入れる。
    tasks:
      - "calendar_events から id=7948nk30gm5btjtqjfcli6lvtv_20260430T010000Z を sb.sh delete で物理削除（P0）"
      - "google-calendar-proxy/index.ts:262 の `if (ev.status === 'cancelled') continue;` を外し、cancelled も upsert する。UI 側 (Calendar.tsx, useGoogleCalendar.ts) で status='cancelled' を除外フィルタする（P1）"
      - ".github/workflows/calendar-sync.yml を新設。30分 cron で google-calendar-proxy/backfill を呼び出し、time_min=today-14d / time_max=today+60d / calendar_ids=[acesinc, yumzzz, yuta.miyaji.xyz] を渡す。BACKFILL_SECRET は GitHub Secrets に格納（P1）"
      - "calendar_sync_state テーブル追加 migration を作成し、backfill 完了時に last_synced_at を upsert（P1）"
      - "freshness-policy.yaml に calendar_events: warn_after=4h を追加し、ブリーフィングで stale 警告を出す（P2）"
  - to: ops
    context: |
      設計（マルチアカウント想定）と実装（PK=user_id でシングルトークン + sharing 横読み）の
      乖離がドキュメント化されておらず、cron 設計の後回しの遠因になっている。
    tasks:
      - "supabase-migration-054-google-tokens.sql に「1ユーザー1Google アカウント、他カレンダーは sharing 経由」のコメントを追記する migration を発行"
      - ".company/design-philosophy.md にカレンダー同期アーキテクチャ（Edge Function proxy + 単一 refresh token + sharing 横読み + 将来 cron）を明文化"
      - "Auto Memory user_work_calendar.md を「3アカウント並列 OAuth」から「acesinc 単一アカウント + sharing 横読み」に修正"
      - "growth_events に countermeasure 'calendar 同期 cron 化 + cancelled 反映' を記録（parent_id は今回の failure 起票後に紐付け）"
  - to: pm
    tasks:
      - "P0/P1/P2 をチケット分割し、P1 を今 sprint、P2 を次 sprint にアサイン"
      - "Google Calendar Push Notifications (watch API) の評価チケットを次 quarter のフォーカスとして起票"
```
