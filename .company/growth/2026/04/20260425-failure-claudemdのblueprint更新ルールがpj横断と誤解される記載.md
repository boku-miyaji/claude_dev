# CLAUDE.mdのBlueprint更新ルールがPJ横断と誤解される記載

- **type**: `failure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, focus-you, auto-detected, daily-batch, llm-classified

## what_happened
Blueprint.tsx更新ルールがCLAUDE.mdに書かれていたが、これはfocus-you (company-dashboard) 固有のものであり、他PJ（rikyu/polaris-circuit等）には適用されない旨を明記する必要があった。

## root_cause
CLAUDE.md記載がPJ固有ルールと横断ルールを区別していなかった

## countermeasure
CLAUDE.mdに focus-you / company-dashboard PJ 限定であることを明記

## result
PJ別ルール適用範囲が明確化

<!-- id: 8e6ddea7-0b50-412d-8d05-53e85e482078 -->
