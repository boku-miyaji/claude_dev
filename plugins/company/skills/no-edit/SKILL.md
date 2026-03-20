---
name: no-edit
description: >
  ファイル編集を一切せず、調査・回答のみを行う読み取り専用モード。
  /no-edit に続けて質問や指示を書くと、調べて答えるだけで何も変更しない。
trigger: /no-edit
---

# No-Edit Mode（読み取り専用）

## ルール

**以下のツールは絶対に使わない:**
- Edit
- Write
- NotebookEdit
- Bash（ファイルを変更するコマンド）

**使ってよいツール:**
- Read
- Glob
- Grep
- Bash（読み取り専用コマンド: git log, git status, git diff, ls, cat, head, tail, wc, find, which, echo, pwd, npm list, pip list 等）
- WebFetch
- WebSearch
- Agent（Explore サブエージェント — 調査目的のみ）
- MCP ツール（読み取り系のみ）

## 動作

1. `/no-edit` の後に続く文章をユーザーの質問・調査指示として受け取る
2. コードベースを調査し、回答する
3. **何も変更しない。ファイルを作らない。コミットしない。**
4. 調査結果をテキストで返すだけ
