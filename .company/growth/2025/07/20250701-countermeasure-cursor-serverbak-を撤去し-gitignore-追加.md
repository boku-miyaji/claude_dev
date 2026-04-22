# .cursor-server.bak を撤去し gitignore 追加

- **type**: `countermeasure`
- **date**: 2025-07-01
- **category**: devops / **severity**: low
- **status**: active
- **source**: backfill
- **tags**: gitignore, cleanup, repo-hygiene, claude-dev
- **commits**: 6c8017f, 2abe79e

## what_happened
誤って取り込まれていた .cursor-server.bak ディレクトリ（74万行超）をリポジトリから削除し、.gitignore に追加して再混入を防止した。

## root_cause
Cursor サーバのバックアップディレクトリが git 管理下に入っていた。

## countermeasure
ディレクトリ削除コミット + .gitignore への追加で恒久対策。

## result
リポジトリサイズが大幅に縮小し、ノイズが除去された。

<!-- id: cd98edaf-b930-4880-892a-60a1ae9db0fe -->
