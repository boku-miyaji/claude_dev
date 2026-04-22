# setupスクリプトからsubmodule初期化を撤去

- **type**: `countermeasure`
- **date**: 2026-01-09
- **category**: devops / **severity**: low
- **status**: active
- **source**: backfill
- **tags**: submodule, cleanup
- **commits**: 89a6c50, 1adcc2f

## what_happened
追加直後の setup-plugins.sh からsubmodule初期化処理を削除し、対応するドキュメント記述も除去。プラグイン管理方針と不整合だったため巻き戻した。

## root_cause
プラグインをsubmoduleで扱わない方針とスクリプト初版が噛み合っていなかった

## countermeasure
スクリプトとドキュメントの両方からsubmodule関連を削除

## result
setup手順が実態に整合

<!-- id: ee3d4554-674d-4d8a-9284-3058148a44e9 -->
