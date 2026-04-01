# セキュリティ部 — HD 常設部門

## ミッション

全PJ会社のソフトウェアサプライチェーンセキュリティを統括管理する。
「暗黙の信頼」から「検証可能な信頼」への転換を推進し、全社で統一されたセキュリティ水準を維持する。

## 管轄範囲

- GitHub Actions / CI/CD のセキュリティ
- 依存関係（Python / JavaScript）のガバナンス
- シークレット管理・権限設計
- 脆弱性管理・SBOM
- インシデント対応フロー

## ガイドライン原本

`company-dashboard/docs/software_supply_chain_security_guideline.md`

## 8つの標準ルール（全社必須）

| # | ルール | 概要 |
|---|--------|------|
| 1 | 依存関係はゼロトラスト | 有名OSS・セキュリティツールも侵害される前提 |
| 2 | ロックファイル必須化 | lockfile を必ずコミット、CI は lockfile 通りにのみインストール |
| 3 | install script 原則禁止 | npm/Yarn の postinstall/preinstall は既定で無効化 |
| 4 | Actions は SHA 固定 | `@v1` 等の可変タグ禁止、フルコミット SHA にピン留め |
| 5 | CI/CD 権限の最小化 | GITHUB_TOKEN は読み取り専用、OIDC 優先 |
| 6 | 検疫期間の設置 | 新規リリース OSS は 48〜72h 検疫 |
| 7 | SBOM / 脆弱性スキャン | 全リリースで SBOM 生成、PR/main/release でスキャン（🔄 ツール検討中） |
| 8 | 新規依存のガバナンス | 保守性・安全性・代替性をレビュー |

## 禁止事項

- CI で `npm install`（`npm ci --ignore-scripts` を使う）
- CI で `poetry update` や ad-hoc 依存解決
- GitHub Actions を `@v1` / `@v3` 等のタグで参照
- `pull_request_target` の安易な利用
- 長期クラウドアクセスキーを GitHub Secrets に保存
- secrets を一括で環境変数に流し込む
- 未承認レジストリ / Git URL / 直接 URL 依存
- 検疫期間を無視して latest を自動適用

## 監査サイクル

| 頻度 | 内容 |
|------|------|
| 随時 | 新規依存追加時のレビュー |
| 月次 | 全PJのセキュリティ対応状況を棚卸し → `audits/YYYY-MM-DD.md` |
| 四半期 | ガイドライン見直し、ロードマップ更新 |

## 脆弱性修復 SLA

| 深刻度 | 目標対応時間 |
|--------|-------------|
| Critical | 24時間以内 |
| High | 7日以内 |
| Medium | 30日以内 |
| Low | 90日以内 |

## ディレクトリ構成

```
security/
├── CLAUDE.md          ← このファイル
├── audits/            ← 監査レポート
│   └── YYYY-MM-DD.md
└── policies/          ← ポリシー文書
```

## 作業プロトコル

1. **監査実施時**: 全PJリポジトリの workflows / lockfile / .npmrc / dependabot 設定をスキャン
2. **是正指示**: 監査結果に基づき、各PJ会社へ対応チケットを発行
3. **ナレッジ蓄積**: セキュリティインシデント・対応事例を記録
4. **ルール更新**: ガイドライン原本の変更を検知し、全社ルールに反映
