---
allowed-tools: >
  Bash(gh issue list:*),
  Bash(gh issue view:*),
  Bash(gh issue create:*),
  Bash(gh label create:*),
  Bash(mkdir:*),
  Bash(mv:*),
  Bash(echo:*)
description: |
  ローカルタスクファイルとGitHub Issuesの双方向同期
  • Pull: GitHubの全Issue → tasks/{#}_{STATE}_{TYPE}.yaml
  • Push: LOCAL_*.yamlのドラフト → GitHub Issue作成
---

## 実行手順 🤖

1. **引数検証と GitHub 認証確認**

   ```bash
   # 引数の処理
   if [ -z "$1" ]; then
     MODE="both"  # pullとpush両方実行
   elif [ "$1" = "pull" ]; then
     MODE="pull"
   elif [ "$1" = "push" ]; then
     MODE="push"
   else
     echo "❌ エラー: 引数は 'pull', 'push', または空欄のみ対応"
     echo "使用法: コマンド [pull|push]"
     exit 1
   fi

   # GitHub認証確認
   if ! gh auth status > /dev/null 2>&1; then
     echo "❌ エラー: GitHub認証が必要です"
     echo "実行してください: gh auth login"
     exit 1
   fi

   echo "🔄 同期モード: $MODE"
   ```

### 2. **Pull 実行時（$MODE が"pull"または"both"の場合）**

1. **準備**

   - `tasks/`ディレクトリを作成
   - GitHub から全 Issue を取得して件数を表示

2. **各 Issue 処理**

   - Issue 詳細（title, body, labels, state, 日時）を取得
   - CLOSED な Issue は対応するローカルファイルを削除してスキップ
     対応する `tasks/design/{Issue ID}_\*.md`, `tasks/pr/{Issue ID}_\*.md` も削除する
   - OPEN な Issue のみ処理を続行

3. **ファイル作成・更新判定**

   - STATE: ラベルから判定（Backlog, Design, Dev, Review, Done。デフォルト: Backlog）
   - TYPE: "TYPE:"ラベルから判定（デフォルト: Task）
   - ファイル名: `tasks/{#}_{STATE}_{TYPE}.yaml`
   - 既存ファイルと GitHub 更新日時を比較して、新規/更新/スキップを判定

4. **ファイル出力**

   - YAML 形式で`issue, title, description, type, state, createdAt, updatedAt`を記録
   - 同一 Issue 番号の古いファイルは削除（1 つの Issue に 1 つのファイル）
   - 処理結果を`PULL: 新規/更新/スキップ → ファイル名`形式で表示

   ```yaml example
   issue: 1
   title: "test"
   description: |
     test various function
   type: Feature
   state: Backlog
   createdAt: "2025-06-29T08:28:36Z"
   updatedAt: "2025-06-29T08:28:36Z"
   ```

※example bash script

```bash
echo "=== Pulling GitHub issues to local files ==="
echo ""

# 全Issueを取得
gh issue list --limit 100 --state all --json \
  number,title,body,labels,state,createdAt,updatedAt > /tmp/issues.json

echo "Number of issues found: $(jq 'length' /tmp/issues.json)"

for i in $(jq -r '.[].number' /tmp/issues.json); do
    echo ""
    echo "Processing issue #$i..."

    # Issue詳細取得
    gh issue view "$i" --json \
      number,title,body,labels,state,createdAt,updatedAt \
      > "/tmp/issue_$i.json"

    # 実際のIssueステートを取得（OPEN or CLOSED）
    issue_state=$(jq -r '.state' "/tmp/issue_$i.json")
    if [ "$issue_state" = "CLOSED" ]; then
        echo "PULL: ↷ スキップ (closed #$i)"
        continue
    fi

    # 以下、OPEN Issueのみ処理
    title=$(jq -r '.title // ""' "/tmp/issue_$i.json")
    body=$(jq -r '.body // ""'  "/tmp/issue_$i.json")

    # ラベルからSTATE判定（無ければBacklog）
    state_label=$(jq -r '.labels[].name' "/tmp/issue_$i.json" \
      | grep -E "^(Backlog|Design|Dev|Review|Done|IceBox)$" \
      | head -1 || echo "Backlog")

    # ラベルからTYPE判定（無ければTask）
    type_label=$(jq -r '.labels[].name' "/tmp/issue_$i.json" \
      | grep -i "^TYPE:" \
      | sed 's/^TYPE: *//I' \
      | head -1 || echo "Task")

    created=$(jq -r '.createdAt' "/tmp/issue_$i.json")
    updated=$(jq -r '.updatedAt' "/tmp/issue_$i.json")

    # 出力ファイル名
    filename="tasks/${i}_${state_label}_${type_label}.yaml"

    # YAML生成
    {
      echo "issue: $i"
      echo "title: \"$title\""
      echo "description: |"
      echo "$body" | sed 's/^/  /'
      echo "type: $type_label"
      echo "state: $state_label"
      echo "createdAt: \"$created\""
      echo "updatedAt: \"$updated\""
    } > "$filename"

    echo "PULL: 新規/更新 → $filename"
done
```

### 3. **Push 実行時（$MODE が"push"または"both"の場合）**

1. **対象ファイル検索**

   - `tasks/LOCAL_*.yaml`ファイルを検索
   - 見つからない場合はスキップ

2. **各ドラフトファイル処理**

   - YAML ファイルから`title, description, type`を読み取り
   - 空欄の場合は推論して補完：
     - TITLE: description から最適なタイトルを生成
     - TYPE: description から判定（Bug, Feature, Task のいずれか）
   - 補完した値は YAML ファイルにも記録

3. **GitHub Issue 作成**

   - `gh issue create`で Issue 作成
   - ラベル: `TYPE: {TYPE}`, `Backlog`を付与
   - 作成された Issue 番号を取得

4. **ファイル管理**

   - `LOCAL_*.yaml` → `tasks/{#}_Backlog_{TYPE}.yaml`にリネーム
   - YAML に issue 番号と最新の updatedAt を追記
   - `PUSH: 新規 → tasks/{#}_Backlog_{TYPE}.yaml`を表示

   ```yaml example
   issue: 1
   title: "test"
   description: |
     test various function
   type: Feature
   state: Backlog
   createdAt: "2025-06-29T08:28:36Z"
   updatedAt: "2025-06-29T08:28:36Z"
   ```

※example bash script

```bash
echo "=== Pushing local draft to GitHub ==="
echo ""

# Read the local draft file
title="miyaji"
body="miyajiyuta"
state="Backlog"
type="Task"  # Default to Task since type is empty

echo "Creating new issue:"
echo "Title: $title"
echo "Body: $body"
echo "Labels: $state, TYPE: $type"
echo ""

# Create the issue
gh issue create --title "$title" --body "$body" --label "$state" --label "TYPE: $type"
```

```bash
echo "=== Updating local file after sync ==="
echo ""

# Move the LOCAL file to the proper numbered file
mv /workspace/app_youtube_translater/tasks/LOCAL_20250629104223.yaml
/workspace/app_youtube_translater/tasks/8_Backlog_Task.yaml

# Update the file to include the issue number
cat > /workspace/app_youtube_translater/tasks/8_Backlog_Task.yaml << 'EOF'
issue: 8
title: "miyaji"
description: |
miyajiyuta
type: Task
state: Backlog
createdAt: "2025-06-29T08:28:36Z"
updatedAt: "2025-06-29T10:42:36Z"
EOF

echo "Updated local file: 8_Backlog_Task.yaml"
```

### 4. **実行完了サマリー**

- Pull/Push の実行結果を 1 行で表示
- 例: `Pull: 新規2件 更新1件 | Push: 新規3件`
- 最後に `✅ sync-tasks 完了` を表示
