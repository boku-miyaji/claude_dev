# 時間見積もり・追跡・精度改善機能の追加

- **type**: `milestone`
- **date**: 2026-03-22
- **category**: automation / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: 見積もり, 計測, hook
- **commits**: 8086659, aee75a2, afe2ab9

## what_happened
タスクの所要時間を見積もり→実績追跡→精度改善するループを実装。HDレベルタスクとツール分類にも対応し、プロンプトログ拡張と company-sync-check hook を追加。

## root_cause
見積もりと実績のズレを定量評価する基盤が欠けていた

## countermeasure
pipeline_runs / prompt-log-server マイグレーションと hook を追加

## result
タスク単位で見積精度を蓄積・改善できる土台が整った

<!-- id: 9515e80c-c086-4b31-923f-95a89c4598ce -->
