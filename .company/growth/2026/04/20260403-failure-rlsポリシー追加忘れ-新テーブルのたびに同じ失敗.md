# RLSポリシー追加忘れ — 新テーブルのたびに同じ失敗

- **type**: `failure`
- **date**: 2026-04-03
- **category**: security / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: security, rls, checklist, migration-template, claude-dev
- **commits**: 1b034f3, dbf46b3, 769df04, 725d88e, bdd8e81, 44d5c36

## what_happened
secretary_notes, activity_log, comments, tasks など、新テーブルを作るたびにRLSポリシーの追加を忘れ、「データが読めない」「INSERTできない」問題が繰り返し発生。少なくとも6回の個別fix。

## root_cause
テーブル作成時のチェックリストがなく、CREATE TABLE と RLS ポリシー作成が別のステップとして分離していた。

## countermeasure
マイグレーションテンプレートにRLSポリシーを必ず含めるルールを策定。新テーブルは CREATE TABLE + ENABLE RLS + ポリシー作成を1つのマイグレーションに含める。

## result
「テーブルを作ったらRLSも作る」は鉄則。チェックリスト化しないと必ず忘れる。

<!-- id: 87ccb623-491f-4bbd-b290-b544e6b64405 -->
