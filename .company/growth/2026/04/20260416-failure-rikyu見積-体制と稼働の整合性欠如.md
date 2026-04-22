# rikyu見積 体制と稼働の整合性欠如

- **type**: `failure`
- **date**: 2026-04-16
- **category**: quality / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: rikyu, llm-retroactive, llm-classified

## what_happened
rikyu FY27拡張見積もりで『AE3名でなぜFY26と同じ値段？稼働率は？』『既存機能進化にSEいらないの？AEはアルゴリズム作る側でバックエンド・フロントエンドはそこまで強くない』と指摘され、人員構成と稼働率・ケイパビリティの整合性が取れていなかった。

## root_cause
FY26の稼働率・ケイパ構成とFY27体制の対応関係を丁寧に詰めず、役割分担（AE/SE、アルゴ/バック/フロント）の妥当性を検証しないまま見積もりを組んだ

## countermeasure
見積もり提示前に『人員×稼働率×ケイパビリティ』の3軸で既存フェーズとの整合性をチェックし、機能追加時のフロント・バック改修工数を必ず計上する

<!-- id: d6143438-c6d1-4f77-8d75-95024e627b5d -->
