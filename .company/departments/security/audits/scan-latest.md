# 週次セキュリティスキャン — 2026-04-01

実行時刻: 2026-04-01 16:00 JST

## サマリー: 33 件（🔴 High: 28 / 🟡 Medium: 4）

### . — 1 件

| 深刻度 | ルール | ファイル | 行 | 内容 |
|--------|--------|---------|---:|------|
| 🟡 medium | missing-npmrc | . | 0 | JS プロジェクトだが .npmrc が存在しない。ignore-scripts=true の設定が必要 |

### project-rikyu-sales-proposals-poc — 32 件

| 深刻度 | ルール | ファイル | 行 | 内容 |
|--------|--------|---------|---:|------|
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_azure_static_web_apps.yml | 22 | actions/checkout@v4 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_azure_static_web_apps.yml | 25 | actions/setup-node@v4 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_azure_static_web_apps.yml | 30 | pnpm/action-setup@v4 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_azure_static_web_apps.yml | 47 | Azure/static-web-apps-deploy@v1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_azure_static_web_apps.yml | 62 | Azure/static-web-apps-deploy@v1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | unsafe-ci-install | project-rikyu-sales-proposals-poc/.github/workflows/deploy_azure_static_web_apps.yml | 43 | npm install を検出。npm ci --ignore-scripts を使用してください |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example.yml | 31 | actions/setup-python@v2 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example.yml | 36 | actions/checkout@v2 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example.yml | 51 | aws-actions/configure-aws-credentials@v1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example.yml | 57 | aces-inc/ssh-agent@v0.4.1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example.yml | 63 | aws-actions/amazon-ecr-login@v1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example.yml | 96 | aws-actions/aws-codebuild-run-build@v1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example_dev.yml | 30 | actions/setup-python@v2 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example_dev.yml | 35 | actions/checkout@v2 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example_dev.yml | 51 | aws-actions/configure-aws-credentials@v1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example_dev.yml | 57 | aces-inc/ssh-agent@v0.4.1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example_dev.yml | 63 | aws-actions/amazon-ecr-login@v1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/deploy_aces_platform_project_example_dev.yml | 96 | aws-actions/aws-codebuild-run-build@v1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/lint.yml | 9 | actions/checkout@v6 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/lint.yml | 12 | actions/setup-python@v6 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/lint.yml | 15 | aces-inc/ssh-agent@v0.4.1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | unsafe-ci-install | project-rikyu-sales-proposals-poc/.github/workflows/lint.yml | 22 | poetry lock を検出。CI では lockfile を再生成しないでください |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/build_on_push_develop.yml | 28 | actions/setup-python@v2 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/build_on_push_develop.yml | 33 | actions/checkout@v2 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/build_on_push_develop.yml | 48 | aws-actions/configure-aws-credentials@v1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/build_on_push_develop.yml | 54 | aces-inc/ssh-agent@v0.4.1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/build_on_push_develop.yml | 60 | aws-actions/amazon-ecr-login@v1 — タグ指定。SHA ピン留めが必要 |
| 🔴 high | actions-sha-pinning | project-rikyu-sales-proposals-poc/.github/workflows/build_on_push_develop.yml | 93 | aws-actions/aws-codebuild-run-build@v1 — タグ指定。SHA ピン留めが必要 |
| 🟡 medium | missing-permissions | project-rikyu-sales-proposals-poc/.github/workflows/deploy_azure_static_web_apps.yml | 0 | permissions: が未宣言。最小権限の原則に違反の可能性 |
| 🟡 medium | missing-permissions | project-rikyu-sales-proposals-poc/.github/workflows/lint.yml | 0 | permissions: が未宣言。最小権限の原則に違反の可能性 |
| 🟡 medium | missing-npmrc | project-rikyu-sales-proposals-poc | 0 | JS プロジェクトだが .npmrc が存在しない。ignore-scripts=true の設定が必要 |
| 🔵 low | missing-dependabot | project-rikyu-sales-proposals-poc | 0 | GitHub Actions ワークフローがあるが dependabot.yml が未設定 |

### ✅ circuit_diagram — 問題なし

### ✅ project-scotch-care — 問題なし
