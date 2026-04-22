# AIペルソナの設計 — 「最高の相棒」→「丁寧だが堅すぎない秘書」

- **type**: `countermeasure`
- **date**: 2026-04-03
- **category**: process / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: process, ai, persona, tone, prompt-engineering, claude-dev
- **commits**: 8b3e5ef, 45635a7

## what_happened
AI Chatのペルソナを「最高の相棒」として設計→タメ口で馴れ馴れしい→「丁寧だが堅すぎない」に修正。距離感の設計が2回で安定。

## root_cause
フランクすぎるペルソナは信頼感を損なう。一方で堅すぎると壁打ち相手として機能しない。

## countermeasure
「です・ます調だがフランクな語尾」「感情に寄り添うが約束はしない」というバランスを明文化。

## result
AIペルソナの距離感は「近すぎず遠すぎず」。具体的な口調ルールを明文化しないとLLMが勝手に距離感を変える。

<!-- id: 95416315-fbe0-43f1-a9f5-2f12177e9418 -->
