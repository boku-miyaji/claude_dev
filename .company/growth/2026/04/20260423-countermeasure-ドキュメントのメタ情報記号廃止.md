# ドキュメントのメタ情報記号廃止

- **type**: `countermeasure`
- **date**: 2026-04-23
- **category**: communication / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, documentation, auto-detected, daily-batch, llm-classified

## what_happened
rikyu system-spec ドキュメント内の R-12 / G-1 / M1 / U 等のメタ情報ラベルが意味不明で読めないと指摘。記号ではなく丁寧な自然言語で説明する方針に変更

## root_cause
LLM生成時に内部IDを外向きドキュメントにそのまま露出していた

## countermeasure
ドキュメント内ではメタ情報ラベルを使わず、自然言語で丁寧に説明する

<!-- id: 6ff4828b-cf3b-4a6d-8a64-9c78d9f581d6 -->
