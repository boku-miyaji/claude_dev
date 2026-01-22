# アルゴリズム・技術設計 / モック開発設計

> **関連**: [設計書サマリ](00_summary.md) | [評価設計](05_evaluation_design.md) | [プロジェクト管理](07_project_management.md)

---

## 7. アルゴリズム・技術設計

### 7.1 基本方針

- 推論時間: リアルタイム性は不要（数分以内で可）
- データ: 社内に閉じる、学習には用いない
- 環境: Azure（自社環境）でモック開発
- セキュリティ/スケーラビリティ: PoC段階では考慮しない

### 7.2 使用技術

| 項目 | 技術選定 | 備考 |
|------|----------|------|
| LLM | Azure OpenAI (GPT-5.2) | Week 1で利用可否検証、GPT-5.2/5.1を想定 |
| Embedding | Azure OpenAI Embedding (text-embedding-3-large) | PoC後半で導入検討（効果測定用） |
| Vector DB | Azure AI Search | PoC後半で導入検討（効果測定用） |
| バックエンド | Python (FastAPI) | - |
| フロントエンド | Streamlit or Gradio | 検証UI・デモUI用 |
| インフラ | Azure | 法人向けならAzure推奨 |
| トレース | **Opik（抽象化レイヤー経由）** | 評価・改善サイクル追跡、LangFuse等への切り替え可能 |
| エージェント構築 | **生API（Azure OpenAI直接呼び出し）** | シンプル・高速イテレーション・デバッグ容易 |
| 自動評価 | **LLM-as-Judge (GPT-5.2) + カスタムルーブリック** | 出力品質の自動評価、ドメイン特化のルーブリック定義 |

### 7.2.1 エージェント構築方式の選定

本PoCでは、フレームワーク（Semantic Kernel, LangChain等）を使わず、**Azure OpenAI APIを直接呼び出す「生API方式」** を採用する。

#### フレームワーク vs 生API 比較

| 観点 | フレームワーク（Semantic Kernel等） | 生API（直接呼び出し） |
|------|----------------------------------|---------------------|
| **学習コスト** | フレームワーク固有の概念習得が必要 | API仕様のみ理解すれば良い |
| **デバッグ** | 抽象化により原因特定が困難な場合あり | 入出力が明確でデバッグしやすい |
| **柔軟性** | フレームワークの制約内での実装 | 完全に自由な実装が可能 |
| **イテレーション速度** | 設定・構造変更にオーバーヘッド | プロンプト変更即反映 |
| **本番移行** | フレームワーク依存が残る | 依存なし、移植性高い |
| **適合シーン** | 大規模・長期プロジェクト | PoC・プロトタイプ・短期検証 |

#### 生API方式を選定した理由

1. **PoCの性質**: 9週間という短期間でプロンプトを高速イテレーションする必要がある
2. **シンプルさ優先**: 複雑なエージェント協調パターンは不要、直列実行で十分
3. **デバッグ効率**: LLMの挙動を直接確認・調整しやすい
4. **将来の柔軟性**: 本番化時にフレームワーク選定を再検討可能

#### 生API方式のアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────┐
│                  生API方式 アーキテクチャ                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    LLM Client Layer                           │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ AzureOpenAIClient                                        │  │  │
│  │  │ ├─ completion(): プロンプト送信・応答取得               │  │  │
│  │  │ ├─ structured_output(): JSON Schema指定出力             │  │  │
│  │  │ └─ retry_with_backoff(): エラー時リトライ               │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │         ▼                                                      │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ Service Layer（ビジネスロジック）                        │  │  │
│  │  │ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  │  │  │
│  │  │ │NeedsEstimator │ │SolutionRec    │ │AutoEvaluator  │  │  │  │
│  │  │ │               │ │ommender       │ │               │  │  │  │
│  │  │ └───────────────┘ └───────────────┘ └───────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │         ▼                                                      │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ Tracer Layer（抽象化）                                   │  │  │
│  │  │ ├─ TracerInterface: 共通インターフェース                │  │  │
│  │  │ ├─ OpikTracer: Opik実装                                 │  │  │
│  │  │ └─ LangFuseTracer: LangFuse実装（将来用）               │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 生API実装例

```python
# === Azure OpenAI Client ===
import os
from openai import AzureOpenAI
from typing import TypeVar, Type
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class AzureOpenAIClient:
    """Azure OpenAI APIの直接呼び出しクライアント"""

    def __init__(self):
        self.client = AzureOpenAI(
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version="2024-08-01-preview"
        )
        self.model = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.2")

    def completion(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7
    ) -> str:
        """基本的なChat Completion"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=temperature
        )
        return response.choices[0].message.content

    def structured_output(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.3
    ) -> T:
        """Structured Output（JSON Schema指定）"""
        response = self.client.beta.chat.completions.parse(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format=response_model,
            temperature=temperature
        )
        return response.choices[0].message.parsed


# === ニーズ推定サービス ===
from pydantic import BaseModel, Field
from typing import List

class EstimatedNeed(BaseModel):
    """推定ニーズの構造"""
    category: str = Field(description="ニーズカテゴリ")
    description: str = Field(description="ニーズの詳細説明")
    priority: int = Field(description="優先度（1-5）", ge=1, le=5)
    evidence: str = Field(description="推定根拠")

class NeedsEstimationResult(BaseModel):
    """ニーズ推定の出力構造"""
    needs: List[EstimatedNeed] = Field(description="推定されたニーズ一覧")
    summary: str = Field(description="総合所見")

class NeedsEstimatorService:
    """顧客ニーズ推定サービス"""

    def __init__(self, client: AzureOpenAIClient, tracer: "TracerInterface"):
        self.client = client
        self.tracer = tracer
        self.system_prompt = self._load_prompt("needs_estimation_system")

    async def estimate(
        self,
        company_info: str,
        hearing_info: str,
        knowledge: dict = None
    ) -> NeedsEstimationResult:
        """ニーズを推定"""
        with self.tracer.span("needs_estimation") as span:
            # ユーザープロンプト構築
            user_prompt = self._build_user_prompt(
                company_info, hearing_info, knowledge
            )
            span.set_input({"company_info": company_info, "hearing_info": hearing_info})

            # LLM呼び出し（Structured Output）
            result = self.client.structured_output(
                system_prompt=self.system_prompt,
                user_prompt=user_prompt,
                response_model=NeedsEstimationResult
            )

            span.set_output(result.model_dump())
            return result

    def _build_user_prompt(self, company_info: str, hearing_info: str, knowledge: dict) -> str:
        # プロンプトテンプレートを読み込んで変数を埋め込む
        template = self._load_prompt("needs_estimation_user")
        return template.format(
            company_info=company_info,
            hearing_info=hearing_info,
            knowledge=knowledge or "ナレッジなし"
        )

    def _load_prompt(self, name: str) -> str:
        # prompts/{name}.txt からプロンプトを読み込む
        with open(f"prompts/{name}.txt", "r") as f:
            return f.read()
```

### 7.2.2 Tracer抽象化レイヤー設計

トレーシングツールへの依存を抽象化し、Opikから他のツール（LangFuse等）への切り替えを容易にする。

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Tracer抽象化レイヤー設計                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                  TracerInterface（抽象）                       │  │
│  │  ├─ trace(name): トレース開始                                 │  │
│  │  ├─ span(name): スパン開始                                    │  │
│  │  ├─ log_evaluation(score, metadata): 評価結果記録             │  │
│  │  └─ log_llm_call(input, output, metadata): LLMコール記録      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          ▲                                          │
│          ┌───────────────┼───────────────┐                          │
│          │               │               │                          │
│  ┌───────┴───────┐ ┌─────┴─────┐ ┌───────┴───────┐                  │
│  │  OpikTracer   │ │LangFuse   │ │  NoopTracer   │                  │
│  │  （現在使用） │ │ Tracer    │ │ （テスト用）  │                  │
│  │               │ │（将来用） │ │               │                  │
│  └───────────────┘ └───────────┘ └───────────────┘                  │
│                                                                     │
│  【切り替え方法】                                                   │
│  ├─ 環境変数: TRACER_TYPE=opik | langfuse | noop                   │
│  ├─ 設定ファイル: config/tracer.yaml                               │
│  └─ ファクトリーパターンで実行時に選択                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Opik vs LangFuse 比較と選定理由

| 観点 | Opik（採用） | LangFuse |
|------|-------------|----------|
| **セットアップ** | ✅ すでに利用可能 | 新規セットアップ必要 |
| **学習コスト** | ✅ 低（チーム習熟済み） | 学習コストあり |
| **評価機能** | ✅ 評価用UIが充実 | 同等機能あり |
| **OSS/有料** | ✅ OSS | OSS |
| **将来性** | 継続発展中 | 継続発展中 |

**結論**: Opikがすでに環境構築済みのため、PoCではOpikを使用。ただし抽象化により将来の切り替えに備える。

#### Tracer抽象化実装

```python
# === Tracer Interface ===
from abc import ABC, abstractmethod
from contextlib import contextmanager
from typing import Any, Dict, Optional
from dataclasses import dataclass


@dataclass
class SpanContext:
    """Span情報を保持するコンテキスト"""
    name: str
    span_id: str
    _tracer: "TracerInterface"
    _input: Optional[Dict] = None
    _output: Optional[Any] = None

    def set_input(self, input_data: Dict):
        """入力データを設定"""
        self._input = input_data
        self._tracer._set_span_input(self.span_id, input_data)

    def set_output(self, output_data: Any):
        """出力データを設定"""
        self._output = output_data
        self._tracer._set_span_output(self.span_id, output_data)

    def add_metadata(self, metadata: Dict):
        """メタデータを追加"""
        self._tracer._add_span_metadata(self.span_id, metadata)


class TracerInterface(ABC):
    """トレーサーの抽象インターフェース"""

    @abstractmethod
    @contextmanager
    def trace(self, name: str, metadata: Optional[Dict] = None):
        """トレースを開始（最上位のコンテキスト）"""
        pass

    @abstractmethod
    @contextmanager
    def span(self, name: str) -> SpanContext:
        """スパンを開始（トレース内の個別操作）"""
        pass

    @abstractmethod
    def log_evaluation(
        self,
        score: float,
        rubric_name: str,
        rating: str,
        metadata: Optional[Dict] = None
    ):
        """評価結果を記録"""
        pass

    @abstractmethod
    def log_llm_call(
        self,
        input_messages: list,
        output: str,
        model: str,
        token_usage: Dict,
        latency_ms: float
    ):
        """LLMコールを記録"""
        pass

    @abstractmethod
    def _set_span_input(self, span_id: str, input_data: Dict):
        pass

    @abstractmethod
    def _set_span_output(self, span_id: str, output_data: Any):
        pass

    @abstractmethod
    def _add_span_metadata(self, span_id: str, metadata: Dict):
        pass


# === Opik実装 ===
import opik
from opik import track

class OpikTracer(TracerInterface):
    """Opikを使用したトレーサー実装"""

    def __init__(self, project_name: str, workspace: str = None):
        opik.configure(project_name=project_name, workspace=workspace)
        self._current_trace = None
        self._spans = {}

    @contextmanager
    def trace(self, name: str, metadata: Optional[Dict] = None):
        """Opikトレース開始"""
        trace = opik.trace(name=name, metadata=metadata or {})
        self._current_trace = trace
        try:
            yield trace
        finally:
            trace.end()
            self._current_trace = None

    @contextmanager
    def span(self, name: str) -> SpanContext:
        """Opikスパン開始"""
        if self._current_trace is None:
            # トレース外でのspan呼び出し時はNoopとして動作
            yield SpanContext(name=name, span_id="noop", _tracer=self)
            return

        span = self._current_trace.span(name=name)
        span_id = span.id
        self._spans[span_id] = span
        context = SpanContext(name=name, span_id=span_id, _tracer=self)
        try:
            yield context
        finally:
            span.end()
            del self._spans[span_id]

    def log_evaluation(
        self,
        score: float,
        rubric_name: str,
        rating: str,
        metadata: Optional[Dict] = None
    ):
        """Opikに評価結果を記録"""
        if self._current_trace:
            self._current_trace.log_metric(
                name=f"eval_{rubric_name}",
                value=score,
                metadata={
                    "rubric_name": rubric_name,
                    "rating": rating,
                    **(metadata or {})
                }
            )

    def log_llm_call(
        self,
        input_messages: list,
        output: str,
        model: str,
        token_usage: Dict,
        latency_ms: float
    ):
        """OpikにLLMコールを記録"""
        # Opikは自動でLLMコールをキャプチャするが、
        # 明示的に記録したい場合はこのメソッドを使用
        if self._current_trace:
            self._current_trace.update(metadata={
                "model": model,
                "token_usage": token_usage,
                "latency_ms": latency_ms
            })

    def _set_span_input(self, span_id: str, input_data: Dict):
        if span_id in self._spans:
            self._spans[span_id].set_input(input_data)

    def _set_span_output(self, span_id: str, output_data: Any):
        if span_id in self._spans:
            self._spans[span_id].set_output(output_data)

    def _add_span_metadata(self, span_id: str, metadata: Dict):
        if span_id in self._spans:
            self._spans[span_id].update(metadata=metadata)


# === LangFuse実装（将来用） ===
class LangFuseTracer(TracerInterface):
    """LangFuseを使用したトレーサー実装（将来の切り替え用）"""

    def __init__(self, public_key: str, secret_key: str, host: str = None):
        # from langfuse import Langfuse
        # self.langfuse = Langfuse(public_key, secret_key, host)
        raise NotImplementedError("LangFuse integration is planned for future use")

    # ... 以下、TracerInterfaceの各メソッドを実装


# === Noop実装（テスト用） ===
class NoopTracer(TracerInterface):
    """何もしないトレーサー（テスト・開発用）"""

    @contextmanager
    def trace(self, name: str, metadata: Optional[Dict] = None):
        yield None

    @contextmanager
    def span(self, name: str) -> SpanContext:
        yield SpanContext(name=name, span_id="noop", _tracer=self)

    def log_evaluation(self, score, rubric_name, rating, metadata=None):
        pass

    def log_llm_call(self, input_messages, output, model, token_usage, latency_ms):
        pass

    def _set_span_input(self, span_id, input_data):
        pass

    def _set_span_output(self, span_id, output_data):
        pass

    def _add_span_metadata(self, span_id, metadata):
        pass


# === Tracerファクトリー ===
import os

def create_tracer() -> TracerInterface:
    """環境に応じたTracerを生成"""
    tracer_type = os.getenv("TRACER_TYPE", "opik").lower()

    if tracer_type == "opik":
        return OpikTracer(
            project_name=os.getenv("TRACER_PROJECT", "rikyu-sales-poc"),
            workspace=os.getenv("TRACER_WORKSPACE")
        )
    elif tracer_type == "langfuse":
        return LangFuseTracer(
            public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
            secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
            host=os.getenv("LANGFUSE_HOST")
        )
    elif tracer_type == "noop":
        return NoopTracer()
    else:
        raise ValueError(f"Unknown tracer type: {tracer_type}")
```

#### トレース使用例

```python
# === 実際の使用例 ===

# Tracerを生成（環境に応じて自動選択）
tracer = create_tracer()

async def run_needs_estimation(company_info: str, hearing_info: str) -> dict:
    """ニーズ推定パイプライン（トレース付き）"""

    with tracer.trace("needs_estimation_pipeline", metadata={
        "prompt_version": "v1.0",
        "retriever_method": "L1"
    }):
        # ニーズ推定
        with tracer.span("estimate_needs") as span:
            span.set_input({"company_info": company_info, "hearing_info": hearing_info})

            result = await needs_estimator.estimate(company_info, hearing_info)

            span.set_output(result.model_dump())

        # 自動評価
        with tracer.span("auto_evaluate") as eval_span:
            evaluation = await auto_evaluator.evaluate(result)

            # 評価結果をログ
            for rubric_name, score_data in evaluation.scores.items():
                tracer.log_evaluation(
                    score=score_data["score"],
                    rubric_name=rubric_name,
                    rating=score_data["rating"],
                    metadata={"comment": score_data.get("comment")}
                )

            eval_span.set_output(evaluation.model_dump())

        return {
            "result": result,
            "evaluation": evaluation
        }
```

#### Opikダッシュボード活用

```yaml
# config/opik.yaml

project: rikyu-sales-poc

# 評価メトリクス定義
metrics:
  - name: needs_coverage
    description: ニーズ網羅性
    type: score  # 0.0-1.0

  - name: evidence_quality
    description: 根拠の質
    type: score

  - name: priority_accuracy
    description: 優先度の妥当性
    type: score

  - name: overall_rating
    description: 総合評価
    type: categorical  # ○/△/×

# ダッシュボード設定
dashboard:
  views:
    - name: "評価スコア推移"
      type: time_series
      metrics: [needs_coverage, evidence_quality, priority_accuracy]

    - name: "改善策分析"
      type: aggregate
      filter: "requires_improvement == true"
      group_by: improvement_category

    - name: "Retriever方式比較"
      type: comparison
      group_by: retriever_method
      metrics: [overall_rating, needs_coverage]
```

### 7.2.3 自動評価LLM設計（LLM-as-Judge + カスタムルーブリック）

自動評価LLMは、**カスタムルーブリック**に基づいてAIの出力品質を評価し、低評価の場合は改善策を生成する。

> **詳細**: ルーブリック定義の詳細は [評価設計](05_evaluation_design.md) の「カスタムルーブリック定義」を参照

```
┌─────────────────────────────────────────────────────────────────────┐
│              自動評価LLMアーキテクチャ（カスタムルーブリック）         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────┐                                                 │
│  │  AI出力結果     │ ← ニーズ推定 or ソリューション推薦の出力        │
│  └───────┬────────┘                                                 │
│          ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │            RubricEvaluator（カスタムルーブリック評価）          │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ Step 1: ルーブリック選択                                 │  │  │
│  │  │ ├─ ニーズ推定: needs_coverage, evidence_quality, ...    │  │  │
│  │  │ └─ ソリューション: solution_fit, reasoning_clarity, ... │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                     ▼                                          │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ Step 2: 各ルーブリックでLLM評価                          │  │  │
│  │  │ ├─ 評価基準（5段階）を提示                              │  │  │
│  │  │ ├─ 具体例（5/3/1のケース）を提示                        │  │  │
│  │  │ └─ Structured Outputでスコア取得                        │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                     ▼                                          │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ Step 3: 総合評価算出                                     │  │  │
│  │  │ ├─ 平均スコア ≥ 4.0 → ◯（実用レベル）                  │  │  │
│  │  │ ├─ 平均スコア ≥ 3.0 → △（条件付き）                    │  │  │
│  │  │ └─ 平均スコア < 3.0 → ×（要改善）                      │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                     ▼                                          │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ Step 4: Tracerに評価結果を記録                           │  │  │
│  │  │ ├─ tracer.log_evaluation() で各ルーブリックのスコア記録 │  │  │
│  │  │ └─ Opikダッシュボードでスコア推移を可視化               │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│          ▼                                                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 出力                                                            │ │
│  │ ├─ 評価結果（各ルーブリックのスコア・総合評価）→ 分析用       │ │
│  │ └─ 改善策（_internal）→ 顧客には非公開、内部改善に活用        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### AutoEvaluatorService実装（生API方式）

```python
# === 自動評価サービス ===
from typing import Dict, List
from pydantic import BaseModel, Field

class ImprovementSuggestion(BaseModel):
    """改善提案"""
    issue: str = Field(description="特定された問題点")
    action: str = Field(description="改善アクション")
    priority: str = Field(description="優先度: high/medium/low")
    prompt_change: str = Field(default="", description="プロンプト改善提案")

class ImprovementResult(BaseModel):
    """改善分析結果"""
    issues: List[ImprovementSuggestion] = Field(description="改善提案リスト")
    overall_direction: str = Field(description="改善の全体方針")


class AutoEvaluatorService:
    """自動評価サービス（生API + カスタムルーブリック）"""

    def __init__(
        self,
        client: "AzureOpenAIClient",
        tracer: "TracerInterface",
        rubric_evaluator: "RubricEvaluator"
    ):
        self.client = client
        self.tracer = tracer
        self.rubric_evaluator = rubric_evaluator

    async def evaluate_and_improve(
        self,
        output_type: str,
        output: dict,
        input_context: dict
    ) -> dict:
        """
        出力を評価し、必要に応じて改善策を生成

        Returns:
            {
                "evaluation": EvaluationResult,
                "_internal": {
                    "improvements": ImprovementResult (低評価時のみ)
                }
            }
        """
        with self.tracer.span("auto_evaluate_and_improve") as span:
            span.set_input({"output_type": output_type})

            # Step 1: カスタムルーブリックで評価
            evaluation = await self.rubric_evaluator.evaluate(
                output_type=output_type,
                output=output,
                input_context=input_context
            )

            result = {
                "evaluation": evaluation,
                "_internal": {}
            }

            # Step 2: 低評価の場合は改善策を生成
            if evaluation.overall_rating in ["△", "×"]:
                improvements = await self._generate_improvements(
                    output=output,
                    evaluation=evaluation,
                    input_context=input_context
                )
                result["_internal"]["improvements"] = improvements
                result["_internal"]["requires_improvement"] = True

                span.add_metadata({
                    "requires_improvement": True,
                    "improvement_count": len(improvements.issues)
                })

            span.set_output({
                "overall_rating": evaluation.overall_rating,
                "scores_summary": {k: v.score for k, v in evaluation.scores.items()}
            })

            return result

    async def _generate_improvements(
        self,
        output: dict,
        evaluation: "EvaluationResult",
        input_context: dict
    ) -> ImprovementResult:
        """
        低評価時に改善策を生成

        ⚠️ この結果は顧客には非公開、内部改善にのみ使用
        """
        # 低スコアのルーブリックを特定
        low_score_rubrics = [
            f"- {k}: スコア{v.score}, コメント: {v.comment}"
            for k, v in evaluation.scores.items()
            if v.score <= 3
        ]

        system_prompt = """あなたはAI出力品質の改善アドバイザーです。
低評価となった出力を分析し、具体的な改善策を提案してください。

改善策は以下の観点で提案してください:
1. 問題点の特定（何が足りないか）
2. 改善アクション（何をすべきか）
3. プロンプト改善提案（どうプロンプトを変えるか）
"""

        user_prompt = f"""【評価結果】
総合評価: {evaluation.overall_rating}
コメント: {evaluation.overall_comment}

【低スコアの項目】
{chr(10).join(low_score_rubrics)}

【入力コンテキスト】
{input_context}

【評価対象の出力】
{output}

上記を分析し、改善策を提案してください。"""

        result = self.client.structured_output(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_model=ImprovementResult
        )

        return result


# === 使用例 ===
async def run_with_evaluation(company_info: str, hearing_info: str):
    """評価付きパイプライン実行"""

    # サービス初期化
    client = AzureOpenAIClient()
    tracer = create_tracer()
    rubric_evaluator = RubricEvaluator(client, tracer)
    auto_evaluator = AutoEvaluatorService(client, tracer, rubric_evaluator)
    needs_estimator = NeedsEstimatorService(client, tracer)

    with tracer.trace("needs_estimation_with_evaluation"):
        # ニーズ推定
        result = await needs_estimator.estimate(company_info, hearing_info)

        # 自動評価
        eval_result = await auto_evaluator.evaluate_and_improve(
            output_type="needs",
            output=result.model_dump(),
            input_context={"company_info": company_info, "hearing_info": hearing_info}
        )

        return {
            "result": result,
            "evaluation": eval_result["evaluation"],
            # _internal は顧客には返さない
        }
```

---

### 7.3 全体アーキテクチャ（PoCスコープ）

```
┌─────────────────────────────────────────────────────────────────┐
│                   システム構成（PoCスコープ）                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐                                               │
│  │ 商材データ   │───▶ システムプロンプトに全量投入              │
│  │ (5カテゴリ)  │     （RAG不要・後からDB化可能）               │
│  └─────────────┘                                               │
│                                                                 │
│  ┌─────────────┐    ┌─────────────────────┐    ┌───────────┐  │
│  │ ユーザー入力 │───▶│ LLM (GPT-5.2)       │───▶│ 出力      │  │
│  │ (企業+面談) │    │ + 商材ナレッジ       │    │(ニーズ/商材)│  │
│  │             │    │ (システムプロンプト) │    │           │  │
│  └─────────────┘    └─────────────────────┘    └───────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7.4 アルゴリズム設計方針

### 設計原則

> **「LLMを最大限活用し、コードは最小限に」**
> **「改善候補を試しやすい構造で作る」**

```
┌─────────────────────────────────────────────────────────────────┐
│                     PoC設計の4原則                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① シンプルさ優先                                               │
│     └─ 1機能 = 1LLMコール（マルチステップは将来拡張）           │
│                                                                 │
│  ② 設定駆動                                                     │
│     └─ ロジック変更 = プロンプト変更（コード変更不要）          │
│                                                                 │
│  ③ 拡張ポイント明確化                                           │
│     └─ どこに何を足せば拡張できるかを設計段階で定義             │
│                                                                 │
│  ④ 改善候補の比較容易性                                         │
│     └─ 同じ入力で複数手法（Embedding有無等）を比較できる構造   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 改善候補の全体像

PoC期間中に試す可能性のある改善アプローチを整理し、基盤設計に反映。

```
┌─────────────────────────────────────────────────────────────────────┐
│                     改善候補の全体マップ                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【ナレッジ注入方式】                                               │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ L0: 静的注入（ベースライン）                                    ││
│  │     └─ 商材・事例をシステムプロンプトに全量記載                ││
│  │                                                                 ││
│  │ L1: 動的選択注入                                                ││
│  │     └─ 入力に応じて関連ナレッジのみを選択して注入              ││
│  │     └─ 例: 業種=製造業 → 製造業向け事例のみ                    ││
│  │                                                                 ││
│  │ L2: Embedding類似検索                                           ││
│  │     └─ 入力をEmbedding化し、類似ナレッジをVector検索           ││
│  │     └─ Azure AI Search / FAISS / Chroma                        ││
│  │                                                                 ││
│  │ L3: Hybrid検索                                                  ││
│  │     └─ キーワード検索 + Embedding検索の組み合わせ              ││
│  │     └─ Azure AI Search の Hybrid Search 機能                   ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  【Few-shot例の選択方式】                                           │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ F0: 固定例（ベースライン）                                      ││
│  │     └─ 事前に選んだ2-3例を常に使用                             ││
│  │                                                                 ││
│  │ F1: 条件別例                                                    ││
│  │     └─ 業種・規模などの条件でグループ化した例を選択            ││
│  │                                                                 ││
│  │ F2: 類似検索例                                                  ││
│  │     └─ 入力に類似した過去事例をEmbedding検索で取得             ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  【推論方式】                                                       │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ R0: Single-Call（ベースライン）                                 ││
│  │     └─ 1回のLLMコールで全処理                                  ││
│  │                                                                 ││
│  │ R1: Multi-Step                                                  ││
│  │     └─ 情報整理 → 推定 → レビュー の段階処理                  ││
│  │                                                                 ││
│  │ R2: Self-Critique                                               ││
│  │     └─ 出力後に自己評価・修正を実行                            ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### PoC期間中の検証計画

| Phase | 期間 | 検証内容 | 改善候補 |
|-------|------|----------|----------|
| **Phase 1** | W1-W4 | ベースライン構築・評価 | L0 + F0 + R0 |
| **Phase 2a** | W5 | ナレッジ注入方式の改善 | L1 or L2 の効果測定 |
| **Phase 2b** | W6 | Few-shot例の改善 | F1 or F2 の効果測定 |
| **Phase 3** | W7-W9 | 組み合わせ最適化 | 効果の高い組み合わせを特定 |

### アーキテクチャ概要（拡張対応版）

```
┌─────────────────────────────────────────────────────────────────────┐
│                 拡張対応版アーキテクチャ                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐                                                   │
│  │  入力データ   │                                                   │
│  │  (JSON/YAML) │                                                   │
│  └──────┬───────┘                                                   │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  ナレッジ取得層（Retriever）                   │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ 【切替可能】                                             │ │   │
│  │  │ ├─ L0: 静的取得（全量をそのまま返す）                   │ │   │
│  │  │ ├─ L1: 条件フィルタ（業種・規模でフィルタ）             │ │   │
│  │  │ ├─ L2: Embedding検索（Azure AI Search）                 │ │   │
│  │  │ └─ L3: Hybrid検索（キーワード + Embedding）             │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ 取得対象                                                 │ │   │
│  │  │ ├─ 商材カタログ                                         │ │   │
│  │  │ ├─ 業種別テンプレート                                   │ │   │
│  │  │ ├─ 過去事例（成約/失注）                                │ │   │
│  │  │ └─ Few-shot例                                           │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              プロンプトテンプレートエンジン                    │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ システムプロンプト                                       │ │   │
│  │  │ ├─ ロール定義                                           │ │   │
│  │  │ ├─ 思考プロセス指示（Chain-of-Thought）                 │ │   │
│  │  │ ├─ ナレッジ注入 ← Retrieverから取得した情報            │ │   │
│  │  │ ├─ Few-shot例 ← Retrieverから取得した類似例            │ │   │
│  │  │ └─ 出力フォーマット指定（JSON Schema）                  │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ ユーザープロンプト                                       │ │   │
│  │  │ └─ 入力データ（企業情報、ヒアリング情報）を埋め込み     │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   推論エンジン（Reasoner）                     │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ 【切替可能】                                             │ │   │
│  │  │ ├─ R0: Single-Call（1回のLLMコール）                    │ │   │
│  │  │ ├─ R1: Multi-Step（複数ステップ）                       │ │   │
│  │  │ └─ R2: Self-Critique（自己評価付き）                    │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         ▼                                                           │
│  ┌──────────────┐                                                   │
│  │  出力パーサ   │  ← JSON Schemaでバリデーション                   │
│  └──────┬───────┘                                                   │
│         ▼                                                           │
│  ┌──────────────┐                                                   │
│  │  構造化出力   │                                                   │
│  │  (JSON)      │                                                   │
│  └──────────────┘                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 7.5 エージェント型アーキテクチャ設計

#### 設計思想

> **「自律的に考え、必要な情報を取得し、回答するエージェント」**

初期版からエージェント的な構造を採用することで、以下の拡張を容易にする：
- ナレッジの動的投入
- データソースの追加
- 検索機能の拡張
- Skills（専門機能）の追加

```
┌─────────────────────────────────────────────────────────────────────┐
│                    エージェント型アーキテクチャ                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐                                                   │
│  │  ユーザー入力  │                                                   │
│  │ (企業+ヒアリング)│                                                   │
│  └──────┬───────┘                                                   │
│         ▼                                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      Orchestrator                              │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ 1. 入力を解析してプランを立てる                          │  │  │
│  │  │ 2. 必要なデータ・ナレッジを特定                          │  │  │
│  │  │ 3. 適切なSkillを選択・実行                               │  │  │
│  │  │ 4. 結果を統合して回答を生成                              │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │         ▼                                                      │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                   Tool / Skill 層                        │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │  │  │
│  │  │  │Retriever│ │ Search  │ │ Analyze │ │ Generate│ ...   │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │         ▼                                                      │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                   Knowledge Store                        │  │  │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐              │  │  │
│  │  │  │ 商材DB    │ │ 事例DB    │ │ 業種知識  │ ...          │  │  │
│  │  │  └───────────┘ └───────────┘ └───────────┘              │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│         ▼                                                           │
│  ┌──────────────┐                                                   │
│  │  構造化出力   │                                                   │
│  └──────────────┘                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Orchestratorの設計

```python
class Orchestrator:
    """エージェントの中核：プラン策定→実行→統合"""

    def __init__(self, tools: dict[str, Tool], llm: LLMCaller):
        self.tools = tools
        self.llm = llm
        self.planner = Planner(llm)

    async def run(self, input: dict) -> dict:
        # Step 1: プランを立てる
        plan = await self.planner.create_plan(input, self.tools.keys())

        # Step 2: プランに従ってToolを実行
        context = {"input": input, "results": {}}
        for step in plan.steps:
            tool = self.tools[step.tool_name]
            result = await tool.execute(step.params, context)
            context["results"][step.id] = result

        # Step 3: 結果を統合して最終回答を生成
        final_output = await self.generate_response(input, context)
        return final_output

    async def generate_response(self, input: dict, context: dict) -> dict:
        """収集した情報を統合して最終回答を生成"""
        prompt = self.prompt_engine.render(
            template="final_response",
            input=input,
            retrieved_knowledge=context["results"].get("retrieve"),
            search_results=context["results"].get("search"),
            analysis=context["results"].get("analyze")
        )
        return await self.llm.call(prompt)
```

#### Planner（プラン策定）

```python
class Planner:
    """入力を解析し、実行プランを策定"""

    async def create_plan(self, input: dict, available_tools: list[str]) -> Plan:
        prompt = f"""
        以下の入力に対して、最適な回答を生成するためのプランを立ててください。

        【入力】
        {json.dumps(input, ensure_ascii=False)}

        【利用可能なツール】
        {self._format_tools(available_tools)}

        【出力形式】
        {{
          "reasoning": "なぜこのプランが適切か",
          "steps": [
            {{"id": "step1", "tool_name": "retrieve", "params": {{...}}, "reason": "..."}},
            ...
          ]
        }}
        """
        plan_json = await self.llm.call(prompt)
        return Plan.from_dict(plan_json)
```

#### Tool / Skill層

```python
# 基底クラス
class Tool:
    name: str
    description: str

    async def execute(self, params: dict, context: dict) -> dict:
        raise NotImplementedError

# === 初期実装するTools ===

class RetrieveTool(Tool):
    """ナレッジストアから情報を取得"""
    name = "retrieve"
    description = "商材情報、業種テンプレート、過去事例を取得します"

    async def execute(self, params: dict, context: dict) -> dict:
        retriever = self.retriever_factory.get(params.get("method", "L0"))
        return await retriever.retrieve(context["input"], params)


class SearchTool(Tool):
    """キーワード/セマンティック検索"""
    name = "search"
    description = "ナレッジを検索してクエリに関連する情報を取得します"

    async def execute(self, params: dict, context: dict) -> dict:
        query = params.get("query")
        index = params.get("index", "all")
        return await self.search_client.search(query, index)


class AnalyzeTool(Tool):
    """入力情報を分析・構造化"""
    name = "analyze"
    description = "企業情報やヒアリング内容を分析・構造化します"

    async def execute(self, params: dict, context: dict) -> dict:
        analysis_type = params.get("type")  # "company" / "hearing" / "needs"
        return await self.analyzer.analyze(context["input"], analysis_type)


class GenerateTool(Tool):
    """特定タイプの出力を生成"""
    name = "generate"
    description = "ニーズ推定、提案方針、更問などを生成します"

    async def execute(self, params: dict, context: dict) -> dict:
        output_type = params.get("type")  # "needs" / "solution" / "questions"
        template = self.templates[output_type]
        return await self.llm.call(template.render(context))
```

#### 初期版（PoC開始時）の構成

```
┌─────────────────────────────────────────────────────────────────────┐
│                    初期版エージェント構成                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【Orchestrator】                                                   │
│  └─ シンプルな固定フロー（Plan自動生成は無効化可能）               │
│                                                                     │
│  【Tools】                                                          │
│  ├─ RetrieveTool (L0: 静的取得)                                    │
│  ├─ AnalyzeTool (入力の構造化)                                     │
│  └─ GenerateTool (ニーズ推定/提案方針生成)                         │
│                                                                     │
│  【Knowledge Store】                                                │
│  ├─ config/knowledge/products.yaml (商材)                          │
│  ├─ config/knowledge/templates.yaml (業種別テンプレート)           │
│  └─ config/knowledge/cases.yaml (過去事例)                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 段階的拡張のロードマップ

| Phase | 追加するTool/機能 | 目的 |
|-------|------------------|------|
| **初期** | RetrieveTool(L0), AnalyzeTool, GenerateTool | 基本動作 |
| **W5** | RetrieveTool(L1: フィルタ) | ナレッジ絞り込み |
| **W5-6** | SearchTool (Embedding) | 類似検索 |
| **W6** | Planner有効化 | 自律的なプラン策定 |
| **W7+** | 新Skills追加 | 専門機能拡張 |

#### 拡張例：新しいSkillの追加

```python
# 例: 競合分析Skill
class CompetitorAnalysisTool(Tool):
    """競合状況を分析"""
    name = "analyze_competitors"
    description = "競合他行の動向を分析し、提案時の注意点を抽出します"

    async def execute(self, params: dict, context: dict) -> dict:
        company_info = context["input"]["company_info"]
        competitors = await self.retriever.get_competitor_info(company_info)
        analysis = await self.llm.call(self.templates["competitor"].render(competitors))
        return analysis
```

**Skill追加の手順**:
1. `Tool`を継承した新クラスを作成
2. `tools/`ディレクトリに配置
3. `config/tools.yaml`に登録
4. Orchestratorが自動的に利用可能に

```yaml
# config/tools.yaml
tools:
  - name: retrieve
    class: tools.RetrieveTool
    enabled: true

  - name: search
    class: tools.SearchTool
    enabled: true  # W5から有効化

  - name: analyze_competitors
    class: tools.CompetitorAnalysisTool
    enabled: false  # 将来拡張用
```

---

### 7.6 ナレッジ取得層（Retriever）の設計

#### 概要

ナレッジ取得層は、入力に応じて適切なナレッジを取得し、プロンプトに注入する役割を担う。
PoC期間中にRetriever方式を切り替えて効果を比較できる設計とする。

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Retriever設計（Strategy Pattern）                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ interface Retriever                                         │    │
│  │   retrieve(input: Input, config: Config) -> Knowledge       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         ▲                                                           │
│         │ implements                                                │
│    ┌────┴────┬──────────────┬──────────────┬──────────────┐        │
│    │         │              │              │              │        │
│  ┌─────┐ ┌─────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │Static│ │Filtered │ │EmbeddingSearch│ │ HybridSearch │          │
│  │(L0)  │ │  (L1)   │ │    (L2)       │ │    (L3)      │          │
│  └─────┘ └─────────┘ └───────────────┘ └───────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### L0: 静的取得（ベースライン）

```python
class StaticRetriever:
    """全ナレッジをそのまま返す（ベースライン）"""

    def __init__(self, knowledge_path: str):
        self.knowledge = load_yaml(knowledge_path)

    def retrieve(self, input: dict, config: dict) -> dict:
        return {
            "product_catalog": self.knowledge["products"],
            "industry_templates": self.knowledge["industry_templates"],
            "case_examples": self.knowledge["cases"],
            "few_shot_examples": self.knowledge["few_shots"][:3]
        }
```

**特徴**:
- 実装が最もシンプル
- トークン消費が多い（全量注入）
- ナレッジ量が少ないうちは十分

#### L1: 条件フィルタ取得

```python
class FilteredRetriever:
    """入力条件に基づいてフィルタリング"""

    def retrieve(self, input: dict, config: dict) -> dict:
        industry = input.get("industry")
        scale = input.get("scale")

        return {
            "product_catalog": self._filter_products(industry),
            "industry_templates": self._get_template(industry),
            "case_examples": self._filter_cases(industry, scale),
            "few_shot_examples": self._select_examples(industry, scale)
        }

    def _filter_cases(self, industry: str, scale: str) -> list:
        """業種・規模でケースをフィルタ"""
        return [c for c in self.cases
                if c["industry"] == industry and c["scale"] == scale]
```

**特徴**:
- ルールベースで高速
- 関連性の高いナレッジに絞れる
- 条件設計の質に依存

#### L2: Embedding類似検索

```python
class EmbeddingRetriever:
    """Embeddingによる類似検索"""

    def __init__(self, index_client: AzureSearchClient):
        self.client = index_client
        self.embedder = AzureOpenAIEmbeddings(model="text-embedding-3-large")

    def retrieve(self, input: dict, config: dict) -> dict:
        # 入力をEmbedding化
        query_text = self._build_query_text(input)
        query_vector = self.embedder.embed(query_text)

        # 各ナレッジタイプごとに類似検索
        similar_cases = self._search("cases", query_vector, top_k=5)
        similar_products = self._search("products", query_vector, top_k=10)

        return {
            "product_catalog": similar_products,
            "case_examples": similar_cases,
            "few_shot_examples": similar_cases[:3]  # 類似ケースをFew-shotに
        }

    def _search(self, index: str, vector: list, top_k: int) -> list:
        """Azure AI Searchでベクトル検索"""
        results = self.client.search(
            search_text="",
            vector_queries=[VectorizedQuery(
                vector=vector,
                k_nearest_neighbors=top_k,
                fields="content_vector"
            )]
        )
        return [r for r in results]
```

**特徴**:
- 意味的に類似したナレッジを取得
- ナレッジ量が多い場合に有効
- Embedding品質に依存

#### L3: Hybrid検索（キーワード + Embedding）

```python
class HybridRetriever:
    """キーワード検索 + Embedding検索のハイブリッド"""

    def retrieve(self, input: dict, config: dict) -> dict:
        query_text = self._build_query_text(input)
        query_vector = self.embedder.embed(query_text)

        # Azure AI SearchのHybrid検索
        results = self.client.search(
            search_text=query_text,  # キーワード検索
            vector_queries=[VectorizedQuery(
                vector=query_vector,  # ベクトル検索
                k_nearest_neighbors=10,
                fields="content_vector"
            )],
            query_type="semantic",  # セマンティックランキング
            semantic_configuration_name="default"
        )
        return self._format_results(results)
```

**特徴**:
- キーワード一致 + 意味的類似の両方を考慮
- Azure AI Searchのセマンティックランキングも活用可能
- 最も高精度だがコストも高い

#### ナレッジのIndex設計（Azure AI Search）

```json
{
  "name": "knowledge-index",
  "fields": [
    {"name": "id", "type": "Edm.String", "key": true},
    {"name": "type", "type": "Edm.String", "filterable": true},
    {"name": "industry", "type": "Edm.String", "filterable": true, "facetable": true},
    {"name": "scale", "type": "Edm.String", "filterable": true},
    {"name": "title", "type": "Edm.String", "searchable": true},
    {"name": "content", "type": "Edm.String", "searchable": true},
    {"name": "content_vector", "type": "Collection(Edm.Single)",
     "dimensions": 3072, "vectorSearchProfile": "default"},
    {"name": "metadata", "type": "Edm.ComplexType", "fields": [
      {"name": "source", "type": "Edm.String"},
      {"name": "created_at", "type": "Edm.DateTimeOffset"},
      {"name": "result", "type": "Edm.String"}
    ]}
  ],
  "vectorSearch": {
    "profiles": [{"name": "default", "algorithm": "hnsw"}],
    "algorithms": [{"name": "hnsw", "kind": "hnsw",
                    "hnswParameters": {"m": 4, "metric": "cosine"}}]
  }
}
```

#### Retriever方式の切替設定

```yaml
# config/retriever.yaml

# 現在のRetriever方式（切替可能）
active_retriever: "L0"  # L0 / L1 / L2 / L3

retrievers:
  L0:
    type: "static"
    knowledge_path: "config/knowledge/"

  L1:
    type: "filtered"
    knowledge_path: "config/knowledge/"
    filter_rules:
      industry_match: true
      scale_match: true

  L2:
    type: "embedding"
    search_endpoint: "${AZURE_SEARCH_ENDPOINT}"
    index_name: "knowledge-index"
    embedding_model: "text-embedding-3-large"
    top_k:
      products: 10
      cases: 5
      few_shots: 3

  L3:
    type: "hybrid"
    search_endpoint: "${AZURE_SEARCH_ENDPOINT}"
    index_name: "knowledge-index"
    embedding_model: "text-embedding-3-large"
    semantic_config: "default"
    top_k:
      products: 10
      cases: 5
```

#### Retriever方式の効果測定

同一入力に対して複数のRetriever方式を実行し、効果を比較できるようにする。

```python
class RetrieverComparator:
    """複数Retriever方式の効果比較"""

    def compare(self, input: dict, retrievers: list[str]) -> dict:
        results = {}
        for r_type in retrievers:
            retriever = RetrieverFactory.create(r_type)
            knowledge = retriever.retrieve(input, {})

            # 同じ入力・同じナレッジでLLMを実行
            output = self.llm_caller.call(
                self.prompt_engine.render(input, knowledge)
            )

            results[r_type] = {
                "knowledge_count": len(knowledge["case_examples"]),
                "token_usage": output["usage"],
                "output": output["result"]
            }

        return results
```

---

### 7.6 機能① 顧客ニーズ推定AI

#### PoC版アーキテクチャ（Single-Call方式）

```
┌─────────────────────────────────────────────────────────────────────┐
│                 顧客ニーズ推定AI（PoC版）                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [入力]                                                             │
│  ├─ 企業情報（業種、規模、財務サマリ、ニュース）                    │
│  ├─ ヒアリング情報（面談記録テキスト）                              │
│  └─ （オプション）過去の類似企業ニーズ事例                          │
│                                                                     │
│         ▼                                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    1回のLLMコール                              │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ システムプロンプト構成                                   │  │  │
│  │  │                                                         │  │  │
│  │  │ [1] ロール定義                                          │  │  │
│  │  │     「あなたは法人営業20年のベテラン営業マネージャー     │  │  │
│  │  │      として、企業の潜在ニーズを分析します」              │  │  │
│  │  │                                                         │  │  │
│  │  │ [2] 思考プロセス（Chain-of-Thought）                    │  │  │
│  │  │     ① まず企業の状況を整理する                          │  │  │
│  │  │     ② 業種・規模から一般的な課題を想起する              │  │  │
│  │  │     ③ ヒアリング内容から固有の状況を抽出する            │  │  │
│  │  │     ④ 上記を統合してニーズを推定する                    │  │  │
│  │  │     ⑤ 情報不足があれば追加質問を生成する                │  │  │
│  │  │                                                         │  │  │
│  │  │ [3] ナレッジ注入                                        │  │  │
│  │  │     ├─ ニーズカテゴリ定義                               │  │  │
│  │  │     ├─ 業種別よくある課題テンプレート                   │  │  │
│  │  │     └─ 優先度・確度の判断基準                           │  │  │
│  │  │                                                         │  │  │
│  │  │ [4] Few-shot Examples（2-3件）                          │  │  │
│  │  │     └─ 入力→出力の具体例                                │  │  │
│  │  │                                                         │  │  │
│  │  │ [5] 出力フォーマット（JSON Schema）                     │  │  │
│  │  │                                                         │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│         ▼                                                           │
│  [出力] 構造化JSON                                                  │
│  ├─ 総評（○/△/×、全体コメント）                                  │
│  ├─ 推定ニーズ一覧（カテゴリ、根拠、確度、優先度）                  │
│  ├─ 類似企業の参考情報                                              │
│  └─ 追加ヒアリング推奨項目                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### プロンプトテンプレート構造

```yaml
# config/prompts/needs_estimation.yaml

system_prompt:
  role: |
    あなたは法人営業20年のベテラン営業マネージャーです。
    企業情報とヒアリング内容から、顧客の潜在ニーズを分析します。

  thinking_process: |
    以下のステップで分析を行ってください：

    <thinking>
    1. 【企業状況の整理】
       - 業種、規模、財務状況を確認
       - 最近のニュースや動向を把握

    2. 【業種・規模からの仮説】
       - この業種・規模の企業によくある課題は何か
       - 一般的なニーズパターンを想起

    3. 【ヒアリング内容からの抽出】
       - 明示的に述べられた課題・要望
       - 言外に示唆されている潜在ニーズ

    4. 【ニーズの統合・優先順位付け】
       - 上記を統合して推定ニーズをリストアップ
       - 優先度と確度を判定

    5. 【情報不足の特定】
       - 推定精度を上げるために必要な追加情報
       - 次回ヒアリングで確認すべき項目
    </thinking>

  knowledge: |
    ## ニーズカテゴリ定義
    {{needs_categories}}

    ## 業種別課題テンプレート
    {{industry_templates}}

    ## 優先度・確度の判断基準
    - 高確度: 顧客が明示的に言及、または具体的な計画が確認できる
    - 中確度: 状況から強く推測できる
    - 低確度: 可能性として考えられる

  few_shot_examples: |
    {{examples}}

  output_format: |
    以下のJSON形式で出力してください：
    {{json_schema}}

user_prompt: |
  ## 企業情報
  {{company_info}}

  ## ヒアリング情報
  {{hearing_info}}

  ## 類似企業の過去ニーズ（参考）
  {{similar_cases}}

  上記の情報をもとに、この企業の潜在ニーズを分析してください。
```

#### 出力JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["overall_assessment", "estimated_needs", "additional_questions"],
  "properties": {
    "overall_assessment": {
      "type": "object",
      "properties": {
        "rating": { "enum": ["○", "△", "×"] },
        "comment": { "type": "string" }
      }
    },
    "estimated_needs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["category", "need", "evidence", "confidence", "priority"],
        "properties": {
          "category": { "type": "string" },
          "need": { "type": "string" },
          "evidence": { "type": "string" },
          "confidence": { "enum": ["高", "中", "低"] },
          "priority": { "enum": ["高", "中", "低"] }
        }
      }
    },
    "similar_cases_reference": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "company_profile": { "type": "string" },
          "past_needs": { "type": "string" }
        }
      }
    },
    "additional_questions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "question": { "type": "string" },
          "reason": { "type": "string" },
          "expected_info": { "type": "string" }
        }
      }
    }
  }
}
```

#### 拡張ポイント（Retriever連動）

| 拡張項目 | L0（ベースライン） | L1（条件フィルタ） | L2/L3（Embedding/Hybrid） |
|----------|-------------------|-------------------|--------------------------|
| **ナレッジ量** | 全量注入 | 業種・規模でフィルタ | 類似度Top-Kを注入 |
| **Few-shot例** | 固定2-3例 | 条件別に選択 | 類似事例をTop-3で動的選択 |
| **トークン消費** | 多い | 中程度 | 最適化可能 |
| **実装工数** | 最小 | 小 | 中（Index構築必要） |

**PoC期間中の改善ステップ**:
1. **W1-W4**: L0でベースライン構築・評価
2. **W5**: L1を試行し、フィルタリングの効果測定
3. **W6**: L2（Embedding検索）を試行し、効果測定
4. **W7以降**: 効果の高い方式を採用

---

### 7.8 機能② ソリューション推薦AI

#### PoC版アーキテクチャ（Single-Call方式）

```
┌─────────────────────────────────────────────────────────────────────┐
│              ソリューション推薦AI（PoC版）                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [入力]                                                             │
│  ├─ 推定ニーズ情報（機能①の出力 or 手動入力）                       │
│  ├─ 企業情報（業種、規模、状況）                                    │
│  └─ （オプション）追加の制約条件                                    │
│                                                                     │
│         ▼                                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    1回のLLMコール                              │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ システムプロンプト構成                                   │  │  │
│  │  │                                                         │  │  │
│  │  │ [1] ロール定義                                          │  │  │
│  │  │     「あなたは法人営業20年のベテランソリューション       │  │  │
│  │  │      セールス担当として、最適な提案方針を策定します」    │  │  │
│  │  │                                                         │  │  │
│  │  │ [2] 思考プロセス（Chain-of-Thought）                    │  │  │
│  │  │     ① ニーズの本質を理解する                            │  │  │
│  │  │     ② 商材の中からニーズにマッチするものを探す          │  │  │
│  │  │     ③ 企業状況を踏まえた提案方針を策定する              │  │  │
│  │  │     ④ 注意すべきポイントを洗い出す                      │  │  │
│  │  │     ⑤ 過去事例を参考にストーリーを構成する              │  │  │
│  │  │                                                         │  │  │
│  │  │ [3] ナレッジ注入                                        │  │  │
│  │  │     ├─ 商材カタログ（全量）                             │  │  │
│  │  │     ├─ 過去の成約・失注事例                             │  │  │
│  │  │     └─ 提案時の注意点テンプレート                       │  │  │
│  │  │                                                         │  │  │
│  │  │ [4] Few-shot Examples（2-3件）                          │  │  │
│  │  │     └─ ニーズ→提案方針の具体例                          │  │  │
│  │  │                                                         │  │  │
│  │  │ [5] 出力フォーマット（JSON Schema）                     │  │  │
│  │  │                                                         │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│         ▼                                                           │
│  [出力] 構造化JSON                                                  │
│  ├─ 総評（○/△/×、全体コメント）                                  │
│  ├─ 提案方針（なぜこの方針か、アプローチ）                          │
│  ├─ 提案の理由                                                      │
│  ├─ 注意すべきポイント                                              │
│  ├─ 推薦商材リスト（対応ニーズ、訴求点、類似事例）                  │
│  └─ 類似企業への過去提案参考                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### プロンプトテンプレート構造

```yaml
# config/prompts/solution_recommendation.yaml

system_prompt:
  role: |
    あなたは法人営業20年のベテランソリューションセールス担当です。
    顧客のニーズに対して、最適な提案方針を策定します。
    単に商材を推薦するのではなく、「なぜこの提案が有効か」を論理的に説明します。

  thinking_process: |
    以下のステップで分析を行ってください：

    <thinking>
    1. 【ニーズの本質理解】
       - 顧客が本当に求めていることは何か
       - 表面的なニーズの裏にある課題は何か

    2. 【商材とのマッチング】
       - このニーズに対応できる商材は何か
       - 単体商材か、組み合わせが有効か

    3. 【提案方針の策定】
       - どのような切り口で提案すべきか
       - 顧客の状況を踏まえたアプローチ

    4. 【注意点の洗い出し】
       - 提案時に気をつけるべきこと
       - 過去の失注事例から学ぶべきこと
       - 競合状況への対応

    5. 【ストーリー構成】
       - 課題→解決策→効果の流れ
       - 過去の成功事例との関連付け
    </thinking>

  knowledge: |
    ## 商材カタログ
    {{product_catalog}}

    ## 過去の成約事例
    {{success_cases}}

    ## 過去の失注事例と教訓
    {{failure_cases}}

    ## 提案時の一般的な注意点
    {{general_cautions}}

  few_shot_examples: |
    {{examples}}

  output_format: |
    以下のJSON形式で出力してください：
    {{json_schema}}

user_prompt: |
  ## 推定ニーズ
  {{estimated_needs}}

  ## 企業情報
  {{company_info}}

  ## 追加の制約・条件（あれば）
  {{constraints}}

  上記の情報をもとに、この企業への提案方針を策定してください。
```

#### 出力JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["overall_assessment", "proposal_strategy", "recommended_products"],
  "properties": {
    "overall_assessment": {
      "type": "object",
      "properties": {
        "rating": { "enum": ["○", "△", "×"] },
        "comment": { "type": "string" }
      }
    },
    "proposal_strategy": {
      "type": "object",
      "properties": {
        "main_approach": { "type": "string" },
        "reasoning": { "type": "string" },
        "expected_effect": { "type": "string" }
      }
    },
    "proposal_reasons": {
      "type": "array",
      "items": { "type": "string" }
    },
    "caution_points": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "point": { "type": "string" },
          "reason": { "type": "string" },
          "mitigation": { "type": "string" }
        }
      }
    },
    "recommended_products": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "product_name": { "type": "string" },
          "target_need": { "type": "string" },
          "selling_point": { "type": "string" },
          "similar_case": { "type": "string" }
        }
      }
    },
    "reference_cases": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "company_profile": { "type": "string" },
          "proposal": { "type": "string" },
          "result": { "enum": ["成約", "失注"] },
          "lesson": { "type": "string" }
        }
      }
    }
  }
}
```

#### 拡張ポイント

| 拡張項目 | 現状（PoC） | 拡張方法 | タイミング |
|----------|-------------|----------|------------|
| 商材情報 | システムプロンプトに全量記載 | RAG化してVector DBから関連商材のみ取得 | MVP以降 |
| 過去事例 | 固定の数件を記載 | 類似ケースを動的検索して注入 | MVP以降 |
| マルチステップ | 1回のLLMコール | 商材選定→方針策定→レビューの3段階化 | 精度不足時 |
| 成約予測 | なし | 過去データ学習による成約確率スコア | MVP以降 |

---

### 7.9 ブラッシュアップ機能のアルゴリズム

#### 概要

```
┌─────────────────────────────────────────────────────────────────────┐
│              ブラッシュアップ機能（対話的改善）                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────┐                                                 │
│  │ 初回出力        │  ← 機能①or②の出力                             │
│  └───────┬────────┘                                                 │
│          ▼                                                          │
│  ┌────────────────┐                                                 │
│  │ ユーザーFB入力  │  ← 「与信上限で商材Aは使えない」等             │
│  └───────┬────────┘                                                 │
│          ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    修正LLMコール                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ システムプロンプト                                       │  │  │
│  │  │ ├─ 元の出力を提示                                       │  │  │
│  │  │ ├─ ユーザーのFBを提示                                   │  │  │
│  │  │ └─ 「FBを反映して修正版を生成せよ」                     │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│          ▼                                                          │
│  ┌────────────────┐                                                 │
│  │ 修正版出力      │                                                │
│  └───────┬────────┘                                                 │
│          ▼                                                          │
│     （繰り返し可能）                                                │
│          ▼                                                          │
│  ┌────────────────┐                                                 │
│  │ 最終版確定      │  ← ユーザーが承認                              │
│  └────────────────┘                                                 │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  [蓄積データ]                                                       │
│  ├─ 初回出力                                                        │
│  ├─ 各ラウンドのFBと修正版                                          │
│  ├─ 最終版                                                          │
│  └─ FBの分類（制約追加/優先度変更/観点追加/トーン変更/商材変更）    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### FB分類の自動タグ付け

```yaml
# config/prompts/feedback_classification.yaml

system_prompt: |
  ユーザーのフィードバックを以下のカテゴリに分類してください：

  1. 制約追加: 与信、規制、予算などの制約を追加
  2. 優先度変更: ニーズや商材の優先度を変更
  3. 観点追加: 新しい観点や論点を追加
  4. トーン変更: 表現やトーンの調整
  5. 商材変更: 推薦商材の追加・削除・変更
  6. その他: 上記に該当しない

output_format:
  type: object
  properties:
    category: { enum: [制約追加, 優先度変更, 観点追加, トーン変更, 商材変更, その他] }
    detail: { type: string }
```

---

### 7.10 共通コンポーネント設計

#### プロンプトテンプレートエンジン

```python
# 概念設計（実装イメージ）

class PromptTemplate:
    """YAMLベースのプロンプトテンプレート管理"""

    def __init__(self, template_path: str):
        self.template = load_yaml(template_path)

    def render(self, **variables) -> dict:
        """変数を埋め込んでプロンプトを生成"""
        system = self._render_section("system_prompt", variables)
        user = self._render_section("user_prompt", variables)
        return {"system": system, "user": user}

    def _render_section(self, section: str, variables: dict) -> str:
        template_str = self.template[section]
        # Jinja2ライクな変数展開
        for key, value in variables.items():
            template_str = template_str.replace(f"{{{{{key}}}}}", str(value))
        return template_str


class LLMCaller:
    """LLM APIの統一インターフェース"""

    def __init__(self, model: str = "gpt-5.2"):
        self.client = AzureOpenAI(...)
        self.model = model

    def call(self, prompt: dict, json_schema: dict = None) -> dict:
        """LLMを呼び出し、構造化出力を返す"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": prompt["system"]},
                {"role": "user", "content": prompt["user"]}
            ],
            response_format={"type": "json_object"} if json_schema else None
        )
        result = json.loads(response.choices[0].message.content)
        if json_schema:
            validate(result, json_schema)  # JSON Schemaでバリデーション
        return result
```

#### ディレクトリ構成（エージェント型対応版）

```
project/
├── config/
│   ├── agent.yaml                  # エージェント設定（Orchestrator設定）
│   ├── tools.yaml                  # 利用可能なTool一覧・有効/無効
│   ├── retriever.yaml              # Retriever方式設定（L0/L1/L2/L3切替）
│   ├── prompts/                    # プロンプトテンプレート（YAML）
│   │   ├── planner.yaml            # プラン策定用プロンプト
│   │   ├── needs_estimation.yaml
│   │   ├── solution_recommendation.yaml
│   │   ├── final_response.yaml     # 最終回答統合用
│   │   └── feedback_classification.yaml
│   ├── knowledge/                  # ナレッジデータ（YAML/JSON）
│   │   ├── needs_categories.yaml
│   │   ├── industry_templates.yaml
│   │   ├── product_catalog.yaml
│   │   └── case_examples.yaml
│   └── schemas/                    # 出力JSON Schema
│       ├── plan.json               # プラン出力スキーマ
│       ├── needs_output.json
│       └── solution_output.json
├── src/
│   ├── agent/
│   │   ├── orchestrator.py         # エージェント中核（プラン→実行→統合）
│   │   ├── planner.py              # プラン策定
│   │   └── context.py              # 実行コンテキスト管理
│   ├── tools/                      # Tool/Skill実装
│   │   ├── base.py                 # Tool基底クラス
│   │   ├── retrieve.py             # ナレッジ取得Tool
│   │   ├── search.py               # 検索Tool（Embedding対応）
│   │   ├── analyze.py              # 分析Tool
│   │   └── generate.py             # 生成Tool
│   ├── retriever/                  # Retriever実装
│   │   ├── base.py                 # Retriever基底クラス
│   │   ├── static.py               # L0: 静的取得
│   │   ├── filtered.py             # L1: 条件フィルタ
│   │   ├── embedding.py            # L2: Embedding検索
│   │   └── hybrid.py               # L3: Hybrid検索
│   ├── core/
│   │   ├── prompt_engine.py        # プロンプトテンプレートエンジン
│   │   ├── llm_caller.py           # LLM API呼び出し
│   │   └── output_parser.py        # 出力パース・バリデーション
│   ├── knowledge/
│   │   ├── store.py                # ナレッジストア（YAML/Azure AI Search）
│   │   └── indexer.py              # ナレッジIndexer（Embedding生成）
│   └── api/
│       └── main.py                 # FastAPI エントリポイント
├── ui/
│   └── streamlit_app.py            # 検証UI
├── scripts/
│   ├── index_knowledge.py          # ナレッジをAzure AI Searchに投入
│   └── compare_retrievers.py       # Retriever方式の効果比較
└── tests/
    ├── test_orchestrator.py
    ├── test_tools.py
    └── test_retrievers.py
```

#### 拡張パターン一覧（エージェント型）

| パターン | 説明 | 実装方法 |
|----------|------|----------|
| **ナレッジ追加** | 新しい業種テンプレート等を追加 | `config/knowledge/`にYAML追加 → `scripts/index_knowledge.py`実行 |
| **プロンプト調整** | 思考プロセスや出力形式を変更 | `config/prompts/`のYAML編集 |
| **Retriever方式変更** | ナレッジ取得方式を切替 | `config/retriever.yaml`の`active_retriever`変更 |
| **新Tool追加** | 新しい機能を追加 | `src/tools/`に実装 → `config/tools.yaml`に登録 |
| **検索機能拡張** | Embedding/Hybrid検索を有効化 | Azure AI Searchセットアップ → `config/retriever.yaml`でL2/L3有効化 |
| **プラン自動化** | LLMによるプラン策定を有効化 | `config/agent.yaml`の`auto_plan: true` |

#### エージェント設定例

```yaml
# config/agent.yaml
orchestrator:
  # プラン策定をLLMに任せるか、固定フローを使うか
  auto_plan: false  # 初期は固定フロー、W6以降でtrue検討

  # 固定フローの場合の実行順序
  fixed_flow:
    - tool: retrieve
      params:
        method: "{{config.retriever.active}}"
    - tool: analyze
      params:
        type: "company_hearing"
    - tool: generate
      params:
        type: "{{request.output_type}}"  # needs / solution

  # 最終回答生成の設定
  response_template: "final_response"

# トレース設定
tracing:
  enabled: true
  backend: "langfuse"  # langfuse / azure_ai_foundry / langsmith
```

---

### 7.11 Week 1 技術検証項目

| タスク | 目的 | 成果物 |
|--------|------|--------|
| GPT-5.2 API検証 | Azure OpenAI経由でGPT-5.2/5.1が使えるか確認 | 検証レポート |
| Embedding API検証 | text-embedding-3-large の利用可否確認 | 検証レポート |
| Azure AI Search検証 | Vector Search / Hybrid Search の動作確認 | 検証レポート |
| トレースツール比較調査 | LangFuse vs Azure AI Foundry vs LangSmith | 比較表 |
| 自動評価のベストプラクティス調査 | LLM-as-a-Judge、ルーブリック評価の事例収集 | サーベイレポート |
| 開発環境セットアップ | Azure環境、リポジトリ、CI/CDの雛形 | 動作する環境 |
| エージェント基盤構築 | Orchestrator + 初期Tools（L0 Retriever） | 動作するエージェント |

---

## 8. モック開発設計

### 8.1 画面構成

```
┌─────────────────────────────────────────────────────────────┐
│  提案仮説構築支援AI（モック）                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [タブ1] 顧客ニーズ推定                                     │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ 企業選択         │  │ 推定結果                         │  │
│  │ ・企業名検索     │  │ ・推定ニーズ一覧                 │  │
│  │ ・企業情報表示   │  │ ・各ニーズの根拠                 │  │
│  ├─────────────────┤  │ ・確度/優先度                    │  │
│  │ ヒアリング入力   │  ├─────────────────────────────────┤  │
│  │ ・テキスト入力   │  │ 追加ヒアリング推奨               │  │
│  │ ・音声入力(任意) │  │ ・質問項目リスト                 │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
│                                                             │
│  [タブ2] ソリューション推薦                                 │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ ニーズ選択       │  │ 推薦結果                         │  │
│  │ ・推定ニーズから │  │ ・推薦商材一覧                   │  │
│  │ ・手動入力も可   │  │ ・推薦理由                       │  │
│  ├─────────────────┤  │ ・類似事例                       │  │
│  │ 条件指定         │  ├─────────────────────────────────┤  │
│  │ ・予算規模       │  │ 提案ストーリー                   │  │
│  │ ・導入時期       │  │ ・構成案                         │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 技術スタック（モック用）

| 層 | 技術 | 理由 |
|----|------|------|
| UI | Streamlit | 高速プロトタイピング、Pythonのみで完結 |
| API | FastAPI | 軽量、OpenAPI自動生成 |
| LLM | Azure OpenAI | 既存契約、GPT-5.2利用可能 |
| Vector DB | （PoCスコープ外） | MTG方針: 商材はシステムプロンプトに投入 |
| Hosting | Azure App Service | 簡易デプロイ |

### 8.3 プロトタイプ仕様

| 項目 | 内容 |
|------|------|
| **技術** | Streamlit または Gradio |
| **機能** | 企業情報入力 → ニーズ推定 → 商材推薦 の一連の流れ |
| **想定工数** | 2-3人日程度 |
| **開発時期** | Phase 4（W7-W8）|

### 環境・データ方針

| 項目 | 方針 |
|------|------|
| **開発・実行環境** | 弊社環境を使用（顧客環境への依存なし） |
| **使用データ** | **機密データを含まないデータのみ**を使用 |
| **データ例** | 公開企業情報、匿名化された面談記録、一般的な商材情報 |

```
⚠️ 重要
- 本プロトタイプでは機密情報（個社名、具体的な取引条件等）は一切使用しない
- 顧客からのデータ提供がある場合も、機密情報を含まない形式に加工して使用
- プロトタイプは社内デモ・評価目的であり、外部公開は行わない
```
