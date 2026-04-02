# Agent 委譲テンプレート・パイプライン仕様

## 標準委譲プロンプト

Agent に作業を委譲する際は、以下の形式で **全コンテキストを渡す**。
Sub-agent は親の会話を参照できないため、必要な情報をすべて含める。

```markdown
## コンテキスト
- PJ会社: {name}
- PJ概要: {CLAUDE.md から1-2行の要約}
- 紐づきリポジトリ: {パス}

## タスク
{具体的な作業指示}

## 前ステップの成果物
{パス or 内容要約 — 省略不可}

## 適用ルール
{knowledge_base から該当スコープの active ルール}

## 実行モード
{full-auto / checkpoint / step-by-step}
```

### 渡すべきもの

| 項目 | 理由 |
|------|------|
| PJ会社名 + 概要 | Agent がドメイン文脈を理解するため |
| 紐づきリポジトリのパス | コードを読み書きする場所の特定 |
| 前ステップの成果物 | パイプラインの連続性を保つため |
| knowledge_base ルール | LLMデフォルトとの差分を適用するため |

### 渡してはいけないもの

| 項目 | 理由 |
|------|------|
| HD全体の組織図 | 不要なコンテキスト消費 |
| 他PJ会社の情報 | コンテキスト汚染 |
| 手順の詳細 | Agent 自身の CLAUDE.md に書くべき |

## パイプライン仕様

### パイプライン A: 新機能開発・大きな変更

```
dept-research → [dept-qa: research-check]
  → dept-ai-dev/design → [dept-qa: design-check] → [checkpoint]
    → dept-ai-dev/impl → [dept-qa: code-check]
      → dept-sys-dev/qa → [dept-qa: coverage-check] → [checkpoint]
        → commit
```

### パイプライン B: バグ修正・小さな改善

```
dept-ai-dev/impl → [dept-qa: code-check] → commit
```

### パイプライン C: 提案書・資料作成

```
dept-research → dept-ai-dev（技術検証） → dept-materials → [checkpoint] → 完成
```

### パイプライン D: 調査・分析のみ

```
dept-research → secretary/notes に記録 → 社長に報告
```

## 品質ループ（自動検証）

各ステップの成果物を **QA検証部Agent** で自動検証する。

**ルール:**
- 検証FAIL → 該当部署Agentに差し戻し（自動リトライ、最大2回）
- 2回連続FAIL → 社長にエスカレーション
- 検証PASS → 次ステップに自動進行

**並列実行パターン:**
- リサーチ + PM（チケット作成）は同時起動可
- AI開発 + 資料制作が独立なら同時起動可
- 秘書はAgentの完了を待ち、結果を統合して報告

## 連携チケット形式

部署間で作業を受け渡す場合:

```markdown
## 連携チケット
- **依頼元**: [部署/チーム名]
- **依頼先**: [部署/チーム名]
- **PJ会社**: [対象PJ]
- **内容**: [何をしてほしいか]
- **入力**: [渡す成果物・情報]
- **期待する出力**: [どんな形式で返してほしいか]
- **期限**: YYYY-MM-DD
- **ステータス**: open / in-progress / done / returned
```
