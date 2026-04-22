# Newsレポート — クリック展開の3連続バグ

- **type**: `failure`
- **date**: 2026-04-02
- **category**: tooling / **severity**: low
- **status**: resolved
- **source**: manual
- **tags**: tooling, news, legacy, dom-manipulation
- **commits**: ff44531, 313d8c7, 1f94f45

## what_happened
Newsレポートをクリックしても開かない→修正→2個目以降が開けない→修正→個別取得方式に変更、と3回の修正が必要だった。

## root_cause
レガシーSPAのDOM操作で、イベントリスナーの付け方とデータの取得タイミングが噛み合っていなかった。全件一括取得→メモリ展開の設計が大量データに対応できなかった。

## countermeasure
クリック時に個別取得する方式（遅延読み込み）に変更。

## result
レガシーコードへの機能追加は「動く最小実装」でも複数回のfixが必要になる。React移行の動機付けになった。

<!-- id: 1595debf-3e97-4cae-8787-2b9481ad57b3 -->
