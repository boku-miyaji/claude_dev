# Finance機能の3段拡張 — 固定費・API費用・ウィッシュリスト

- **type**: `milestone`
- **date**: 2026-04-05
- **category**: tooling / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: tooling, finance, subscription, api-costs, wishlist, jpy
- **commits**: 56b1335, 13576aa, 6e83495, 6447830, 683a2ba, 7d3ff7a

## what_happened
(1)固定費/サブスクリプション管理タブ追加 (2)API費用タブ追加（日本円表示）(3)ウィッシュリストタブ追加。統一的なAPIコスト追跡をsource categories付きで実装し、news収集もaiCompletion()経由に統一してコスト追跡対象に。

## root_cause
Finance機能が売上/経費のみで、サブスク管理・API費用・欲しいものリストがバラバラだった。

## countermeasure
Financeページにタブを追加し、金銭に関わる全情報を一元化。APIコストはJPY表示で直感的に把握可能に。

## result
「お金に関することはFinanceに集約」という原則で機能を整理。サブスク管理は特にフリーランスにとって重要。

<!-- id: 8758aa4f-4407-487d-820e-ef95d2652dc5 -->
