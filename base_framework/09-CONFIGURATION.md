# 09. Configuration - 設定・環境管理設計

> **目的**: 環境変数、設定管理、デプロイメント設定を定義

---

## 1. 設定管理の原則

```
┌─────────────────────────────────────────────────────────────────┐
│                   Configuration Principles                      │
├─────────────────────────────────────────────────────────────────┤
│  1. Environment Variables - シークレットは環境変数で管理       │
│  2. Type Safety          - Pydantic Settingsで型検証           │
│  3. Defaults             - 合理的なデフォルト値                │
│  4. Validation           - 起動時に設定検証                    │
│  5. Documentation        - .env.example による文書化           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Pydantic Settings

### 2.1 設定クラス

```python
# settings.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from typing import Literal
from functools import lru_cache

class Settings(BaseSettings):
    """アプリケーション設定"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

    # ===================
    # アプリケーション
    # ===================
    app_name: str = "LLM System"
    app_version: str = "1.0.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False

    # ===================
    # サーバー
    # ===================
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1
    reload: bool = False

    # ===================
    # データベース
    # ===================
    database_url: str = "sqlite:///./app.db"

    @property
    def async_database_url(self) -> str:
        """非同期DB接続URL"""
        url = self.database_url
        if url.startswith("sqlite:"):
            return url.replace("sqlite:", "sqlite+aiosqlite:")
        elif url.startswith("postgresql:"):
            return url.replace("postgresql:", "postgresql+asyncpg:")
        return url

    # DB接続プール
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30

    # ===================
    # LLM API
    # ===================
    openai_api_key: str = ""
    google_ai_api_key: str = ""
    anthropic_api_key: str = ""

    default_llm_provider: Literal["openai", "google", "anthropic", "mock"] = "openai"
    default_openai_model: str = "gpt-4o"
    default_google_model: str = "gemini-pro"

    llm_timeout: int = 300  # 5分
    llm_max_retries: int = 3

    # ===================
    # セキュリティ
    # ===================
    secret_key: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24

    cors_origins: list[str] = ["http://localhost:3000"]

    # ===================
    # ログ
    # ===================
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_format: Literal["json", "text"] = "json"

    # ===================
    # 機能フラグ
    # ===================
    enable_metrics: bool = True
    enable_rate_limit: bool = False
    rate_limit_per_minute: int = 60

    # ===================
    # バリデーション
    # ===================
    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        if info.data.get("environment") == "production":
            if v == "change-me-in-production" or len(v) < 32:
                raise ValueError(
                    "Secret key must be at least 32 characters in production"
                )
        return v

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v


@lru_cache
def get_settings() -> Settings:
    """シングルトン設定インスタンス"""
    return Settings()
```

---

## 3. 環境変数ファイル

### 3.1 .env.example

```bash
# ===================
# Application
# ===================
APP_NAME=LLM System
ENVIRONMENT=development
DEBUG=true

# ===================
# Server
# ===================
HOST=0.0.0.0
PORT=8000
WORKERS=1
RELOAD=true

# ===================
# Database
# ===================
# SQLite (開発用)
DATABASE_URL=sqlite:///./app.db

# PostgreSQL (本番用)
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname

DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20

# ===================
# LLM API Keys
# ===================
# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Google AI
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Anthropic (Claude)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Default provider
DEFAULT_LLM_PROVIDER=openai
DEFAULT_OPENAI_MODEL=gpt-4o

# ===================
# Security
# ===================
SECRET_KEY=your-secret-key-at-least-32-characters-long
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# CORS (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# ===================
# Logging
# ===================
LOG_LEVEL=INFO
LOG_FORMAT=json

# ===================
# Features
# ===================
ENABLE_METRICS=true
ENABLE_RATE_LIMIT=false
RATE_LIMIT_PER_MINUTE=60
```

### 3.2 環境別設定

```bash
# .env.development
ENVIRONMENT=development
DEBUG=true
DATABASE_URL=sqlite:///./dev.db
LOG_LEVEL=DEBUG

# .env.staging
ENVIRONMENT=staging
DEBUG=false
DATABASE_URL=postgresql://user:pass@staging-db:5432/app
LOG_LEVEL=INFO

# .env.production
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql://user:pass@prod-db:5432/app
LOG_LEVEL=WARNING
ENABLE_RATE_LIMIT=true
```

---

## 4. Docker設定

### 4.1 docker-compose.yml

```yaml
# docker-compose.yml
version: "3.8"

services:
  # バックエンド
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/app
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY}
      - ENVIRONMENT=development
    depends_on:
      - postgres
    volumes:
      - ./backend:/app
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

  # フロントエンド
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

  # PostgreSQL
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # pgAdmin (オプション)
  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

  # Redis (キャッシュ用、オプション)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 4.2 Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 依存関係インストール
RUN pip install uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# アプリケーションコード
COPY . .

# 環境変数
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# ポート
EXPOSE 8000

# 起動コマンド
CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 4.3 Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# 依存関係インストール
COPY package.json package-lock.json ./
RUN npm ci

# アプリケーションコード
COPY . .

# ビルド（本番用）
# RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

---

## 5. フロントエンド設定

### 5.1 Next.js設定

```typescript
// frontend/config/index.ts
export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    timeout: 300000, // 5分
  },
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'LLM System',
  },
  features: {
    enableMetrics: process.env.NEXT_PUBLIC_ENABLE_METRICS === 'true',
  },
} as const;

// 型定義
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_APP_NAME?: string;
      NEXT_PUBLIC_ENABLE_METRICS?: string;
    }
  }
}
```

### 5.2 next.config.js

```javascript
// frontend/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 環境変数
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // APIプロキシ（開発用）
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },

  // ヘッダー
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

---

## 6. 設定の検証

```python
# main.py
from .settings import get_settings

def validate_configuration():
    """起動時の設定検証"""
    settings = get_settings()
    errors = []

    # 本番環境チェック
    if settings.environment == "production":
        if not settings.openai_api_key and not settings.google_ai_api_key:
            errors.append("At least one LLM API key is required in production")

        if "sqlite" in settings.database_url:
            errors.append("SQLite is not recommended for production")

        if settings.debug:
            errors.append("Debug mode should be disabled in production")

    if errors:
        for error in errors:
            logger.error(f"Configuration error: {error}")
        raise ValueError(f"Configuration validation failed: {errors}")

    logger.info(f"Configuration validated for {settings.environment}")

# アプリケーション起動時
@app.on_event("startup")
async def startup():
    validate_configuration()
```

---

## 7. シークレット管理

### 7.1 開発環境

```bash
# .env ファイルを使用（.gitignore に追加）
echo ".env" >> .gitignore
```

### 7.2 本番環境

```yaml
# Kubernetes Secret
apiVersion: v1
kind: Secret
metadata:
  name: llm-system-secrets
type: Opaque
stringData:
  OPENAI_API_KEY: "sk-..."
  DATABASE_URL: "postgresql://..."
  SECRET_KEY: "..."
```

```yaml
# デプロイメントでの参照
env:
  - name: OPENAI_API_KEY
    valueFrom:
      secretKeyRef:
        name: llm-system-secrets
        key: OPENAI_API_KEY
```

---

## 8. 設定のリロード

```python
# 設定のホットリロード（開発用）
import watchfiles

async def watch_config():
    """設定ファイル変更を監視"""
    async for changes in watchfiles.awatch(".env"):
        logger.info(f"Configuration file changed: {changes}")
        # キャッシュクリア
        get_settings.cache_clear()
        # 新しい設定をロード
        new_settings = get_settings()
        logger.info(f"Configuration reloaded")
```

---

## 9. 関連ドキュメント

- [01-SYSTEM-ARCHITECTURE.md](./01-SYSTEM-ARCHITECTURE.md) - 全体構成
- [08-OBSERVABILITY.md](./08-OBSERVABILITY.md) - ログ設定
- [10-TESTING-STRATEGY.md](./10-TESTING-STRATEGY.md) - テスト環境設定
