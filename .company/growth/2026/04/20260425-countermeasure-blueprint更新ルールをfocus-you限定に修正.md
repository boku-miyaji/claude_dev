# Blueprint更新ルールをfocus-you限定に修正

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, organization, auto-detected, daily-batch, llm-classified

## what_happened
Blueprint.tsxの更新確認ルールが全PJに適用されると誤解されていたため、社長から「blueprintは関係ない、focus-youに関係したもの。claude.mdにも書いて」と指摘。CLAUDE.mdにfocus-you/company-dashboard限定である旨を明記する対応を実施。

## root_cause
CLAUDE.mdのBlueprint更新ルールがPJスコープを明示していなかった

## countermeasure
CLAUDE.mdに「focus-you / company-dashboard PJ 限定」「他PJ（rikyu/polaris-circuit等）には適用しない」を追記

## result
ルールのスコープが明確化

<!-- id: c316f717-0351-417f-a960-d93b35f37cf5 -->
