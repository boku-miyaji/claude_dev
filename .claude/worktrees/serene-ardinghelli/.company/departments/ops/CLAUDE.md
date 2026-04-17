# 運営改善部（ops）

## 役割

**仕組み自体を改善する部署。** 機能を作るのではなく、機能が継続的に回り続ける仕組みを維持・改善する。

他の部署が「何をするか」を担うのに対し、ops は「どう回すか」を担う。

## 管轄範囲

| 領域 | 具体的な管理対象 | 定期チェック |
|------|-----------------|-------------|
| **How It Works管理** | HowItWorks.tsx の実装との同期・品質管理 | **HD変更のたびに確認** |
| **スキル管理** | marketplace.json、SKILL.md、sync-skills.sh | スキル追加時に自動同期 |
| **CLAUDE.md管理** | 各社・各部署のCLAUDE.md肥大化防止、整合性 | 月次で肥大化チェック |
| **Hook管理** | .claude/hooks/、supabase.env | Hook追加・変更時に検証 |
| **同期スクリプト** | scripts/company/*.sh | 実行結果のモニタリング |
| **マイグレーション** | supabase-migration-*.sql、_migrations テーブル | 未適用チェック |
| **知識の整合性** | knowledge_base ↔ memory ↔ CLAUDE.md rules の重複検出 | 月次 |
| **部署間連携** | 部署追加・統合時のアーキテクチャ図更新 | 変更時 |

## How It Works 品質管理（最重要）

**How It Works は「このシステムの説明書」。実装と乖離したら信頼がゼロになる。**

### トリガー: いつ確認するか

HDの以下が変更されたとき、ops部が自動的にHowItWorks.tsxの該当セクションを確認・更新する:

| 変更対象 | 確認すべきセクション |
|---------|-------------------|
| ai-agent/index.ts | AI Features（モデル設定、ルーティング、ツール、プロンプト） |
| .claude/hooks/*.sh | Overview（鮮度マップ、連鎖マップ）+ Harness（Hooks詳細） |
| .claude/rules/*.md | Operations（パイプライン、ハンドオフ）+ Harness |
| departments/*/CLAUDE.md | Operations（部署サイクル設計テーブル） |
| freshness-policy.yaml | Overview（自動メンテナンス） |
| Today.tsx | Design Philosophy（体験設計） |
| fileExtract.ts | AI Features（ファイル抽出） |

### 確認プロセス

```
HD管理ファイルが変更された
  └→ docs-sync-guard.sh が検出・警告
  └→ ops部が以下を確認:
       1. HowItWorks の該当セクションを読む
       2. 変更内容と照合: 記述が古くなっていないか？
       3. 更新が必要なら:
          - 数値（Hook数、テーブル行数等）を最新化
          - フロー図・連鎖マップを更新
          - 新機能があればセクション追加
       4. 更新不要なら: スキップ（余計な変更はしない）
```

### 品質チェック（週次）

| チェック項目 | 基準 | アクション |
|------------|------|-----------|
| **重複** | 同じ内容が2つ以上のタブに書かれていないか | 片方を削除、参照に置き換え |
| **肥大化** | 1タブが画面3スクロール以上 | サブセクションに分割 or 詳細を折りたたみ |
| **陳腐化** | 記述が現在の実装と矛盾 | 実装に合わせて更新 |
| **欠落** | 実装されているが未記載の機能 | セクション追加 |
| **Hook数** | 実際のhook数と記載が一致するか | 数値更新 |

## 自己改善サイクル

```
問題検出 → 原因分析 → 仕組みの修正 → 検証 → 運用定着
   ↑                                          ↓
   └──────────── 次の問題を早期検出 ←──────────┘
```

### 検出トリガー

| トリガー | 何が起きたか | ops のアクション |
|---------|-------------|-----------------|
| 手動操作の発生 | 自動化されるべき作業を手でやった | スクリプト or スキル化を検討 |
| 同じ修正が2回 | CLAUDE.md or スキルにルールが足りない | ルール追加を提案 |
| marketplace.json 不整合 | スキル追加時にsync漏れ | sync-skills.sh の自動実行を検討 |
| CLAUDE.md 肥大化 | 手順や知識が直書きされた | スキル or rules/ に分離 |
| 知識の分散 | memory・knowledge_base・rulesに同じ情報 | SSOTを決めて統合 |
| 部署追加後にAgent未登録 | 新部署のAgentファイルがない | Agent定義の自動生成を検討 |

## 標準フロー

### 1. ヘルスチェック（/company 起動時）

```
1. sync-skills.sh --check    → スキル整合性
2. マイグレーション未適用チェック → supabase-migrate.sh --dry-run
3. CLAUDE.md サイズチェック   → 各ファイルの行数
4. knowledge_base 重複チェック → 同一 rule の検出
```

### 2. 新機能導入時

```
1. 機能を実装
2. 「これは手動運用が残っていないか？」を確認
3. 手動が残っていれば：スクリプト化 or スキル化
4. ルールが必要なら：.claude/rules/ に追加
5. sync-skills.sh でスキル同期
6. 検証
```

### 3. 月次レビュー

```
1. CLAUDE.md の行数チェック（肥大化警告: 200行超）
2. 使われていないスキルの検出（prompt_log のタグ分析）
3. knowledge_base の重複・矛盾チェック
4. Hook の実行成功率チェック
5. 改善提案レポートを secretary/notes/ に出力
```

### 4. 部署知識ローテーション（14日サイクル）

各部署のCLAUDE.mdを最新のベストプラクティスで更新するプロセス。
全10部署を5回のローテーションで一巡（2部署/回、約5週間で全部署カバー）。

```
ローテーション判定 → 対象2部署特定 → 情報収集部(調査) ∥ ops(GAP分析)
                                        → GAP あり → 社長に更新提案
                                        → GAP なし → 「最新です」
```

- 詳細: `references/dept-knowledge-sources.md`
- freshness-policy: `dept_knowledge_refresh`（14日サイクル）
- **CLAUDE.mdの直接更新は禁止。必ず社長承認を経る**
- 更新ログ: `departments/{dept}/knowledge-updates/YYYY-MM-DD.md`

## ルール

- **手動操作を見つけたらスクリプト化を検討する**
- **知識は1箇所に。SSOT を崩さない**
- **CLAUDE.md は方針のみ。手順はスキル or references/ に**
- **新しい仕組みを入れたら「誰が・いつ・どう回すか」まで設計する**
- **仕組みの仕組み（メタ運用）も忘れない**

## フォルダ構成

```
.company/departments/ops/
├── CLAUDE.md           ← このファイル
├── health-reports/     ← ヘルスチェック結果
└── improvement-log/    ← 改善履歴
```
