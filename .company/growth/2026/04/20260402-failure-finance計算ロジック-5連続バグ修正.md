# Finance計算ロジック — 5連続バグ修正

- **type**: `failure`
- **date**: 2026-04-02
- **category**: tooling / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: tooling, finance, calculation, data-modeling
- **commits**: ccffbb3, 06dd65d, 61388ee, 9576550, 1553b55

## what_happened
月末日計算エラー、クライアント別グルーピングミス、重複チャート、暦月ベースの誤った売上予測、未定義CSS変数、とFinance機能だけで5つの連続fixが発生。

## root_cause
請求書データの構造（project_id vs client_name、月末日の扱い、実績月 vs カレンダー月）を十分に理解せずに集計ロジックを組んだ。

## countermeasure
実データに基づく集計に修正。月末日は専用関数で算出、グルーピングはclient_nameベース、予測は実績月のみ使用。

## result
金融・会計系のロジックは「実データの構造を先に確認」してから組むべき。カレンダー月と請求月は異なるという基本が重要。

<!-- id: aa8a2ebc-e525-4f4c-b05a-9f5f409be879 -->
