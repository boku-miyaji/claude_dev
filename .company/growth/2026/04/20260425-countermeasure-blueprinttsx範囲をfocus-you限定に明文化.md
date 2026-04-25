# Blueprint.tsx範囲をfocus-you限定に明文化

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, organization, auto-detected, daily-batch, llm-classified

## what_happened
Blueprint更新ルールが他PJ(rikyu/circuit等)にも適用されると誤解されかねない記述になっていた。社長より『blueprintは関係ない、focus-youに関係したもの。CLAUDE.mdにちゃんと書いて』と指示。

## root_cause
CLAUDE.mdのBlueprint更新ルールがPJ範囲を明記していなかった

## countermeasure
CLAUDE.mdに『IMPORTANT (focus-you / company-dashboard PJ 限定)』を明記し、他PJ(rikyu/circuit/その他)には適用しない旨を追記

## result
ルール文言が修正され適用範囲が明確化

<!-- id: b0a2ba7c-9520-40b8-99e9-34c310de1223 -->
