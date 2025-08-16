---
allowed-tools: >
  Bash(git branch:*),
  Bash(git checkout:*),
  Bash(git add:*),
  Bash(git commit:*),
  Bash(echo:*),
  Bash(mkdir:*),
  Bash(cat:*),
  Write(*),
  MultiEdit(*)
description: |
  Issue IDを指定して、設計ドキュメントに基づいた実装を行う。
  機能ブランチの作成、コード実装、テスト実行、コミット、PR準備を含む。
---

## 引数

$ARGUMENTS

## 実行手順

1. **引数検証と準備**

   - 第 1 引数で Issue ID を受け取り（必須）
   - 対象タスクの状態が`Dev`であることを確認

2. **機能ブランチの作成・切り替え**

   - ブランチ名: `feature/implement-{Issue ID}`に切り替え

3. **PR 関連ファイル作成**

   - 今回の PR 差分の要約を`tasks/pr/{Issue ID}_commits/{YYYYMMDDHHMMSS}.md`を収集し、PR 説明ファイル`tasks/pr/{Issue ID}_{type}.md`を更新。
     - **この PR ファイルは commit 毎に章を分けて記載するのではなく、対象の commit 全てを包括して記載する。以前の更新内容・最新の更新内容などで章分けをせずに全てをまとめて記載する。**
       - 実装した機能一覧
       - テスト結果
       - 変更ファイル一覧
       - [必須] 人間が最終チェックすべき項目
       - etc...

4. **PR レビューファイルを更新**

   - [ultrathink]PR のレビューを世界最高峰のプログラマー視点で行う。可読性・保守性・拡張性を考慮してレビューする。
   - PR レビューファイル`tasks/pr/{Issue ID}_{type}_review.md`を更新
     - レビュー結果
     - 人間が最終チェックするべき機能

5. **タスクステータス更新**

   - YAML ファイルを更新:

     - `updatedAt`を現在時刻に更新
     - `implementation`情報（ブランチ、コミット）を追加

6. **完了ログ出力**

   - ブランチ名とコミット状況を表示
   - 次のステップ（6-push-pr.md）への案内
