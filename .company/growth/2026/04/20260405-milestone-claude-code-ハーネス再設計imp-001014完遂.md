# Claude Code ハーネス再設計（IMP-001〜014完遂）

- **type**: `milestone`
- **date**: 2026-04-05
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: harness, claude-code, refactor, organization, agent-harness
- **commits**: 7ca29a0, fc34479, 8494e4a, 1b4eb85, d27a611, ce94a42

## what_happened
ハーネスエンジニアリング観点でCLAUDE.md(208→64行)の刈り込み、hook並列化、構造化handoff YAML、CLAUDE.mdサイズガード、部署知識ローテーション等の改善提案14件をP0〜P2全て完遂。Operations/How It Worksタブも上流→下流順に再編。

## root_cause
部署の動き方や設計・実行・チェックサイクルが曖昧で、いきなり実行に入る懸念があった

## countermeasure
ops部署の分析データに基づき改善提案を整理→段階的に実装→How It Worksで設計思想から実装まで辿れるようドキュメント統合

## result
ハーネスが設計→実行→検証の循環構造として可視化され、部署運営が体系化

<!-- id: 2abd59be-c581-45ca-921d-1ffde65d11da -->
