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
├── CLAUDE.md            ← このファイル
├── audits/              ← 監査レポート
│   ├── YYYY-MM-DD.md    ← 手動監査（月次）
│   ├── scan-YYYY-MM-DD.md ← 自動スキャン（週次）
│   └── scan-latest.md   ← 最新スキャン（鮮度チェック用）
└── policies/            ← ポリシー文書
```

## 自動化レイヤー（3層構成）

セキュリティが「忘れ去られない」ための仕組み:

### Layer 1: /company 起動時の鮮度チェック（毎回）

`freshness-policy.yaml` に登録済み。`/company` 起動のたびに:
- `security_scan` (priority 5): 週次スキャンが7日以上前 → 自動アラート
- `security_audit` (priority 4): 手動監査が30日以上前 → リマインド

### Layer 2: 週次自動スキャン（GitHub Actions）

`.github/workflows/security-scan.yml` が毎週月曜 10:00 JST に実行:
- `scripts/security/scan.py` で全リポジトリをスキャン
- SHA ピン留め漏れ、permissions 未宣言、危険な CI コマンドを検出
- 結果を `audits/scan-latest.md` + `audits/scan-YYYY-MM-DD.md` に出力
- 自動コミット & プッシュ

### Layer 3: 日次情報収集（intelligence 連携）

`intelligence/sources.yaml` にセキュリティフィードを追加済み:
- GitHub Security Blog、Socket.dev Blog を日次監視
- "supply chain attack npm pypi"、"GitHub Actions vulnerability" を日次検索
- @SocketDev（サプライチェーン速報）を監視
- 重大な脆弱性が検出された場合、ブリーフィングで優先報告

## 運用フロー

### 通常時（自動）

```
毎日: intelligence → セキュリティ動向を収集・報告
毎週月曜: security-scan.yml → 全リポジトリをスキャン → scan-latest.md
/company 起動: 鮮度チェック → スキャン結果が古ければアラート
```

### 問題検出時

```
スキャンで High 検出 → /company ブリーフィングで警告
intelligence で攻撃情報検出 → 影響有無を即時確認
  → 影響あり: インシデント対応フロー（SLA準拠）
  → 影響なし: 監査レポートに記録
```

### 月次（手動監査）

```
セキュリティ部が全PJの対応状況を棚卸し
  → audits/YYYY-MM-DD.md に詳細レポート
  → 未対応項目を各PJ会社へ是正指示
```

## 作業プロトコル

1. **自動スキャン確認**: 毎週の scan-latest.md を確認し、新規 findings に対応
2. **動向ウォッチ**: intelligence レポートのセキュリティカテゴリを確認
3. **月次監査**: 全PJリポジトリの workflows / lockfile / .npmrc / dependabot を手動でも確認
4. **是正指示**: 監査結果に基づき、各PJ会社へ対応チケットを発行
5. **ナレッジ蓄積**: セキュリティインシデント・対応事例を記録
6. **ルール更新**: ガイドライン原本の変更を検知し、全社ルールに反映
