# rikyu MVP デプロイは Azure Portal 経由で進める

- **type**: `decision`
- **date**: 2026-05-02
- **category**: devops / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, deployment, auto-detected, daily-batch, llm-classified

## what_happened
devcontainer から Azure CLI が叩けない問題を確認後、ACES PC 制限の調査を経て、.env.local（DATABASE_URL/MOCK_JWT_SECRET）が揃っているこの PC で Portal 経由でデプロイする方針に決定。ACR webhook での auto deploy も検討。

## result
Portal でのデプロイに成功。SESSION_2026-05-01_DEPLOYMENT.md に記録し継続作業へ。

<!-- id: 42770b62-41d8-4f76-b358-91481a2a4894 -->
