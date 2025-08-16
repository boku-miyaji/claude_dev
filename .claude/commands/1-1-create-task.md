---
allowed-tools: >
  Bash(date:*),
  Bash(mkdir:*),
  Bash(printf:*),
  Bash(echo:*)
description: |
  新しいローカルタスクファイルを作成する
  出力: tasks/LOCAL_<timestamp>.yaml
---

## 引数

$ARGUMENTS

## 実行手順 🤖

1. **ディレクトリの確認・作成**

   ```bash
   mkdir -p tasks
   if [ ! -d "tasks" ]; then
     echo "❌ tasksディレクトリの作成に失敗しました"
     exit 1
   fi
   ```

2. **タイムスタンプ付きファイル名の生成**

   ```bash
   NOW=$(date +%Y%m%d%H%M%S)
   FNAME="tasks/LOCAL_${NOW}.yaml"
   ```

3. **テンプレートファイルの作成**
   ```bash
   TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
   cat > "$FNAME" << EOF
   title: ""
   description: |
   ```

type: ""
state: Backlog
createdAt: "$TIMESTAMP"
updatedAt: "$TIMESTAMP"
EOF

````

4. **作成結果の確認とログ出力**
```bash
if [ ! -f "$FNAME" ]; then
  echo "❌ ファイル作成に失敗: $FNAME"
  exit 1
fi
echo "🆕 作成完了: $FNAME"
echo "📝 次のステップ: ファイルを編集後、'1-2-sync_tasks.md push'でGitHubイシューを作成"
````

## ワークフロー連携

- **次のステップ**: `1-2-sync_tasks.md push`で GitHub と同期
- **全体の流れ**: タスク作成 → 同期 → 設計 → 実装 → PR 作成
