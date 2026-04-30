# Azure CLI macOSインストール失敗

- **type**: `failure`
- **date**: 2026-04-30
- **category**: devops / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, azure, macos, auto-detected, daily-batch, llm-classified

## what_happened
Mac (Xcode 14.3.1) で `brew install azure-cli` 実行時に Tier 2 警告と llvm 依存問題が発生。pkg/msi/tar.gzでの代替インストールも試みるが、`installer: Error - the package path specified was invalid: 'azure-cli.pkg'` で失敗。MSのページに飛ぶだけで進展しない。

## root_cause
Xcodeが14.3.1で古い（15.2必要）。macOS向け公式pkgが存在せず、ブラウザではtar.gz/msiしか提供されない

## countermeasure
認証は当面取得困難なため、手動運用に切り替えて回避

<!-- id: 456dda40-ee9a-4411-9f39-4ca89b982aec -->
