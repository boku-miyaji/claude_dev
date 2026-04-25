# Blueprint更新ルールをfocus-you限定に修正

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, rule, documentation, auto-detected, daily-batch, llm-classified

## what_happened
CLAUDE.mdの『TodoWrite最後にBlueprint更新確認を含める』ルールが全PJに適用される表現だったため、社長から『blueprintは関係ない。focus-youに関係したもの。ちゃんとclaude.mdにも書いて』と指摘。Blueprint.tsxはfocus-you（company-dashboard）固有のページであり、rikyu/polaris-circuit等の他PJには適用すべきでない。

## root_cause
Blueprint.tsxがfocus-you固有のダッシュボードであるにも関わらず、CLAUDE.mdのルール表現が全PJに適用される形になっていた

## countermeasure
CLAUDE.mdに『IMPORTANT (focus-you / company-dashboard PJ 限定)』の条件を追記し、他PJ（aces-rikyu-sales-proposals-poc / polaris-circuit / その他）には適用しないと明記

## result
ルール適用範囲が明確化され、不要なBlueprint確認タスクの混入を防止

<!-- id: 5cd9e570-6289-4456-9cf6-a2bf4e98d70d -->
