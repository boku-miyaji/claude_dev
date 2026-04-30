# Calendar 同期 P1 設計書（実装前・社長承認待ち）

**作成日**: 2026-04-30
**部署**: システム開発部
**前提レポート**: `.company/departments/investigation/2026-04-30-calendar-sync-and-batch-failures.md`
**実装モード**: checkpoint（本書承認後に実装着手）

## 0. ゴール再掲

| タスク | 効果 |
|---|---|
| **P1-1**: cancelled イベントを DB 反映 | Google 側で削除した予定が DB / UI に伝わる |
| **P1-2**: GitHub Actions cron で `/backfill` 定期呼出 | ブラウザ非依存で同期が走る（SPOF 解消） |
| **P1-3**: `calendar_sync_state` + freshness 警告 | 同期遅延を仕組みで検知できる |

3つは独立に動かせるが、デプロイ順序は **P1-1 → P1-3 (migration) → P1-2 (workflow)** が安全（cron 始動時に新スキーマと cancelled 反映が揃った状態にしたい）。

---

## 1. 詳細設計

### P1-1: Edge Function `cancelled` イベント反映

#### 変更ファイル

`/workspace/company-dashboard/supabase/functions/google-calendar-proxy/index.ts`

#### 変更箇所と diff の要点

**(a) `handleGetEvents`（line 261-298 周辺）**

```diff
        for (const ev of data.items || []) {
-         if (ev.status === "cancelled") continue;
          const startTime = ev.start?.dateTime || ev.start?.date || "";
          const endTime = ev.end?.dateTime || ev.end?.date || "";
          const allDay = !ev.start?.dateTime;
          const calendarType: string = calId === "primary" ? "primary" : "secondary";
+         // cancelled イベントは start/end が無いことがある（Google 仕様）。
+         // DB に同期するために最低限のフィールドだけ詰める。
+         // 表示は client / dbRows 両方とも cancelled をフィルタ。
+         const isCancelled = ev.status === "cancelled";
          const eventRow = {
            id: ev.id,
            calendar_id: calId,
            calendar_type: calendarType,
            summary: ev.summary || "(No title)",
            start_time: startTime,
            end_time: endTime,
            all_day: allDay,
            status: ev.status,
            location: ev.location || null,
            hangoutLink: ev.hangoutLink || null,
            description: ev.description || null,
          };
-         allEvents.push(eventRow);
+         if (!isCancelled) allEvents.push(eventRow);  // UI 用 response は active のみ

          dbRows.push({
            id: ev.id,
            calendar_id: calId,
-           summary: eventRow.summary,
+           summary: ev.summary || "(No title)",
            start_time: startTime,
            end_time: endTime,
            all_day: allDay,
            location: ev.location || null,
            description: ev.description || null,
            status: ev.status,
            response_status: (ev.attendees || []).find(...)?.responseStatus || null,
            calendar_type: calendarType,
            synced_at: new Date().toISOString(),
          });
        }
```

**(b) `handleGetEvents` の `/backfill` 側（line 612 周辺）**

同じ要領で `if (ev.status === "cancelled") continue;` を外し、cancelled も `dbRows` に積む。`/backfill` は API レスポンスを返さないので `allEvents` への push 分岐は不要、すべて dbRows に入れて upsert すればよい。

#### フロント側フィルタ

クライアント側は **2層で防御**する（DB に cancelled が入っていても UI は壊れない）。

| 層 | ファイル | 変更 |
|---|---|---|
| API 層 | `src/lib/calendarApi.ts:254` | `data.events.map(...)` の前に `.filter(ev => ev.status !== 'cancelled')` を入れる。仮に Edge Function が古い動作を返しても画面側で除外される |
| 既存 | `src/hooks/useDiaryExtraction.ts:176` | 既に `.neq('status', 'cancelled')` あり。**変更不要** |
| 既存 | `src/hooks/useSelfAnalysis.ts:521` | `calendar_events` を `.select(...)` で読むだけ。要確認、現状フィルタなし → `.neq('status', 'cancelled')` を追加 |

`pages/Calendar.tsx` は `useGoogleCalendar` から流れる `events` を直接表示している。calendarApi 層でフィルタを入れれば自然に除外される。

#### テスト方針

| 種類 | 内容 |
|---|---|
| 手動 e2e | (1) Google Calendar で予定を1つ削除 → (2) `/backfill` を社長 user_id で叩く（curl） → (3) `sb.sh query "SELECT id, summary, status FROM calendar_events WHERE id='<event_id>'"` で `status='cancelled'` になっていることを確認 → (4) ブラウザでカレンダーページを開き、消えた予定が表示されないことを確認 |
| 既存自動テスト | `company-dashboard/` 配下に Calendar 関連の vitest はほぼ無いため新規追加はスコープ外（小規模ユニットテストの追加は次 sprint で検討） |
| 回帰確認 | 既存の active イベントが従来通り取れること（フロントの `events.length` が変わらないこと） |

#### リスクと cancelled 件数見積もり

- **リスク**: 過去 14 日（cron の time_min=today-14d を想定）の cancelled イベントが初回 backfill で一気に upsert される
- **見積もり方法**:
  ```bash
  # 社長環境で 1 回手動実行（Google API 直叩きは出来ないので backfill で観測）
  # Edge Function 修正前 vs 修正後の totalFetched 差分が cancelled 件数の上限
  ```
  実測値での見積もりは未取得だが、過去 30 日の active 件数（acesinc 534 / yumzzz 176 / xyz 21 = 731 件）の経験則から **cancelled は 5-15% 程度＝最大 100 件オーダー** と想定。Supabase REST upsert は chunkSize=100 で既に分割しており、payload 制限に抵触しない。
- **対策**: 初回 cron 実行は手動 dispatch で範囲を狭め（time_min=today-3d など）安全側で動かしてから 14d に広げる手順を運用に含める

---

### P1-2: GitHub Actions cron で `/backfill` 定期呼出

#### 新規ファイル

`/workspace/.github/workflows/calendar-sync.yml`

#### 構造（既存 narrator-update / morning-quote の踏襲）

```yaml
name: Calendar Sync (Every 30min)

# Google Calendar の差分を /backfill 経由で calendar_events に取り込む。
# ブラウザ依存の SPOF を解消するための定期同期バッチ。
#
# 設計:
#   - time_min = today - 14d（過去の cancelled 反映猶予）
#   - time_max = today + 60d（先2ヶ月の予定を確保）
#   - calendar_ids: 主要3カレンダー（acesinc / yumzzz / xyz）
#   - 認証: BACKFILL_SECRET（既存。Edge Function 側 env と GitHub Secrets で同じ値）
#
# コスト: API課金なし（Supabase Edge Function 内部処理 + Google API は既存 quota 内）

on:
  schedule:
    - cron: '*/30 * * * *'   # 30分ごと
  workflow_dispatch:
    inputs:
      time_min_days_ago:
        description: '過去N日（デフォルト14）'
        required: false
        default: '14'
        type: string

permissions:
  contents: read

concurrency:
  group: calendar-sync
  cancel-in-progress: false   # 同時実行は防ぐが進行中はキャンセルしない

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Resolve time range
        id: range
        env:
          INPUT_DAYS: ${{ inputs.time_min_days_ago }}
        run: |
          DAYS=${INPUT_DAYS:-14}
          # JST 起点で算出
          TIME_MIN=$(TZ=Asia/Tokyo date -d "today -${DAYS} days" +%Y-%m-%dT00:00:00+09:00)
          TIME_MAX=$(TZ=Asia/Tokyo date -d "today +60 days" +%Y-%m-%dT00:00:00+09:00)
          echo "TIME_MIN=$TIME_MIN" >> "$GITHUB_OUTPUT"
          echo "TIME_MAX=$TIME_MAX" >> "$GITHUB_OUTPUT"

      - name: Call /backfill
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          BACKFILL_SECRET: ${{ secrets.BACKFILL_SECRET }}
          FOCUS_YOU_USER_ID: ${{ secrets.FOCUS_YOU_USER_ID }}
          CAL_ACESINC: ${{ secrets.CAL_ACESINC }}      # yuta.miyaji@acesinc.co.jp
          CAL_YUMZZZ: ${{ secrets.CAL_YUMZZZ }}        # yumzzz.my6223@gmail.com
          CAL_XYZ: ${{ secrets.CAL_XYZ }}              # yuta.miyaji.xyz@gmail.com
          TIME_MIN: ${{ steps.range.outputs.TIME_MIN }}
          TIME_MAX: ${{ steps.range.outputs.TIME_MAX }}
        run: |
          # JSON 構築（jq で安全に）
          PAYLOAD=$(jq -n \
            --arg uid "$FOCUS_YOU_USER_ID" \
            --arg tmin "$TIME_MIN" \
            --arg tmax "$TIME_MAX" \
            --arg c1 "$CAL_ACESINC" \
            --arg c2 "$CAL_YUMZZZ" \
            --arg c3 "$CAL_XYZ" \
            '{user_id:$uid, time_min:$tmin, time_max:$tmax, calendar_ids:[$c1,$c2,$c3]}')

          echo "Calling /backfill: time_min=$TIME_MIN time_max=$TIME_MAX"
          HTTP_CODE=$(curl -s -o /tmp/backfill.json -w '%{http_code}' \
            -X POST "${SUPABASE_URL}/functions/v1/google-calendar-proxy/backfill" \
            -H "x-backfill-secret: ${BACKFILL_SECRET}" \
            -H "Content-Type: application/json" \
            -d "$PAYLOAD")

          cat /tmp/backfill.json
          if [ "$HTTP_CODE" != "200" ]; then
            echo "::error::backfill failed with HTTP $HTTP_CODE"
            exit 1
          fi

          # fetched / saved を summary に出す
          FETCHED=$(jq -r '.fetched // 0' /tmp/backfill.json)
          SAVED=$(jq -r '.saved // 0' /tmp/backfill.json)
          echo "::notice::backfill OK fetched=$FETCHED saved=$SAVED"
          echo "fetched=$FETCHED, saved=$SAVED" >> "$GITHUB_STEP_SUMMARY"
```

#### 必要な GitHub Secrets

| 名前 | 値 | 既存/新規 |
|---|---|---|
| `SUPABASE_URL` | `https://akycymnahqypmtsfqhtr.supabase.co` | **既存** |
| `BACKFILL_SECRET` | Edge Function env と同じシークレット | **要確認**: Edge Function 側に既に登録されているなら同値を Secrets 追加 / 無ければ新規生成して両方に同時投入 |
| `FOCUS_YOU_USER_ID` | 社長の auth user_id (UUID) | **既存** |
| `CAL_ACESINC` | `yuta.miyaji@acesinc.co.jp` | **新規** |
| `CAL_YUMZZZ` | `yumzzz.my6223@gmail.com` | **新規** |
| `CAL_XYZ` | `yuta.miyaji.xyz@gmail.com` | **新規** |

calendar_id をハードコードせず Secrets にする理由: メアド漏洩は実害ゼロだが、退職や統合でカレンダーが変わった時に workflow を編集せず Secrets だけ差し替えで完結させたい。

#### `BACKFILL_SECRET` の確認手順（実装前）

```bash
# Supabase 側に既存か確認（Edge Function env list はダッシュボードからのみ可視）
# 確認できない場合は新規生成して上書き:
openssl rand -hex 32   # → これを GitHub Secrets / Supabase env の両方に登録
```

未確認なら、社長に「既存値を流用するか、新規生成して両方更新するか」を判断してもらう（**未確定論点**参照）。

#### テスト方針

| 種類 | 内容 |
|---|---|
| ローカル | `gh workflow run calendar-sync.yml -f time_min_days_ago=1` で 1日分だけ手動実行。Actions ログで `fetched=N, saved=N` を確認 |
| 結果検証 | `sb.sh query "SELECT max(synced_at) FROM calendar_events"` で synced_at が更新されていることを確認 |
| エラー時 | `BACKFILL_SECRET` を意図的に間違えて 403 が返ることを確認（authentication 経路） |

---

### P1-3: `calendar_sync_state` テーブル + watermark + freshness 警告

#### 新規 migration

`/workspace/company-dashboard/supabase-migration-071-calendar-sync-state.sql`

```sql
-- supabase-migration-071-calendar-sync-state.sql
-- Calendar sync watermark テーブル。/backfill 完了時に upsert され、
-- ブリーフィング/freshness-policy が stale 検知に使う。

CREATE TABLE IF NOT EXISTS calendar_sync_state (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  last_sync_status text NOT NULL DEFAULT 'success',  -- 'success' | 'partial' | 'error'
  last_error text,
  fetched_count int NOT NULL DEFAULT 0,
  saved_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, calendar_id)
);

COMMENT ON TABLE calendar_sync_state IS 'Calendar sync watermark. /backfill が calendar_id ごとに upsert する。stale 検知用。';
COMMENT ON COLUMN calendar_sync_state.last_sync_status IS 'success/partial/error。partial=一部カレンダーで HTTP エラーがあったが他は OK';

-- RLS: 自分の行のみ select 可能、書き込みは service_role のみ
ALTER TABLE calendar_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_sync_state_select_own"
  ON calendar_sync_state FOR SELECT
  USING (user_id = auth.uid());

-- service_role は RLS bypass されるので明示ポリシー不要だが、
-- ingest-key 経由の REST 書き込みを許す場合は別途追加検討
```

#### Edge Function `/backfill` の改修（P1-1 と同 commit でよい）

`/backfill` 完了時、calendar_id ごとに watermark を upsert する処理を追加:

```ts
// /backfill のループ末尾、各 calId 処理後に:
const calStatus = calId in failedCalendars  // 構造は既存に合わせる
  ? "error"
  : "success";

await sb.from("calendar_sync_state").upsert({
  user_id,
  calendar_id: calId,
  last_synced_at: new Date().toISOString(),
  last_sync_status: calStatus,
  last_error: null,
  fetched_count: perCalFetched,
  saved_count: perCalSaved,
}, { onConflict: "user_id,calendar_id" });
```

現状の `/backfill` には `failedCalendars` トラッキングが無いので、`handleGetEvents` 同等のエラーキャプチャを足してから upsert する（**+15行程度**）。

#### freshness-policy.yaml への追加

`/workspace/.company/freshness-policy.yaml` に新規エントリ:

```yaml
  calendar_events_sync:
    priority: 1.7
    max_age_days: 0   # hours単位で見たいので独自閾値
    auto_update: false
    blocking: false
    check_method: supabase_query
    check_query: >
      SELECT calendar_id, last_synced_at,
             EXTRACT(EPOCH FROM (now() - last_synced_at))/3600 AS hours_stale,
             last_sync_status
      FROM calendar_sync_state
      WHERE user_id = '<FOCUS_YOU_USER_ID>'
      ORDER BY last_synced_at ASC
    stale_condition: |
      いずれかの calendar_id で last_synced_at が 2 時間以上前
      OR last_sync_status='error'
    update_action: |
      1. 警告を /company ブリーフィングに出す:
         「⚠️ Calendar 同期遅延: {calendar_id} が {hours} 時間 stale」
      2. 4 時間以上 stale なら GitHub Actions の calendar-sync workflow が落ちている可能性
         → gh run list -w calendar-sync.yml -L 5 で直近実行を確認
      3. 即時復旧したい場合:
         gh workflow run calendar-sync.yml -f time_min_days_ago=14
```

**閾値の根拠**: cron が 30 分ごとなので「2 時間 = 4 回連続失敗」を warn ライン、「4 時間 = 8 回失敗」を強警告ラインに設定。レポート提案の `4h` より厳しめにしたのは、削除イベント反映の遅延を 2h で気付きたいため。

#### ブリーフィング SQL

`/company` 起動時に走らせる stale 検知 SQL は上記 `check_query` の通り。サマリ用には:

```sql
SELECT calendar_id,
       to_char(last_synced_at AT TIME ZONE 'Asia/Tokyo', 'MM/DD HH24:MI') AS last_jst,
       round(EXTRACT(EPOCH FROM (now() - last_synced_at))/60) AS minutes_stale,
       last_sync_status
FROM calendar_sync_state
WHERE user_id = '<UID>'
ORDER BY last_synced_at ASC;
```

#### テスト方針

| 種類 | 内容 |
|---|---|
| migration | `sb.sh query "SELECT * FROM calendar_sync_state LIMIT 1"` でテーブル存在確認、空であることを確認 |
| 書き込み | calendar-sync workflow を手動 dispatch → `sb.sh query "SELECT * FROM calendar_sync_state"` で 3 行（カレンダー数分）入っていることを確認 |
| RLS | anon key で select したら `[]` が返ることを確認（自分の user_id の auth が通ってないので） |

---

## 2. デプロイ手順（順序）

ロールバック容易性を最優先した順序:

### Step 1: migration 071 を apply
```bash
# /workspace/company-dashboard/supabase-migration-071-calendar-sync-state.sql の内容を
# Management API で実行
sb.sh query "$(cat /workspace/company-dashboard/supabase-migration-071-calendar-sync-state.sql)"
# 確認
sb.sh query "SELECT count(*) FROM calendar_sync_state"   # → 0
```

理由: テーブルが先にあれば、Edge Function 改修が watermark upsert に失敗しない。失敗してもイベント同期自体は止まらない（best effort）。

### Step 2: Edge Function 改修をデプロイ（P1-1 + watermark upsert を 1 PR）

```bash
cd /workspace/company-dashboard
# index.ts 編集
supabase functions deploy google-calendar-proxy --no-verify-jwt
# 動作確認
sb.sh fn google-calendar-proxy '{}'   # 401 が返れば到達
```

git commit メッセージ案: `fix(calendar): cancelled イベントを DB 反映 + sync watermark 記録`

### Step 3: GitHub Secrets 登録

```bash
# 既存値の確認（CLI から見える範囲で）
gh secret list

# 新規追加が必要なもの（社長が gh CLI で実行）
gh secret set CAL_ACESINC --body "yuta.miyaji@acesinc.co.jp"
gh secret set CAL_YUMZZZ --body "yumzzz.my6223@gmail.com"
gh secret set CAL_XYZ --body "yuta.miyaji.xyz@gmail.com"

# BACKFILL_SECRET が無ければ新規生成して Edge Function env と GitHub Secrets に同値を投入
# （未確定論点参照）
```

### Step 4: workflow を 1 回手動 dispatch（**狭い範囲で**）

```bash
gh workflow run calendar-sync.yml -f time_min_days_ago=1
gh run watch
```

時間範囲を 1 日に絞って影響範囲を確認。saved 件数とエラーがないことをチェック。

### Step 5: 通常 cron（30分）に切替（コミット）

Step 4 が成功したら `.github/workflows/calendar-sync.yml` をそのままコミット。次の `*/30` で自動実行が始まる。

### Step 6: freshness-policy 追記をコミット

Step 5 が 30 分後に走って calendar_sync_state に行が入ることを確認してから、freshness-policy.yaml を追記してコミット（先に追記すると `/company` ブリーフィングで「データなし」警告が出る）。

---

## 3. ロールバック手順

### 3-A: workflow が暴走/誤動作した場合（最も起こりうる）

```bash
# 即時停止（cron 無効化）
gh workflow disable calendar-sync.yml

# 必要なら最後の正常コミットに戻す
git revert <calendar-sync.yml の追加コミット>
```

cron 停止だけで Edge Function 自体は動き続けるので副作用なし。

### 3-B: Edge Function 改修に問題があった場合

直前の HEAD に戻してデプロイ:

```bash
# デプロイ前 HEAD を控えておく（Step 2 直前に確認）
git log --oneline -1   # → これが安全な戻り先

# revert
git revert <Edge Function 改修コミット>
cd /workspace/company-dashboard
supabase functions deploy google-calendar-proxy --no-verify-jwt
```

**注意**: cancelled が DB に入った状態を残したくない場合のみ:
```bash
sb.sh query "DELETE FROM calendar_events WHERE status='cancelled'"
```
ただし `useDiaryExtraction.ts` 等は既に `.neq('status','cancelled')` で除外しているので、残しておいても UI 影響はゼロ。物理削除は急がない。

### 3-C: migration を revert したい場合

```sql
-- supabase-migration-071-calendar-sync-state-revert.sql（応急用、コミットしない）
DROP TABLE IF EXISTS calendar_sync_state;
```

calendar_sync_state は新規テーブルで他テーブルから FK 参照なし。安全に DROP できる。

### 3-D: BACKFILL_SECRET をローテートしたい場合

```bash
NEW=$(openssl rand -hex 32)
# Supabase Edge Function env を更新（Studio から）
gh secret set BACKFILL_SECRET --body "$NEW"
# 次の cron から新値で動く
```

---

## 4. 見積もり

| タスク | 内容 | 見積 |
|---|---|---|
| P1-1 | Edge Function 編集（cancelled 反映 + フロントフィルタ）| **30 分** |
| P1-1 テスト | 手動 e2e（Google で削除 → backfill → DB 確認 → UI 確認）| 20 分 |
| P1-3 migration | 071 SQL 作成 + apply + 確認 | 20 分 |
| P1-3 watermark upsert | Edge Function に 15 行追加（P1-1 と同 commit）| 20 分 |
| P1-2 workflow | calendar-sync.yml 新規作成 + Secrets 登録 | 30 分 |
| P1-2 dry run | 1 日範囲で手動 dispatch + ログ確認 | 15 分 |
| P1-3 freshness-policy | yaml エントリ追記 + ブリーフィング SQL 検証 | 15 分 |
| デプロイ + 統合確認 | Step1→6 順次実行 + 30 分後の自動実行確認 | 30 分（待ち時間別） |
| **合計** | | **約 3 時間**（実装 2h + 待ち 1h）|

並列化はあまり効かない（Edge Function deploy → workflow → freshness の順序依存）。

---

## 5. 未確定論点（社長判断 / リスク）

### 5-1: BACKFILL_SECRET の取り扱い（要判断）

Edge Function 側に既存の `BACKFILL_SECRET` env がある（コード上の参照あり）。値が未確認なので:

- **選択肢 A**: 既存値を流用 → Supabase Studio から env を確認し GitHub Secrets に同値投入
- **選択肢 B**: 新規生成 → `openssl rand -hex 32` の値で Edge Function env と GitHub Secrets を **同時更新**

**推奨**: B（新規生成）。既存値の用途が明確でないため、calendar-sync 専用に切る方が監査しやすい。社長判断を仰ぐ。

### 5-2: cancelled の物理削除をどうするか

DB に cancelled 行が溜まり続ける。当面は status フィルタで非表示にすれば問題ないが、長期的には:

- 案1: **保持**（履歴として残す。「いつキャンセルされたか」が監査できる）
- 案2: **30 日後に物理削除**（別バッチで `DELETE WHERE status='cancelled' AND synced_at < now() - interval '30 days'`）

**推奨**: 案1（当面）。ストレージは tasks/diary より遥かに小さいテーブルで問題にならない。

### 5-3: 主要 3 カレンダー以外の扱い

Auto Memory には 4 アカウント記載あり（acesinc/xyz/primary/gangsters）。`gangsters` は同期実績が直近 30 日でゼロ。

- 案1: **3 つだけ同期**（実績ある3つ）
- 案2: **`useUserCalendars` の動的リスト**を Edge Function 内で取得して横断

**推奨**: 案1（今 sprint）。動的リスト化は P2 で `useUserCalendars` の結果を `google_tokens.calendar_ids` に書き戻す機構が要るため、別タスク。

### 5-4: max_age_days=0 + 独自時間閾値の不整合

`freshness-policy.yaml` の既存仕様は `max_age_days` を使う。calendar は時間粒度で見たいため、`stale_condition` に時間閾値を直接書いている。`/company` のロジックで読めるかは要確認（`max_age_days: 0` で「常に check_query を見る」扱いになるはず、既存の `claude_md_size` 等が同じパターン）。

**リスク**: 既存ロジックが `max_age_days==0` を「無視」と解釈していたら警告が出ない。**実装後に `/company` で実機確認**して、ダメならポリシー側のロジックを 1 行調整する追加作業（5 分以内）。

### 5-5: 30 分間隔の妥当性

- 短い: 5 分 → Google API quota（1 user/day = 100 万 req）に余裕はあるが、Supabase Edge Function 起動コストが累積
- 長い: 60 分 → 削除反映が最大 1 時間遅れる

**推奨**: 30 分（提示通り）。30 分なら 1 日 48 回 × 3 calendars = 144 req/day、Supabase free tier の Edge Function 実行枠（500K/month）に対して無視できる量。

### 5-6: `useSelfAnalysis.ts:521` の cancelled フィルタ追加

P1-1 の副次対応だが、`calendar_events` を直接読む client コードが他にもあるかもしれない。grep で:

```
calendar_events を読む箇所:
- useDiaryExtraction.ts:172  ← 既に .neq('status','cancelled')
- useSelfAnalysis.ts:521     ← 未対応、追加必要
- Story.tsx:374              ← diary_entries.calendar_events JSON カラムを読む（別物）
```

`useSelfAnalysis.ts` は分析用なので cancelled が混入するとノイズになる。P1-1 と同 PR で対応する（**+1 行**）。

### 5-7: calendar 数が増えたとき workflow のメンテ性

Secrets を `CAL_ACESINC / CAL_YUMZZZ / CAL_XYZ` と個別に持つ設計はカレンダー追加で workflow も編集が要る。**改善案**: `CAL_IDS` を JSON 配列文字列で 1 つの secret にする。今回は 3 つなのでべた書きでも許容、ただし 4 つ目を追加する pull request で JSON 化に切り替える方が清潔。

### 5-8: 計画変更可能性

- 新たに発覚した場合のみ調整: `/backfill` の watermark upsert で `failedCalendars` トラッキング実装が思ったより重ければ P1-3 は次 sprint に切り出す可能性あり（最低限 P1-1 と P1-2 だけで「同期停止」は解消する）
- `BACKFILL_SECRET` が機密上の理由で再生成不可な場合 5-1 の案 A 強制

---

## 6. ハンドオフ

実装着手は社長承認後。承認時に確認したい質問:

1. **BACKFILL_SECRET**: 既存値流用 or 新規生成、どちらにしますか？
2. **同期対象カレンダー**: 主要 3 つ（acesinc/yumzzz/xyz）で OK？ gangsters は除外で OK？
3. **cancelled 物理削除**: 当面保持でよい？（推奨: 保持）
4. **デプロイタイミング**: 今すぐ通しで実装 → デプロイ可？ 段階的に分ける？

```yaml
# handoff
handoff:
  - to: ops
    context: |
      P1 実装着手の社長承認が下りたら、本書の Step 1-6 を順次実行する。
      実装完了後、growth_events に countermeasure を追記し、parent_id で
      同日 investigation レポートの failure に紐付ける（記録は実装後）。
    tasks:
      - "実装完了後、growth_events に countermeasure 'calendar 同期 cron 化 + cancelled 反映' を記録（手動 record.sh）"
      - "Auto Memory user_work_calendar.md を「acesinc 単一アカウント + sharing 横読み + 30分 cron」に修正"
  - to: pm
    tasks:
      - "P1-1/P1-2/P1-3 の3チケットを Supabase tasks に登録（type=task、tags=calendar,sync,p1）"
      - "P2（freshness 警告 / Push Notification 評価）は次 sprint に持ち越しチケット化"
```
