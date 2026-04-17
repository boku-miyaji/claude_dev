# 成長記録（Growth Chronicle）詳細仕様

会社運営の「失敗→対策→進化」の軌跡を `growth_events` テーブルに記録し、ダッシュボードの Growth ページで可視化する。

## 記録対象

- セキュリティの穴を発見・修正した
- アーキテクチャ設計を変更した（設計判断の転換）
- DevOps/自動化の仕組みを導入・改善した
- 組織構造（部署）を新設・統合・廃止した
- ダッシュボード機能の進化（新ページ、UX改善）
- 運用プロセスの改善

## event_type

| type | 意味 | いつ使う |
|------|------|---------|
| `failure` | 問題・失敗 | バグ、設計ミス、セキュリティホール発見時 |
| `countermeasure` | 対策 | 問題への具体的な修正・改善を実施した時 |
| `milestone` | 成果 | 新機能完成、仕組みが稼働開始した時 |

## 秘書の自動検出トリガー

- fix: コミットが2つ以上連続 → failure + countermeasure 提案
- セキュリティ関連マイグレーション → security イベント提案
- 新部署作成 → organization milestone 提案
- ダッシュボードに新ページ追加 → tooling milestone 提案

## 記録フロー

1. 秘書がトリガーを検出 or 社長が「記録して」と指示
2. 秘書が event_type, category, title, what_happened 等を起案
3. 社長に「成長記録に残しますか？」と確認
4. 承認 → `growth_events` テーブルに INSERT
5. 因果関係がある場合 `parent_id` で failure → countermeasure → milestone をチェーン

## カテゴリ

security, architecture, devops, automation, tooling, organization, process, quality, communication
