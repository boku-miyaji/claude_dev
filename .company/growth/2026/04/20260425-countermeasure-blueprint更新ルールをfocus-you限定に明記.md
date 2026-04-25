# Blueprint更新ルールをfocus-you限定に明記

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, organization, auto-detected, daily-batch, llm-classified

## what_happened
TodoWriteの最後のステップに「Blueprint更新確認」を含めるルールが、他PJ（rikyu/polaris-circuit）にも適用されると誤解される問題があった。CLAUDE.mdに「focus-you / company-dashboard PJ限定」と明記して他PJ混入を防ぐ対策を実施。

## root_cause
CLAUDE.mdのルール記述が曖昧で、Blueprint.tsxがfocus-you固有のダッシュボードであることが伝わっていなかった

## countermeasure
CLAUDE.mdのIMPORTANT節に「focus-you / company-dashboard PJ限定」と明示記載

<!-- id: 6cd04825-3b74-4028-bdff-d060e42e1c3f -->
