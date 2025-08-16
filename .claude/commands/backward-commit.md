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
  Issue IDを指定して、コミットを元に戻す.
---

## 引数

$ARGUMENTS

## 実行手順

1.  **引数検証と準備**

    - 第 1 引数で Issue ID を受け取り
    - 第 2 引数で戻すコミット数を受け取り
      もしなければ１つのコミットを戻す
    - 対象タスクの状態が`Dev`であることを確認

2.  **機能ブランチの作成・切り替え**

    - ブランチ名: `feature/implement-{Issue ID}`に切り替え。

3.  **コミットを元に戻す**

    - 指定されたコミット数分、コミットを元に戻す。デフォルトは１つのコミットを戻す

4.  **PR 関連ファイル作成/更新**

    - 対象コミットの`tasks/pr/{Issue ID}_{type}_diff_{YYYYMMDDHHMMSS}.md`を`tasks/pr/Delete/{Issue ID}_{type}_diff_{YYYYMMDDHHMMSS.md`にリネーム

5.  **タスクステータス更新**

    - YAML ファイルを更新:
      - `updatedAt`を現在時刻に更新
      - `implementation`情報を更新
        対象コミットに`Delete`を追加

6.  **完了ログ出力**

    - ブランチ名とコミット削除状況を表示
    - 次のステップ（4-reimplement.md or 6-push-pr.md）への案内
