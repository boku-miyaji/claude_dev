# LLMコスト分離の原則（ダッシュボード/バッチ/Hook で用途別モデル）

- **type**: `decision`
- **date**: 2026-04-22
- **category**: architecture / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, cost, llm-prompt, operations, manual-record

## what_happened
ダッシュボード=gpt-5-nano（Edge Function経由）、バッチ=Claude Code CLI（claude --print）、Hook=API呼び出し禁止、と用途別にモデル／経路を分離して使う方針を確立

## root_cause
全てを同じLLM／同じ経路で呼ぶと、バッチが重くなった際にUIの応答性を損ね、月次課金も予測不能になる

## result
API課金の上限が予測可能に。バッチの重さがUIに波及せず、ダッシュボード体験が保たれる

<!-- id: 98504a3a-2a41-4c28-94b8-c1284b6b6e49 -->
