# 見積もりは根拠+月単価で説明する

- **type**: `countermeasure`
- **date**: 2026-04-20
- **category**: process / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: rikyu, documentation, llm-retroactive, llm-classified

## what_happened
Phase2とPhase3の価格差の妥当性が見えず、3行対応10人月も過剰に感じるとの指摘。対策として値段の根拠を日本語で、かつ期間がバラバラなため1ヶ月あたりの金額も併記する方針に変更。

## root_cause
見積もりが総工数と総額のみで、期間長・月単価・根拠が不可視のため妥当性判断ができなかった

## countermeasure
見積もり表に(1)日本語の根拠説明、(2)月単位コスト、(3)追加分と既存分の区別、を標準で含める

<!-- id: f82cdc67-2d08-48b9-a2b1-3cb09ad07ee6 -->
