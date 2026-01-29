# Azure デプロイ設計

> **関連**: [設計書サマリ](00_summary.md) | [技術設計](06_technical_design.md)

> **Note**: 現時点ではAzureリソースは手動で構築します。本ドキュメントのBicep/IaCコードは参考情報です。

---

## 1. 概要

### 1.1 設計方針

| 項目 | 選定 | 理由 |
|------|------|------|
| CI/CD | GitHub Actions | リポジトリ統合、無料枠あり |
| 環境 | dev のみ | PoC段階では1環境で十分 |
| リージョン | East US | Azure AI機能の先行提供 |
| コンピュート | Azure Container Apps | ゼロスケール、Agent Framework推奨 |
| データストア | Blob Storage + AI Search | 柔軟性とコスト効率 |

### 1.2 アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Azure Architecture                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Resource Group: rg-rikyu-poc-dev                  │   │
│  │                    Location: East US                                 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  ┌─────────────────┐    ┌─────────────────┐                        │   │
│  │  │ Container Apps  │    │ Azure AI Search │                        │   │
│  │  │ Environment     │    │ (ベクトル検索)  │                        │   │
│  │  │                 │    └────────┬────────┘                        │   │
│  │  │ ┌─────────────┐ │             │                                 │   │
│  │  │ │ app-api     │ │◀────────────┼──────────────────┐              │   │
│  │  │ │ (FastAPI)   │ │             │                  │              │   │
│  │  │ └─────────────┘ │             │                  │              │   │
│  │  │                 │             │                  │              │   │
│  │  │ ┌─────────────┐ │    ┌───────┴───────┐  ┌───────┴───────┐      │   │
│  │  │ │ app-worker  │ │    │ Blob Storage  │  │ Azure OpenAI  │      │   │
│  │  │ │ (処理)      │ │    │ (データ)      │  │ (LLM)         │      │   │
│  │  │ └─────────────┘ │    └───────────────┘  └───────────────┘      │   │
│  │  └─────────────────┘                                               │   │
│  │                                                                     │   │
│  │  ┌─────────────────┐    ┌─────────────────┐                        │   │
│  │  │ Container       │    │ Key Vault       │                        │   │
│  │  │ Registry (ACR)  │    │ (シークレット)  │                        │   │
│  │  └─────────────────┘    └─────────────────┘                        │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Azure リソース一覧

### 2.1 リソース定義

| リソース | 名前 | SKU/Tier | 用途 |
|----------|------|----------|------|
| Resource Group | `rg-rikyu-poc-dev` | - | リソース管理単位 |
| Container Apps Environment | `cae-rikyu-poc-dev` | Consumption | コンテナ実行環境 |
| Container App (API) | `app-rikyu-api-dev` | - | FastAPI バックエンド |
| Container App (Worker) | `app-rikyu-worker-dev` | - | 非同期処理 |
| Container Registry | `crrikyupocdev` | Basic | Dockerイメージ保存 |
| Storage Account | `strikyupocdev` | Standard_LRS | Blob Storage |
| AI Search | `srch-rikyu-poc-dev` | Basic | ベクトル検索 |
| Azure OpenAI | `aoai-rikyu-poc-dev` | S0 | LLM API |
| Key Vault | `kv-rikyu-poc-dev` | Standard | シークレット管理 |
| Log Analytics | `log-rikyu-poc-dev` | PerGB2018 | ログ収集 |
| Application Insights | `appi-rikyu-poc-dev` | - | APM |

### 2.2 Blob Storage コンテナ構成

```
Storage Account: strikyupocdev
├── scenarios/           # シナリオデータ
│   ├── scenario_001.json
│   └── scenario_002.json
├── knowledge/           # ナレッジデータ
│   ├── tacit/          # 暗黙知
│   ├── product/        # 商材情報
│   └── cases/          # 過去事例
├── evaluations/         # 評価結果
│   └── {scenario_id}/{run_id}.json
└── uploads/             # アップロード一時保存
    └── {upload_id}/
```

### 2.3 AI Search インデックス構成

```yaml
indexes:
  - name: knowledge-index
    fields:
      - name: id
        type: Edm.String
        key: true
      - name: content
        type: Edm.String
        searchable: true
      - name: category
        type: Edm.String
        filterable: true
      - name: embedding
        type: Collection(Edm.Single)
        dimensions: 1536  # text-embedding-3-small
        vectorSearchProfile: default-profile
    vectorSearch:
      algorithms:
        - name: hnsw-algorithm
          kind: hnsw
          parameters:
            m: 4
            efConstruction: 400
            efSearch: 500
      profiles:
        - name: default-profile
          algorithm: hnsw-algorithm

  - name: cases-index
    fields:
      - name: id
        type: Edm.String
        key: true
      - name: company_profile
        type: Edm.String
        searchable: true
      - name: needs
        type: Edm.String
        searchable: true
      - name: proposal
        type: Edm.String
        searchable: true
      - name: embedding
        type: Collection(Edm.Single)
        dimensions: 1536
        vectorSearchProfile: default-profile
```

---

## 3. CI/CD パイプライン設計

### 3.1 パイプライン概要

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CI/CD Pipeline (GitHub Actions)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Push to main/develop]                                                     │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────┐                                                       │
│  │ 1. Lint & Test  │ ← ruff, pytest                                        │
│  └────────┬────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                       │
│  │ 2. Build Image  │ ← Docker build → ACR push                             │
│  └────────┬────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                       │
│  │ 3. Deploy       │ ← Container Apps デプロイ                             │
│  └────────┬────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                       │
│  │ 4. Health Check │ ← デプロイ確認                                        │
│  └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 ブランチ戦略

```
main ─────────────────────────────────────────────────► Production
  │
  └─ feature/* ──────────► develop ──────────────────► Staging (future)
                              │
                              └─ PR merge ─► main
```

| ブランチ | トリガー | デプロイ先 |
|----------|---------|-----------|
| `main` | push | dev環境 |
| `feature/*` | push | テストのみ（デプロイなし） |
| PR to main | PR | テスト + プレビュー環境（将来） |

### 3.3 GitHub Actions ワークフロー

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AZURE_CONTAINER_REGISTRY: crrikyupocdev
  CONTAINER_APP_NAME: app-rikyu-api-dev
  RESOURCE_GROUP: rg-rikyu-poc-dev

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install uv
          uv sync

      - name: Lint
        run: uv run ruff check .

      - name: Type check
        run: uv run mypy src/

      - name: Test
        run: uv run pytest tests/ -v

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Azure
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Log in to ACR
        run: az acr login --name ${{ env.AZURE_CONTAINER_REGISTRY }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.AZURE_CONTAINER_REGISTRY }}.azurecr.io/rikyu-api
          tags: |
            type=sha,prefix=
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=registry,ref=${{ env.AZURE_CONTAINER_REGISTRY }}.azurecr.io/rikyu-api:cache
          cache-to: type=registry,ref=${{ env.AZURE_CONTAINER_REGISTRY }}.azurecr.io/rikyu-api:cache,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest

    steps:
      - name: Log in to Azure
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --name ${{ env.CONTAINER_APP_NAME }} \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --image ${{ env.AZURE_CONTAINER_REGISTRY }}.azurecr.io/rikyu-api:${{ github.sha }}

      - name: Health check
        run: |
          FQDN=$(az containerapp show \
            --name ${{ env.CONTAINER_APP_NAME }} \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --query properties.configuration.ingress.fqdn -o tsv)
          curl -f https://$FQDN/health || exit 1
```

---

## 4. Infrastructure as Code (Bicep)

### 4.1 ディレクトリ構成

```
infra/
├── main.bicep              # エントリーポイント
├── main.parameters.json    # パラメータ
└── modules/
    ├── container-apps.bicep
    ├── storage.bicep
    ├── ai-search.bicep
    ├── openai.bicep
    └── keyvault.bicep
```

### 4.2 main.bicep

```bicep
// infra/main.bicep
targetScope = 'subscription'

@description('Environment name')
param environmentName string = 'dev'

@description('Location for all resources')
param location string = 'eastus'

@description('Base name for resources')
param baseName string = 'rikyu-poc'

var resourceGroupName = 'rg-${baseName}-${environmentName}'
var tags = {
  project: 'rikyu-sales-poc'
  environment: environmentName
}

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// Log Analytics (required for Container Apps)
module logAnalytics 'modules/log-analytics.bicep' = {
  name: 'logAnalytics'
  scope: rg
  params: {
    name: 'log-${baseName}-${environmentName}'
    location: location
    tags: tags
  }
}

// Storage Account
module storage 'modules/storage.bicep' = {
  name: 'storage'
  scope: rg
  params: {
    name: 'st${replace(baseName, '-', '')}${environmentName}'
    location: location
    tags: tags
  }
}

// AI Search
module aiSearch 'modules/ai-search.bicep' = {
  name: 'aiSearch'
  scope: rg
  params: {
    name: 'srch-${baseName}-${environmentName}'
    location: location
    tags: tags
  }
}

// Azure OpenAI
module openai 'modules/openai.bicep' = {
  name: 'openai'
  scope: rg
  params: {
    name: 'aoai-${baseName}-${environmentName}'
    location: location
    tags: tags
  }
}

// Key Vault
module keyVault 'modules/keyvault.bicep' = {
  name: 'keyVault'
  scope: rg
  params: {
    name: 'kv-${baseName}-${environmentName}'
    location: location
    tags: tags
  }
}

// Container Registry
module acr 'modules/container-registry.bicep' = {
  name: 'acr'
  scope: rg
  params: {
    name: 'cr${replace(baseName, '-', '')}${environmentName}'
    location: location
    tags: tags
  }
}

// Container Apps Environment
module containerApps 'modules/container-apps.bicep' = {
  name: 'containerApps'
  scope: rg
  params: {
    environmentName: 'cae-${baseName}-${environmentName}'
    appName: 'app-${baseName}-api-${environmentName}'
    location: location
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    containerRegistryName: acr.outputs.name
    keyVaultName: keyVault.outputs.name
  }
}

// Outputs
output resourceGroupName string = rg.name
output containerAppFqdn string = containerApps.outputs.fqdn
output storageAccountName string = storage.outputs.name
output aiSearchName string = aiSearch.outputs.name
```

### 4.3 Container Apps モジュール

```bicep
// infra/modules/container-apps.bicep
param environmentName string
param appName string
param location string
param tags object
param logAnalyticsWorkspaceId string
param containerRegistryName string
param keyVaultName string

// Container Apps Environment
resource cae 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2022-10-01').customerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2022-10-01').primarySharedKey
      }
    }
  }
}

// Container App
resource app 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: cae.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: '${containerRegistryName}.azurecr.io'
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'openai-api-key'
          keyVaultUrl: 'https://${keyVaultName}.vault.azure.net/secrets/openai-api-key'
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${containerRegistryName}.azurecr.io/rikyu-api:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'AZURE_OPENAI_API_KEY'
              secretRef: 'openai-api-key'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output principalId string = app.identity.principalId
```

---

## 5. Dockerfile

```dockerfile
# Dockerfile
FROM python:3.11-slim as builder

WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

FROM python:3.11-slim as runtime

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY src/ ./src/

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 6. セキュリティ設計

### 6.1 認証・認可

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Security Architecture                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  【Managed Identity】                                                        │
│  Container Apps → Key Vault (シークレット取得)                              │
│  Container Apps → Storage (Blob アクセス)                                   │
│  Container Apps → AI Search (検索API)                                       │
│  Container Apps → Azure OpenAI (LLM API)                                    │
│                                                                             │
│  【Key Vault シークレット】                                                  │
│  - openai-api-key                                                           │
│  - ai-search-admin-key                                                      │
│  - storage-connection-string (将来的には Managed Identity に移行)           │
│                                                                             │
│  【ネットワーク】                                                            │
│  - Container Apps: Public ingress (HTTPS only)                              │
│  - Storage: Public (将来的に Private Endpoint 検討)                         │
│  - AI Search: Public (将来的に Private Endpoint 検討)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 GitHub Secrets

| Secret名 | 用途 | 取得方法 |
|----------|------|----------|
| `AZURE_CREDENTIALS` | Azure ログイン | Service Principal の JSON |
| `AZURE_SUBSCRIPTION_ID` | サブスクリプションID | Azure Portal |
| `AZURE_TENANT_ID` | テナントID | Azure Portal |

```bash
# Service Principal 作成
az ad sp create-for-rbac \
  --name "sp-rikyu-poc-github" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/rg-rikyu-poc-dev \
  --sdk-auth
```

---

## 7. 環境変数・設定

### 7.1 アプリケーション環境変数

```yaml
# Container Apps 環境変数
env:
  # Azure OpenAI
  - name: AZURE_OPENAI_ENDPOINT
    value: https://aoai-rikyu-poc-dev.openai.azure.com/
  - name: AZURE_OPENAI_API_KEY
    secretRef: openai-api-key
  - name: AZURE_OPENAI_DEPLOYMENT_NAME
    value: gpt-4o

  # Azure AI Search
  - name: AZURE_SEARCH_ENDPOINT
    value: https://srch-rikyu-poc-dev.search.windows.net
  - name: AZURE_SEARCH_INDEX_NAME
    value: knowledge-index

  # Azure Storage
  - name: AZURE_STORAGE_ACCOUNT_NAME
    value: strikyupocdev
  - name: AZURE_STORAGE_CONTAINER_NAME
    value: scenarios

  # Opik (トレーシング)
  - name: OPIK_API_KEY
    secretRef: opik-api-key
  - name: OPIK_PROJECT_NAME
    value: rikyu-sales-poc
```

---

## 8. デプロイ手順

### 8.1 初回セットアップ

```bash
# 1. Azure CLI ログイン
az login

# 2. サブスクリプション設定
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# 3. Bicep デプロイ（インフラ構築）
az deployment sub create \
  --location eastus \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.json

# 4. GitHub Secrets 設定
# GitHub リポジトリの Settings > Secrets and variables > Actions で設定

# 5. 初回イメージビルド・プッシュ
az acr login --name crrikyupocdev
docker build -t crrikyupocdev.azurecr.io/rikyu-api:latest .
docker push crrikyupocdev.azurecr.io/rikyu-api:latest

# 6. Container App 初回デプロイ
az containerapp update \
  --name app-rikyu-api-dev \
  --resource-group rg-rikyu-poc-dev \
  --image crrikyupocdev.azurecr.io/rikyu-api:latest
```

### 8.2 以降の更新

```bash
# main ブランチにマージ → GitHub Actions が自動実行
git checkout main
git merge feature/your-feature
git push origin main

# デプロイ状況確認
az containerapp revision list \
  --name app-rikyu-api-dev \
  --resource-group rg-rikyu-poc-dev \
  --output table
```

---

## 9. コスト試算

### 9.1 月額コスト（概算）

| リソース | SKU | 月額（USD） | 備考 |
|----------|-----|------------|------|
| Container Apps | Consumption | ~$10-30 | 使用量依存 |
| Container Registry | Basic | ~$5 | |
| Storage Account | Standard_LRS | ~$1 | 100GB想定 |
| AI Search | Basic | ~$70 | |
| Azure OpenAI | S0 | ~$50-200 | 使用量依存 |
| Key Vault | Standard | ~$1 | |
| Log Analytics | PerGB | ~$5 | |
| **合計** | | **~$150-320** | |

### 9.2 コスト最適化

- Container Apps: ゼロスケール設定で非使用時コスト削減
- AI Search: Free tier（開発初期のみ）の活用検討
- Storage: ライフサイクル管理で古いデータを自動削除

---

## 10. 監視・ログ

### 10.1 Application Insights

```python
# src/telemetry.py
from opentelemetry import trace
from azure.monitor.opentelemetry import configure_azure_monitor

def setup_telemetry():
    configure_azure_monitor(
        connection_string=os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"]
    )
```

### 10.2 アラート設定

| メトリクス | 条件 | アクション |
|-----------|------|-----------|
| HTTP 5xx | > 10/5min | メール通知 |
| Response Time | > 5s (avg) | メール通知 |
| Container Restart | > 3/hour | メール通知 |

---

## 更新履歴

| 日付 | バージョン | 更新内容 | 担当 |
|------|-----------|---------|------|
| 2025-01-26 | 1.0 | 初版作成 | - |
