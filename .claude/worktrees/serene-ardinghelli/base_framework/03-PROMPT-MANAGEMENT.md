# 03. Prompt Management - プロンプト管理設計

> **目的**: プロンプトの設計、バージョン管理、プロバイダー最適化の仕組みを定義

---

## 1. 設計目標

```
┌─────────────────────────────────────────────────────────────────┐
│                      Design Goals                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Centralized Management - 一元管理されたプロンプトレジストリ │
│  2. Provider Variants     - プロバイダー別の最適化             │
│  3. Version Control       - バージョン管理とロールバック        │
│  4. Runtime Override      - 実行時のカスタマイズ               │
│  5. Template Variables    - 動的変数の埋め込み                 │
│  6. Output Schema         - 出力形式の定義と検証               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. アーキテクチャ

### 2.1 全体構成

```
┌─────────────────────────────────────────────────────────────────┐
│                    Prompt Management Layer                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   Prompt Registry                          │ │
│  │                   (Singleton)                              │ │
│  │  ─────────────────────────────────────────────────────── │ │
│  │  + get(prompt_id, provider) -> PromptConfig               │ │
│  │  + get_system_prompt(id, provider) -> str                 │ │
│  │  + get_user_prompt(id, provider, **vars) -> str           │ │
│  │  + get_all() -> list[PromptConfig]                        │ │
│  │  + get_by_category(category) -> list[PromptConfig]        │ │
│  │  + save_custom_override(id, overrides) -> void            │ │
│  │  + reset_to_default(id) -> void                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│              │                                                  │
│              ▼                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   Prompt Config                            │ │
│  │  ─────────────────────────────────────────────────────── │ │
│  │  - id: str                                                │ │
│  │  - name: str                                              │ │
│  │  - category: str                                          │ │
│  │  - system_prompt: str                                     │ │
│  │  - user_prompt_template: str                              │ │
│  │  - output_schema: str                                     │ │
│  │  - provider_variants: dict[str, ProviderVariant]          │ │
│  └───────────────────────────────────────────────────────────┘ │
│              │                                                  │
│              ▼                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │               Provider Variants                            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │ │
│  │  │  OpenAI  │  │  Google  │  │ Anthropic│               │ │
│  │  │ Variant  │  │ Variant  │  │  Variant │               │ │
│  │  └──────────┘  └──────────┘  └──────────┘               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2.2 クラス図

```
┌─────────────────────────────┐
│      PromptRegistry         │
├─────────────────────────────┤
│ - _prompts: dict            │
│ - _overrides: dict          │
│ - _overrides_path: Path     │
├─────────────────────────────┤
│ + get()                     │
│ + get_system_prompt()       │
│ + get_user_prompt()         │
│ + save_custom_override()    │
│ + reset_to_default()        │
└─────────────────────────────┘
            │
            │ contains
            ▼
┌─────────────────────────────┐
│       PromptConfig          │
├─────────────────────────────┤
│ + id: str                   │
│ + name: str                 │
│ + category: str             │
│ + description: str          │
│ + system_prompt: str        │
│ + user_prompt_template: str │
│ + output_format: str        │
│ + output_schema: str        │
│ + input_variables: list     │
│ + temperature: float        │
│ + provider_variants: dict   │
├─────────────────────────────┤
│ + get_system_prompt()       │
│ + get_temperature()         │
│ + format_user_prompt()      │
└─────────────────────────────┘
            │
            │ has many
            ▼
┌─────────────────────────────┐
│   ProviderPromptVariant     │
├─────────────────────────────┤
│ + system_prompt: str | None │
│ + user_prompt_template: str │
│ + temperature: float | None │
│ + model_hints: dict | None  │
└─────────────────────────────┘
```

---

## 3. データモデル

### 3.1 PromptConfig

```python
# prompts/config.py
from dataclasses import dataclass, field
from typing import Any

@dataclass
class ProviderPromptVariant:
    """プロバイダー固有のプロンプト設定"""
    system_prompt: str | None = None          # 上書きシステムプロンプト
    user_prompt_template: str | None = None   # 上書きユーザープロンプト
    temperature: float | None = None          # 推奨温度
    model_hints: dict[str, Any] | None = None # モデル固有ヒント

@dataclass
class PromptConfig:
    """プロンプト設定"""
    id: str                                   # 一意識別子
    name: str                                 # 表示名
    category: str                             # カテゴリ
    description: str                          # 説明

    system_prompt: str                        # デフォルトシステムプロンプト
    user_prompt_template: str                 # ユーザープロンプトテンプレート

    output_format: str = "JSON"               # 出力形式
    output_schema: str = ""                   # JSON Schema文字列
    input_variables: list[str] = field(default_factory=list)
    temperature: float = 0.7                  # デフォルト温度

    provider_variants: dict[str, ProviderPromptVariant] = field(
        default_factory=dict
    )

    def get_system_prompt(self, provider: str) -> str:
        """プロバイダー用システムプロンプトを取得"""
        variant = self.provider_variants.get(provider)
        if variant and variant.system_prompt:
            return variant.system_prompt
        return self.system_prompt

    def get_temperature(self, provider: str) -> float:
        """プロバイダー用温度を取得"""
        variant = self.provider_variants.get(provider)
        if variant and variant.temperature is not None:
            return variant.temperature
        return self.temperature

    def format_user_prompt(self, provider: str, **kwargs) -> str:
        """テンプレート変数を埋め込んでユーザープロンプトを生成"""
        variant = self.provider_variants.get(provider)
        template = (
            variant.user_prompt_template
            if variant and variant.user_prompt_template
            else self.user_prompt_template
        )
        return template.format(**kwargs)

    def validate_input_variables(self, **kwargs) -> list[str]:
        """必須変数の検証"""
        missing = [var for var in self.input_variables if var not in kwargs]
        return missing
```

---

## 4. プロンプトレジストリ

### 4.1 シングルトン実装

```python
# prompts/registry.py
import json
from pathlib import Path
from typing import Any
from .config import PromptConfig, ProviderPromptVariant

class PromptRegistry:
    """プロンプト一元管理レジストリ（シングルトン）"""

    _instance: "PromptRegistry | None" = None

    def __new__(cls) -> "PromptRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._prompts: dict[str, PromptConfig] = {}
        self._overrides: dict[str, dict] = {}
        self._overrides_path = Path("data/prompt_overrides.json")
        self._load_prompts()
        self._load_overrides()

    def _load_prompts(self):
        """プロンプト定義をロード"""
        from .categories import (
            specification_prompts,
            block_diagram_prompts,
            circuit_prompts,
            # ... 他のカテゴリ
        )

        all_prompts = [
            *specification_prompts,
            *block_diagram_prompts,
            *circuit_prompts,
        ]

        for prompt in all_prompts:
            self._prompts[prompt.id] = prompt

    def _load_overrides(self):
        """カスタムオーバーライドをロード"""
        if self._overrides_path.exists():
            with open(self._overrides_path) as f:
                self._overrides = json.load(f)

    def get(self, prompt_id: str, provider: str | None = None) -> PromptConfig:
        """プロンプト設定を取得"""
        if prompt_id not in self._prompts:
            raise ValueError(f"Unknown prompt: {prompt_id}")

        config = self._prompts[prompt_id]

        # オーバーライドがあれば適用
        if prompt_id in self._overrides:
            config = self._apply_override(config, self._overrides[prompt_id])

        return config

    def _apply_override(
        self,
        config: PromptConfig,
        override: dict
    ) -> PromptConfig:
        """オーバーライドを適用した新しいConfigを返す"""
        from dataclasses import replace
        return replace(
            config,
            system_prompt=override.get("system_prompt", config.system_prompt),
            user_prompt_template=override.get(
                "user_prompt_template",
                config.user_prompt_template
            ),
            temperature=override.get("temperature", config.temperature)
        )

    def get_system_prompt(self, prompt_id: str, provider: str) -> str:
        """システムプロンプトを取得"""
        config = self.get(prompt_id)
        return config.get_system_prompt(provider)

    def get_user_prompt(
        self,
        prompt_id: str,
        provider: str,
        **template_vars
    ) -> str:
        """テンプレート変数を埋め込んだユーザープロンプトを取得"""
        config = self.get(prompt_id)

        # 必須変数チェック
        missing = config.validate_input_variables(**template_vars)
        if missing:
            raise ValueError(f"Missing template variables: {missing}")

        return config.format_user_prompt(provider, **template_vars)

    def get_all(self) -> list[PromptConfig]:
        """全プロンプトを取得"""
        return list(self._prompts.values())

    def get_by_category(self, category: str) -> list[PromptConfig]:
        """カテゴリでフィルタ"""
        return [p for p in self._prompts.values() if p.category == category]

    def save_custom_override(
        self,
        prompt_id: str,
        overrides: dict[str, Any]
    ):
        """カスタムオーバーライドを保存"""
        if prompt_id not in self._prompts:
            raise ValueError(f"Unknown prompt: {prompt_id}")

        self._overrides[prompt_id] = overrides
        self._overrides_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._overrides_path, "w") as f:
            json.dump(self._overrides, f, indent=2, ensure_ascii=False)

    def reset_to_default(self, prompt_id: str):
        """デフォルトにリセット"""
        if prompt_id in self._overrides:
            del self._overrides[prompt_id]
            with open(self._overrides_path, "w") as f:
                json.dump(self._overrides, f, indent=2, ensure_ascii=False)


# グローバルインスタンス
prompt_registry = PromptRegistry()
```

---

## 5. プロンプト定義

### 5.1 カテゴリ別ファイル構成

```
prompts/
├── __init__.py
├── config.py              # データモデル定義
├── registry.py            # レジストリ
└── categories/
    ├── __init__.py
    ├── specification.py   # 仕様書関連プロンプト
    ├── block_diagram.py   # ブロック図関連
    ├── analysis.py        # 分析関連
    ├── generation.py      # 生成関連
    └── chat.py            # チャット関連
```

### 5.2 プロンプト定義例

```python
# prompts/categories/specification.py
from ..config import PromptConfig, ProviderPromptVariant

specification_prompts = [
    PromptConfig(
        id="spec_analyze",
        name="仕様書分析",
        category="specification",
        description="入力テキストから要件を抽出・分析",

        system_prompt="""あなたは要件分析の専門家です。
入力されたテキストから、以下の情報を抽出してください：
- 機能要件
- 非機能要件
- 制約条件
- 不明確な点

出力はJSON形式で返してください。""",

        user_prompt_template="""以下の{source_type}から要件を分析してください：

---
{content}
---

抽出した要件をJSON形式で出力してください。""",

        output_format="JSON",
        output_schema="""{
  "type": "object",
  "properties": {
    "functional_requirements": {
      "type": "array",
      "items": {"type": "object", "properties": {"id": {"type": "string"}, "description": {"type": "string"}}}
    },
    "non_functional_requirements": {"type": "array"},
    "constraints": {"type": "array"},
    "unclear_points": {"type": "array"}
  },
  "required": ["functional_requirements"]
}""",

        input_variables=["source_type", "content"],
        temperature=0.3,

        provider_variants={
            "openai": ProviderPromptVariant(
                system_prompt="""You are an expert requirements analyst.
Extract and analyze requirements from the input text.
Output must be valid JSON.""",
                temperature=0.2
            ),
            "google": ProviderPromptVariant(
                system_prompt="""あなたは要件分析の専門家です。
入力テキストから要件を抽出し、JSON形式で出力してください。
日本語で回答してください。""",
                temperature=0.3
            )
        }
    ),

    PromptConfig(
        id="spec_generate_rough",
        name="ラフ仕様書生成",
        category="specification",
        description="分析結果からラフ仕様書を生成",
        # ... 以下省略
    ),
]
```

---

## 6. プロンプトテンプレート

### 6.1 変数埋め込み

```python
# テンプレート変数の命名規則
# {variable_name} - 単純な値
# {items:json}    - JSON形式でシリアライズ（カスタム拡張）

# 基本的な使用例
template = "以下の{source_type}を分析：\n{content}"
result = template.format(source_type="メール", content="...")

# 複雑なデータの埋め込み
def format_with_json(template: str, **kwargs) -> str:
    """JSON埋め込み対応のフォーマット"""
    import json
    formatted = {}
    for key, value in kwargs.items():
        if isinstance(value, (dict, list)):
            formatted[key] = json.dumps(value, ensure_ascii=False, indent=2)
        else:
            formatted[key] = value
    return template.format(**formatted)
```

### 6.2 条件付きセクション

```python
# prompts/utils.py

def build_prompt_with_context(
    base_template: str,
    context_sections: dict[str, str | None]
) -> str:
    """コンテキストに応じてセクションを追加"""
    sections = []
    sections.append(base_template)

    for section_name, content in context_sections.items():
        if content:
            sections.append(f"\n\n## {section_name}\n{content}")

    return "\n".join(sections)

# 使用例
prompt = build_prompt_with_context(
    base_template="設計を作成してください。",
    context_sections={
        "前提条件": previous_context,  # Noneなら含まれない
        "参考情報": reference_data,
        "制約": constraints
    }
)
```

---

## 7. 出力スキーマ

### 7.1 JSON Schema定義

```python
# prompts/schemas.py

SPEC_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "extracted_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"enum": ["high", "medium", "low"]}
                },
                "required": ["category", "description"]
            }
        },
        "missing_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "question": {"type": "string"}
                }
            }
        },
        "reasoning": {"type": "string"}
    },
    "required": ["extracted_items", "reasoning"]
}

def validate_llm_output(data: dict, schema: dict) -> tuple[bool, list[str]]:
    """LLM出力をスキーマで検証"""
    import jsonschema
    try:
        jsonschema.validate(data, schema)
        return True, []
    except jsonschema.ValidationError as e:
        return False, [str(e)]
```

### 7.2 スキーマをプロンプトに含める

```python
def get_user_prompt_with_schema(
    prompt_id: str,
    provider: str,
    **template_vars
) -> str:
    """スキーマ付きプロンプトを生成"""
    config = prompt_registry.get(prompt_id)
    base_prompt = config.format_user_prompt(provider, **template_vars)

    if config.output_schema:
        schema_instruction = f"""

出力は以下のJSONスキーマに従ってください：
```json
{config.output_schema}
```
"""
        return base_prompt + schema_instruction

    return base_prompt
```

---

## 8. バージョン管理

### 8.1 DBモデル

```python
# models/prompt.py
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base, GUID, JSONType
import uuid
from datetime import datetime

class PromptVersion(Base):
    """プロンプトバージョン"""
    __tablename__ = "prompt_versions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    prompt_id = Column(String(100), nullable=False, index=True)
    version = Column(Integer, nullable=False)

    system_prompt = Column(Text, nullable=False)
    user_prompt_template = Column(Text, nullable=False)
    temperature = Column(Float, default=0.7)
    output_schema = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100))
    change_description = Column(Text)

    # ユニーク制約
    __table_args__ = (
        UniqueConstraint("prompt_id", "version", name="uq_prompt_version"),
    )

class PromptVersionHistory(Base):
    """プロンプト変更履歴"""
    __tablename__ = "prompt_version_history"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    prompt_version_id = Column(GUID, ForeignKey("prompt_versions.id"))
    action = Column(String(50))  # created, updated, rolled_back
    previous_content = Column(JSONType)
    new_content = Column(JSONType)
    timestamp = Column(DateTime, default=datetime.utcnow)
```

### 8.2 バージョン管理API

```python
# routers/prompts.py

@router.get("/{prompt_id}/versions")
async def list_versions(
    prompt_id: str,
    session: AsyncSession = Depends(get_session)
) -> list[PromptVersionResponse]:
    """バージョン一覧"""
    result = await session.execute(
        select(PromptVersion)
        .where(PromptVersion.prompt_id == prompt_id)
        .order_by(PromptVersion.version.desc())
    )
    return [PromptVersionResponse.from_orm(v) for v in result.scalars()]

@router.post("/{prompt_id}/versions/{version}/rollback")
async def rollback_version(
    prompt_id: str,
    version: int,
    session: AsyncSession = Depends(get_session)
):
    """指定バージョンにロールバック"""
    target = await session.execute(
        select(PromptVersion)
        .where(
            PromptVersion.prompt_id == prompt_id,
            PromptVersion.version == version
        )
    )
    target_version = target.scalar_one_or_none()
    if not target_version:
        raise HTTPException(404, "Version not found")

    # 新バージョンとして保存（履歴を維持）
    new_version = PromptVersion(
        prompt_id=prompt_id,
        version=await get_next_version(session, prompt_id),
        system_prompt=target_version.system_prompt,
        user_prompt_template=target_version.user_prompt_template,
        change_description=f"Rollback to version {version}"
    )
    session.add(new_version)
    await session.commit()

    # レジストリを更新
    prompt_registry.save_custom_override(prompt_id, {
        "system_prompt": new_version.system_prompt,
        "user_prompt_template": new_version.user_prompt_template
    })

    return {"message": f"Rolled back to version {version}"}
```

---

## 9. プロバイダー最適化

### 9.1 モデル特性への対応

```python
# prompts/optimization.py

MODEL_CHARACTERISTICS = {
    "openai": {
        "gpt-4o": {
            "context_window": 128000,
            "best_for": ["complex_reasoning", "code_generation"],
            "prompt_style": "structured"
        },
        "gpt-4o-mini": {
            "context_window": 128000,
            "best_for": ["quick_tasks", "summarization"],
            "prompt_style": "concise"
        },
        "o1": {
            "context_window": 128000,
            "best_for": ["complex_reasoning", "math", "code"],
            "prompt_style": "step_by_step",
            "notes": "No system prompt, no temperature"
        }
    },
    "google": {
        "gemini-pro": {
            "context_window": 32000,
            "best_for": ["general_tasks", "multilingual"],
            "prompt_style": "conversational"
        }
    }
}

def optimize_prompt_for_model(
    prompt: str,
    provider: str,
    model: str
) -> str:
    """モデル特性に応じてプロンプトを最適化"""
    characteristics = MODEL_CHARACTERISTICS.get(provider, {}).get(model, {})

    if characteristics.get("prompt_style") == "step_by_step":
        # o1系は段階的思考を促す
        prompt = f"Think step by step.\n\n{prompt}"

    if characteristics.get("prompt_style") == "concise":
        # ミニモデルは簡潔に
        prompt = prompt.replace("詳細に", "簡潔に")

    return prompt
```

### 9.2 プロバイダー別ベストプラクティス

```python
# OpenAI向け
OPENAI_BEST_PRACTICES = """
- システムプロンプトは明確なロール定義から開始
- JSON出力は "Respond with valid JSON only." を含める
- 複雑なタスクは箇条書きで分解
"""

# Google AI向け
GOOGLE_BEST_PRACTICES = """
- Geminiは会話調のプロンプトに強い
- 日本語のニュアンスを活かす
- マルチモーダル入力を活用可能
"""
```

---

## 10. 使用例

### 10.1 サービスでの使用

```python
# services/process/specification_service.py

class SpecificationService:
    def __init__(
        self,
        llm_service: LLMService,
        prompt_registry: PromptRegistry
    ):
        self.llm = llm_service
        self.prompts = prompt_registry

    async def analyze(
        self,
        content: str,
        source_type: str
    ) -> SpecificationAnalysisResult:
        """仕様書を分析"""

        # プロンプト取得
        system_prompt = self.prompts.get_system_prompt(
            "spec_analyze",
            self.llm.provider
        )
        user_prompt = self.prompts.get_user_prompt(
            "spec_analyze",
            self.llm.provider,
            content=content,
            source_type=source_type
        )

        # LLM呼び出し
        result, llm_response = await self.llm.generate_json_with_usage(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=self.prompts.get("spec_analyze").get_temperature(
                self.llm.provider
            )
        )

        return SpecificationAnalysisResult(**result)
```

### 10.2 管理UI用API

```python
# routers/prompts.py

@router.get("/")
async def list_prompts() -> list[PromptConfigResponse]:
    """全プロンプト一覧"""
    return [
        PromptConfigResponse(
            id=p.id,
            name=p.name,
            category=p.category,
            description=p.description
        )
        for p in prompt_registry.get_all()
    ]

@router.get("/{prompt_id}")
async def get_prompt(prompt_id: str) -> PromptDetailResponse:
    """プロンプト詳細"""
    config = prompt_registry.get(prompt_id)
    return PromptDetailResponse(
        id=config.id,
        name=config.name,
        category=config.category,
        system_prompt=config.system_prompt,
        user_prompt_template=config.user_prompt_template,
        output_schema=config.output_schema,
        input_variables=config.input_variables,
        temperature=config.temperature,
        provider_variants={
            k: ProviderVariantResponse(
                system_prompt=v.system_prompt,
                user_prompt_template=v.user_prompt_template,
                temperature=v.temperature
            )
            for k, v in config.provider_variants.items()
        }
    )

@router.patch("/{prompt_id}")
async def update_prompt(
    prompt_id: str,
    data: PromptUpdateRequest
) -> PromptDetailResponse:
    """プロンプト更新"""
    prompt_registry.save_custom_override(
        prompt_id,
        data.model_dump(exclude_unset=True)
    )
    return await get_prompt(prompt_id)
```

---

## 11. 関連ドキュメント

- [02-LLM-INTEGRATION.md](./02-LLM-INTEGRATION.md) - LLMサービスとの連携
- [04-PROCESS-PIPELINE.md](./04-PROCESS-PIPELINE.md) - プロセスでのプロンプト使用
- [10-TESTING-STRATEGY.md](./10-TESTING-STRATEGY.md) - プロンプトのテスト
