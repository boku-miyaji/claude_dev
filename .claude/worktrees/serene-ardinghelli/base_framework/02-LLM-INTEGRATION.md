# 02. LLM Integration - LLM統合設計

> **目的**: 複数 LLM プロバイダーの統一的な統合パターンを定義

---

## 1. 設計目標

```
┌─────────────────────────────────────────────────────────────────┐
│                      Design Goals                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Provider Agnostic - プロバイダー非依存の統一インターフェース│
│  2. Easy Switching   - 実行時のプロバイダー切り替え            │
│  3. Mock Support     - 開発時のAPI呼び出し不要                 │
│  4. Cost Tracking    - トークン使用量・コスト追跡              │
│  5. Error Resilience - レート制限・タイムアウト対応            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. アーキテクチャ

### 2.1 クラス構造

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Service Layer                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              <<abstract>>                                 │ │
│  │              LLMService                                   │ │
│  │  ─────────────────────────────────────────────────────── │ │
│  │  + provider: str                                         │ │
│  │  + model: str                                            │ │
│  │  ─────────────────────────────────────────────────────── │ │
│  │  + generate(prompt, system_prompt) -> str                │ │
│  │  + generate_json(prompt, system_prompt) -> dict          │ │
│  │  + generate_with_usage(...) -> (str, LLMResponse)        │ │
│  │  + generate_json_with_usage(...) -> (dict, LLMResponse)  │ │
│  └───────────────────────────────────────────────────────────┘ │
│            △                    △                    △         │
│            │                    │                    │         │
│  ┌─────────┴───────┐  ┌────────┴────────┐  ┌────────┴───────┐ │
│  │  OpenAIService  │  │ GoogleAIService │  │  MockLLMService│ │
│  │                 │  │                 │  │                │ │
│  │ - GPT-4o        │  │ - Gemini Pro    │  │ - 固定応答     │ │
│  │ - GPT-4         │  │ - Gemini Flash  │  │ - ファイル応答 │ │
│  │ - o1/o3         │  │                 │  │                │ │
│  └─────────────────┘  └─────────────────┘  └────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 レスポンスモデル

```python
# services/llm/base.py
from pydantic import BaseModel
from typing import Any

class LLMResponse(BaseModel):
    """LLM応答の統一モデル"""
    content: str                          # 生成テキスト
    model: str                            # 使用モデル
    usage: dict[str, int] | None = None   # トークン使用量
    raw_response: dict[str, Any] | None = None  # 生のAPI応答

    @property
    def prompt_tokens(self) -> int:
        return self.usage.get("prompt_tokens", 0) if self.usage else 0

    @property
    def completion_tokens(self) -> int:
        return self.usage.get("completion_tokens", 0) if self.usage else 0

    @property
    def total_tokens(self) -> int:
        return self.usage.get("total_tokens", 0) if self.usage else 0
```

---

## 3. 抽象基底クラス

### 3.1 非同期サービス（バックエンド用）

```python
# services/llm/base.py
from abc import ABC, abstractmethod
from typing import Any

class LLMService(ABC):
    """LLMサービスの抽象基底クラス（非同期）"""

    def __init__(self, model: str | None = None):
        self._model = model

    @property
    @abstractmethod
    def provider(self) -> str:
        """プロバイダー名"""
        pass

    @property
    @abstractmethod
    def model(self) -> str:
        """モデル名"""
        pass

    @property
    @abstractmethod
    def is_mock(self) -> bool:
        """Mockモードかどうか"""
        pass

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> str:
        """テキスト生成"""
        pass

    @abstractmethod
    async def generate_json(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> dict[str, Any]:
        """JSON形式で生成"""
        pass

    @abstractmethod
    async def generate_with_usage(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> tuple[str, LLMResponse | None]:
        """テキスト生成（使用量情報付き）"""
        pass

    @abstractmethod
    async def generate_json_with_usage(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> tuple[dict[str, Any], LLMResponse | None]:
        """JSON生成（使用量情報付き）"""
        pass
```

### 3.2 同期クライアント（スクリプト用）

```python
# shared/llm/base.py
from abc import ABC, abstractmethod

class BaseLLMClient(ABC):
    """LLMクライアントの抽象基底クラス（同期）"""

    @abstractmethod
    def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> LLMResponse:
        """テキスト生成"""
        pass

    @abstractmethod
    def generate_json(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7
    ) -> dict:
        """JSON生成"""
        pass
```

---

## 4. プロバイダー実装

### 4.1 OpenAI 実装

```python
# services/llm/openai.py
import json
import asyncio
from openai import AsyncOpenAI
from .base import LLMService, LLMResponse

class OpenAIService(LLMService):
    """OpenAI LLMサービス"""

    # モデル別設定
    MODEL_CONFIGS = {
        "gpt-4o": {"max_tokens": 16384, "supports_temperature": True},
        "gpt-4o-mini": {"max_tokens": 16384, "supports_temperature": True},
        "o1": {"max_tokens": 32768, "supports_temperature": False},
        "o1-mini": {"max_tokens": 32768, "supports_temperature": False},
        "o3-mini": {"max_tokens": 32768, "supports_temperature": False},
    }

    DEFAULT_MODEL = "gpt-4o"
    TIMEOUT = 300  # 推論モデル用に長めのタイムアウト

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None
    ):
        super().__init__(model)
        self._api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self._mock_mode = not self._has_api_key
        self._client = None if self._mock_mode else AsyncOpenAI(
            api_key=self._api_key,
            timeout=self.TIMEOUT
        )

    @property
    def _has_api_key(self) -> bool:
        return bool(self._api_key and self._api_key != "placeholder")

    @property
    def provider(self) -> str:
        return "openai"

    @property
    def model(self) -> str:
        return self._model or self.DEFAULT_MODEL

    @property
    def is_mock(self) -> bool:
        return self._mock_mode

    def _get_model_config(self) -> dict:
        return self.MODEL_CONFIGS.get(
            self.model,
            {"max_tokens": 16384, "supports_temperature": True}
        )

    async def generate_with_usage(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> tuple[str, LLMResponse | None]:
        if self._mock_mode:
            return self._mock_response(prompt), None

        config = self._get_model_config()
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # リクエストパラメータ構築
        params = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens or config["max_tokens"],
        }

        # 温度パラメータ（o1/o3は非対応）
        if config["supports_temperature"]:
            params["temperature"] = temperature

        try:
            response = await self._client.chat.completions.create(**params)

            content = response.choices[0].message.content or ""
            llm_response = LLMResponse(
                content=content,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                },
                raw_response=response.model_dump()
            )
            return content, llm_response

        except Exception as e:
            raise LLMError(f"OpenAI API error: {str(e)}")

    async def generate_json_with_usage(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> tuple[dict, LLMResponse | None]:
        # JSON形式を強制するシステムプロンプト
        json_system = (system_prompt or "") + "\n\nRespond with valid JSON only."

        content, llm_response = await self.generate_with_usage(
            prompt=prompt,
            system_prompt=json_system,
            temperature=temperature,
            max_tokens=max_tokens
        )

        # JSONパース
        try:
            # コードブロック除去
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                cleaned = cleaned.rsplit("```", 1)[0]

            return json.loads(cleaned), llm_response
        except json.JSONDecodeError as e:
            raise LLMError(f"Failed to parse JSON response: {e}")

    def _mock_response(self, prompt: str) -> str:
        """Mock応答を返す"""
        from .mock.fixtures import get_mock_response
        return get_mock_response(prompt)
```

### 4.2 Google AI 実装

```python
# services/llm/google.py
import google.generativeai as genai
from .base import LLMService, LLMResponse

class GoogleAIService(LLMService):
    """Google AI (Gemini) サービス"""

    DEFAULT_MODEL = "gemini-pro"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None
    ):
        super().__init__(model)
        self._api_key = api_key or os.getenv("GOOGLE_AI_API_KEY", "")
        self._mock_mode = not self._has_api_key

        if not self._mock_mode:
            genai.configure(api_key=self._api_key)

    @property
    def provider(self) -> str:
        return "google"

    @property
    def model(self) -> str:
        return self._model or self.DEFAULT_MODEL

    @property
    def is_mock(self) -> bool:
        return self._mock_mode

    async def generate_with_usage(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> tuple[str, LLMResponse | None]:
        if self._mock_mode:
            return self._mock_response(prompt), None

        model = genai.GenerativeModel(
            model_name=self.model,
            system_instruction=system_prompt
        )

        generation_config = genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens
        )

        # 非同期実行
        response = await asyncio.to_thread(
            model.generate_content,
            prompt,
            generation_config=generation_config
        )

        content = response.text
        usage = {
            "prompt_tokens": response.usage_metadata.prompt_token_count,
            "completion_tokens": response.usage_metadata.candidates_token_count,
            "total_tokens": response.usage_metadata.total_token_count,
        }

        llm_response = LLMResponse(
            content=content,
            model=self.model,
            usage=usage
        )

        return content, llm_response
```

### 4.3 Mock 実装

```python
# services/llm/mock/service.py
import json
from pathlib import Path
from ..base import LLMService, LLMResponse

class MockLLMService(LLMService):
    """Mock LLMサービス（開発・テスト用）"""

    FIXTURES_DIR = Path(__file__).parent / "fixtures"

    def __init__(self, model: str | None = None):
        super().__init__(model)
        self._fixtures = self._load_fixtures()

    @property
    def provider(self) -> str:
        return "mock"

    @property
    def model(self) -> str:
        return self._model or "mock-model"

    @property
    def is_mock(self) -> bool:
        return True

    def _load_fixtures(self) -> dict:
        """フィクスチャファイルを読み込み"""
        fixtures = {}
        for file in self.FIXTURES_DIR.glob("*.json"):
            key = file.stem
            with open(file) as f:
                fixtures[key] = json.load(f)
        return fixtures

    def _select_fixture(self, prompt: str) -> dict:
        """プロンプト内容からフィクスチャを選択"""
        prompt_lower = prompt.lower()

        # キーワードマッチング
        if "specification" in prompt_lower:
            return self._fixtures.get("specification_analysis", {})
        elif "block diagram" in prompt_lower:
            return self._fixtures.get("block_diagram", {})
        elif "circuit" in prompt_lower:
            return self._fixtures.get("circuit_schematic", {})
        else:
            return {"message": "Mock response for testing"}

    async def generate_with_usage(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> tuple[str, LLMResponse | None]:
        fixture = self._select_fixture(prompt)
        content = json.dumps(fixture, ensure_ascii=False)

        llm_response = LLMResponse(
            content=content,
            model=self.model,
            usage={
                "prompt_tokens": len(prompt) // 4,
                "completion_tokens": len(content) // 4,
                "total_tokens": (len(prompt) + len(content)) // 4
            }
        )

        return content, llm_response

    async def generate_json_with_usage(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> tuple[dict, LLMResponse | None]:
        content, llm_response = await self.generate_with_usage(
            prompt, system_prompt, temperature, max_tokens
        )
        return json.loads(content), llm_response
```

---

## 5. ファクトリーパターン

### 5.1 サービス生成

```python
# services/llm/factory.py
from enum import Enum
from typing import Literal
from .base import LLMService

class LLMProvider(str, Enum):
    OPENAI = "openai"
    GOOGLE = "google"
    MOCK = "mock"

def create_llm_service(
    provider: Literal["openai", "google", "mock"] = "openai",
    api_key: str | None = None,
    model: str | None = None
) -> LLMService:
    """LLMサービスを生成（遅延インポート）"""

    if provider == "openai":
        from .openai import OpenAIService
        return OpenAIService(api_key=api_key, model=model)

    elif provider == "google":
        from .google import GoogleAIService
        return GoogleAIService(api_key=api_key, model=model)

    elif provider == "mock":
        from .mock.service import MockLLMService
        return MockLLMService(model=model)

    else:
        raise ValueError(f"Unknown provider: {provider}")


def create_llm_service_auto(
    preferred_provider: str = "openai",
    openai_api_key: str | None = None,
    google_api_key: str | None = None,
    model: str | None = None
) -> LLMService:
    """APIキーの有無に応じて自動選択"""

    # 優先プロバイダーでAPIキーがあればそれを使用
    if preferred_provider == "openai" and openai_api_key:
        return create_llm_service("openai", openai_api_key, model)
    if preferred_provider == "google" and google_api_key:
        return create_llm_service("google", google_api_key, model)

    # フォールバック
    if openai_api_key:
        return create_llm_service("openai", openai_api_key, model)
    if google_api_key:
        return create_llm_service("google", google_api_key, model)

    # APIキーなし → Mock
    return create_llm_service("mock", model=model)
```

### 5.2 使用例

```python
# サービス層での使用
from services.llm.factory import create_llm_service_auto

class SpecificationService:
    def __init__(self, settings: Settings):
        self.llm = create_llm_service_auto(
            preferred_provider=settings.default_llm_provider,
            openai_api_key=settings.openai_api_key,
            google_api_key=settings.google_ai_api_key,
            model=settings.default_openai_model
        )

    async def analyze(self, content: str) -> dict:
        result, usage = await self.llm.generate_json_with_usage(
            prompt=f"Analyze: {content}",
            system_prompt="You are an analyst."
        )
        return result
```

---

## 6. エラーハンドリング

### 6.1 例外定義

```python
# services/llm/exceptions.py

class LLMError(Exception):
    """LLM関連エラーの基底クラス"""
    pass

class LLMConnectionError(LLMError):
    """接続エラー"""
    pass

class LLMRateLimitError(LLMError):
    """レート制限"""
    def __init__(self, retry_after: int | None = None):
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded. Retry after {retry_after}s")

class LLMTimeoutError(LLMError):
    """タイムアウト"""
    pass

class LLMResponseError(LLMError):
    """レスポンス解析エラー"""
    pass

class LLMContentFilterError(LLMError):
    """コンテンツフィルターによるブロック"""
    pass
```

### 6.2 リトライ戦略

```python
# services/llm/retry.py
import asyncio
from functools import wraps

def with_retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    exponential: bool = True
):
    """リトライデコレータ"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)

                except LLMRateLimitError as e:
                    last_exception = e
                    delay = e.retry_after or (base_delay * (2 ** attempt))
                    await asyncio.sleep(delay)

                except LLMTimeoutError as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        delay = base_delay * (2 ** attempt) if exponential else base_delay
                        await asyncio.sleep(delay)

                except LLMError:
                    raise  # 他のLLMエラーは即座に再raise

            raise last_exception

        return wrapper
    return decorator

# 使用例
class OpenAIService(LLMService):
    @with_retry(max_attempts=3, base_delay=1.0)
    async def generate_with_usage(self, prompt: str, ...) -> tuple[str, LLMResponse]:
        # 実装
        pass
```

---

## 7. コスト計算

### 7.1 料金モデル

```python
# services/llm/pricing.py

PRICING = {
    "openai": {
        "gpt-4o": {"input": 2.50, "output": 10.00},       # per 1M tokens
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "o1": {"input": 15.00, "output": 60.00},
        "o1-mini": {"input": 3.00, "output": 12.00},
        "o3-mini": {"input": 1.10, "output": 4.40},
    },
    "google": {
        "gemini-pro": {"input": 0.50, "output": 1.50},
        "gemini-flash": {"input": 0.075, "output": 0.30},
    }
}

def calculate_cost(
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int
) -> float:
    """コストを計算（USD）"""
    pricing = PRICING.get(provider, {}).get(model)
    if not pricing:
        return 0.0

    input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
    output_cost = (completion_tokens / 1_000_000) * pricing["output"]

    return input_cost + output_cost
```

### 7.2 使用量追跡

```python
# services/metrics_recorder.py

class MetricsRecorder:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def record(
        self,
        project_id: str,
        process_id: str,
        provider: str,
        model: str,
        llm_response: LLMResponse,
        inference_time_ms: int
    ):
        """LLM呼び出しメトリクスを記録"""
        cost = calculate_cost(
            provider=provider,
            model=model,
            prompt_tokens=llm_response.prompt_tokens,
            completion_tokens=llm_response.completion_tokens
        )

        metric = LLMMetrics(
            project_id=project_id,
            process_id=process_id,
            provider=provider,
            model=model,
            prompt_tokens=llm_response.prompt_tokens,
            completion_tokens=llm_response.completion_tokens,
            total_tokens=llm_response.total_tokens,
            cost_usd=cost,
            inference_time_ms=inference_time_ms
        )

        self.session.add(metric)
        await self.session.commit()
```

---

## 8. Mock モード詳細

### 8.1 自動検出

```python
# APIキー未設定時の自動Mock切り替え
class OpenAIService(LLMService):
    def __init__(self, api_key: str | None = None, ...):
        self._api_key = api_key or os.getenv("OPENAI_API_KEY", "")

        # 自動Mock判定
        self._mock_mode = (
            not self._api_key or
            self._api_key == "placeholder" or
            self._api_key == "your_api_key_here"
        )

        if self._mock_mode:
            logger.info("Running in mock mode (no API key)")
```

### 8.2 フィクスチャ構造

```
services/llm/mock/fixtures/
├── specification_analysis.json
├── block_diagram.json
├── circuit_schematic.json
├── component_selection.json
└── generic_response.json
```

```json
// fixtures/specification_analysis.json
{
  "extracted_items": [
    {"category": "機能要件", "description": "..."},
    {"category": "非機能要件", "description": "..."}
  ],
  "missing_items": [
    {"category": "性能要件", "question": "..."}
  ],
  "reasoning": "Mock analysis for development"
}
```

---

## 9. ストリーミング対応

### 9.1 ストリーミングインターフェース

```python
# services/llm/base.py
from typing import AsyncIterator

class LLMService(ABC):
    # ... 既存メソッド ...

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7
    ) -> AsyncIterator[str]:
        """ストリーミング生成"""
        raise NotImplementedError

# services/llm/openai.py
class OpenAIService(LLMService):
    async def generate_stream(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7
    ) -> AsyncIterator[str]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            stream=True
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

### 9.2 Server-Sent Events (SSE)

```python
# routers/chat.py
from fastapi.responses import StreamingResponse

@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    llm: LLMService = Depends(get_llm_service)
):
    async def generate():
        async for chunk in llm.generate_stream(
            prompt=request.message,
            system_prompt=request.system_prompt
        ):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )
```

---

## 10. 拡張ポイント

### 10.1 新規プロバイダー追加

```python
# 1. services/llm/anthropic.py を作成
class AnthropicService(LLMService):
    @property
    def provider(self) -> str:
        return "anthropic"

    # ... 実装 ...

# 2. factory.py を更新
def create_llm_service(provider: str, ...) -> LLMService:
    # ...
    elif provider == "anthropic":
        from .anthropic import AnthropicService
        return AnthropicService(api_key=api_key, model=model)

# 3. pricing.py を更新
PRICING["anthropic"] = {
    "claude-3-opus": {"input": 15.00, "output": 75.00},
    # ...
}
```

### 10.2 カスタムモデル対応

```python
# ローカルLLM（Ollama等）対応例
class OllamaService(LLMService):
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3"):
        self.base_url = base_url
        self._model = model

    @property
    def provider(self) -> str:
        return "ollama"

    async def generate_with_usage(self, prompt: str, ...) -> tuple[str, LLMResponse]:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/api/generate",
                json={"model": self.model, "prompt": prompt}
            ) as resp:
                data = await resp.json()
                return data["response"], LLMResponse(...)
```

---

## 11. 関連ドキュメント

- [01-SYSTEM-ARCHITECTURE.md](./01-SYSTEM-ARCHITECTURE.md) - 全体構成
- [03-PROMPT-MANAGEMENT.md](./03-PROMPT-MANAGEMENT.md) - プロンプト管理
- [08-OBSERVABILITY.md](./08-OBSERVABILITY.md) - メトリクス詳細
