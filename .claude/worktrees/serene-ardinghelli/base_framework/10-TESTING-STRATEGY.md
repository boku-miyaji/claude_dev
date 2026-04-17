# 10. Testing Strategy - テスト戦略設計

> **目的**: テストピラミッド、Mock活用、CI/CDパイプラインを定義

---

## 1. テストピラミッド

```
                    ┌───────────────┐
                    │    E2E Tests  │  少数・遅い・高コスト
                    │   (Playwright)│
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  Integration  │  中程度
                    │    Tests      │
                    └───────┬───────┘
                            │
            ┌───────────────▼───────────────┐
            │         Unit Tests            │  多数・速い・低コスト
            │         (pytest)              │
            └───────────────────────────────┘
```

---

## 2. テスト構成

### 2.1 ディレクトリ構造

```
backend/
└── tests/
    ├── conftest.py           # 共通フィクスチャ
    ├── unit/                 # ユニットテスト
    │   ├── services/
    │   │   ├── test_llm_service.py
    │   │   ├── test_process_service.py
    │   │   └── test_state_manager.py
    │   ├── prompts/
    │   │   └── test_registry.py
    │   └── utils/
    │       └── test_helpers.py
    ├── integration/          # 統合テスト
    │   ├── test_api_projects.py
    │   ├── test_api_processes.py
    │   └── test_database.py
    └── e2e/                  # E2Eテスト
        └── test_workflow.py

frontend/
└── __tests__/
    ├── components/           # コンポーネントテスト
    ├── hooks/               # フックテスト
    └── e2e/                 # E2Eテスト（Playwright）
```

---

## 3. pytest設定

### 3.1 pyproject.toml

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"

# マーカー定義
markers = [
    "unit: Unit tests",
    "integration: Integration tests",
    "e2e: End-to-end tests",
    "slow: Slow tests",
]

# カバレッジ設定
addopts = [
    "--cov=src",
    "--cov-report=term-missing",
    "--cov-report=html",
    "--cov-fail-under=80",
]

# 除外パターン
filterwarnings = [
    "ignore::DeprecationWarning",
]
```

### 3.2 conftest.py

```python
# tests/conftest.py
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from src.models.base import Base
from src.settings import Settings

# テスト用設定
@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        database_url="sqlite:///./test.db",
        openai_api_key="",  # Mock使用
        environment="development",
        debug=True
    )

# テスト用DB
@pytest.fixture
async def async_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()

@pytest.fixture
async def async_session(async_engine) -> AsyncSession:
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session

# Mock LLMサービス
@pytest.fixture
def mock_llm_service():
    from src.services.llm.mock.service import MockLLMService
    return MockLLMService()

# FastAPIテストクライアント
@pytest.fixture
async def client(async_session, mock_llm_service):
    from fastapi.testclient import TestClient
    from httpx import AsyncClient, ASGITransport
    from src.main import app
    from src.database import get_session
    from src.dependencies import get_llm_service

    app.dependency_overrides[get_session] = lambda: async_session
    app.dependency_overrides[get_llm_service] = lambda: mock_llm_service

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client

    app.dependency_overrides.clear()
```

---

## 4. ユニットテスト

### 4.1 LLMサービステスト

```python
# tests/unit/services/test_llm_service.py
import pytest
from src.services.llm.mock.service import MockLLMService
from src.services.llm.base import LLMResponse

@pytest.mark.unit
class TestMockLLMService:
    @pytest.fixture
    def service(self):
        return MockLLMService()

    @pytest.mark.asyncio
    async def test_generate_returns_string(self, service):
        result = await service.generate(
            prompt="Test prompt",
            system_prompt="You are a test assistant"
        )

        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_generate_with_usage_returns_response(self, service):
        content, llm_response = await service.generate_with_usage(
            prompt="Test prompt"
        )

        assert isinstance(content, str)
        assert isinstance(llm_response, LLMResponse)
        assert llm_response.usage is not None
        assert llm_response.usage["total_tokens"] > 0

    @pytest.mark.asyncio
    async def test_generate_json_returns_dict(self, service):
        result = await service.generate_json(
            prompt="Return a JSON object"
        )

        assert isinstance(result, dict)

    def test_is_mock_returns_true(self, service):
        assert service.is_mock is True

    def test_provider_returns_mock(self, service):
        assert service.provider == "mock"
```

### 4.2 状態管理テスト

```python
# tests/unit/services/test_state_manager.py
import pytest
from uuid import uuid4
from src.services.state_manager import ProcessStateManager

@pytest.mark.unit
class TestProcessStateManager:
    @pytest.fixture
    def manager(self, async_session):
        return ProcessStateManager(async_session)

    @pytest.mark.asyncio
    async def test_initialize_states_creates_all_states(
        self, manager, async_session
    ):
        project_id = str(uuid4())

        await manager.initialize_states(project_id)

        states = await manager.get_all_states(project_id)
        assert len(states) > 0
        assert all(s.state == "empty" for s in states)

    @pytest.mark.asyncio
    async def test_mark_valid_updates_state(self, manager, async_session):
        project_id = str(uuid4())
        process_id = "specification"

        await manager.initialize_states(project_id)
        await manager.mark_valid(project_id, process_id)

        state = await manager.get_state(project_id, process_id)
        assert state.state == "valid"
        assert state.version == 1

    @pytest.mark.asyncio
    async def test_mark_valid_invalidates_downstream(
        self, manager, async_session
    ):
        project_id = str(uuid4())

        await manager.initialize_states(project_id)

        # 下流を先にvalidにする
        await manager.mark_valid(project_id, "block_diagram")

        # 上流を更新
        await manager.mark_valid(project_id, "specification")

        # 下流がstaleになることを確認
        downstream_state = await manager.get_state(project_id, "block_diagram")
        assert downstream_state.state == "stale"
```

### 4.3 プロンプトレジストリテスト

```python
# tests/unit/prompts/test_registry.py
import pytest
from src.prompts.registry import PromptRegistry

@pytest.mark.unit
class TestPromptRegistry:
    @pytest.fixture
    def registry(self):
        return PromptRegistry()

    def test_get_returns_prompt_config(self, registry):
        config = registry.get("spec_analyze")

        assert config is not None
        assert config.id == "spec_analyze"
        assert len(config.system_prompt) > 0

    def test_get_unknown_raises_error(self, registry):
        with pytest.raises(ValueError) as exc:
            registry.get("unknown_prompt")

        assert "Unknown prompt" in str(exc.value)

    def test_get_system_prompt_returns_provider_variant(self, registry):
        openai_prompt = registry.get_system_prompt("spec_analyze", "openai")
        google_prompt = registry.get_system_prompt("spec_analyze", "google")

        # プロバイダー別で異なる可能性
        assert isinstance(openai_prompt, str)
        assert isinstance(google_prompt, str)

    def test_get_user_prompt_formats_template(self, registry):
        prompt = registry.get_user_prompt(
            "spec_analyze",
            "openai",
            content="Test content",
            source_type="email"
        )

        assert "Test content" in prompt
        assert "email" in prompt

    def test_get_user_prompt_missing_vars_raises_error(self, registry):
        with pytest.raises(ValueError) as exc:
            registry.get_user_prompt(
                "spec_analyze",
                "openai",
                content="Test"
                # source_type missing
            )

        assert "Missing template variables" in str(exc.value)
```

---

## 5. 統合テスト

### 5.1 API統合テスト

```python
# tests/integration/test_api_projects.py
import pytest
from httpx import AsyncClient

@pytest.mark.integration
class TestProjectsAPI:
    @pytest.mark.asyncio
    async def test_create_project(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/projects",
            json={"name": "Test Project", "description": "Description"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Project"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_list_projects(self, client: AsyncClient):
        # 作成
        await client.post(
            "/api/v1/projects",
            json={"name": "Project 1"}
        )
        await client.post(
            "/api/v1/projects",
            json={"name": "Project 2"}
        )

        # 一覧取得
        response = await client.get("/api/v1/projects")

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) >= 2

    @pytest.mark.asyncio
    async def test_get_project(self, client: AsyncClient):
        # 作成
        create_response = await client.post(
            "/api/v1/projects",
            json={"name": "Test Project"}
        )
        project_id = create_response.json()["id"]

        # 取得
        response = await client.get(f"/api/v1/projects/{project_id}")

        assert response.status_code == 200
        assert response.json()["name"] == "Test Project"

    @pytest.mark.asyncio
    async def test_get_nonexistent_project_returns_404(
        self, client: AsyncClient
    ):
        response = await client.get(
            "/api/v1/projects/00000000-0000-0000-0000-000000000000"
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_project(self, client: AsyncClient):
        # 作成
        create_response = await client.post(
            "/api/v1/projects",
            json={"name": "Original"}
        )
        project_id = create_response.json()["id"]

        # 更新
        response = await client.patch(
            f"/api/v1/projects/{project_id}",
            json={"name": "Updated"}
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated"

    @pytest.mark.asyncio
    async def test_delete_project(self, client: AsyncClient):
        # 作成
        create_response = await client.post(
            "/api/v1/projects",
            json={"name": "To Delete"}
        )
        project_id = create_response.json()["id"]

        # 削除
        response = await client.delete(f"/api/v1/projects/{project_id}")

        assert response.status_code == 204

        # 確認
        get_response = await client.get(f"/api/v1/projects/{project_id}")
        assert get_response.status_code == 404
```

### 5.2 プロセス実行テスト

```python
# tests/integration/test_api_processes.py
import pytest
from httpx import AsyncClient

@pytest.mark.integration
class TestProcessesAPI:
    @pytest.fixture
    async def project_id(self, client: AsyncClient) -> str:
        response = await client.post(
            "/api/v1/projects",
            json={"name": "Test Project"}
        )
        return response.json()["id"]

    @pytest.mark.asyncio
    async def test_execute_process_with_mock(
        self, client: AsyncClient, project_id: str
    ):
        response = await client.post(
            f"/api/v1/projects/{project_id}/processes/specification/execute",
            json={
                "data": {
                    "content": "Test specification content",
                    "source_type": "email"
                }
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert "output" in data

    @pytest.mark.asyncio
    async def test_get_process_states(
        self, client: AsyncClient, project_id: str
    ):
        response = await client.get(
            f"/api/v1/projects/{project_id}/processes"
        )

        assert response.status_code == 200
        states = response.json()
        assert isinstance(states, list)
```

---

## 6. Mockの活用

### 6.1 LLM Mock フィクスチャ

```python
# tests/fixtures/llm_responses.py

MOCK_SPEC_ANALYSIS = {
    "extracted_items": [
        {"category": "機能要件", "description": "ユーザー認証機能"},
        {"category": "非機能要件", "description": "レスポンス1秒以内"}
    ],
    "missing_items": [
        {"category": "性能要件", "question": "同時接続数は？"}
    ],
    "reasoning": "テスト用のMock分析結果"
}

MOCK_BLOCK_DIAGRAM = {
    "blocks": [
        {"id": "1", "name": "入力処理", "type": "input"},
        {"id": "2", "name": "メイン処理", "type": "process"},
        {"id": "3", "name": "出力処理", "type": "output"}
    ],
    "connections": [
        {"from": "1", "to": "2"},
        {"from": "2", "to": "3"}
    ],
    "mermaid_diagram": "graph TD\n  A[入力] --> B[処理] --> C[出力]"
}
```

### 6.2 外部API Mock

```python
# tests/unit/services/test_openai_service.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.mark.unit
class TestOpenAIService:
    @pytest.mark.asyncio
    async def test_generate_calls_api(self):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Test response"))]
        mock_response.model = "gpt-4o"
        mock_response.usage = MagicMock(
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30
        )
        mock_response.model_dump.return_value = {}

        with patch("openai.AsyncOpenAI") as mock_client:
            mock_client.return_value.chat.completions.create = AsyncMock(
                return_value=mock_response
            )

            from src.services.llm.openai import OpenAIService
            service = OpenAIService(api_key="test-key")

            result, llm_response = await service.generate_with_usage(
                prompt="Test",
                system_prompt="You are a test"
            )

            assert result == "Test response"
            assert llm_response.total_tokens == 30
```

---

## 7. カバレッジ

```bash
# カバレッジレポート生成
pytest --cov=src --cov-report=html --cov-report=term-missing

# HTMLレポートを開く
open htmlcov/index.html
```

---

## 8. CI/CD

### 8.1 GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install uv
        run: pip install uv

      - name: Install dependencies
        run: |
          cd backend
          uv sync

      - name: Run unit tests
        run: |
          cd backend
          uv run pytest tests/unit -v --cov=src

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
        run: |
          cd backend
          uv run pytest tests/integration -v

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage.xml
```

---

## 9. テストコマンド

```bash
# 全テスト実行
pytest

# ユニットテストのみ
pytest tests/unit -v

# 統合テストのみ
pytest tests/integration -v

# 特定ファイル
pytest tests/unit/services/test_llm_service.py -v

# 特定テスト
pytest tests/unit/services/test_llm_service.py::TestMockLLMService::test_generate_returns_string -v

# マーカー指定
pytest -m "unit and not slow"

# 並列実行
pytest -n auto

# デバッグモード
pytest --pdb
```

---

## 10. 関連ドキュメント

- [02-LLM-INTEGRATION.md](./02-LLM-INTEGRATION.md) - Mock実装
- [09-CONFIGURATION.md](./09-CONFIGURATION.md) - テスト環境設定
- [06-API-DESIGN.md](./06-API-DESIGN.md) - API仕様
