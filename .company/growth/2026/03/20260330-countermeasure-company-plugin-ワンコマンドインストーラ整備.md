# company plugin ワンコマンドインストーラ整備

- **type**: `countermeasure`
- **date**: 2026-03-30
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: plugin, install, devops
- **commits**: 2e1f726, 151394f, 52769d4, c77d7a2, 66019dc

## what_happened
プラグインキャッシュに plugin.json がなく marketplace.json だけが入っていたため skill discovery が失敗していた。plugin.json を追加し、install-company.sh を作成してマーケットプレース配下の正しいディレクトリ構造に配置する手順を確立した。

## root_cause
プラグインのディレクトリ構造と必須ファイルの理解不足

## countermeasure
plugin.json 追加 + install-company.sh（--force オプション付き）新設 + パス修正

## result
新規セッションでも一発でプラグインが有効化される状態に

<!-- id: 6babd24a-f415-4510-81b5-3b61faff6b29 -->
