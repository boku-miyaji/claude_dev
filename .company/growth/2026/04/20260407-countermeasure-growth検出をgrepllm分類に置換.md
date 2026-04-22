# Growth検出をgrep→LLM分類に置換

- **type**: `countermeasure`
- **date**: 2026-04-07
- **category**: automation / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: growth-chronicle, llm-classification, hooks
- **commits**: 05aaa4c, 5511b7f, cba2202

## what_happened
grepベースの成長シグナル検出・タグ付けでは誤検出や取りこぼしが多かったため、gpt-5-nanoによるLLM分類に置き換えた。growth-detector と tagging の両方に適用。

## root_cause
ルールベース（grep）では文脈を読めず、雑多なシグナルを拾いすぎる/逃しすぎる

## countermeasure
LLM (gpt-5-nano) 分類に移行。3シグナル蓄積で自動要約する仕組みも追加

## result
成長記録の精度が向上、自動要約まで一気通貫

<!-- id: 1611db11-546e-4b7c-aff8-9723c0545df9 -->
