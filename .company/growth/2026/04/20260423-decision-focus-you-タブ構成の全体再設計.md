# focus-you タブ構成の全体再設計

- **type**: `decision`
- **date**: 2026-04-23
- **category**: architecture / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: focus-you, ui, frontend, auto-detected, daily-digest
- **commits**: ed277b6, 0f55812

## what_happened
focus-you ダッシュボードのタブ構成について、重複する役割や不明瞭な領域が散在している問題を受け、タブ全体を上流下流の観点から再整理する方針を決定。system-spec ドキュメントも同じ観点で再整理し、requests 機能は日記反応のみに簡素化する判断も同時に実施。

## root_cause
機能追加を続けるうちにタブ間の責務境界が曖昧になり、どこで何ができるか迷う状態になっていた

## result
タブ構成の整理方針が決定し、関連ドキュメントが更新された

<!-- id: 6d1708bc-0e85-4cb1-8054-715c1b05df02 -->
