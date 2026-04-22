# ハーネスエンジニアリング調査 — 「プロンプトより環境が重要」の発見

- **type**: `milestone`
- **date**: 2026-04-05
- **category**: architecture / **severity**: critical
- **status**: resolved
- **source**: manual
- **tags**: architecture, harness-engineering, stanford-hai, research, agent-harness
- **commits**: a2842bc, 1796521, 08e03f0, 7bf75d4

## what_happened
Stanford HAI の研究で「ハーネス（CLAUDE.md, Hooks, MCP, Permissions, Sub-agents, Skills）の品質が成果の+28-47%を左右し、プロンプト自体は+3%しか影響しない」という知見を発見。自社システムのギャップ分析と14件の改善提案を策定した。

## root_cause
これまでプロンプトの書き方に注力していたが、それを動かす「環境」の設計が体系化されていなかった。

## countermeasure
6つのハーネスコンポーネント（CLAUDE.md, Hooks, Permissions, MCP, Sub-agents, Skills）を明示的に設計対象として位置づけ、How It Worksに専用タブを追加。

## result
AI Agent の能力 = CLAUDE.md のルール品質。この原則が全社の設計思想として確立された。

<!-- id: 19e1df92-b10d-45f0-a250-a0329d410da5 -->
