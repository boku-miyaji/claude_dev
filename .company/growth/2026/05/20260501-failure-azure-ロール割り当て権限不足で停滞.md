# Azure ロール割り当て権限不足で停滞

- **type**: `failure`
- **date**: 2026-05-01
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, deployment, auto-detected, daily-batch, llm-classified

## what_happened
yuta.miyaji@acesinc.co.jp が roleAssignments/write 権限を持たず、ACES PC でないと実行できない操作にぶつかりデプロイ作業が停止。代替として devcontainer から az CLI を叩く検討や portal デプロイの可能性を模索。

## root_cause
ACES テナントの権限設計上、別 PC ではロール割り当てなど一部 Azure 操作が制限されている

## countermeasure
DATABASE_URL と MOCK_JWT_SECRET を含む .env.local で当面進め、portal デプロイ経路を検証、az CLI 利用は別サーバーで実施する手順書化

<!-- id: 436ae787-8c44-4134-8894-e03283cab6a1 -->
