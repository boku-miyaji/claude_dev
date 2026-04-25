# focus-you向けrulesをCLAUDE.mdに明記

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, focus-you, auto-detected, daily-batch, llm-classified

## what_happened
Blueprint更新ルールがfocus-you限定なのに全PJに見える書き方になっていた問題を受け、focus-you関連であることをCLAUDE.mdに明示する対策を実施。他PJ（rikyu/circuit等）にBlueprint.tsxを適用しない旨を明記。

## root_cause
PJ横断ルールとPJ固有ルールの境界が曖昧でblueprint関連が混入していた

## countermeasure
CLAUDE.mdにIMPORTANT (focus-you / company-dashboard PJ 限定)として明記

<!-- id: 86b04720-7306-4016-995d-0ac94dd0ba97 -->
