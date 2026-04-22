# 統一APIコストトラッキング + 6段階モデルルーティング

- **type**: `milestone`
- **date**: 2026-04-05
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: ai-cost, model-routing, finance, claude-dev
- **commits**: 6447830, d035d9c, 13576aa, 6e83495, 683a2ba

## what_happened
AI呼び出しのコストをsourceカテゴリ別に一元記録する仕組みを導入し、FinanceページにAPI Costsタブ(JPY表示)を追加。同時にタスク複雑度に応じた6-tier自動モデルルーティングを実装。news-collect等の既存呼び出しもaiCompletion()経由に統一。

## root_cause
コスト可視化がなく、またモデル選択が単純で無駄な高コスト呼び出しが発生していた

## countermeasure
aiCompletion()ラッパーに集約 + 6段階ルーティング + 円換算UI

## result
コスト分離原則（ダッシュボード=nano等）を実運用で担保できる状態に

<!-- id: be3b3289-8dba-4490-8d1a-ff8c449f7142 -->
