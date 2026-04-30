# Azure CLI インストール経路が機能しない

- **type**: `failure`
- **date**: 2026-04-30
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: claude-dev, azure, auth, auto-detected, daily-batch, llm-classified

## what_happened
Mac で Azure CLI のインストールを試みるも、brew は Xcode 14.3.1 outdated 警告で進まず、pkg installer は invalid path エラー、ブラウザからは tar.gz/msi しか取得できず Microsoft ページに飛ぶだけで完結しない。Error 53003（管理対象PC 関連の認証エラー）も併発。

## root_cause
ACES管理対象PCの制約 + Xcode バージョン不足 + 配布形態の不整合

## countermeasure
認証はしばらく取得できないため手動運用に切り替え、ロール割り当ては相手側で対応

## result
手動運用で暫定回避

<!-- id: d0c2994b-e923-49ff-9eeb-b6951019ac41 -->
