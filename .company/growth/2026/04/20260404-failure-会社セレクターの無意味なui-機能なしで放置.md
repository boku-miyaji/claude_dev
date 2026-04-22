# 会社セレクターの無意味なUI — 機能なしで放置

- **type**: `failure`
- **date**: 2026-04-04
- **category**: process / **severity**: low
- **status**: resolved
- **source**: manual
- **tags**: architecture, ui, yagni, sidebar

## what_happened
サイドバーに「全社（HD）」の会社切替セレクターが表示されていたが、どのページでもactiveCompanyIdを参照しておらず、選択しても何も起きない状態だった。

## root_cause
将来の機能として先にUIだけ作ったが、実装が追いつかず「UIだけ存在する」状態で放置された。ユーザーに混乱を与える無意味な要素。

## countermeasure
会社セレクターを削除。必要になった時点で再追加する方針に。

## result
UIは「動く機能」とセットで追加する。スタブUIは混乱の元。YAGNI原則の再確認。

<!-- id: d484372c-1459-4914-ba76-c233e292b50c -->
