# rikyu ACES環境必要性の説明根拠が弱い

- **type**: `failure`
- **date**: 2026-04-16
- **category**: process / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: rikyu, llm-retroactive, llm-classified

## what_happened
rikyuのLCインフラ費用検討で、お客さん環境にdev/stg/本番が用意されるのにACES側にも類似環境を用意する提案をしたところ、『お客さん環境の検証環境でできるのでは？』『アクセス申請・承認は保守・運用する人はいないと思う。汎用化はACESが嬉しいのであって、お客さんは興味ないのでは？』と根拠の弱さを指摘された。

## root_cause
ACES側の環境を持つ理由（再現性・説明可能性・汎用化）をお客さん視点の価値で切り分けず、ACESの都合と顧客メリットを混同した提案になっていた

## countermeasure
お客さん環境で完結できる作業と、ACES側で保持する必然性がある作業を切り分け、『顧客が払う価値』として説明できる項目のみ見積もりに残す

<!-- id: 014e0c0e-48e4-46bf-939a-57b1e4fb4641 -->
