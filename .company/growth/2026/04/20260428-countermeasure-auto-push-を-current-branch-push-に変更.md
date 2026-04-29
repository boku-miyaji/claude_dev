# auto-push を current branch push に変更

- **type**: `countermeasure`
- **date**: 2026-04-28
- **category**: automation / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, hook, automation, auto-detected, daily-digest
- **commits**: cc71095c

## what_happened
auto-push hook が main 固定で push していたため feature ブランチでの作業時に挙動が不整合だった。current branch を push する形に変更し、ブランチ運用と整合させた。

## root_cause
auto-push.sh が `git push origin main` 固定だった。

## countermeasure
current branch を取得して push する実装に変更。

## result
feature ブランチで作業中も auto-save が正しい branch に push されるようになった。

<!-- id: 5455f626-b2d0-491e-89ce-ffa46a543a8e -->
