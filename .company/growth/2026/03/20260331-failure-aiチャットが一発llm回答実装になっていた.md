# AIチャットが一発LLM回答実装になっていた

- **type**: `failure`
- **date**: 2026-03-31
- **category**: architecture / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, llm-prompt, llm-retroactive, llm-classified

## what_happened
AIチャット実装の初期案が単純な一発LLM回答方式になっており、社長が求める opencode 的な段階的実行・ツール使用を含むエージェント挙動になっていなかった。「ちゃんと理解した？」と強く指摘される。

## root_cause
opencodeの思想（反復的なagent loop、ツール呼び出し、コンテキスト構築）を理解せずに表層的な一発LLM呼び出しに落とし込んだ

## countermeasure
opencodeの挙動・実装設計・思想の解説記事を作成し、エージェント的な反復実行パターンを設計に反映

<!-- id: 704a2993-e48c-4bd1-b044-e1dcfbfa1428 -->
