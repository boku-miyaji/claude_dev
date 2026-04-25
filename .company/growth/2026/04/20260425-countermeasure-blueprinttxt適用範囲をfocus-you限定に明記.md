# Blueprint.txt適用範囲をfocus-you限定に明記

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, documentation, auto-detected, daily-batch, llm-classified

## what_happened
TodoWriteのBlueprint更新確認ステップが他PJ（rikyu/polaris-circuit等）にも適用されていた誤りを指摘。CLAUDE.mdに「focus-you/company-dashboard PJ限定」と明記し、他PJには適用しない旨を追記した。

## root_cause
ルール記載時にPJスコープを明示していなかった

## countermeasure
CLAUDE.mdにIMPORTANT表記でfocus-you限定を明示

## result
PJ横断ルールとPJ固有ルールの混同を防止

<!-- id: 7b6617b0-5b46-46de-9378-17bb13f54cb5 -->
