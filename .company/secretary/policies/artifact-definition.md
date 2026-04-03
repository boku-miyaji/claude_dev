# 成果物（Artifact）定義

## 成果物とは

**具体的な問題に対する完成した作業成果物**。以下の条件を満たすもの:

1. **完成している**（ドラフトではなく、レビュー可能な状態）
2. **実質的**（5KB以上、または意思決定を含む）
3. **再利用価値がある**（他のPJや将来の自分が参照する可能性）

## 成果物の分類

| type | 説明 | 例 |
|------|------|-----|
| `design` | 設計書・方針書・アーキテクチャ | テックスタック方針、AI設計書 |
| `research` | 調査・分析レポート | 市場調査、技術比較、セキュリティ調査 |
| `proposal` | 提案書・プレゼン資料 | クライアント向け資料、RFP |
| `guide` | 手順書・プレイブック | AI Readiness Playbook |
| `analysis` | 監査・レビュー・評価 | セキュリティ監査、UX分析 |

## 成果物でないもの

- 設定ファイル（CLAUDE.md, config.toml）
- 一時的なメモ・TODO
- コードファイル（ソースコードは Git で管理）
- ログ・自動生成データ
- changelog / 差分ログ

## 自動登録ルール

### 登録トリガー

秘書がファイルを作成・更新した際に、以下の条件を**全て**満たす場合に自動登録する:

1. パスが登録対象ディレクトリに含まれる（下記参照）
2. ファイルサイズが 5KB 以上
3. 拡張子が `.md`, `.html`, `.pptx`, `.pdf` のいずれか
4. ファイル名が一時ファイルパターンに一致しない（`temp-`, `wip-`, `draft-` 等）

### 登録対象ディレクトリ

```
.company/departments/*/           → HD共通部署の成果物
.company/secretary/notes/         → 意思決定ログ・設計提案（10KB以上のみ）
.company-*/secretary/archive/     → PJ会社のアーカイブ済み成果物
project-*/docs/final_output/      → PJリポジトリの完成成果物
project-*/docs/miyaji/            → 方法論ドキュメント
```

### 除外パターン

```
**/CLAUDE.md                       → 設定ファイル
**/changelog/**                    → 差分ログ
**/temp-*, **/wip-*, **/draft-*    → 一時ファイル
**/node_modules/**, **/.next/**    → ビルド成果物
```

## フィードバックループ（学習）

### 社長のアクション → 学習

| アクション | 意味 | 記録先 | 次回への反映 |
|-----------|------|--------|------------|
| レポートを開いて読んだ | 関心あり | `artifact_views` (activity_log) | 類似テーマの登録優先度UP |
| アーカイブした | 不要と判断 | `artifact_archived` (activity_log) | 同カテゴリの登録閾値UP（10KB→15KB等） |
| 削除した | 完全に不要 | `artifact_deleted` (activity_log) | 同パスパターンを除外リストに追加 |
| 手動で登録した | 自動登録が漏れた | `artifact_manual` (activity_log) | 対象ディレクトリ・条件を緩和 |

### 除外学習

社長が削除・アーカイブした成果物のパターンを記録し、次回以降の自動登録で参考にする:

```
activity_log:
  action: 'artifact_feedback'
  metadata: {
    artifact_id: 72,
    feedback: 'archived' | 'deleted' | 'viewed' | 'manual_registered',
    file_path: '...',
    tags: [...],
    reason: '（社長のコメントがあれば）'
  }
```

### 月次振り返り

毎月1日に秘書が以下を報告:
- 今月の自動登録数 / 手動登録数
- アーカイブ・削除された数
- 「自動登録したが読まれなかった」数
- 登録ルールの調整提案

## 登録方法

- **自動**: Hook（artifact-sync.sh）が対象ディレクトリを監視し、条件に合うファイルを登録
- **手動**: `/company:register` スキル、またはダッシュボードのReportsページから
- **秘書経由**: `/company` でレポート作成時、完了後に自動登録
