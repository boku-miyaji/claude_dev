# 01. System Architecture - システムアーキテクチャ設計

> **目的**: LLM システムの全体構成、レイヤー分離、コンポーネント責務を定義

---

## 1. アーキテクチャ概要

### 1.1 レイヤードアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                    Presentation Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Web UI     │  │  API Client │  │  CLI / Scripts          │ │
│  │  (Next.js)  │  │  (External) │  │  (Python)               │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / JSON
┌───────────────────────────▼─────────────────────────────────────┐
│                    API Layer (FastAPI)                          │
│  ┌────────────────────────────────────────────────────────────┐│
│  │  Routers: /projects /processes /prompts /metrics /health   ││
│  │  • リクエスト検証 (Pydantic Schemas)                        ││
│  │  • 認証・認可 (Middleware)                                  ││
│  │  • レート制限                                               ││
│  └────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Service Layer                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Process Service │  │  Prompt Service  │  │ State Manager │ │
│  │  ・ビジネスロジック │  │  ・プロンプト管理  │  │ ・状態遷移    │ │
│  │  ・LLM呼び出し     │  │  ・バージョン管理  │  │ ・依存管理    │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   LLM Service Layer                       │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         │  │
│  │  │ OpenAI │  │ Google │  │ Claude │  │  Mock  │         │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Data Access Layer                            │
│  ┌────────────────────────────────────────────────────────────┐│
│  │  Repository Pattern / ORM (SQLAlchemy)                     ││
│  │  • CRUD操作                                                ││
│  │  • トランザクション管理                                     ││
│  │  • クエリ最適化                                            ││
│  └────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Infrastructure Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Database │  │ LLM APIs │  │  Cache   │  │  Queue   │       │
│  │ PG/SQLite│  │OpenAI/etc│  │  Redis   │  │  Celery  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 レイヤー責務

| レイヤー | 責務 | 依存方向 |
|---------|------|---------|
| Presentation | UI描画、ユーザー操作受付 | → API Layer |
| API | リクエスト検証、ルーティング | → Service Layer |
| Service | ビジネスロジック、LLM統合 | → Data Access Layer |
| Data Access | 永続化、クエリ実行 | → Infrastructure |
| Infrastructure | 外部サービス連携 | なし |

---

## 2. ディレクトリ構造

### 2.1 バックエンド構造

```
backend/
├── src/
│   ├── main.py                 # アプリケーションエントリポイント
│   ├── config.py               # 設定定義
│   ├── settings.py             # Pydantic Settings
│   ├── database.py             # DB接続・セッション管理
│   │
│   ├── routers/                # API Layer
│   │   ├── __init__.py
│   │   ├── projects.py         # プロジェクトCRUD
│   │   ├── processes.py        # プロセス実行
│   │   ├── prompts.py          # プロンプト管理
│   │   ├── metrics.py          # メトリクス取得
│   │   └── health.py           # ヘルスチェック
│   │
│   ├── schemas/                # Request/Response Schemas
│   │   ├── __init__.py
│   │   ├── project.py
│   │   ├── process.py
│   │   ├── prompt.py
│   │   └── common.py
│   │
│   ├── services/               # Service Layer
│   │   ├── __init__.py
│   │   ├── llm/               # LLM統合 (詳細は02-LLM-INTEGRATION)
│   │   │   ├── base.py
│   │   │   ├── openai.py
│   │   │   ├── google.py
│   │   │   ├── mock/
│   │   │   └── factory.py
│   │   ├── process/           # プロセス実行 (詳細は04-PROCESS-PIPELINE)
│   │   │   ├── base.py
│   │   │   └── {domain}_service.py
│   │   ├── state_manager.py   # 状態管理
│   │   └── metrics_recorder.py # メトリクス記録
│   │
│   ├── prompts/               # Prompt Layer (詳細は03-PROMPT-MANAGEMENT)
│   │   ├── registry.py
│   │   ├── config.py
│   │   └── categories/
│   │
│   ├── models/                # Data Access Layer
│   │   ├── __init__.py
│   │   ├── base.py            # ベースクラス、型定義
│   │   ├── project.py
│   │   ├── process.py
│   │   ├── prompt.py
│   │   └── metrics.py
│   │
│   └── utils/                 # ユーティリティ
│       ├── __init__.py
│       └── helpers.py
│
├── tests/                     # テスト
│   ├── conftest.py
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── alembic/                   # DBマイグレーション
│   ├── versions/
│   └── env.py
│
├── data/                      # データファイル
│   └── prompt_overrides.json
│
└── pyproject.toml
```

### 2.2 フロントエンド構造

```
frontend/
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── workspace/
│   │   └── prompts/
│   │
│   ├── components/
│   │   ├── layout/            # レイアウトコンポーネント
│   │   ├── ui/                # 汎用UIコンポーネント
│   │   └── domain/            # ドメイン固有コンポーネント
│   │
│   ├── lib/
│   │   ├── api/               # APIクライアント
│   │   │   ├── client.ts
│   │   │   └── hooks/
│   │   └── utils/
│   │
│   ├── types/                 # TypeScript型定義
│   │   ├── api.ts
│   │   └── domain.ts
│   │
│   └── config/
│       └── index.ts
│
├── public/
├── package.json
└── tsconfig.json
```

### 2.3 共有モジュール構造

```
shared/
├── llm/                       # 同期LLMクライアント（スクリプト用）
│   ├── __init__.py
│   ├── base.py
│   ├── openai.py
│   ├── google.py
│   ├── factory.py
│   ├── env.py
│   └── mock_data.py
│
└── types/                     # 共通型定義
    └── __init__.py
```

---

## 3. コンポーネント詳細

### 3.1 API Layer

```python
# routers/projects.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..schemas.project import ProjectCreate, ProjectResponse
from ..services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectResponse)
async def create_project(
    data: ProjectCreate,
    session: AsyncSession = Depends(get_session)
) -> ProjectResponse:
    """プロジェクト作成"""
    service = ProjectService(session)
    return await service.create(data)
```

### 3.2 Service Layer

```python
# services/process/base.py
from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from ..llm.base import LLMService
from ...prompts.registry import PromptRegistry

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")

class BaseProcessService(ABC, Generic[TInput, TOutput]):
    """プロセスサービスの基底クラス"""

    def __init__(
        self,
        llm_service: LLMService,
        prompt_registry: PromptRegistry
    ):
        self.llm = llm_service
        self.prompts = prompt_registry

    @abstractmethod
    async def execute(self, input_data: TInput) -> TOutput:
        """プロセス実行"""
        pass

    async def _call_llm(
        self,
        prompt_id: str,
        **template_vars
    ) -> dict:
        """LLM呼び出しの共通処理"""
        prompt_config = self.prompts.get(prompt_id)
        system_prompt = prompt_config.get_system_prompt(self.llm.provider)
        user_prompt = prompt_config.format_user_prompt(
            self.llm.provider,
            **template_vars
        )

        result, usage = await self.llm.generate_json_with_usage(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=prompt_config.get_temperature(self.llm.provider)
        )
        return result
```

### 3.3 Data Access Layer

```python
# models/base.py
from sqlalchemy import TypeDecorator, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import DeclarativeBase
import uuid
import json

class GUID(TypeDecorator):
    """UUID型（PostgreSQL: UUID / SQLite: String）"""
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value) if dialect.name != "postgresql" else value
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid.UUID(str(value))
        return value

class JSONType(TypeDecorator):
    """JSON型（PostgreSQL: JSONB / SQLite: Text）"""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB)
        return dialect.type_descriptor(Text)

    def process_bind_param(self, value, dialect):
        if value is not None and dialect.name != "postgresql":
            return json.dumps(value, ensure_ascii=False)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and isinstance(value, str):
            return json.loads(value)
        return value

class Base(DeclarativeBase):
    """SQLAlchemy Base"""
    pass
```

---

## 4. 依存性注入パターン

### 4.1 FastAPI Dependency Injection

```python
# dependencies.py
from functools import lru_cache
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_session
from .settings import Settings
from .services.llm.factory import create_llm_service
from .prompts.registry import PromptRegistry

@lru_cache
def get_settings() -> Settings:
    return Settings()

async def get_llm_service(
    settings: Settings = Depends(get_settings)
) -> LLMService:
    return create_llm_service(
        provider=settings.default_llm_provider,
        api_key=settings.openai_api_key
    )

def get_prompt_registry() -> PromptRegistry:
    return PromptRegistry()

async def get_process_service(
    session: AsyncSession = Depends(get_session),
    llm: LLMService = Depends(get_llm_service),
    prompts: PromptRegistry = Depends(get_prompt_registry)
) -> ProcessService:
    return ProcessService(session, llm, prompts)
```

---

## 5. 非同期処理アーキテクチャ

### 5.1 同期 vs 非同期の使い分け

| 処理タイプ | 実装 | 理由 |
|-----------|------|------|
| API ハンドラ | async | I/O待機時に他リクエスト処理可能 |
| LLM 呼び出し | async | 数秒〜数分の待機時間 |
| DB クエリ | async | I/O待機 |
| CPU集約処理 | sync (別ワーカー) | イベントループブロック回避 |
| スクリプト | sync | 単純な逐次処理 |

### 5.2 バックグラウンドタスク

```python
# 長時間処理のパターン
from fastapi import BackgroundTasks

@router.post("/processes/{id}/execute")
async def execute_process(
    id: str,
    background_tasks: BackgroundTasks,
    service: ProcessService = Depends(get_process_service)
):
    # 即座にジョブIDを返却
    job_id = await service.create_job(id)

    # バックグラウンドで実行
    background_tasks.add_task(service.execute_async, job_id)

    return {"job_id": job_id, "status": "pending"}
```

---

## 6. エラーハンドリング戦略

### 6.1 例外階層

```python
# exceptions.py
class AppException(Exception):
    """アプリケーション例外の基底クラス"""
    def __init__(self, message: str, code: str = "UNKNOWN_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)

class ValidationError(AppException):
    """入力検証エラー"""
    def __init__(self, message: str):
        super().__init__(message, "VALIDATION_ERROR")

class LLMError(AppException):
    """LLM関連エラー"""
    pass

class LLMRateLimitError(LLMError):
    """レート制限エラー"""
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, "LLM_RATE_LIMIT")

class LLMTimeoutError(LLMError):
    """タイムアウトエラー"""
    def __init__(self, message: str = "LLM request timeout"):
        super().__init__(message, "LLM_TIMEOUT")

class ProcessError(AppException):
    """プロセス実行エラー"""
    pass

class ProcessDependencyError(ProcessError):
    """依存プロセス未完了エラー"""
    def __init__(self, missing: list[str]):
        super().__init__(
            f"Missing dependencies: {missing}",
            "PROCESS_DEPENDENCY_ERROR"
        )
```

### 6.2 グローバル例外ハンドラ

```python
# main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message
            }
        }
    )

@app.exception_handler(LLMRateLimitError)
async def rate_limit_handler(request: Request, exc: LLMRateLimitError):
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "retry_after": 60
            }
        }
    )
```

---

## 7. セキュリティ考慮事項

### 7.1 API セキュリティ

```python
# middleware/auth.py
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """JWTトークン検証"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### 7.2 入力サニタイゼーション

```python
# schemas/common.py
from pydantic import BaseModel, field_validator
import re

class SafeTextInput(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        # HTMLタグ除去（必要に応じて）
        v = re.sub(r"<[^>]+>", "", v)
        # 最大長制限
        return v[:50000]
```

### 7.3 シークレット管理

```python
# settings.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # APIキーは環境変数から取得
    openai_api_key: str = ""
    google_ai_api_key: str = ""

    # 本番では SecretStr を使用
    # from pydantic import SecretStr
    # openai_api_key: SecretStr
```

---

## 8. スケーラビリティ設計

### 8.1 水平スケーリング

```
                     ┌─────────────────┐
                     │  Load Balancer  │
                     └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │  Backend 1  │   │  Backend 2  │   │  Backend 3  │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                 │                 │
           └─────────────────┼─────────────────┘
                             │
                     ┌───────▼───────┐
                     │  PostgreSQL   │
                     │   (Primary)   │
                     └───────┬───────┘
                             │
                     ┌───────▼───────┐
                     │   Read Replica│
                     └───────────────┘
```

### 8.2 キャッシング戦略

```python
# services/cache.py
from functools import lru_cache
import redis.asyncio as redis

class CacheService:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    async def get_cached_response(
        self,
        prompt_hash: str
    ) -> dict | None:
        """同一プロンプトの結果をキャッシュから取得"""
        cached = await self.redis.get(f"llm:response:{prompt_hash}")
        if cached:
            return json.loads(cached)
        return None

    async def cache_response(
        self,
        prompt_hash: str,
        response: dict,
        ttl: int = 3600
    ):
        """LLMレスポンスをキャッシュ"""
        await self.redis.setex(
            f"llm:response:{prompt_hash}",
            ttl,
            json.dumps(response)
        )
```

---

## 9. 設計原則サマリ

| 原則 | 適用 |
|------|------|
| 単一責任 | 各サービスは1つの責務のみ |
| 依存性逆転 | 抽象に依存、具象に依存しない |
| インターフェース分離 | LLMService は共通インターフェース |
| 開放閉鎖 | 新Provider追加は既存コード変更不要 |
| リスコフ置換 | Mock/Real LLMService は交換可能 |

---

## 10. 関連ドキュメント

- [02-LLM-INTEGRATION.md](./02-LLM-INTEGRATION.md) - LLM統合の詳細
- [04-PROCESS-PIPELINE.md](./04-PROCESS-PIPELINE.md) - プロセス設計の詳細
- [05-DATA-MODEL.md](./05-DATA-MODEL.md) - データモデルの詳細
