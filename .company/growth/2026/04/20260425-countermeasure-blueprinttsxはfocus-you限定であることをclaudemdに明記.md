# Blueprint.tsxはfocus-you限定であることをCLAUDE.mdに明記

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, rule-scope, auto-detected, daily-batch, llm-classified

## what_happened
Blueprint更新確認をTodoWriteの最終ステップに含めるルールが他PJ（rikyu/circuit等）にも誤って適用される懸念を社長が指摘。blueprintはfocus-you固有のダッシュボードであり、他PJには適用しないことをCLAUDE.mdに明記するよう指示された。

## root_cause
Blueprint確認ルールの適用範囲が曖昧で、focus-you以外のPJ作業中も適用されかねない記述だった

## countermeasure
CLAUDE.mdに「focus-you / company-dashboard PJ 限定」「他PJ（aces-rikyu-sales-proposals-poc / polaris-circuit / その他）には Blueprint.tsx を適用しない」を明記

## result
ルールスコープを明確化、他PJで誤適用される懸念を解消

<!-- id: 8672160f-a430-4f05-b705-25ed851debd3 -->
