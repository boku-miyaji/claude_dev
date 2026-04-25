# Blueprint更新ルールをfocus-you限定と明示

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, rules, documentation, auto-detected, daily-batch, llm-classified

## what_happened
CLAUDE.mdのBlueprint更新確認ルールが全PJに適用されると秘書が誤解。社長から「blueprintは関係ない。focus-youに関係したもの」と指摘され、focus-you/company-dashboard PJ限定であることをCLAUDE.mdに明記する対応を実施。

## root_cause
CLAUDE.mdのルール記述で適用範囲（focus-you限定）が曖昧だった

## countermeasure
CLAUDE.mdに「focus-you / company-dashboard PJ 限定」と明示。他PJ（rikyu/polaris-circuit等）には適用しないことも併記

## result
ルール適用範囲が明確化

<!-- id: 1293ef3f-49de-4fe6-9193-34bff0b134de -->
