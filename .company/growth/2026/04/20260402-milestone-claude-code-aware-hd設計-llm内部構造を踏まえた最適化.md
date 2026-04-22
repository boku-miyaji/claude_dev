# Claude Code-aware HD設計 — LLM内部構造を踏まえた最適化

- **type**: `milestone`
- **date**: 2026-04-02
- **category**: architecture / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: architecture, claude-code, context-optimization, meta-design, agent-harness
- **commits**: ee00235

## what_happened
CLAUDE.mdが肥大化し、Context Loadingのたびに大量のトークンを消費。Sub-agentに必要な情報が渡らない、意思決定が会話内に残ってContext Compactionで消えるなどの問題が発生。

## countermeasure
Claude Codeの内部構造（Context Loading, Compaction, Tool Execution Model, Agentic Loop）を分析し、それぞれに対応した設計原則を策定。CLAUDE.mdは方針のみ、手順はreferences/に分離、意思決定は即時永続化、ブリーフィングは並列実行。

## result
LLM Agentの内部動作を理解した上で設計することで、コンテキスト効率と実行精度が大幅に向上。「LLMの仕組みに合わせた設計」というメタレベルの知見が蓄積。

<!-- id: c1a68cdf-4fe2-416d-834c-4954d57f61e5 -->
