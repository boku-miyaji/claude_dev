# 05. Data Model - データモデル設計

> **目的**: データベーススキーマ、型抽象化、マイグレーション戦略を定義

---

## 1. 設計目標

```
┌─────────────────────────────────────────────────────────────────┐
│                      Design Goals                               │
├─────────────────────────────────────────────────────────────────┤
│  1. DB Agnostic       - SQLite/PostgreSQL両対応               │
│  2. Type Safety       - Pydantic連携による型安全性            │
│  3. Migration Ready   - Alembicによるスキーマ管理             │
│  4. Audit Trail       - 作成・更新履歴の追跡                  │
│  5. Soft Delete       - 論理削除対応                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. ER図

```
┌─────────────────┐       ┌─────────────────┐
│     Project     │       │ProcessDefinition│
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ name            │       │ name            │
│ description     │       │ order_index     │
│ status          │       │ input_schema    │
│ created_at      │       │ output_schema   │
│ updated_at      │       │ depends_on      │
└────────┬────────┘       └────────┬────────┘
         │                         │
         │ 1:N                     │ 1:N
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│ProcessExecution │◀──────│  ProcessState   │
├─────────────────┤  1:1  ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ project_id (FK) │       │ project_id (FK) │
│ process_id (FK) │       │ process_id (FK) │
│ input_data      │       │ state           │
│ output_data     │       │ version         │
│ status          │       │ current_exec_id │
│ created_at      │       │ last_updated_at │
└────────┬────────┘       └─────────────────┘
         │
         │ N:1
         ▼
┌─────────────────┐       ┌─────────────────┐
│  PromptVersion  │       │   LLMMetrics    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ prompt_id       │       │ project_id (FK) │
│ version         │       │ process_id      │
│ system_prompt   │       │ provider        │
│ user_template   │       │ model           │
│ temperature     │       │ prompt_tokens   │
│ created_at      │       │ completion_tkns │
│ created_by      │       │ cost_usd        │
└─────────────────┘       │ inference_time  │
                          │ created_at      │
                          └─────────────────┘
```

---

## 3. 型抽象化

### 3.1 データベース非依存型

```python
# models/base.py
from sqlalchemy import TypeDecorator, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB, ARRAY
from sqlalchemy.orm import DeclarativeBase
import uuid
import json
from typing import Any

class GUID(TypeDecorator):
    """
    UUID型 - データベース非依存
    - PostgreSQL: UUID型
    - SQLite: String(36)
    """
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is not None:
            if dialect.name == "postgresql":
                return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid.UUID(str(value)) if not isinstance(value, uuid.UUID) else value
        return value


class JSONType(TypeDecorator):
    """
    JSON型 - データベース非依存
    - PostgreSQL: JSONB（インデックス可能）
    - SQLite: Text（JSON文字列）
    """
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB)
        return dialect.type_descriptor(Text)

    def process_bind_param(self, value, dialect):
        if value is not None:
            if dialect.name != "postgresql":
                return json.dumps(value, ensure_ascii=False, default=str)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if isinstance(value, str):
                return json.loads(value)
        return value


class ArrayType(TypeDecorator):
    """
    配列型 - データベース非依存
    - PostgreSQL: ARRAY
    - SQLite: Text（JSONシリアライズ）
    """
    impl = Text
    cache_ok = True

    def __init__(self, item_type=String):
        super().__init__()
        self.item_type = item_type

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(self.item_type))
        return dialect.type_descriptor(Text)

    def process_bind_param(self, value, dialect):
        if value is not None and dialect.name != "postgresql":
            return json.dumps(value, ensure_ascii=False)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if isinstance(value, str):
                return json.loads(value)
        return value


class Base(DeclarativeBase):
    """SQLAlchemy Declarative Base"""
    pass
```

### 3.2 ミックスイン

```python
# models/mixins.py
from sqlalchemy import Column, DateTime, Boolean
from datetime import datetime

class TimestampMixin:
    """作成・更新日時"""
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SoftDeleteMixin:
    """論理削除"""
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime)

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()

class AuditMixin(TimestampMixin):
    """監査情報"""
    created_by = Column(String(100))
    updated_by = Column(String(100))
```

---

## 4. コアモデル

### 4.1 Project

```python
# models/project.py
from sqlalchemy import Column, String, Text, Enum
from sqlalchemy.orm import relationship
from .base import Base, GUID, JSONType
from .mixins import TimestampMixin, SoftDeleteMixin
import uuid
import enum

class ProjectStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"

class Project(Base, TimestampMixin, SoftDeleteMixin):
    """プロジェクト"""
    __tablename__ = "projects"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(
        Enum(ProjectStatus),
        default=ProjectStatus.DRAFT,
        nullable=False
    )

    # メタデータ
    metadata_ = Column("metadata", JSONType, default=dict)

    # リレーション
    executions = relationship(
        "ProcessExecution",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    process_states = relationship(
        "ProcessState",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    metrics = relationship(
        "LLMMetrics",
        back_populates="project",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name})>"
```

### 4.2 ProcessExecution

```python
# models/process.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer
from sqlalchemy.orm import relationship

class ProcessExecution(Base, TimestampMixin):
    """プロセス実行記録"""
    __tablename__ = "process_executions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    project_id = Column(GUID, ForeignKey("projects.id"), nullable=False, index=True)
    process_id = Column(String(100), nullable=False, index=True)
    prompt_version_id = Column(GUID, ForeignKey("prompt_versions.id"))

    # 入出力
    input_data = Column(JSONType, nullable=False)
    output_data = Column(JSONType)

    # ステータス
    status = Column(
        String(50),
        default="pending",
        nullable=False
    )  # pending, running, completed, failed
    error_message = Column(Text)

    # メタデータ
    reasoning = Column(Text)
    missing_info = Column(JSONType)

    # タイムスタンプ
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # リレーション
    project = relationship("Project", back_populates="executions")
    prompt_version = relationship("PromptVersion")

    __table_args__ = (
        Index("ix_execution_project_process", "project_id", "process_id"),
    )
```

### 4.3 ProcessState

```python
class ProcessState(Base):
    """プロセス状態（プロジェクト × プロセス）"""
    __tablename__ = "process_states"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    project_id = Column(GUID, ForeignKey("projects.id"), nullable=False)
    process_id = Column(String(100), nullable=False)

    # 状態
    state = Column(String(50), default="empty", nullable=False)
    version = Column(Integer, default=0)

    # 現在の実行参照
    current_execution_id = Column(GUID, ForeignKey("process_executions.id"))

    # 無効化情報
    invalidated_at = Column(DateTime)
    invalidated_by_process_id = Column(String(100))

    # タイムスタンプ
    last_updated_at = Column(DateTime, default=datetime.utcnow)

    # リレーション
    project = relationship("Project", back_populates="process_states")
    current_execution = relationship("ProcessExecution")

    __table_args__ = (
        UniqueConstraint("project_id", "process_id", name="uq_project_process_state"),
    )
```

### 4.4 LLMMetrics

```python
# models/metrics.py

class LLMMetrics(Base, TimestampMixin):
    """LLM使用メトリクス"""
    __tablename__ = "llm_metrics"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    project_id = Column(GUID, ForeignKey("projects.id"), index=True)
    process_id = Column(String(100), index=True)
    execution_id = Column(GUID, ForeignKey("process_executions.id"))

    # プロバイダー情報
    provider = Column(String(50), nullable=False)  # openai, google, mock
    model = Column(String(100), nullable=False)

    # トークン使用量
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)

    # コスト
    cost_usd = Column(Float, default=0.0)

    # パフォーマンス
    inference_time_ms = Column(Integer)

    # リレーション
    project = relationship("Project", back_populates="metrics")

    __table_args__ = (
        Index("ix_metrics_project_created", "project_id", "created_at"),
    )
```

---

## 5. Pydanticスキーマ

### 5.1 リクエスト/レスポンス

```python
# schemas/project.py
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Any

class ProjectCreate(BaseModel):
    """プロジェクト作成リクエスト"""
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

class ProjectUpdate(BaseModel):
    """プロジェクト更新リクエスト"""
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    status: str | None = None
    metadata: dict[str, Any] | None = None

class ProjectResponse(BaseModel):
    """プロジェクトレスポンス"""
    id: UUID
    name: str
    description: str | None
    status: str
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}

class ProjectListResponse(BaseModel):
    """プロジェクト一覧レスポンス"""
    items: list[ProjectResponse]
    total: int
    page: int
    page_size: int
```

### 5.2 プロセス関連

```python
# schemas/process.py

class ProcessExecutionResponse(BaseModel):
    """プロセス実行レスポンス"""
    id: UUID
    process_id: str
    status: str
    input_data: dict[str, Any]
    output_data: dict[str, Any] | None
    reasoning: str | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}

class ProcessStateResponse(BaseModel):
    """プロセス状態レスポンス"""
    process_id: str
    state: str
    version: int
    last_updated_at: datetime
    invalidated_at: datetime | None
    invalidated_by: str | None

    model_config = {"from_attributes": True}

class ProcessInputRequest(BaseModel):
    """プロセス入力リクエスト（汎用）"""
    data: dict[str, Any]
    options: dict[str, Any] = Field(default_factory=dict)
```

---

## 6. データベース接続

### 6.1 接続設定

```python
# database.py
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker
)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .settings import Settings

settings = Settings()

# 非同期エンジン（FastAPI用）
async_engine = create_async_engine(
    settings.async_database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# 同期エンジン（スクリプト・マイグレーション用）
sync_engine = create_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    sync_engine,
    expire_on_commit=False
)

async def get_session() -> AsyncSession:
    """FastAPI依存性注入用"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

### 6.2 接続URL変換

```python
# settings.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./app.db"

    @property
    def async_database_url(self) -> str:
        """非同期接続URLに変換"""
        url = self.database_url

        if url.startswith("sqlite:"):
            return url.replace("sqlite:", "sqlite+aiosqlite:")
        elif url.startswith("postgresql:"):
            return url.replace("postgresql:", "postgresql+asyncpg:")

        return url
```

---

## 7. マイグレーション

### 7.1 Alembic設定

```python
# alembic/env.py
from alembic import context
from sqlalchemy import engine_from_config, pool
from logging.config import fileConfig

from src.database import sync_engine
from src.models.base import Base

config = context.config
fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline():
    """オフラインマイグレーション"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    """オンラインマイグレーション"""
    connectable = sync_engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### 7.2 マイグレーションコマンド

```bash
# 新規マイグレーション作成
alembic revision --autogenerate -m "Add new table"

# マイグレーション実行
alembic upgrade head

# 1つ戻す
alembic downgrade -1

# 履歴確認
alembic history
```

---

## 8. クエリパターン

### 8.1 リポジトリパターン

```python
# repositories/project.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..models.project import Project

class ProjectRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, id: str) -> Project | None:
        result = await self.session.execute(
            select(Project).where(
                Project.id == id,
                Project.is_deleted == False
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None
    ) -> tuple[list[Project], int]:
        query = select(Project).where(Project.is_deleted == False)

        if status:
            query = query.where(Project.status == status)

        # カウント
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.session.scalar(count_query)

        # ページネーション
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(query)

        return list(result.scalars()), total

    async def create(self, data: dict) -> Project:
        project = Project(**data)
        self.session.add(project)
        await self.session.commit()
        await self.session.refresh(project)
        return project

    async def update(self, id: str, data: dict) -> Project | None:
        project = await self.get_by_id(id)
        if not project:
            return None

        for key, value in data.items():
            if hasattr(project, key):
                setattr(project, key, value)

        await self.session.commit()
        await self.session.refresh(project)
        return project

    async def delete(self, id: str) -> bool:
        project = await self.get_by_id(id)
        if not project:
            return False

        project.soft_delete()
        await self.session.commit()
        return True
```

---

## 9. 関連ドキュメント

- [01-SYSTEM-ARCHITECTURE.md](./01-SYSTEM-ARCHITECTURE.md) - 全体構成
- [04-PROCESS-PIPELINE.md](./04-PROCESS-PIPELINE.md) - プロセス関連モデル
- [06-API-DESIGN.md](./06-API-DESIGN.md) - APIでのスキーマ使用
