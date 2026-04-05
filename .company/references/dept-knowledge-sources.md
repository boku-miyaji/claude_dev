# 部署別知識ソースと追跡対象

各部署が最新のベストプラクティスを追跡するための情報源定義。
ops部の「部署知識ローテーション」で使用する。

## ローテーションスケジュール

1回の /company 起動で最大2部署を更新（コンテキスト消費制限）。
全10部署を5回のローテーションで一巡（約2-3週間で全部署カバー）。

| ローテーション | 部署A | 部署B | 理由 |
|--------------|-------|-------|------|
| 1 | AI開発 | セキュリティ | 技術変化が最も速い |
| 2 | システム開発 | UXデザイン | 実装パターン+設計トレンド |
| 3 | リサーチ | 情報収集 | 調査手法の改善 |
| 4 | PM | 資料制作 | プロジェクト管理+ドキュメント |
| 5 | マーケティング | 運営改善 | 戦略+メタ運用 |

## 部署別追跡対象

### AI開発部
- **追跡テーマ**: LLMの新モデル・API変更、プロンプト設計パターン、RAG最新手法、エージェント設計パターン
- **情報源**: Anthropic Blog, OpenAI Blog, Hugging Face Blog, arXiv (cs.CL), LangChain/LlamaIndex changelog
- **検索キーワード**: "LLM agent patterns 2026", "RAG best practices", "prompt engineering latest"
- **CLAUDE.md更新トリガー**: 新モデルの推奨設定変更、新しいAPI呼び出しパターン、評価手法の標準変更

### システム開発部
- **追跡テーマ**: TypeScript/React最新パターン、テスト手法、CI/CD、パフォーマンス最適化
- **情報源**: TypeScript Blog, React Blog, Vite changelog, Supabase changelog, Vercel Blog
- **検索キーワード**: "React 2026 patterns", "TypeScript best practices", "Supabase new features"
- **CLAUDE.md更新トリガー**: フレームワークの破壊的変更、新しいテストパターン、Supabase新機能

### UXデザイン部
- **追跡テーマ**: AI時代のUXパターン、アクセシビリティ標準更新、インタラクションデザイン最新研究
- **情報源**: Nielsen Norman Group, Smashing Magazine, A11y Project, Google Material Design Blog
- **検索キーワード**: "AI UX patterns 2026", "WCAG updates", "interaction design research"
- **CLAUDE.md更新トリガー**: WCAG標準の改訂、新しいHCI研究の実践的知見

### リサーチ部
- **追跡テーマ**: 調査手法、情報源の信頼性評価、AI活用リサーチ手法
- **情報源**: Google Scholar, ResearchGate, 学術論文検索の最新ツール
- **検索キーワード**: "AI-assisted research methods", "information verification techniques"
- **CLAUDE.md更新トリガー**: 新しい調査フレームワーク、信頼性評価手法の更新

### PM部
- **追跡テーマ**: AIネイティブなプロジェクト管理手法、エージェント協調パターン、見積もり精度向上
- **情報源**: Atlassian Blog, Linear Blog, GitHub Blog, PM関連の技術記事
- **検索キーワード**: "AI project management 2026", "agent orchestration patterns", "estimation techniques"
- **CLAUDE.md更新トリガー**: 新しいタスク分解手法、エージェント間調整パターンの変化

### 情報収集部
- **追跡テーマ**: 情報収集自動化、ニュースフィルタリングAI、ソーシャルリスニング手法
- **情報源**: Feedly Blog, RSS関連ツール、Web Scraping最新手法
- **検索キーワード**: "news aggregation AI", "information curation automation"
- **CLAUDE.md更新トリガー**: 新しい情報源API、フィルタリングアルゴリズムの改善

### セキュリティ部
- **追跡テーマ**: LLMセキュリティ（プロンプトインジェクション、データ漏洩）、サプライチェーン攻撃、新脆弱性
- **情報源**: OWASP, Socket.dev Blog, GitHub Security Blog, Snyk Blog, CVE Database
- **検索キーワード**: "LLM security 2026", "supply chain attack npm", "AI agent security"
- **CLAUDE.md更新トリガー**: 新しい攻撃手法の発見、セキュリティルールの追加必要性

### 資料制作部
- **追跡テーマ**: プレゼン設計の最新トレンド、AIライティング手法、ビジュアルコミュニケーション
- **情報源**: Presentation Design blogs, Miro Blog, Figma Blog
- **検索キーワード**: "presentation design AI 2026", "visual communication best practices"
- **CLAUDE.md更新トリガー**: 新しい資料テンプレートパターン、プレゼン設計の標準変更

### マーケティング部
- **追跡テーマ**: PLG最新事例、Developer Marketing、AI SaaSのGo-to-Market
- **情報源**: a16z Blog, First Round Review, Product Hunt trends, Indie Hackers
- **検索キーワード**: "PLG 2026", "developer marketing AI tools", "AI SaaS go-to-market"
- **CLAUDE.md更新トリガー**: 新しいGo-to-Market手法、競合の戦略変更

### 運営改善部
- **追跡テーマ**: Claude Code最新機能（Hooks/Sub-agents/MCP）、DevOps自動化、メタ運用パターン
- **情報源**: Claude Code Changelog, Anthropic Engineering Blog, DevOps関連ブログ
- **検索キーワード**: "Claude Code hooks new", "agentic automation patterns", "self-improving systems"
- **CLAUDE.md更新トリガー**: Claude Codeの新機能リリース、新しい自動化パターン

## 更新フロー

```
/company 起動
  └→ freshness-check: dept_knowledge_refresh 14日超?
       └→ YES: ローテーション番号を算出（日付ベース）
            └→ 対象2部署を特定
                 └→ 情報収集部: 対象部署の知識ソースを調査
                      └→ 運営改善部: 調査結果と現行CLAUDE.mdのGAP分析
                           └→ GAP あり → 社長に更新提案を提示
                           └→ GAP なし → 「最新です」と報告
```

## 更新ログ

各更新の記録先: `.company/departments/{dept}/knowledge-updates/YYYY-MM-DD.md`

フォーマット:
```markdown
# 知識更新 YYYY-MM-DD

## 調査結果
- [記事タイトル](URL) — 要約

## 現行CLAUDE.mdとのGAP
- {差分の説明}

## 更新提案
- {CLAUDE.mdに追加/変更すべき内容}

## 判定
- [ ] 社長承認済み → CLAUDE.md更新
- [ ] 承認不要（差分なし）
```
