---
name: permission
description: >
  Claude Code のパーミッションレベルをワンコマンドで切り替える。
  full / safe / strict の3段階 + show / add / remove で個別管理。
trigger: /permission
---

# Permission Manager

## いつ使うか

- `/permission full` — 全許可モード（確認なし）
- `/permission safe` — 破壊的操作のみ確認
- `/permission strict` — ホワイトリストのみ許可
- `/permission show` — 現在の設定を表示
- `/permission add <pattern>` — allow に追加
- `/permission remove <pattern>` — allow から削除
- `/permission deny <pattern>` — deny に追加
- `/permission undeny <pattern>` — deny から削除

---

## 実行手順

### Step 1: 引数を解析

引数がない場合 → `show` として扱う。

### Step 2: レベル別の処理

---

### `show` — 現在の設定を表示

1. `.claude/settings.json` を読み込む
2. 以下を整理して表示:

```
📋 Permission Level: safe

✅ Allow (自動許可):
  - Bash(npm:*)
  - Bash(git:*)
  - Read
  - Edit
  - Write
  ...

🚫 Deny (ブロック):
  - Bash(rm -rf:*)
  ...

⚠️  それ以外 → 確認ダイアログが出る
```

---

### `full` — 全許可モード

**settings.json の permissions を以下に書き換える:**

```json
{
  "permissions": {
    "defaultMode": "bypassPermissions",
    "allow": [],
    "deny": [],
    "additionalDirectories": ["{{既存の additionalDirectories を維持}}"]
  }
}
```

**注意**: `bypassPermissions` でも `.git`, `.claude`, `.vscode`, `.idea` への書き込みは確認される（Claude Code の仕様）。

書き換え後のメッセージ:
```
🔓 Permission: full（全許可モード）

全ツールが確認なしで実行されます。
⚠️ .git / .claude への書き込みのみ確認が出ます（Claude Code の仕様）。

元に戻す: /permission safe
```

---

### `safe` — 破壊的操作のみ確認

**settings.json の permissions を以下に書き換える:**

```json
{
  "permissions": {
    "defaultMode": "bypassPermissions",
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(rm -r:*)",
      "Bash(git push --force:*)",
      "Bash(git push -f:*)",
      "Bash(git reset --hard:*)",
      "Bash(git clean:*)",
      "Bash(git checkout -- :*)",
      "Bash(git branch -D:*)",
      "Bash(drop table:*)",
      "Bash(DROP TABLE:*)",
      "Bash(truncate:*)",
      "Bash(TRUNCATE:*)",
      "Bash(kill -9:*)",
      "Bash(pkill:*)",
      "Bash(chmod 777:*)",
      "Bash(> /dev:*)"
    ],
    "allow": [],
    "additionalDirectories": ["{{既存の additionalDirectories を維持}}"]
  }
}
```

書き換え後のメッセージ:
```
🛡️ Permission: safe（破壊的操作のみブロック）

ほとんどのツールが確認なしで実行されます。
以下の操作はブロック（deny）されます:
  - rm -rf / rm -r（再帰削除）
  - git push --force / git reset --hard（Git破壊操作）
  - DROP TABLE / TRUNCATE（DB破壊操作）
  - kill -9 / pkill（プロセス強制終了）
  - chmod 777（危険なパーミッション変更）

deny リストの調整: /permission deny <pattern> / /permission undeny <pattern>
元に戻す: /permission strict
```

---

### `strict` — ホワイトリスト管理

**settings.json の permissions を以下に書き換える:**

```json
{
  "permissions": {
    "defaultMode": "default",
    "allow": [
      "Read",
      "Bash(git status)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git branch:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(wc:*)",
      "Bash(which:*)",
      "Bash(echo:*)",
      "Bash(pwd)",
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(npm install:*)",
      "Bash(npx:*)",
      "Bash(python3:*)",
      "Bash(pip:*)"
    ],
    "deny": [],
    "additionalDirectories": ["{{既存の additionalDirectories を維持}}"]
  }
}
```

書き換え後のメッセージ:
```
🔒 Permission: strict（ホワイトリスト管理）

以下のツールのみ確認なしで実行されます:
  - Read（全ファイル読み取り）
  - git status / log / diff / branch
  - ls / cat / head / tail / wc / which / echo / pwd
  - npm run / test / install / npx
  - python3 / pip

それ以外の操作（Edit, Write, Bash の未登録コマンド）は確認が出ます。

allow の追加: /permission add Bash(docker compose:*)
allow の削除: /permission remove Bash(docker compose:*)
```

---

### `add <pattern>` — allow に追加

1. `.claude/settings.json` の `permissions.allow` に pattern を追加
2. 重複チェック（既にあればスキップ）
3. 変更後のメッセージ:
```
✅ Added to allow: Bash(docker compose:*)
```

### `remove <pattern>` — allow から削除

1. `.claude/settings.json` の `permissions.allow` から pattern を削除
2. 存在しなければ通知
3. 変更後のメッセージ:
```
🗑️ Removed from allow: Bash(docker compose:*)
```

### `deny <pattern>` — deny に追加

1. `.claude/settings.json` の `permissions.deny` に pattern を追加（deny キーがなければ作成）
2. 重複チェック
3. 変更後のメッセージ:
```
🚫 Added to deny: Bash(curl:*)
```

### `undeny <pattern>` — deny から削除

1. `.claude/settings.json` の `permissions.deny` から pattern を削除
2. 存在しなければ通知
3. 変更後のメッセージ:
```
✅ Removed from deny: Bash(curl:*)
```

---

## 重要な実装ルール

1. **settings.json の編集**: `Edit` ツールで `.claude/settings.json` を直接編集する
2. **additionalDirectories は維持**: レベル切り替え時に既存の additionalDirectories を消さない
3. **hooks は維持**: レベル切り替え時に hooks セクションを消さない
4. **他のセクションは維持**: `enabledPlugins`, `extraKnownMarketplaces`, `env`, `feedbackSurveyState` 等はそのまま
5. **permissions セクションのみ書き換え**: `defaultMode`, `allow`, `deny` の3キーだけ変更する
6. **変更後に show を実行**: レベル切り替え後は自動で現在の設定を表示する
7. **config-sync hook が同期**: 次のセッションでダッシュボードに反映される（手動同期不要）
