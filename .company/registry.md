# PJ会社レジストリ

## PJ会社一覧

<!-- GENERATED:COMPANY_TABLE:START -->
| ID | 会社名 | 説明 | リポジトリ | 作成日 | ステータス |
|----|--------|------|-----------|--------|-----------|
| foundry | Foundry移行会社 | SOMPOケア Foundry移行PJT支援 | project-scotch-care/ | 2026-03-20 | active |
| rikyu | りきゅう | りそな向け営業支援DX | project-rikyu-sales-proposals-poc/ | 2026-03-20 | active |
| circuit | 回路設計支援システム会社 | 電子回路設計DX + Polaris AI協業 | circuit_diagram/ | 2026-03-21 | active |
| polaris | Polaris AI | 図面暗黙知抽出（Polaris AI社協業） | なし | 2026-03-29 | active |
<!-- GENERATED:COMPANY_TABLE:END -->

## HD共通部署一覧

<!-- GENERATED:DEPT_TABLE:START -->
| 部署 | パス | 役割 |
|------|------|------|
| AI開発部署 | departments/ai-dev/ | LLM/AIシステムの要件定義・設計・実装・評価・運用を一貫して担当する。 |
| 情報収集部 | departments/intelligence/ | 社長が常に最新の情報にキャッチアップできるよう、指定されたソースから情報を収集・要約・報告する。 |
| 資料制作部署 | departments/materials/ | 顧客説明用のプレゼン、提案書、デモ資料、技術説明資料を作成する。 |
| PM | departments/pm/ | プロジェクトの立ち上げから完了まで進捗を管理する。 |
| リサーチ部署 | departments/research/ | 市場調査、技術調査、対象企業調査を行い、組織全体に情報を提供する。 |
| セキュリティ部 | departments/security/ | 全PJ会社のソフトウェアサプライチェーンセキュリティを統括管理する。 |
| システム開発部署 | departments/sys-dev/ | バックエンド・フロントエンド・QAを担当し、PJのシステム部分を構築する。 |
<!-- GENERATED:DEPT_TABLE:END -->

## アーキテクチャ概要

- 共通部署はHD（`.company/departments/`）に集約
- 子会社はPJ固有コンテキスト（`.company-{name}/CLAUDE.md`）+ 秘書のみ
- 部署がPJ作業する際は、子会社CLAUDE.mdからコンテキストを注入

## SSOT（Single Source of Truth）ルール

- **会社の追加・変更・削除** → まずこのファイルの PJ会社一覧テーブルを編集
- **部署の追加・変更・削除** → `departments/` ディレクトリを変更 → `sync-registry.sh` が上テーブルを更新
- **全派生ファイルの更新** → `bash scripts/company/sync-registry.sh` を実行
