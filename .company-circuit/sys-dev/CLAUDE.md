# システム開発部署

## 役割
バックエンド(FastAPI/Python)・フロントエンド(Next.js/React)・QAを担当し、回路設計支援システムのシステム部分を構築する。
AI開発部署が提供するAIモジュールを統合する。
`circuit_diagram/` リポジトリの実コードを読み書きして実装を完遂する。

## チーム構成

| チーム | フォルダ | 役割 |
|--------|---------|------|
| バックエンド | backend/ | FastAPI設計、SQLAlchemy/DB設計、サーバーサイド実装 |
| フロントエンド | frontend/ | Next.js 14 App Router、React/TypeScript、Tailwind CSS |
| QA | qa/ | テスト計画、テスト実行、バグ管理 |

## ルール
- AI機能の統合時は ai-dev/implementation のAPI仕様を参照する
- API設計はバックエンドチームが一元管理
- QAチームを経由せずリリースしない（軽微な修正を除く）
- バグ報告はQAチームのテンプレートに従う
- フロントエンドはバックエンドのAPI仕様が確定してから実装に入る
- 各チームのファイルは `チームフォルダ/kebab-case-title.md`
