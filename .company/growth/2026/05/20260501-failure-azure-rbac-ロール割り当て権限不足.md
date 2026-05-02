# Azure RBAC ロール割り当て権限不足

- **type**: `failure`
- **date**: 2026-05-01
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, auth, auto-detected, daily-batch, llm-classified

## what_happened
ACESアカウント yuta.miyaji@acesinc.co.jp で Azure サブスクリプションに対する Microsoft.Authorization/roleAssignments/write 権限がなく、ロール割り当てが追加できないエラーが発生。コンテナからの設定もイメージ不在で失敗。別PCからの作業も制限あり。

## root_cause
ACES の Azure 環境での権限制御。ACES 配布PC以外からは特定の管理操作が制限される。

<!-- id: 174a6d2c-ed8a-42b5-b040-9eda63781c08 -->
