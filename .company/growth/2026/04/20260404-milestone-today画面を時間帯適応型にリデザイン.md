# Today画面を時間帯適応型にリデザイン

- **type**: `milestone`
- **date**: 2026-04-04
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: UX, Today, time-adaptive
- **commits**: 2dfa168, ec3cd80, 8055ad8

## what_happened
Today画面を時間帯（朝/昼/夜）に応じて構成が変わる適応型UIにリデザイン。天気・明日のスケジュール・パーソナライズドAIコメントを統合し、タスクとhabitsを統一Actionsブロックにまとめた。

## root_cause
朝と夜で求める情報が異なるのに同じレイアウトだったため、時間帯ごとに最適化する必要があった

## countermeasure
timeMode.ts を新設し、時間帯判定ロジックを共通化。UX設計書を先に書いてから実装

## result
時間帯ごとに最適化された情報提示が可能に

<!-- id: 8b367a28-22f1-46a9-88d6-48638cea6743 -->
