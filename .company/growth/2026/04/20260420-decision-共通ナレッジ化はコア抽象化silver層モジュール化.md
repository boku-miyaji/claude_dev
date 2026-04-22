# 共通ナレッジ化はコア抽象化+silver層モジュール化

- **type**: `decision`
- **date**: 2026-04-20
- **category**: architecture / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: rikyu, architecture, llm-retroactive, llm-classified

## what_happened
共通ナレッジ化はPhase毎明細を出さずゴール状態のみ定義。F1-F8コア機能をユースケース非依存で抽象化、他ユースケース候補を洗い出し、silver層データモデル/加工モジュールの設計方針を策定する。

<!-- id: ef28e8db-4935-4fe4-b65a-84041ca46c34 -->
