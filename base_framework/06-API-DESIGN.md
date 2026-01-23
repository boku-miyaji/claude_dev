# 06. API Design - API設計

> **目的**: RESTful API設計規約、エンドポイント構造、エラーハンドリングを定義

---

## 1. 設計原則

```
┌─────────────────────────────────────────────────────────────────┐
│                      Design Principles                          │
├─────────────────────────────────────────────────────────────────┤
│  1. RESTful         - リソース指向のURL設計                    │
│  2. Versioning      - APIバージョニング (/api/v1/)            │
│  3. Consistency     - 統一されたリクエスト/レスポンス形式      │
│  4. Error Handling  - 標準化されたエラーレスポンス             │
│  5. Documentation   - OpenAPI/Swagger自動生成                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. エンドポイント構造

### 2.1 URL設計

```
/api/v1/
├── /projects                      # プロジェクト管理
│   ├── GET    /                   # 一覧取得
│   ├── POST   /                   # 新規作成
│   ├── GET    /{id}               # 詳細取得
│   ├── PATCH  /{id}               # 更新
│   ├── DELETE /{id}               # 削除
│   │
│   └── /{id}/processes            # プロセス関連
│       ├── GET    /               # 全プロセス状態
│       ├── POST   /{pid}/execute  # プロセス実行
│       ├── GET    /{pid}/history  # 実行履歴
│       └── POST   /{pid}/reset    # 状態リセット
│
├── /prompts                       # プロンプト管理
│   ├── GET    /                   # 一覧取得
│   ├── GET    /{id}               # 詳細取得
│   ├── PATCH  /{id}               # 更新
│   ├── GET    /{id}/versions      # バージョン一覧
│   └── POST   /{id}/rollback      # ロールバック
│
├── /metrics                       # メトリクス
│   ├── GET    /summary            # サマリー
│   ├── GET    /by-project/{id}    # プロジェクト別
│   └── GET    /by-process/{id}    # プロセス別
│
└── /health                        # ヘルスチェック
    └── GET    /                   # 状態確認
```

### 2.2 命名規則

```python
# 良い例
GET  /api/v1/projects              # コレクション（複数形）
GET  /api/v1/projects/{id}         # 単一リソース
POST /api/v1/projects/{id}/execute # アクション（動詞）

# 悪い例
GET  /api/v1/getProjects           # 動詞をURLに含めない
GET  /api/v1/project               # 単数形を避ける
POST /api/v1/projects/{id}/doExecute  # 冗長
```

---

## 3. リクエスト/レスポンス形式

### 3.1 リクエスト

```python
# schemas/common.py
from pydantic import BaseModel, Field
from typing import Any

class PaginationParams(BaseModel):
    """ページネーションパラメータ"""
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

class SortParams(BaseModel):
    """ソートパラメータ"""
    sort_by: str = "created_at"
    sort_order: str = "desc"  # asc, desc

class FilterParams(BaseModel):
    """フィルタパラメータ"""
    status: str | None = None
    created_after: datetime | None = None
    created_before: datetime | None = None
```

### 3.2 レスポンス

```python
# 成功レスポンス
class SuccessResponse(BaseModel):
    """単一リソースレスポンス"""
    data: Any
    meta: dict | None = None

class ListResponse(BaseModel):
    """一覧レスポンス"""
    data: list[Any]
    pagination: PaginationMeta

class PaginationMeta(BaseModel):
    """ページネーションメタ"""
    total: int
    page: int
    page_size: int
    total_pages: int

# エラーレスポンス
class ErrorResponse(BaseModel):
    """エラーレスポンス"""
    error: ErrorDetail

class ErrorDetail(BaseModel):
    """エラー詳細"""
    code: str           # ERROR_CODE
    message: str        # Human readable message
    details: dict | None = None  # Additional info
    trace_id: str | None = None  # For debugging
```

---

## 4. FastAPIルーター実装

### 4.1 基本構造

```python
# routers/projects.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from ..database import get_session
from ..schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse
)
from ..services.project_service import ProjectService

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
    responses={404: {"model": ErrorResponse}}
)

@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    session: AsyncSession = Depends(get_session)
):
    """プロジェクト一覧を取得"""
    service = ProjectService(session)
    projects, total = await service.list(
        page=page,
        page_size=page_size,
        status=status
    )
    return ProjectListResponse(
        data=[ProjectResponse.model_validate(p) for p in projects],
        pagination=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size
        )
    )

@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    session: AsyncSession = Depends(get_session)
):
    """プロジェクトを作成"""
    service = ProjectService(session)
    project = await service.create(data)
    return ProjectResponse.model_validate(project)

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """プロジェクト詳細を取得"""
    service = ProjectService(session)
    project = await service.get(str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse.model_validate(project)

@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    session: AsyncSession = Depends(get_session)
):
    """プロジェクトを更新"""
    service = ProjectService(session)
    project = await service.update(str(project_id), data)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse.model_validate(project)

@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """プロジェクトを削除"""
    service = ProjectService(session)
    success = await service.delete(str(project_id))
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
```

### 4.2 プロセス実行エンドポイント

```python
# routers/processes.py

@router.post(
    "/{project_id}/processes/{process_id}/execute",
    response_model=ProcessExecutionResponse
)
async def execute_process(
    project_id: UUID,
    process_id: str,
    request: ProcessExecuteRequest,
    session: AsyncSession = Depends(get_session),
    llm_service: LLMService = Depends(get_llm_service)
):
    """プロセスを実行"""
    service = get_process_service(process_id, session, llm_service)
    if not service:
        raise HTTPException(status_code=400, detail=f"Unknown process: {process_id}")

    try:
        result = await service.execute(str(project_id), request.data)
        return ProcessExecutionResponse(
            process_id=process_id,
            status="completed",
            output=result
        )
    except ProcessDependencyError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "DEPENDENCY_NOT_MET",
                "message": str(e),
                "missing": e.missing
            }
        )
    except LLMError as e:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "LLM_ERROR",
                "message": str(e)
            }
        )
```

---

## 5. エラーハンドリング

### 5.1 例外ハンドラ

```python
# main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from .exceptions import AppException, ValidationError, NotFoundError

app = FastAPI()

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            }
        }
    )

@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Validation failed",
                "details": exc.errors
            }
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # ログ記録
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred"
            }
        }
    )
```

### 5.2 エラーコード一覧

```python
# exceptions.py

class ErrorCode:
    # 汎用
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"

    # プロジェクト
    PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND"
    PROJECT_ARCHIVED = "PROJECT_ARCHIVED"

    # プロセス
    PROCESS_NOT_FOUND = "PROCESS_NOT_FOUND"
    PROCESS_DEPENDENCY_ERROR = "PROCESS_DEPENDENCY_ERROR"
    PROCESS_ALREADY_RUNNING = "PROCESS_ALREADY_RUNNING"

    # LLM
    LLM_ERROR = "LLM_ERROR"
    LLM_RATE_LIMIT = "LLM_RATE_LIMIT"
    LLM_TIMEOUT = "LLM_TIMEOUT"
    LLM_CONTENT_FILTER = "LLM_CONTENT_FILTER"

    # プロンプト
    PROMPT_NOT_FOUND = "PROMPT_NOT_FOUND"
    PROMPT_VALIDATION_ERROR = "PROMPT_VALIDATION_ERROR"
```

---

## 6. 認証・認可

### 6.1 JWT認証

```python
# middleware/auth.py
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """JWTトークンからユーザー情報を取得"""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail={"code": "TOKEN_EXPIRED", "message": "Token has expired"}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "Invalid token"}
        )

# ルーターでの使用
@router.get("/protected")
async def protected_route(
    user: dict = Depends(get_current_user)
):
    return {"user": user}
```

### 6.2 APIキー認証

```python
# middleware/api_key.py
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(
    api_key: str = Security(api_key_header)
) -> bool:
    """APIキーを検証"""
    if api_key not in settings.valid_api_keys:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_API_KEY", "message": "Invalid API key"}
        )
    return True
```

---

## 7. OpenAPI設定

### 7.1 メタデータ

```python
# main.py
from fastapi import FastAPI

app = FastAPI(
    title="LLM System API",
    description="LLM-based System Framework API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    openapi_tags=[
        {"name": "projects", "description": "Project management"},
        {"name": "processes", "description": "Process execution"},
        {"name": "prompts", "description": "Prompt management"},
        {"name": "metrics", "description": "Usage metrics"},
    ]
)
```

### 7.2 レスポンス例

```python
# schemas/examples.py

PROJECT_EXAMPLE = {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Sample Project",
    "description": "A sample project",
    "status": "in_progress",
    "created_at": "2024-01-15T10:30:00Z"
}

# ルーターでの使用
@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    responses={
        200: {
            "description": "Project details",
            "content": {
                "application/json": {
                    "example": PROJECT_EXAMPLE
                }
            }
        },
        404: {
            "description": "Project not found",
            "content": {
                "application/json": {
                    "example": {
                        "error": {
                            "code": "PROJECT_NOT_FOUND",
                            "message": "Project not found"
                        }
                    }
                }
            }
        }
    }
)
async def get_project(project_id: UUID):
    ...
```

---

## 8. CORS設定

```python
# main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 9. レート制限

```python
# middleware/rate_limit.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ルーターでの使用
@router.post("/execute")
@limiter.limit("10/minute")
async def execute_with_limit(request: Request):
    ...
```

---

## 10. 関連ドキュメント

- [01-SYSTEM-ARCHITECTURE.md](./01-SYSTEM-ARCHITECTURE.md) - 全体構成
- [05-DATA-MODEL.md](./05-DATA-MODEL.md) - スキーマ定義
- [07-FRONTEND-INTEGRATION.md](./07-FRONTEND-INTEGRATION.md) - APIクライアント
