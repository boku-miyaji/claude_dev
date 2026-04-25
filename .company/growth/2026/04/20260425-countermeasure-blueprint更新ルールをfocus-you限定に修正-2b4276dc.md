# Blueprint更新ルールをfocus-you限定に修正

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, harness, auto-detected, daily-batch, llm-classified

## what_happened
CLAUDE.mdの『TodoWrite最終ステップにBlueprint更新確認を含める』ルールが全PJに適用されていたが、Blueprint.tsxはfocus-you固有のため社長から指摘。focus-you/company-dashboard PJ限定に修正するよう指示された。

## root_cause
CLAUDE.mdのルール記述で適用範囲が曖昧で、rikyu等の他PJ作業時にも適用される状態だった

## countermeasure
CLAUDE.mdに『focus-you / company-dashboard PJ 限定』『他PJには適用しない』を明記

<!-- id: 2b4276dc-a594-4fa0-bd5d-77824cfb9196 -->
