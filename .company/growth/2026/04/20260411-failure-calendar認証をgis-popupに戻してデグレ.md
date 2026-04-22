# Calendar認証をGIS popupに戻してデグレ

- **type**: `failure`
- **date**: 2026-04-11
- **category**: architecture / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: calendar, auth, デグレ, 設計判断

## what_happened
legacy→React移行時、Edge Function proxy認証がうまく動かず、GIS popup+localStorageに戻した。1時間でトークンが切れる既知の問題を再発させた。

## root_cause
proxy認証のバグ（google_tokensにトークンが保存されない）を調査せず、方式ごと変更してしまった。過去の設計判断の経緯を記憶していなかった。

## countermeasure
1. メモリに恒久ルールとして記録（方式を変えない）。2. バグは方式内で修正する原則を徹底。3. 変更前に過去の経緯を確認する。

<!-- id: aacd3091-42f5-43c5-b0c8-ca8f82f03a2f -->
