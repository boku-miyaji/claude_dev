# クロスリポジトリ誤コミット防止ルール追加

- **type**: `countermeasure`
- **date**: 2026-03-24
- **category**: process / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: governance, git, rules, claude-dev
- **commits**: 5ff67f7

## what_happened
claude_dev に個別PJのコードを誤ってコミットするリスクへの対応として、リポジトリ判定手順と禁止事項を明文化した commit rules をドキュメント化。

## root_cause
サブディレクトリに独自 .git を持つ PJ が混在し、コミット先が曖昧だった

## countermeasure
docs に repository commit rules を追加し、コミット前に .git 確認・remote 確認を必須化

## result
PJ横断基盤と個別PJの境界が明文化され、誤コミットを未然に防ぐガードレールが整備された

<!-- id: 6d14b6f2-6e90-4a34-823a-e6c0860c747a -->
