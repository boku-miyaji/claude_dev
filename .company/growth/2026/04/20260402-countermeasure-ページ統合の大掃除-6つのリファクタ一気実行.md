# ページ統合の大掃除 — 6つのリファクタ一気実行

- **type**: `countermeasure`
- **date**: 2026-04-02
- **category**: architecture / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: architecture, ux, page-consolidation, refactor, focus-you
- **commits**: 35396ad, 42d1e1f, 462da9c, af0a6ee, 9c3845b, 1d1071c

## what_happened
ダッシュボードのタブが15以上に膨張。Inbox/Tasks/Dashboard/Portfolio/Careerが重複・中途半端な状態で並存していた。

## root_cause
機能を追加するたびに新しいタブを作り、既存タブとの関係を整理しなかった。

## countermeasure
InboxをTasksに統合、DashboardタブをHome化、Portfolioを削除してCareerに統合、OrgchartをカードUIに、Intelligence→Newsにリネーム。6つのrefactorを一気に実行。

## result
定期的な「ページ棚卸し」が必要。機能は足し算で増えるが、UXは引き算で良くなる。

<!-- id: a7455b90-c4de-45eb-81c3-e0e7f8c0c5df -->
