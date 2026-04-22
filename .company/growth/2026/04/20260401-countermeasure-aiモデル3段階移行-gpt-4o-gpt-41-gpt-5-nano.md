# AIモデル3段階移行 — gpt-4o → gpt-4.1 → gpt-5-nano

- **type**: `countermeasure`
- **date**: 2026-04-01
- **category**: tooling / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: tooling, ai, model-migration, configuration, claude-dev
- **commits**: 075a0a5, 364ecb3, 8aa04e5

## what_happened
2週間で3回のモデル移行が発生。gpt-4oが非推奨→gpt-4.1/o4-miniに→gpt-5シリーズ登場→gpt-5-nanoに統一。各移行でモデル名のハードコードを全箇所修正する必要があった。

## root_cause
モデル名が各ファイルにハードコードされており、一括変更が困難だった。

## countermeasure
Edge FunctionのMODEL_MAPで一元管理。クライアントは「simple/moderate/complex」のティア指定のみ。

## result
AI機能のモデル名はハードコードせず、設定で一元管理する。モデルの世代交代は頻繁に起きる前提で設計する。

<!-- id: 6ded8bb0-942b-46ae-8a7d-9c73ccb8b208 -->
