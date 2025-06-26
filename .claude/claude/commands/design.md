---
allowed-tools: >
  Bash(git ls-tree:*),
  Bash(cat:*),
  Bash(echo:*)
description: |
  Generate a concise technical design (1-2 pages) for `$ARGUMENTS`.
  Include: Problem / Constraints / Proposed Architecture (Mermaid) /
  Milestones / Risks & Mitigations.
---

## Repo snapshot
!`git ls-tree -r --name-only HEAD | head -n 100`

## 出力フォーマット
Markdown + Mermaid。最後に
```
### Next-step
/flow:spawn-sparc architect --design "$ARGUMENTS"
```
