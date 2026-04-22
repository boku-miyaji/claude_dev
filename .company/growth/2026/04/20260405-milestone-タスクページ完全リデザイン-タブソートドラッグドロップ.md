# タスクページ完全リデザイン — タブ・ソート・ドラッグ&ドロップ

- **type**: `milestone`
- **date**: 2026-04-05
- **category**: tooling / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: tooling, dashboard, tasks, ux, drag-and-drop, focus-you
- **commits**: 4b9c37d, fdd0b13, 5daf25e, 7553fff, 020056e

## what_happened
Tasks/Requestsのタブ切替UI、日付/優先度/期限でのソート、行クリックで編集モーダル、期限超過バッジ、ドラッグ&ドロップ並び替えを実装。さらにT/Rボタンを廃止し、ホバー時のアクションボタン（→Request / →Task / 削除）に置換。

## root_cause
旧UIはリストが単純すぎて、タスクとリクエストの区別がつきにくく、優先順位の把握も困難だった。

## countermeasure
タブUIでTask/Requestを明確に分離。各行にtype tag表示。ソートボタンでトグル方向切替。Todayページからはrequestを除外。

## result
「情報の整理 = 行動の質」。見やすいUIが意思決定の速度を上げる。ホバーアクションは「常時表示のボタン」より画面がスッキリする。

<!-- id: 37ef72b2-1424-4ea0-8569-052931dab7c5 -->
