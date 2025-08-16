---
allowed-tools: >
  Bash(date:*),
  Bash(mkdir:*),
  Bash(cat:*),
  Bash(printf:*),
  Bash(echo:*)
description: |
  Given an Issue ID, load the corresponding `tasks/{ID}_*.yaml` file and draft a single “設計” Markdown file.
  After that, update the original YAML to reflect the new state and document path.
---

## 引数

$ARGUMENTS

## 実行手順

1. **引数検証と準備**

   - 第 1 引数で Issue ID を受け取り（ID がなければエラー）
   - 第 2 引数以降で追加の設計指示があれば考慮
   - GitHub 認証状態を確認
   - 対象タスクの状態が`Backlog`または`Design`であることを確認
   - `Design`の場合は設計し直しを実施する

2. **Locate the YAML**

   - Find exactly one matching file:
     ```bash
     src="tasks/${ARGUMENTS}_*.yaml"
     ```
   - If zero or multiple matches,
     ```bash
     echo "ERROR: tasks/${ARGUMENTS}_*.yaml not found or ambiguous"
     exit 1
     ```

3. **Read metadata**

   - Parse the YAML to extract:
     - `title`
     - `description`
     - `type`

4. **出力ディレクトリ準備**

   - Create `tasks/design/` if it doesn’t exist:
     ```bash
     mkdir -p tasks/design
     ```

5. **設計ドキュメント生成**

   - ファイル名: `tasks/design/{Issue ID}_{type}.md`
   - **ultrathink**で深く設計を考察すること
   - テンプレート構成:
     - フロントマター（issue, title, type, description）
     - 概要・要件分析
     - 技術設計（アーキテクチャ、実装詳細、データモデル）
     - テスト戦略（必須）
     - セキュリティ・パフォーマンス考慮事項
     - 未解決の設計課題

6. **YAML ファイル更新**

   - 元の YAML ファイルを更新:
     - `updatedAt`を現在時刻に更新
     - `state`を`Design`に変更
     - `design`フィールドに設計ドキュメントパスを追加
   - ファイル名を`tasks/{Issue ID}_Design_{type}.yaml`にリネーム

7. **GitHub ラベル更新**

   - Issue のステータスラベルを`Design`に変更
   - 古いステータスラベル（Backlog 等）を削除
   - TYPE ラベル（Bug, Feature, Task）はそのまま維持

8. **完了ログ出力**

   - 作成した設計ドキュメントパス
   - 更新した YAML ファイルパス
   - GitHub ステータス変更内容を表示
