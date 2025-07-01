---
allowed-tools: >
  Bash(git push:*),
  Bash(gh pr create:*),
  Bash(gh pr view:*),
  Bash(gh pr merge:*),
  Bash(gh pr checks:*),
  Bash(gh pr edit:*),
  Bash(gh pr list:*),
  Bash(gh issue edit:*),
  Bash(sleep:*),
  Bash(echo:*),
  Write(*)
description: |
  実装完了後の機能ブランチをプッシュし、PR作成、マージ可能性チェック、
  レビュー準備、ステータス更新を行う。必要に応じて自動マージも実行。
---

## 実行手順 🤖

1. **引数検証と準備**

   - Issue ID を第 1 引数で受け取り（必須）
   - GitHub 認証状態を確認
   - 対象タスクの状態が`Dev`または`Review`であることを確認

2. **機能ブランチのプッシュ**

   - ブランチ名: `feature/implement-{Issue ID}`
   - リモートブランチにプッシュ（upstream 設定も含む）
     - 変更内容的にまとめられる commit はまとめて、1 つの commit でプッシュする

3. **PR 作成または更新**

   - 既存 PR がある場合は更新、無い場合は新規作成
   - PR 説明ファイル`tasks/pr/{Issue ID}_*.md`の内容を本文に使用
   - タイトル: Conventional Commits 形式
   - 必要に応じてレビュアーを指定

4. **CI/CD チェック待機**

   - PR 作成後、CI チェックの完了を待機
   - 最大 10 分程度の待機時間設定
   - チェック進行状況を定期的に表示

5. **マージ可能性チェック**

   - PR のマージ可能性を総合的に判定:
     - コンフリクトの有無
     - CI チェック結果
     - レビュー状況
   - 詳細なステータスレポートを`tasks/pr/{Issue ID}_{type}_status.md`に作成

6. **タスクステータス更新**

   - YAML ファイルを更新:
     - `state`を`Review`に変更
     - PR 番号と URL を追加
     - `updatedAt`を現在時刻に更新
   - ファイル名を`tasks/{Issue ID}_Review_{type}.yaml`にリネーム
   - GitHub ラベルを`Review`に変更

7. **自動マージ判定**

   - 全てのチェックが通過している場合:
     - 自動マージするか確認プロンプト表示
     - マージ実行時はブランチ削除も実行
     - タスクステータスを`Done`に更新

8. **完了ログ出力**

   - PR 番号と URL
   - 現在のステータス
   - 次のアクション案内
