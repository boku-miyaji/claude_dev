# モバイルUX全面改善とReact hookバグ修正

- **type**: `countermeasure`
- **date**: 2026-04-06
- **category**: quality / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: mobile, pwa, react-hooks, bugfix, claude-dev
- **commits**: 85b5d9d, 5adbbcd, 2bc37b2, 12f56a7

## what_happened
body lockクリーンアップとiOSタッチスクロール対応でモバイルスクロールフリーズを解消。Today.tsxの条件付きreturnより前にhooks移動してReact error #300を修正。artifact viewer のレスポンシブ対応とPWA強化も合わせて実施。

## root_cause
モバイル検証不足とhooks順序ルール違反

## countermeasure
CSS最適化 + hook順序修正 + PWA manifest更新

## result
モバイル操作の安定化

<!-- id: c641cce8-ffb1-4bfa-98a2-190f15f23fe2 -->
