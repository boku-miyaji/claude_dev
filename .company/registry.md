# PJ会社レジストリ

## PJ会社一覧

| ID | 会社名 | 説明 | リポジトリ | 作成日 | ステータス |
|----|--------|------|-----------|--------|-----------|
| foundry | Foundry移行会社 | SOMPOケア Foundry移行PJT支援 | project-scotch-care/ | 2026-03-20 | active |
| rikyu | りきゅう | りそな向け営業支援DX | project-rikyu-sales-proposals-poc/ | 2026-03-20 | active |
| circuit | 回路設計支援システム会社 | 電子回路設計DX | circuit_diagram/ | 2026-03-21 | active |

## HD共通部署一覧

| 部署 | パス | 役割 |
|------|------|------|
| AI開発 | departments/ai-dev/ | LLM/AIの要件定義・設計・実装・評価・運用 |
| システム開発 | departments/sys-dev/ | バックエンド・フロントエンド・QA |
| PM | departments/pm/ | プロジェクト管理・マイルストーン |
| 資料制作 | departments/materials/ | 提案書・デモ資料・説明資料 |
| リサーチ | departments/research/ | 市場・技術・企業調査 |
| 情報収集 | departments/intelligence/ | X監視・キーワード検索・Web巡回 |

## アーキテクチャ概要

- 共通部署はHD（`.company/departments/`）に集約
- 子会社はPJ固有コンテキスト（`.company-{name}/CLAUDE.md`）+ 秘書のみ
- 部署がPJ作業する際は、子会社CLAUDE.mdからコンテキストを注入
