# ハーネスエンジニアリング: Claude Code における設計思想と実践

**調査日**: 2026-04-05 | **調査チーム**: 技術調査

---

## 1. ハーネスエンジニアリングとは

AIの出力品質は「プロンプトの書き方」ではなく「AIを取り巻く環境の設計」で決まる。

| 段階 | 時期 | 中心的な問い |
|------|------|-------------|
| Prompt Engineering | 2022-2023 | 「どう聞けばいい？」 |
| Context Engineering | 2023-2024 | 「AIは何を知る必要がある？」 |
| **Harness Engineering** | 2025-現在 | **「どんな環境を構築すべき？」** |

Stanford HAI調査: プロンプト改善は品質+3%、ハーネス改善は**+28〜47%**。

## 2. ハーネスの6構成要素

| 構成要素 | 役割 | 性質 |
|---|---|---|
| **CLAUDE.md** | 方針・規約 | 助言的（無視されうる）。60行以下推奨 |
| **Hooks** | ライフサイクル制御 | **決定論的（確実に実行）** |
| **Permissions** | 安全制御 | 強制的 |
| **MCP** | ツール拡張 | 外部サービス接続 |
| **Sub-agents** | コンテキスト分離 | 独立メモリ、最小権限 |
| **Skills** | ナレッジ注入 | オンデマンドロード |

## 3. 宮路HDシステムへの適用分析

### 現状の強み
- Hook活用（24個）は先進的
- Freshness Policy による自動データ鮮度管理
- 部署CLAUDE.mdによるコンテキスト分離設計

### ギャップ

| 問題 | ハーネス思想 | 現状 |
|---|---|---|
| CLAUDE.mdが巨大 | 60行以下推奨 | HD: 208行 |
| ルールが「助言」止まり | 重要ルールはHookで強制 | CLAUDE.md記載のみ |
| ハンドオフが正規表現 | 構造化データで確実に | テキストパターンマッチ |
| Sub-agentの最小権限なし | ツール/モデルを制限 | 全部署が全ツールアクセス可能 |

### 改善案

1. **「助言」→「強制」昇格**: 成果物ハンドオフ検出、QA未通過防止、CLAUDE.md肥大化防止をHooks化
2. **部署=Sub-agent設計**: 独立コンテキスト、最小権限、モデル選択（opus/haiku）
3. **コンテキスト圧縮対策**: Progress File（構造化JSON）、SessionStart(compact) Hookによる再注入

## Sources

- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [Best Practices](https://code.claude.com/docs/en/best-practices)
- [Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [From Prompt Engineer to Harness Engineer (DEV)](https://dev.to/wonderlab/from-prompt-engineer-to-harness-engineer-three-evolutions-in-ai-collaboration-5bgp)
- [Claude Code Agent Harness Architecture (WaveSpeedAI)](https://wavespeed.ai/blog/posts/claude-code-agent-harness-architecture/)
