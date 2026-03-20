---
name: permission
description: >
  Claude Code のパーミッションレベルをワンコマンドで切り替える。
  full / safe / strict の3段階 + show / add / remove で個別管理。
  PermissionRequest Hook により、セッション内で即座に反映される。
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

## 仕組み（2段構え）

Claude Code の settings.json は**セッション起動時にしか読み込まれない**。
そのため、セッション途中で settings.json を書き換えても権限は変わらない。

このスキルは2つの仕組みを併用して、**即座に反映**させる:

```
/permission safe
  ↓
(1) .claude/hooks/permission-level.conf に "safe" を書き込む
  ↓ → PermissionRequest Hook が毎回このファイルを読む
  ↓ → 権限確認ダイアログが出る前に allow/deny を自動判定
  ↓ → 今のセッションで即座に反映される ✅
  ↓
(2) .claude/settings.json の permissions を書き換える
  ↓ → 次のセッションのデフォルトとして永続化
  ↓ → config-sync Hook でダッシュボードにも反映
```

### PermissionRequest Hook の動作

`.claude/hooks/permission-guard.sh` が権限確認の直前に実行される:

| レベル | Hook の挙動 |
|--------|-----------|
| **full** | 全ツールに `{"behavior": "allow"}` を返す → ダイアログ出ない |
| **safe** | 破壊的コマンドのみスキップ（通常のダイアログ表示）→ それ以外は `allow` |
| **strict** | Hook は介入しない → settings.json の allow リストに基づく通常動作 |

---

## 実行手順

### Step 1: 引数を解析

引数がない場合 → `show` として扱う。

### Step 2: permission-level.conf を書き込む

**全レベル共通で、まず以下を実行する:**

`.claude/hooks/permission-level.conf` にレベル名を書き込む:

```bash
# full の場合
echo "full" > .claude/hooks/permission-level.conf
```

これにより **PermissionRequest Hook が即座に新しいレベルで動作する。**

### Step 3: settings.json を書き換える（永続化）

### Step 4: 結果を表示する

---

### `show` — 現在の設定を表示

1. `.claude/hooks/permission-level.conf` を読む（なければ "未設定"）
2. `.claude/settings.json` の permissions を読む
3. 以下を整理して表示:

```
📋 Permission Level: safe（セッション内で有効）

✅ Allow (自動許可):
  Hook が破壊的操作以外を全て自動許可

🚫 Deny (ブロック / 確認):
  - rm -rf / rm -r
  - git push --force / git reset --hard
  - DROP TABLE / TRUNCATE
  - kill -9 / pkill
  - chmod 777

⚠️  .git / .claude への書き込みは常に確認（Claude Code 仕様）
```

---

### `full` — 全許可モード

**Step 2: permission-level.conf**
```
echo "full" > .claude/hooks/permission-level.conf
```

**Step 3: settings.json の permissions を以下に書き換える:**

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

表示:
```
🔓 Permission: full（全許可モード）- 即座に反映済み

全ツールが確認なしで実行されます。
⚠️ .git / .claude への書き込みのみ確認が出ます（Claude Code の仕様）。

元に戻す: /permission safe
```

---

### `safe` — 破壊的操作のみ確認

**Step 2: permission-level.conf**
```
echo "safe" > .claude/hooks/permission-level.conf
```

**Step 3: settings.json の permissions を以下に書き換える:**

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

表示:
```
🛡️ Permission: safe（破壊的操作のみ確認）- 即座に反映済み

ほとんどのツールが確認なしで実行されます。
以下の操作は確認ダイアログが出ます:
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

**Step 2: permission-level.conf**
```
echo "strict" > .claude/hooks/permission-level.conf
```

**Step 3: settings.json の permissions を以下に書き換える:**

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

表示:
```
🔒 Permission: strict（ホワイトリスト管理）- 即座に反映済み

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
3. 表示:
```
✅ Added to allow: Bash(docker compose:*)
```

### `remove <pattern>` — allow から削除

1. `.claude/settings.json` の `permissions.allow` から pattern を削除
2. 存在しなければ通知
3. 表示:
```
🗑️ Removed from allow: Bash(docker compose:*)
```

### `deny <pattern>` — deny に追加

1. `.claude/settings.json` の `permissions.deny` に pattern を追加（deny キーがなければ作成）
2. 重複チェック
3. 表示:
```
🚫 Added to deny: Bash(curl:*)
```

### `undeny <pattern>` — deny から削除

1. `.claude/settings.json` の `permissions.deny` から pattern を削除
2. 存在しなければ通知
3. 表示:
```
✅ Removed from deny: Bash(curl:*)
```

---

## 重要な実装ルール

1. **必ず permission-level.conf を先に書き換える**: これがセッション内で即座に反映される仕組みの核
2. **settings.json は永続化用**: 次のセッションのデフォルトとダッシュボード同期のため
3. **additionalDirectories は維持**: レベル切り替え時に既存の additionalDirectories を消さない
4. **hooks は維持**: レベル切り替え時に hooks セクションを消さない
5. **他のセクションは維持**: `enabledPlugins`, `extraKnownMarketplaces`, `env`, `feedbackSurveyState` 等はそのまま
6. **permissions セクションのみ書き換え**: `defaultMode`, `allow`, `deny` の3キーだけ変更する
7. **変更後に show を実行**: レベル切り替え後は自動で現在の設定を表示する
8. **config-sync hook が同期**: 次のセッションでダッシュボードに反映される（手動同期不要）

---

## 制約事項（正直に）

- **deny ルールは Hook より優先**: settings.json の deny ルールは PermissionRequest Hook の `allow` より強い。safe モードで Hook が allow を返しても、settings.json に deny があればブロックされる
- **full モードでも `.git` / `.claude` 書き込みは確認が出る**: Claude Code のハードコード仕様で回避不可
- **strict モードの Hook は介入しない**: settings.json の allow/deny リストに完全に依存する
