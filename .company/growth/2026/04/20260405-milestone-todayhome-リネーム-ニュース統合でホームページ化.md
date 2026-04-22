# Today→Home リネーム + ニュース統合でホームページ化

- **type**: `milestone`
- **date**: 2026-04-05
- **category**: tooling / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: tooling, dashboard, home, news, schedule, claude-dev
- **commits**: 333ea66, 8a0241b, 98d0979

## what_happened
TodayページをHomeにリネームし、ニュースフィード機能を統合。旧Homeページを廃止して一本化。スケジュールセクションは予定がなくても常に表示（「予定なし」表示 + カレンダーリンク）するよう修正。

## root_cause
「Today」と「Home」が別ページとして存在し、どちらを見ればいいか混乱していた。

## countermeasure
Todayの機能（スケジュール・タスク）とHomeの機能（ニュース）を統合し、Homeに一本化。

## result
ページ統合で「起動したらまずここを見る」が明確に。「予定なし」の明示表示は「カレンダー接続が壊れたのか？」という不安を解消。

<!-- id: d1ca4564-db75-4740-8174-383f03e3d124 -->
