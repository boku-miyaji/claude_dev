# auto-pushに巨大ファイル/build artifactsガードを追加

- **type**: `countermeasure`
- **date**: 2026-04-27
- **category**: devops / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, hook, operations, devops, auto-detected, daily-digest
- **commits**: 457b4396

## what_happened
auto-save Stop hookでcommit直前にnode_modules/、.next/、dist/、build/、*.tsbuildinfo、*.log、45MB超のファイルをstageから除外する防御層を実装。除外検知は/tmp/auto-push-blocked.jsonに記録され、SessionStart hookで警告表示。.gitignoreの必須項目もrules化した。

## countermeasure
.claude/hooks/auto-push.shでサイズ・パスベース除外を実装、commit-rules.mdに巨大ファイルガード運用を追記、SessionStart hook (auto-push-status-check.sh) で次セッション時に通知。

## result
GitHub 50MB警告ライン手前で自動防御。.gitignore漏れがあってもpush rejectを未然に防ぐ多層防御が完成。

<!-- id: 0ad53efc-4b16-40fe-b270-ad855398be05 -->
