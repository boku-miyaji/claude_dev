# Azure CLI認証エラー53003

- **type**: `failure`
- **date**: 2026-04-30
- **category**: security / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, auth, auto-detected, daily-batch, llm-classified

## what_happened
Microsoft Azure CLIでAADSTS53003系の認証エラー（Error Code: 53003）。ACES管理対象PCからの接続でconditional accessポリシーに引っかかった可能性。brewでazure-cli導入時もXcode 14.3.1古いとの警告、installer pkg invalid pathで失敗。

## root_cause
ACES管理対象PCのconditional access + brew/installerの環境問題

## countermeasure
認証は当面取得不可のため手動運用に切り替え、ロール割り当ては相手側で実施

## result
ルート2（ロール割り当て手動）で進行、Azure CLI導入は保留

<!-- id: 20d1da11-451c-4b84-925f-fe7abfbab800 -->
