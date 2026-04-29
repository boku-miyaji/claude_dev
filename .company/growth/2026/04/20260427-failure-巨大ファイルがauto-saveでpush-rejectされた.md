# 巨大ファイルがauto-saveでpush rejectされた

- **type**: `failure`
- **date**: 2026-04-27
- **category**: devops / **severity**: high
- **status**: resolved
- **source**: daily-digest
- **tags**: claude-dev, devops, operations, auto-detected, daily-digest
- **commits**: 457b4396

## what_happened
rikyuリポジトリで server/node_modules/next-swc.linux-x64-gnu.node (113MB) と .next/turbopackキャッシュ (50-84MB) が auto-save で誤ってtrackedになり、push時にGitHubの100MB制限でrejectされた。git filter-repoで履歴から削除する事故対応が発生。

## root_cause
.gitignoreにNext.js/Turbopack関連の除外が不十分で、auto-push.shにもサイズガードが無かったため、依存バイナリとビルドキャッシュがstageに混入した。

## countermeasure
(1) .gitignore に **/node_modules/, **/.next/, **/dist/, **/build/, *.tsbuildinfo を追加。(2) .claude/hooks/auto-push.sh に LARGE_FILE_THRESHOLD=45MB と node_modules/.next/dist/build/tsbuildinfo パスガードを実装。(3) .claude/rules/commit-rules.md に巨大ファイル commit ガード章を追加。(4) git filter-repo で履歴から 113MB バイナリを除去。

<!-- id: 4b43edd5-42a9-45a0-b824-ee9ec862d6f4 -->
