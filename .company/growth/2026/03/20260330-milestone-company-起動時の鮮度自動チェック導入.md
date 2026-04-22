# /company 起動時の鮮度自動チェック導入

- **type**: `milestone`
- **date**: 2026-03-30
- **category**: automation / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: freshness, automation, company, hook, agent-harness
- **commits**: 32b8029, ad048d3, 45633bb

## what_happened
システムで管理している情報が古くなる問題に対応し、何を起点に各データが更新されるかを整理。freshness-policy.yaml で更新頻度・優先度を定義し、/company コマンド起動時に自動で鮮度チェックを走らせる仕組みを実装した。

## root_cause
情報の更新起点がバラバラで、古いデータのまま運用判断していた

## countermeasure
freshness-policy.yaml + freshness-check.sh hook + how-it-works への鮮度マップ追加

## result
/company 起動のたびに古い情報が自動で検出・更新されるようになった

<!-- id: 1bb4dc07-753f-45bd-9333-d73a042deb02 -->
