# カレンダー UTC/JST 地獄 — 5連続fix

- **type**: `failure`
- **date**: 2026-04-02
- **category**: tooling / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: tooling, calendar, timezone, utc, jst
- **commits**: 3111f2a, b1ac1d3, 0a275a7, eb5b6f9, 784576d

## what_happened
Google Calendar連携で日付が1日ずれる、時間帯が9時間ずれる、イベント作成時にUTCとJSTが混在する等の問題が5回連続でfixされた。

## root_cause
JavaScriptのDateオブジェクトがUTCベースで動くのに対し、Google Calendar APIはローカルタイムゾーンを期待する。この不一致を統一的に扱う設計がなかった。

## countermeasure
すべてのAPI呼び出しでJST(+09:00)を明示的に指定。表示側もtoLocaleStringでtimeZone: Asia/Tokyoを統一。

## result
タイムゾーン問題は「全レイヤーで統一」しないと再発する。部分的な修正は新たなバグを生む。

<!-- id: 6a09eb73-9b74-4245-ab2d-0e0cbfdd5a50 -->
