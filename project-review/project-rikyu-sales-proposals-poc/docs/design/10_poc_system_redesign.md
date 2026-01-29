# rikyu PoC検証システム 再設計書

> **作成日**: 2026-01-23
> **バージョン**: v1.0
> **参考**: base_framework設計パターン

---

## 1. 再設計の目的

### 1.1 現状の課題

```
┌─────────────────────────────────────────────────────────────────┐
│                    現状の問題点                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. MLテンプレートベースのため、LLMアプリに不適合               │
│  2. Mock機能がない → 開発中のLLM APIコスト発生                  │
│  3. プロンプトがハードコード → バージョン管理・最適化困難       │
│  4. プロセス間の状態管理がない → 依存関係追跡困難               │
│  5. メトリクス収集機能がない → コスト・品質追跡困難             │
│  6. 評価結果の蓄積・分析基盤がない → 改善サイクル回しにくい     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 再設計のゴール

```
┌─────────────────────────────────────────────────────────────────┐
│                    Design Goals (PoC検証最適化)                  │
├─────────────────────────────────────────────────────────────────┤
│  1. Mock-First開発   - 開発初期はMockで高速検証                 │
│  2. 段階的検証       - シナリオ1件から段階的に拡大              │
│  3. コスト可視化     - トークン・コストをリアルタイム追跡       │
│  4. 評価自動化       - LLM-as-Judgeとの連携                     │
│  5. 改善追跡         - プロンプト変更→効果測定のサイクル        │
│  6. 切り替え容易     - Mock ⇔ Real LLM を環境変数で切替         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. アーキテクチャ全体像

### 2.1 レイヤードアーキテクチャ

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  Streamlit UI   │  │  Gradio Demo    │  │  CLI / Scripts      │  │
│  │  (検証・評価)    │  │  (顧客デモ)     │  │  (バッチ実行)        │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ REST API (JSON)
┌────────────────────────────▼─────────────────────────────────────────┐
│                      API Layer (FastAPI)                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Routers: /scenarios /processes /prompts /evaluations /metrics│   │
│  │  • リクエスト検証 (Pydantic Schemas)                          │   │
│  │  • Tracerコンテキスト管理                                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                      Service Layer                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │NeedsEstimator    │  │SolutionRecommender│ │EvaluationService  │  │
│  │ Service          │  │ Service          │  │ (LLM-as-Judge)    │  │
│  │ ・ニーズ推定      │  │ ・ソリューション推薦│  │ ・自動評価        │  │
│  └──────────────────┘  └──────────────────┘  └───────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   LLM Service Layer                           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐   │   │
│  │  │AzureOpenAI│  │  OpenAI  │  │  Claude  │  │MockLLMService│  │   │
│  │  │ Service  │  │  Service │  │  Service │  │（開発用）    │   │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────┐  ┌───────────────────────────────────┐  │
│  │   Prompt Registry      │  │   State Manager                   │  │
│  │   ・プロンプト一元管理   │  │   ・プロセス状態追跡              │  │
│  │   ・バージョン管理      │  │   ・依存関係管理                  │  │
│  └────────────────────────┘  └───────────────────────────────────┘  │
│  ┌────────────────────────┐  ┌───────────────────────────────────┐  │
│  │   Tracer Abstraction   │  │   Metrics Recorder                │  │
│  │   ・Opik/LangFuse抽象化 │  │   ・トークン/コスト記録           │  │
│  └────────────────────────┘  └───────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                      Data Layer                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │   Database   │  │   LLM APIs   │  │   External Services      │   │
│  │ SQLite(dev)  │  │ Azure OpenAI │  │   Opik / AI Search       │   │
│  │ PG(prod)     │  │              │  │                          │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 PoC検証フロー

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   PoC検証フロー（1シナリオ単位）- 伴奏AI版                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ①シナリオ入力         ②ニーズ推定      ③ソリューション伴奏     ④評価        │
│                                                                                 │
│  ┌──────────────────┐    ┌──────────┐    ┌────────────────┐    ┌──────────┐  │
│  │ 企業情報          │───▶│ニーズ推定│───▶│伴奏AI          │───▶│LLM評価   │  │
│  │ 聴取情報          │    │  AI      │    │（提案＋アクション）│  │ as-Judge │  │
│  │ 商材情報          │    └──────────┘    └────────────────┘    └──────────┘  │
│  │ ★経営アジェンダ  │         │                   │                   │        │
│  │ ★キーパーソンマップ│        ▼                   ▼                   ▼        │
│  └──────────────────┘    ┌──────────┐    ┌────────────────┐    ┌──────────┐  │
│       │                  │ニーズ    │    │提案方針        │    │評価結果  │  │
│       │                  │リスト    │    │商材推薦        │    │スコア    │  │
│       │                  └──────────┘    │★ネクストアクション│  └──────────┘  │
│       │                                  │★アカウントプラン │                  │
│       │                                  │  更新提案       │                  │
│       │                                  └────────────────┘                  │
│       └────────────────────────────────────────────────────────┼─────────┐    │
│                                                                │         │    │
│  ⑤メトリクス記録                                               ▼         ▼    │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  Metrics Recorder + Opik                                                  │ │
│  │  ・トークン使用量  ・コスト  ・推論時間  ・評価スコア履歴                  │ │
│  │  ★ネクストアクション品質スコア  ★アカウントプラン更新提案適切度          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  【伴奏AIの核心】                                                               │
│  入力：現状のアカウントプラン（経営アジェンダ・キーパーソンマップ）を受け取り   │
│  出力：商材提案だけでなく、アカウントプラン更新・深掘りアクションまで提示       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. ディレクトリ構造（再設計後）

```
project-rikyu-sales-proposals-poc/
├── src/
│   ├── main.py                     # FastAPI エントリポイント
│   ├── config.py                   # 設定定義
│   ├── settings.py                 # Pydantic Settings
│   ├── database.py                 # DB接続・セッション管理
│   │
│   ├── routers/                    # API Layer
│   │   ├── __init__.py
│   │   ├── scenarios.py            # シナリオCRUD
│   │   ├── processes.py            # プロセス実行
│   │   ├── prompts.py              # プロンプト管理
│   │   ├── evaluations.py          # 評価API
│   │   ├── metrics.py              # メトリクス取得
│   │   └── health.py               # ヘルスチェック
│   │
│   ├── schemas/                    # Request/Response Schemas
│   │   ├── __init__.py
│   │   ├── scenario.py
│   │   ├── needs.py                # ニーズ推定I/O
│   │   ├── solution.py             # ソリューション推薦I/O
│   │   ├── evaluation.py           # 評価I/O
│   │   └── common.py
│   │
│   ├── services/                   # Service Layer
│   │   ├── __init__.py
│   │   ├── llm/                    # ★ LLM統合層
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # LLMService 抽象基底
│   │   │   ├── azure_openai.py     # Azure OpenAI実装
│   │   │   ├── openai.py           # OpenAI実装（バックアップ）
│   │   │   ├── factory.py          # LLMサービスファクトリー
│   │   │   ├── pricing.py          # コスト計算
│   │   │   └── mock/               # ★ Mock実装
│   │   │       ├── __init__.py
│   │   │       ├── service.py      # MockLLMService
│   │   │       └── fixtures/       # Mockレスポンス
│   │   │           ├── needs_estimation.json
│   │   │           ├── solution_recommendation.json
│   │   │           └── evaluation.json
│   │   │
│   │   ├── process/                # プロセス実行
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # BaseProcessService
│   │   │   ├── needs_estimator.py  # ニーズ推定サービス
│   │   │   ├── solution_recommender.py  # ソリューション推薦
│   │   │   └── evaluator.py        # LLM-as-Judge評価
│   │   │
│   │   ├── state_manager.py        # プロセス状態管理
│   │   ├── metrics_recorder.py     # メトリクス記録
│   │   └── tracer/                 # ★ Tracer抽象化
│   │       ├── __init__.py
│   │       ├── interface.py        # TracerInterface
│   │       ├── opik_tracer.py      # Opik実装
│   │       ├── noop_tracer.py      # 無効実装（テスト用）
│   │       └── factory.py          # Tracerファクトリー
│   │
│   ├── prompts/                    # ★ プロンプト管理層
│   │   ├── __init__.py
│   │   ├── config.py               # PromptConfig定義
│   │   ├── registry.py             # PromptRegistry
│   │   └── categories/
│   │       ├── __init__.py
│   │       ├── needs_estimation.py # ニーズ推定プロンプト
│   │       ├── solution.py         # ソリューション推薦プロンプト
│   │       └── evaluation.py       # 評価プロンプト
│   │
│   ├── models/                     # Data Access Layer
│   │   ├── __init__.py
│   │   ├── base.py                 # ベースクラス、型定義（DB非依存）
│   │   ├── scenario.py             # シナリオモデル
│   │   ├── process.py              # プロセス実行・状態モデル
│   │   ├── prompt_version.py       # プロンプトバージョン
│   │   └── metrics.py              # LLMメトリクス
│   │
│   └── utils/
│       ├── __init__.py
│       ├── logging.py              # 構造化ログ
│       └── helpers.py
│
├── ui/                             # フロントエンド
│   ├── streamlit/                  # 検証・評価UI
│   │   ├── app.py
│   │   ├── pages/
│   │   │   ├── 01_scenarios.py     # シナリオ管理
│   │   │   ├── 02_execution.py     # 実行・結果確認
│   │   │   ├── 03_evaluation.py    # 評価・FB
│   │   │   ├── 04_prompts.py       # プロンプト管理
│   │   │   └── 05_metrics.py       # メトリクスダッシュボード
│   │   └── components/
│   │
│   └── gradio/                     # 顧客デモUI
│       └── demo_app.py
│
├── tests/
│   ├── conftest.py                 # 共通フィクスチャ（Mock自動適用）
│   ├── unit/
│   │   ├── services/
│   │   │   ├── test_llm_service.py
│   │   │   ├── test_needs_estimator.py
│   │   │   └── test_state_manager.py
│   │   └── prompts/
│   │       └── test_registry.py
│   ├── integration/
│   │   ├── test_api_scenarios.py
│   │   └── test_process_pipeline.py
│   └── evaluation/                 # 評価テスト
│       └── test_llm_as_judge.py
│
├── alembic/                        # DBマイグレーション
│   ├── versions/
│   └── env.py
│
├── data/
│   ├── fixtures/                   # ★ Mock用固定レスポンス
│   │   ├── needs_estimation/
│   │   │   ├── scenario_001.json
│   │   │   └── scenario_002.json
│   │   └── solution_recommendation/
│   │       └── ...
│   ├── prompt_overrides.json       # プロンプトオーバーライド
│   └── rubrics/                    # 評価ルーブリック
│       ├── needs_rubric.yaml
│       └── solution_rubric.yaml
│
├── config/
│   ├── process_pipeline.yaml       # パイプライン定義
│   └── tracer.yaml                 # Tracer設定
│
├── docs/
│   └── design/
│
├── scripts/
│   ├── seed_scenarios.py           # シナリオデータ投入
│   └── run_batch_evaluation.py     # バッチ評価実行
│
├── pyproject.toml
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## 4. LLM統合層設計

### 4.1 設計目標

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM統合層 Design Goals                        │
├─────────────────────────────────────────────────────────────────┤
│  1. Provider Agnostic - Azure OpenAI / OpenAI / Mock 切替可能   │
│  2. Mock-First       - 開発中はMockでAPIコスト0                 │
│  3. Auto Fallback    - APIキー未設定時は自動でMock              │
│  4. Cost Tracking    - 全呼び出しのトークン・コスト記録         │
│  5. Structured Output - Pydantic連携でJSON応答を型安全に        │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 クラス構造

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LLM Service Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              <<abstract>>                                     │ │
│  │              LLMService                                       │ │
│  │  ─────────────────────────────────────────────────────────── │ │
│  │  + provider: str                                              │ │
│  │  + model: str                                                 │ │
│  │  + is_mock: bool                                              │ │
│  │  ─────────────────────────────────────────────────────────── │ │
│  │  + generate(prompt, system_prompt) -> str                     │ │
│  │  + generate_json(prompt, system_prompt, schema) -> dict       │ │
│  │  + generate_structured(prompt, response_model: T) -> T        │ │
│  │  + generate_with_usage(...) -> (str, LLMResponse)             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│            △                    △                    △             │
│            │                    │                    │             │
│  ┌─────────┴───────┐  ┌────────┴────────┐  ┌────────┴───────────┐ │
│  │AzureOpenAIService│  │  OpenAIService  │  │  MockLLMService    │ │
│  │（本番用）         │  │（バックアップ） │  │  （開発・テスト用）│ │
│  │ - GPT-5.2        │  │  - GPT-4o       │  │  - fixture応答    │ │
│  └─────────────────┘  └─────────────────┘  └────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 基底クラス実装

```python
# src/services/llm/base.py
from abc import ABC, abstractmethod
from typing import Any, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class LLMResponse(BaseModel):
    """LLM応答の統一モデル"""
    content: str
    model: str
    provider: str
    usage: dict[str, int] | None = None

    @property
    def prompt_tokens(self) -> int:
        return self.usage.get("prompt_tokens", 0) if self.usage else 0

    @property
    def completion_tokens(self) -> int:
        return self.usage.get("completion_tokens", 0) if self.usage else 0

    @property
    def total_tokens(self) -> int:
        return self.usage.get("total_tokens", 0) if self.usage else 0


class LLMService(ABC):
    """LLMサービスの抽象基底クラス"""

    @property
    @abstractmethod
    def provider(self) -> str:
        pass

    @property
    @abstractmethod
    def model(self) -> str:
        pass

    @property
    @abstractmethod
    def is_mock(self) -> bool:
        pass

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
    ) -> str:
        """テキスト生成"""
        pass

    @abstractmethod
    async def generate_structured(
        self,
        prompt: str,
        response_model: type[T],
        system_prompt: str | None = None,
        temperature: float = 0.3,
    ) -> T:
        """Structured Output（Pydanticモデルで型付きJSON取得）"""
        pass

    @abstractmethod
    async def generate_with_usage(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
    ) -> tuple[str, LLMResponse]:
        """テキスト生成（使用量情報付き）"""
        pass
```

### 4.4 Mock実装（PoC検証の要）

```python
# src/services/llm/mock/service.py
import json
from pathlib import Path
from typing import TypeVar
from pydantic import BaseModel
from ..base import LLMService, LLMResponse

T = TypeVar("T", bound=BaseModel)

class MockLLMService(LLMService):
    """
    Mock LLMサービス（開発・テスト用）

    PoC検証での役割:
    - 開発初期はMockでUI/パイプラインを構築
    - APIコスト0で高速イテレーション
    - 期待出力を固定してE2Eテスト
    """

    FIXTURES_DIR = Path("data/fixtures")

    def __init__(self):
        self._fixtures = self._load_fixtures()

    @property
    def provider(self) -> str:
        return "mock"

    @property
    def model(self) -> str:
        return "mock-model"

    @property
    def is_mock(self) -> bool:
        return True

    def _load_fixtures(self) -> dict:
        """フィクスチャを読み込み"""
        fixtures = {}
        for category_dir in self.FIXTURES_DIR.iterdir():
            if category_dir.is_dir():
                fixtures[category_dir.name] = {}
                for file in category_dir.glob("*.json"):
                    with open(file) as f:
                        fixtures[category_dir.name][file.stem] = json.load(f)
        return fixtures

    def _select_fixture(self, prompt: str) -> dict:
        """プロンプト内容からフィクスチャを選択"""
        prompt_lower = prompt.lower()

        # キーワードマッチングでフィクスチャ選択
        if "ニーズ" in prompt or "needs" in prompt_lower:
            return self._fixtures.get("needs_estimation", {}).get(
                "default", self._default_needs_response()
            )
        elif "ソリューション" in prompt or "推薦" in prompt or "solution" in prompt_lower:
            return self._fixtures.get("solution_recommendation", {}).get(
                "default", self._default_solution_response()
            )
        elif "評価" in prompt or "evaluate" in prompt_lower:
            return self._fixtures.get("evaluation", {}).get(
                "default", self._default_evaluation_response()
            )
        else:
            return {"message": "Mock response"}

    async def generate_structured(
        self,
        prompt: str,
        response_model: type[T],
        system_prompt: str | None = None,
        temperature: float = 0.3,
    ) -> T:
        """Structured Output（Mock）"""
        fixture = self._select_fixture(prompt)
        return response_model.model_validate(fixture)

    async def generate_with_usage(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
    ) -> tuple[str, LLMResponse]:
        fixture = self._select_fixture(prompt)
        content = json.dumps(fixture, ensure_ascii=False)

        # 擬似的なトークン数（文字数/4で近似）
        llm_response = LLMResponse(
            content=content,
            model=self.model,
            provider=self.provider,
            usage={
                "prompt_tokens": len(prompt) // 4,
                "completion_tokens": len(content) // 4,
                "total_tokens": (len(prompt) + len(content)) // 4
            }
        )

        return content, llm_response

    def _default_needs_response(self) -> dict:
        """デフォルトのニーズ推定レスポンス"""
        return {
            "needs": [
                {
                    "category": "業務効率化",
                    "description": "手作業による業務プロセスの自動化ニーズ",
                    "priority": 4,
                    "evidence": "【Mock】聴取情報から推定"
                }
            ],
            "summary": "【Mock】開発用のダミーレスポンスです"
        }

    # ... 他のデフォルトレスポンス
```

### 4.5 ファクトリーパターン（自動Mock切替）

```python
# src/services/llm/factory.py
import os
from .base import LLMService

def create_llm_service(
    provider: str | None = None,
    api_key: str | None = None,
) -> LLMService:
    """
    LLMサービスを生成

    優先順位:
    1. 明示的に指定されたprovider
    2. 環境変数 LLM_PROVIDER
    3. APIキーの有無で自動判定
    4. フォールバック: Mock
    """
    # provider決定
    provider = provider or os.getenv("LLM_PROVIDER", "auto")

    if provider == "mock":
        from .mock.service import MockLLMService
        return MockLLMService()

    if provider == "azure_openai" or provider == "auto":
        azure_key = api_key or os.getenv("AZURE_OPENAI_API_KEY")
        if azure_key and azure_key != "placeholder":
            from .azure_openai import AzureOpenAIService
            return AzureOpenAIService(api_key=azure_key)

    if provider == "openai" or provider == "auto":
        openai_key = api_key or os.getenv("OPENAI_API_KEY")
        if openai_key and openai_key != "placeholder":
            from .openai import OpenAIService
            return OpenAIService(api_key=openai_key)

    # APIキーなし → 自動的にMock
    print("⚠️ No API key found. Running in MOCK mode.")
    from .mock.service import MockLLMService
    return MockLLMService()
```

---

## 5. プロンプト管理設計

### 5.1 設計目標

```
┌─────────────────────────────────────────────────────────────────┐
│                 Prompt Management Goals (PoC最適化)              │
├─────────────────────────────────────────────────────────────────┤
│  1. 一元管理       - 全プロンプトをレジストリで管理             │
│  2. バージョン追跡 - 変更履歴とその効果を追跡                   │
│  3. A/Bテスト対応  - 複数バージョンを並行評価                   │
│  4. テンプレート化 - 変数埋め込みで柔軟な入力対応               │
│  5. 出力スキーマ   - JSON Schemaで出力形式を強制                │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 プロンプト定義例

```python
# src/prompts/categories/needs_estimation.py
from ..config import PromptConfig

needs_estimation_prompts = [
    PromptConfig(
        id="needs_estimation_v1",
        name="ニーズ推定 v1",
        category="needs_estimation",
        description="企業情報・聴取情報から顧客ニーズを推定",

        system_prompt="""あなたはrikyu社の営業支援AIです。
企業情報と聴取情報から、顧客の潜在的なニーズを推定してください。

## 推定の観点
- 明示的に言及されたニーズ
- 業種・規模から推測されるニーズ
- 競合動向から推測されるニーズ
- 言及されていないが重要と思われるニーズ

## 出力形式
JSON形式で、needs配列とsummaryを出力してください。""",

        user_prompt_template="""## 企業情報
{company_info}

## 聴取情報
{hearing_info}

## 経営アジェンダシート
{management_agenda}

## キーパーソンマップ
{key_person_map}

## 参考情報（オプション）
{knowledge}

上記情報から顧客ニーズを推定してください。
経営アジェンダシートの課題・キーパーソンマップの関係性を踏まえて、
深掘りすべきポイントも併せて提示してください。""",

        output_schema="""
{
  "type": "object",
  "properties": {
    "needs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "category": {"type": "string"},
          "description": {"type": "string"},
          "priority": {"type": "integer", "minimum": 1, "maximum": 5},
          "evidence": {"type": "string"}
        },
        "required": ["category", "description", "priority", "evidence"]
      }
    },
    "summary": {"type": "string"},
    "deep_dive_points": {
      "type": "array",
      "description": "経営アジェンダの深掘りポイント",
      "items": {"type": "string"}
    }
  },
  "required": ["needs", "summary"]
}
""",
        input_variables=["company_info", "hearing_info", "management_agenda", "key_person_map", "knowledge"],
        temperature=0.3,
    ),
]
```

### 5.3 プロンプトレジストリ

```python
# src/prompts/registry.py
from typing import Any
from pathlib import Path
import json

class PromptRegistry:
    """
    プロンプト一元管理レジストリ

    PoC検証での役割:
    - プロンプト変更の追跡
    - バージョン間の比較評価
    - オーバーライドによる実験
    """

    _instance = None

    def __new__(cls):
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
        self._load_prompts()
        self._load_overrides()

    def get(self, prompt_id: str) -> PromptConfig:
        """プロンプト取得（オーバーライド適用済み）"""
        if prompt_id not in self._prompts:
            raise ValueError(f"Unknown prompt: {prompt_id}")

        config = self._prompts[prompt_id]

        # オーバーライドがあれば適用
        if prompt_id in self._overrides:
            config = self._apply_override(config, self._overrides[prompt_id])

        return config

    def get_formatted_prompt(
        self,
        prompt_id: str,
        **template_vars
    ) -> tuple[str, str]:
        """
        フォーマット済みプロンプトを取得
        Returns: (system_prompt, user_prompt)
        """
        config = self.get(prompt_id)

        # 必須変数チェック
        missing = [v for v in config.input_variables if v not in template_vars]
        if missing:
            raise ValueError(f"Missing template variables: {missing}")

        # オプション変数のデフォルト設定
        for var in config.input_variables:
            if var not in template_vars:
                template_vars[var] = ""

        user_prompt = config.user_prompt_template.format(**template_vars)

        return config.system_prompt, user_prompt

    def save_override(self, prompt_id: str, overrides: dict):
        """
        オーバーライドを保存（実験用）

        使用例:
        - A/Bテストで新しいsystem_promptを試す
        - temperatureの調整実験
        """
        self._overrides[prompt_id] = overrides
        self._save_overrides()

    def get_all_versions(self, category: str) -> list[PromptConfig]:
        """カテゴリ内の全バージョンを取得"""
        return [p for p in self._prompts.values() if p.category == category]


# グローバルインスタンス
prompt_registry = PromptRegistry()
```

---

## 6. プロセスパイプライン設計

### 6.1 パイプライン構造

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PoC検証 パイプライン                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │ニーズ推定   │───▶│ソリューション│───▶│自動評価     │            │
│  │ (Process A) │    │  推薦       │    │ (LLM-Judge) │            │
│  │             │    │ (Process B) │    │ (Process C) │            │
│  └─────────────┘    └─────────────┘    └─────────────┘            │
│       │                  │                  │                      │
│       ▼                  ▼                  ▼                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │  State      │    │  State      │    │  State      │            │
│  │ empty→valid │    │ empty→valid │    │ empty→valid │            │
│  └─────────────┘    └─────────────┘    └─────────────┘            │
│                                                                     │
│  【状態遷移】                                                       │
│  empty → pending → valid                                           │
│                  → error                                            │
│  valid → stale (上流が更新された場合)                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 パイプライン定義

```yaml
# config/process_pipeline.yaml
processes:
  - id: needs_estimation
    name: ニーズ推定
    order: 1
    depends_on: []
    prompt_id: needs_estimation_v1
    input_schema:
      type: object
      required: [company_info, hearing_info, management_agenda, key_person_map]
      properties:
        company_info: { type: string }
        hearing_info: { type: string }
        management_agenda: { type: object }  # ★経営アジェンダシート
        key_person_map: { type: object }      # ★キーパーソンマップ
        knowledge: { type: object }

  - id: solution_recommendation
    name: ソリューション伴奏（提案＋ネクストアクション）
    order: 2
    depends_on: [needs_estimation]
    prompt_id: solution_recommendation_v1
    auto_input_mapping:
      # 上流出力から自動入力
      needs_list: needs_estimation.needs
      company_summary: needs_estimation.summary
      deep_dive_points: needs_estimation.deep_dive_points
    output_includes:
      - proposal_policy      # 提案方針
      - recommended_products # 推薦商材
      - next_actions         # ★ネクストアクション
      - account_plan_update  # ★アカウントプラン更新提案

  - id: evaluation
    name: 自動評価（LLM-as-Judge）
    order: 3
    depends_on: [needs_estimation, solution_recommendation]
    prompt_id: evaluation_v1
    is_evaluation: true  # 評価プロセスフラグ
    evaluation_targets:
      - needs_coverage         # ニーズ網羅性
      - solution_fit           # ソリューション適合度
      - next_action_quality    # ★ネクストアクション品質
      - account_plan_usefulness # ★アカウントプラン更新提案の有用性
```

### 6.3 状態管理サービス

```python
# src/services/state_manager.py
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

class ProcessStateManager:
    """
    プロセス状態管理

    PoC検証での役割:
    - 各プロセスの完了状態追跡
    - 上流変更時の下流無効化
    - 再実行判定
    """

    class State:
        EMPTY = "empty"
        PENDING = "pending"
        VALID = "valid"
        STALE = "stale"
        ERROR = "error"

    async def check_can_execute(
        self,
        scenario_id: str,
        process_id: str
    ) -> tuple[bool, list[str]]:
        """
        実行可能かチェック
        Returns: (can_execute, missing_dependencies)
        """
        dependencies = self._get_dependencies(process_id)
        missing = []

        for dep_id in dependencies:
            state = await self.get_state(scenario_id, dep_id)
            if state != self.State.VALID:
                missing.append(dep_id)

        return len(missing) == 0, missing

    async def mark_valid_and_invalidate_downstream(
        self,
        scenario_id: str,
        process_id: str
    ):
        """
        完了をマークし、下流を無効化

        これにより:
        - ニーズ推定を再実行 → ソリューション推薦がstaleに
        - プロンプト変更の効果測定が可能に
        """
        await self._mark_state(scenario_id, process_id, self.State.VALID)

        # 下流を無効化
        downstream = self._get_downstream(process_id)
        for ds_id in downstream:
            current = await self.get_state(scenario_id, ds_id)
            if current == self.State.VALID:
                await self._mark_state(
                    scenario_id, ds_id, self.State.STALE,
                    invalidated_by=process_id
                )
```

---

## 7. メトリクス・観測可能性設計

### 7.1 収集メトリクス

```
┌─────────────────────────────────────────────────────────────────┐
│                   PoC検証メトリクス                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【LLM使用量】                                                  │
│  ├─ prompt_tokens: 入力トークン数                              │
│  ├─ completion_tokens: 出力トークン数                          │
│  ├─ total_tokens: 合計トークン数                               │
│  └─ cost_usd: コスト（USD）                                    │
│                                                                 │
│  【パフォーマンス】                                             │
│  ├─ inference_time_ms: 推論時間                                │
│  └─ total_latency_ms: 全体レイテンシー                         │
│                                                                 │
│  【品質（評価結果）】                                           │
│  ├─ needs_coverage_score: ニーズ網羅度（0-100）               │
│  ├─ solution_relevance_score: 提案適切度（0-100）             │
│  ├─ overall_score: 総合スコア                                  │
│  └─ human_feedback: 人間FB（営業知見者）                       │
│                                                                 │
│  【プロンプト効果】                                             │
│  ├─ prompt_version: 使用プロンプトバージョン                   │
│  └─ score_delta: 前バージョン比スコア差分                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Tracer連携

```python
# src/services/tracer/interface.py
from abc import ABC, abstractmethod
from contextlib import contextmanager
from typing import Dict, Any

class TracerInterface(ABC):
    """
    トレーサー抽象インターフェース

    目的:
    - Opik / LangFuse 切り替え対応
    - テスト時はNoopTracerで無効化
    """

    @abstractmethod
    @contextmanager
    def trace(self, name: str, metadata: Dict | None = None):
        """トレース開始"""
        pass

    @abstractmethod
    @contextmanager
    def span(self, name: str):
        """スパン開始"""
        pass

    @abstractmethod
    def log_llm_call(
        self,
        input_prompt: str,
        output: str,
        model: str,
        usage: Dict[str, int],
        latency_ms: int
    ):
        """LLM呼び出し記録"""
        pass

    @abstractmethod
    def log_evaluation(
        self,
        score: float,
        rubric_name: str,
        details: Dict[str, Any]
    ):
        """評価結果記録"""
        pass


# src/services/tracer/opik_tracer.py
import opik

class OpikTracer(TracerInterface):
    """Opik実装"""

    def __init__(self):
        opik.configure(project_name="rikyu-poc")

    @contextmanager
    def trace(self, name: str, metadata: Dict | None = None):
        with opik.trace(name=name, metadata=metadata) as t:
            yield t

    @contextmanager
    def span(self, name: str):
        with opik.span(name=name) as s:
            yield s

    def log_evaluation(
        self,
        score: float,
        rubric_name: str,
        details: Dict[str, Any]
    ):
        opik.log_evaluation(
            name=rubric_name,
            score=score,
            metadata=details
        )
```

---

## 8. 評価システム設計（LLM-as-Judge）

### 8.1 評価フロー

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LLM-as-Judge 評価フロー                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【入力】                                                           │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ ・シナリオ情報（企業情報、聴取情報）                           ││
│  │ ・AI出力（ニーズリスト、提案方針）                             ││
│  │ ・正解データ（あれば）                                         ││
│  │ ・評価ルーブリック                                             ││
│  └────────────────────────────────────────────────────────────────┘│
│       │                                                             │
│       ▼                                                             │
│  【LLM-as-Judge】                                                   │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ GPT-5.2 による自動評価                                         ││
│  │ ・ルーブリックに基づく項目別スコアリング                       ││
│  │ ・根拠の説明生成                                               ││
│  │ ・改善提案（内部用）                                           ││
│  └────────────────────────────────────────────────────────────────┘│
│       │                                                             │
│       ▼                                                             │
│  【出力】                                                           │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ {                                                              ││
│  │   "scores": {                                                  ││
│  │     "needs_coverage": 75,    # ニーズ網羅度                   ││
│  │     "needs_accuracy": 80,    # ニーズ精度                     ││
│  │     "solution_relevance": 70, # 提案適切度                    ││
│  │     "overall": 75                                              ││
│  │   },                                                           ││
│  │   "level": "中堅レベル",                                       ││
│  │   "reasoning": "主要ニーズは網羅...",                         ││
│  │   "improvement_suggestions": [...]  # 内部用                   ││
│  │ }                                                              ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 評価ルーブリック

```yaml
# data/rubrics/needs_rubric.yaml
rubric:
  name: ニーズ推定評価
  version: "1.0"

  criteria:
    - id: coverage
      name: 網羅度
      description: 重要なニーズがどれだけ網羅されているか
      levels:
        - score_range: [0, 40]
          label: 新人レベル以下
          description: 基本的なニーズの半分以上が抜け落ち
        - score_range: [40, 60]
          label: 新人レベル
          description: 基本は拾えるが重要な抜け漏れあり
        - score_range: [60, 80]
          label: 中堅レベル
          description: 主要項目を網羅、軽微な漏れのみ
        - score_range: [80, 100]
          label: ベテランレベル
          description: 潜在ニーズまで網羅

    - id: accuracy
      name: 精度
      description: 推定されたニーズの正確性
      levels:
        # ...

    - id: priority
      name: 優先度判断
      description: 優先度付けの適切さ
      levels:
        # ...
```

---

## 9. Mock/検証システム設計

### 9.1 開発フェーズ別Mock活用

```
┌─────────────────────────────────────────────────────────────────────┐
│                    開発フェーズ別Mock活用                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【Phase 1: UI・パイプライン構築】 LLM_PROVIDER=mock               │
│  ├─ 目的: UI/APIの動作確認、パイプライン構築                       │
│  ├─ Mock使用: 100%                                                 │
│  └─ コスト: $0                                                     │
│                                                                     │
│  【Phase 2: 初回シナリオ検証】 LLM_PROVIDER=azure_openai           │
│  ├─ 目的: 1シナリオでReal LLM出力確認                              │
│  ├─ Mock使用: 0%（評価のみMock可）                                 │
│  └─ コスト: 最小限                                                 │
│                                                                     │
│  【Phase 3: 改善サイクル】 切り替え使用                             │
│  ├─ プロンプト調整時: Mock で高速イテレーション                    │
│  ├─ 効果測定時: Real LLM で実測                                    │
│  └─ 回帰テスト: Mock フィクスチャで自動テスト                      │
│                                                                     │
│  【Phase 4: 本番評価】 LLM_PROVIDER=azure_openai                   │
│  ├─ 全シナリオでReal LLM実行                                       │
│  └─ 最終評価データ収集                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 フィクスチャ管理

```
data/fixtures/
├── needs_estimation/
│   ├── default.json           # デフォルトレスポンス
│   ├── scenario_001.json      # シナリオ別固定レスポンス
│   ├── scenario_002.json
│   ├── edge_case_empty.json   # エッジケース: 空入力
│   └── edge_case_long.json    # エッジケース: 長文入力
│
├── solution_recommendation/
│   ├── default.json
│   └── ...
│
└── evaluation/
    ├── default.json           # デフォルト評価結果
    ├── high_score.json        # 高スコアケース
    └── low_score.json         # 低スコアケース
```

---

## 10. テスト戦略

### 10.1 テストピラミッド（PoC最適化）

```
                    ┌───────────────┐
                    │  評価テスト   │  LLM-as-Judge一致率検証
                    │ (Real LLM)    │  最小限の件数で実施
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  Integration  │  Mock使用
                    │    Tests      │  API・パイプライン検証
                    └───────┬───────┘
                            │
            ┌───────────────▼───────────────┐
            │         Unit Tests            │  全てMock
            │    サービス・プロンプト検証    │  高速実行
            └───────────────────────────────┘
```

### 10.2 conftest.py（Mock自動適用）

```python
# tests/conftest.py
import pytest
from unittest.mock import AsyncMock
from src.services.llm.mock.service import MockLLMService
from src.services.tracer.noop_tracer import NoopTracer

@pytest.fixture
def mock_llm_service():
    """全テストでMock LLMを使用"""
    return MockLLMService()

@pytest.fixture
def noop_tracer():
    """テストではTracer無効化"""
    return NoopTracer()

@pytest.fixture
def test_settings():
    """テスト用設定"""
    return Settings(
        database_url="sqlite:///:memory:",
        llm_provider="mock",
        tracer_type="noop"
    )
```

---

## 11. 実装ロードマップ

```
Phase 1: コア基盤 (Week 1-2)
├── ディレクトリ構造作成
├── LLM Service Layer（Mock実装含む）
├── Prompt Registry
├── DB基盤（SQLite）
└── 基本API構造

Phase 2: プロセス実装 (Week 2-3)
├── ニーズ推定サービス
├── ソリューション推薦サービス
├── State Manager
└── パイプライン実行

Phase 3: 評価システム (Week 3-4)
├── LLM-as-Judge実装
├── Tracer連携（Opik）
├── メトリクス記録
└── 評価ダッシュボード

Phase 4: UI構築 (Week 4-5)
├── Streamlit検証UI
├── シナリオ管理画面
├── 結果確認・評価画面
└── メトリクスダッシュボード

Phase 5: 検証実行 (Week 5-9)
├── 初回シナリオ検証
├── FB収集・改善サイクル
├── プロンプト最適化
└── 最終評価
```

---

## 12. 変更履歴

| バージョン | 日付 | 変更内容 |
|------------|------|----------|
| v1.0 | 2026-01-23 | 初版作成（base_framework参考の再設計） |
| v1.1 | 2026-01-25 | 伴奏AI対応: 入力に経営アジェンダシート・キーパーソンマップ追加、出力にネクストアクション・アカウントプラン更新提案追加、検証フロー図更新 |
