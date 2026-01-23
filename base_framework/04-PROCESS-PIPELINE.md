# 04. Process Pipeline - プロセスパイプライン設計

> **目的**: LLM処理の連鎖実行、状態管理、依存関係の仕組みを定義

---

## 1. 設計目標

```
┌─────────────────────────────────────────────────────────────────┐
│                      Design Goals                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Pipeline Definition  - プロセス間の依存関係定義            │
│  2. State Management     - プロセス実行状態の追跡              │
│  3. Cascade Invalidation - 上流変更時の自動無効化              │
│  4. Auto Input Fill      - 上流出力からの自動入力              │
│  5. Execution History    - 実行履歴の保持                      │
│  6. Error Recovery       - エラー時のリトライ・復旧            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. プロセスパイプライン概念

### 2.1 パイプライン構造

```
┌─────────────────────────────────────────────────────────────────┐
│                    Process Pipeline                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │Process A│───▶│Process B│───▶│Process C│───▶│Process D│     │
│  │(Input)  │    │(Analyze)│    │(Generate)│   │(Output) │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│       │              │              │              │            │
│       ▼              ▼              ▼              ▼            │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │  State  │    │  State  │    │  State  │    │  State  │     │
│  │ valid   │    │ valid   │    │ pending │    │ empty   │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 状態遷移図

```
                    ┌───────────┐
                    │   empty   │
                    └─────┬─────┘
                          │ execute()
                          ▼
                    ┌───────────┐
              ┌────▶│  pending  │◀────┐
              │     └─────┬─────┘     │
              │           │           │
              │    success│    error  │
              │           │           │
              │           ▼           │
              │     ┌───────────┐     │
              │     │   valid   │     │
              │     └─────┬─────┘     │
              │           │           │
              │   upstream│   retry   │
              │   changed │           │
              │           ▼           │
              │     ┌───────────┐     │
              └─────│   stale   │─────┘
                    └───────────┘
                          │
                          │ re-execute
                          ▼
                    ┌───────────┐
                    │   error   │
                    └───────────┘
```

---

## 3. データモデル

### 3.1 プロセス定義

```python
# models/process.py
from sqlalchemy import Column, String, Integer, Text
from .base import Base, GUID, JSONType
import uuid

class ProcessDefinition(Base):
    """プロセス定義（静的設定）"""
    __tablename__ = "process_definitions"

    id = Column(String(100), primary_key=True)  # "specification", "block_diagram"
    name = Column(String(200), nullable=False)
    description = Column(Text)
    order_index = Column(Integer, nullable=False)  # 実行順序

    # スキーマ定義
    input_schema = Column(JSONType)   # 入力JSONスキーマ
    output_schema = Column(JSONType)  # 出力JSONスキーマ

    # 依存関係
    depends_on = Column(JSONType)  # ["process_a", "process_b"]

    # 関連
    executions = relationship("ProcessExecution", back_populates="process")
    states = relationship("ProcessState", back_populates="process")
```

### 3.2 プロセス実行

```python
class ProcessExecution(Base):
    """プロセス実行記録"""
    __tablename__ = "process_executions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    project_id = Column(GUID, ForeignKey("projects.id"), nullable=False)
    process_id = Column(String(100), ForeignKey("process_definitions.id"))
    prompt_version_id = Column(GUID, ForeignKey("prompt_versions.id"))

    # 入出力
    input_data = Column(JSONType)
    output_data = Column(JSONType)

    # ステータス
    status = Column(String(50), default="pending")  # pending, completed, failed
    error_message = Column(Text)

    # メタデータ
    reasoning = Column(Text)        # LLMの推論過程
    missing_info = Column(JSONType) # 不足情報リスト

    # タイムスタンプ
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    # リレーション
    project = relationship("Project", back_populates="executions")
    process = relationship("ProcessDefinition", back_populates="executions")
```

### 3.3 プロセス状態

```python
class ProcessState(Base):
    """プロジェクトごとのプロセス状態"""
    __tablename__ = "process_states"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    project_id = Column(GUID, ForeignKey("projects.id"), nullable=False)
    process_id = Column(String(100), ForeignKey("process_definitions.id"))

    # 状態
    state = Column(String(50), default="empty")  # empty, pending, valid, stale, error
    version = Column(Integer, default=0)  # 状態バージョン

    # 現在の実行
    current_execution_id = Column(GUID, ForeignKey("process_executions.id"))

    # 無効化情報
    invalidated_at = Column(DateTime)
    invalidated_by_process_id = Column(String(100))

    # タイムスタンプ
    last_updated_at = Column(DateTime, default=datetime.utcnow)

    # ユニーク制約
    __table_args__ = (
        UniqueConstraint("project_id", "process_id", name="uq_project_process"),
    )
```

---

## 4. 状態管理

### 4.1 ProcessStateManager

```python
# services/state_manager.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from ..models.process import ProcessState, ProcessExecution, ProcessDefinition

class ProcessStateManager:
    """プロセス状態管理"""

    # 状態定義
    class State:
        EMPTY = "empty"
        PENDING = "pending"
        VALID = "valid"
        STALE = "stale"
        ERROR = "error"

    def __init__(self, session: AsyncSession):
        self.session = session

    async def initialize_states(self, project_id: str):
        """プロジェクトの全プロセス状態を初期化"""
        definitions = await self.session.execute(
            select(ProcessDefinition).order_by(ProcessDefinition.order_index)
        )

        for process_def in definitions.scalars():
            state = ProcessState(
                project_id=project_id,
                process_id=process_def.id,
                state=self.State.EMPTY
            )
            self.session.add(state)

        await self.session.commit()

    async def get_state(
        self,
        project_id: str,
        process_id: str
    ) -> ProcessState | None:
        """プロセス状態を取得"""
        result = await self.session.execute(
            select(ProcessState).where(
                ProcessState.project_id == project_id,
                ProcessState.process_id == process_id
            )
        )
        return result.scalar_one_or_none()

    async def get_all_states(
        self,
        project_id: str
    ) -> list[ProcessState]:
        """プロジェクトの全プロセス状態を取得"""
        result = await self.session.execute(
            select(ProcessState)
            .where(ProcessState.project_id == project_id)
            .order_by(ProcessState.process_id)
        )
        return list(result.scalars())

    async def mark_pending(
        self,
        project_id: str,
        process_id: str,
        execution_id: str
    ):
        """実行開始を記録"""
        await self.session.execute(
            update(ProcessState)
            .where(
                ProcessState.project_id == project_id,
                ProcessState.process_id == process_id
            )
            .values(
                state=self.State.PENDING,
                current_execution_id=execution_id,
                last_updated_at=datetime.utcnow()
            )
        )
        await self.session.commit()

    async def mark_valid(
        self,
        project_id: str,
        process_id: str
    ):
        """実行完了を記録"""
        state = await self.get_state(project_id, process_id)
        if state:
            state.state = self.State.VALID
            state.version += 1
            state.last_updated_at = datetime.utcnow()
            await self.session.commit()

            # 下流を無効化
            await self._invalidate_downstream(project_id, process_id)

    async def mark_error(
        self,
        project_id: str,
        process_id: str,
        error_message: str
    ):
        """エラーを記録"""
        await self.session.execute(
            update(ProcessState)
            .where(
                ProcessState.project_id == project_id,
                ProcessState.process_id == process_id
            )
            .values(
                state=self.State.ERROR,
                last_updated_at=datetime.utcnow()
            )
        )
        await self.session.commit()

    async def _invalidate_downstream(
        self,
        project_id: str,
        changed_process_id: str
    ):
        """下流プロセスを無効化"""
        # 依存関係を取得
        downstream = await self._get_downstream_processes(changed_process_id)

        for process_id in downstream:
            await self.session.execute(
                update(ProcessState)
                .where(
                    ProcessState.project_id == project_id,
                    ProcessState.process_id == process_id,
                    ProcessState.state == self.State.VALID
                )
                .values(
                    state=self.State.STALE,
                    invalidated_at=datetime.utcnow(),
                    invalidated_by_process_id=changed_process_id
                )
            )

        await self.session.commit()

    async def _get_downstream_processes(
        self,
        process_id: str
    ) -> list[str]:
        """下流プロセスIDリストを取得"""
        result = await self.session.execute(
            select(ProcessDefinition)
        )

        downstream = []
        for process in result.scalars():
            if process.depends_on and process_id in process.depends_on:
                downstream.append(process.id)
                # 再帰的に下流を取得
                downstream.extend(
                    await self._get_downstream_processes(process.id)
                )

        return list(set(downstream))  # 重複除去
```

### 4.2 上流出力の自動取得

```python
class ProcessStateManager:
    # ... 上記に追加 ...

    async def get_upstream_output(
        self,
        project_id: str,
        process_id: str
    ) -> dict[str, Any] | None:
        """上流プロセスの出力を取得"""
        # プロセス定義を取得
        process_def = await self.session.execute(
            select(ProcessDefinition)
            .where(ProcessDefinition.id == process_id)
        )
        process = process_def.scalar_one_or_none()

        if not process or not process.depends_on:
            return None

        # 上流の出力を集約
        upstream_outputs = {}
        for upstream_id in process.depends_on:
            state = await self.get_state(project_id, upstream_id)
            if state and state.state == self.State.VALID:
                execution = await self.session.get(
                    ProcessExecution,
                    state.current_execution_id
                )
                if execution:
                    upstream_outputs[upstream_id] = execution.output_data

        return upstream_outputs if upstream_outputs else None

    async def check_dependencies_satisfied(
        self,
        project_id: str,
        process_id: str
    ) -> tuple[bool, list[str]]:
        """依存プロセスが完了しているか確認"""
        process_def = await self.session.execute(
            select(ProcessDefinition)
            .where(ProcessDefinition.id == process_id)
        )
        process = process_def.scalar_one_or_none()

        if not process or not process.depends_on:
            return True, []

        missing = []
        for upstream_id in process.depends_on:
            state = await self.get_state(project_id, upstream_id)
            if not state or state.state != self.State.VALID:
                missing.append(upstream_id)

        return len(missing) == 0, missing
```

---

## 5. プロセスサービス

### 5.1 基底クラス

```python
# services/process/base.py
from abc import ABC, abstractmethod
from typing import Generic, TypeVar
from ..llm.base import LLMService
from ..state_manager import ProcessStateManager
from ...prompts.registry import PromptRegistry

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")

class BaseProcessService(ABC, Generic[TInput, TOutput]):
    """プロセスサービス基底クラス"""

    process_id: str  # サブクラスで定義

    def __init__(
        self,
        session: AsyncSession,
        llm_service: LLMService,
        prompt_registry: PromptRegistry,
        state_manager: ProcessStateManager,
        metrics_recorder: MetricsRecorder
    ):
        self.session = session
        self.llm = llm_service
        self.prompts = prompt_registry
        self.state_manager = state_manager
        self.metrics = metrics_recorder

    async def execute(
        self,
        project_id: str,
        input_data: TInput
    ) -> TOutput:
        """プロセス実行のメインフロー"""
        # 1. 依存チェック
        satisfied, missing = await self.state_manager.check_dependencies_satisfied(
            project_id, self.process_id
        )
        if not satisfied:
            raise ProcessDependencyError(missing)

        # 2. 実行記録作成
        execution = ProcessExecution(
            project_id=project_id,
            process_id=self.process_id,
            input_data=input_data.model_dump() if hasattr(input_data, 'model_dump') else input_data,
            status="pending"
        )
        self.session.add(execution)
        await self.session.commit()

        # 3. 状態を pending に
        await self.state_manager.mark_pending(
            project_id, self.process_id, str(execution.id)
        )

        try:
            # 4. 実際の処理実行
            start_time = time.time()
            result, llm_response = await self._execute_impl(input_data)
            inference_time = int((time.time() - start_time) * 1000)

            # 5. 結果を記録
            execution.output_data = result.model_dump() if hasattr(result, 'model_dump') else result
            execution.status = "completed"
            execution.completed_at = datetime.utcnow()
            await self.session.commit()

            # 6. メトリクス記録
            if llm_response:
                await self.metrics.record(
                    project_id=project_id,
                    process_id=self.process_id,
                    provider=self.llm.provider,
                    model=self.llm.model,
                    llm_response=llm_response,
                    inference_time_ms=inference_time
                )

            # 7. 状態を valid に
            await self.state_manager.mark_valid(project_id, self.process_id)

            return result

        except Exception as e:
            # エラー記録
            execution.status = "failed"
            execution.error_message = str(e)
            await self.session.commit()
            await self.state_manager.mark_error(
                project_id, self.process_id, str(e)
            )
            raise

    @abstractmethod
    async def _execute_impl(
        self,
        input_data: TInput
    ) -> tuple[TOutput, LLMResponse | None]:
        """サブクラスで実装する実際の処理"""
        pass

    async def get_auto_input(self, project_id: str) -> dict | None:
        """上流出力から自動入力を生成"""
        upstream = await self.state_manager.get_upstream_output(
            project_id, self.process_id
        )
        if not upstream:
            return None
        return self._transform_upstream_output(upstream)

    def _transform_upstream_output(self, upstream: dict) -> dict:
        """上流出力を入力形式に変換（サブクラスでオーバーライド可）"""
        return upstream
```

### 5.2 具体的なプロセスサービス

```python
# services/process/specification_service.py

class SpecificationService(BaseProcessService[SpecificationInput, SpecificationOutput]):
    """仕様書分析プロセス"""

    process_id = "specification"

    async def _execute_impl(
        self,
        input_data: SpecificationInput
    ) -> tuple[SpecificationOutput, LLMResponse | None]:
        # プロンプト取得
        system_prompt = self.prompts.get_system_prompt(
            "spec_analyze",
            self.llm.provider
        )
        user_prompt = self.prompts.get_user_prompt(
            "spec_analyze",
            self.llm.provider,
            content=input_data.content,
            source_type=input_data.source_type
        )

        # LLM呼び出し
        result, llm_response = await self.llm.generate_json_with_usage(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.3
        )

        return SpecificationOutput(**result), llm_response


# services/process/block_diagram_service.py

class BlockDiagramService(BaseProcessService[BlockDiagramInput, BlockDiagramOutput]):
    """ブロック図生成プロセス"""

    process_id = "block_diagram"

    def _transform_upstream_output(self, upstream: dict) -> dict:
        """仕様書出力をブロック図入力に変換"""
        spec_output = upstream.get("specification", {})
        return {
            "requirements": spec_output.get("extracted_items", []),
            "constraints": spec_output.get("constraints", [])
        }

    async def _execute_impl(
        self,
        input_data: BlockDiagramInput
    ) -> tuple[BlockDiagramOutput, LLMResponse | None]:
        # ... 実装
        pass
```

---

## 6. パイプライン定義

### 6.1 設定ファイル

```yaml
# config/process_pipeline.yaml
processes:
  - id: specification
    name: 仕様書分析
    order: 1
    depends_on: []
    prompt_id: spec_analyze

  - id: block_diagram
    name: ブロック図生成
    order: 2
    depends_on: [specification]
    prompt_id: block_diagram

  - id: detailed_block_diagram
    name: 詳細ブロック図
    order: 3
    depends_on: [block_diagram]
    prompt_id: detailed_block

  - id: circuit_schematic
    name: 回路図生成
    order: 4
    depends_on: [detailed_block_diagram]
    prompt_id: circuit_schematic

  - id: component_selection
    name: 部品選定
    order: 5
    depends_on: [circuit_schematic]
    prompt_id: component_selection

  - id: bom
    name: BOM生成
    order: 6
    depends_on: [component_selection]
    prompt_id: bom_generation
```

### 6.2 パイプラインローダー

```python
# services/pipeline_loader.py
import yaml
from pathlib import Path

class PipelineLoader:
    """パイプライン設定ローダー"""

    def __init__(self, config_path: str = "config/process_pipeline.yaml"):
        self.config_path = Path(config_path)
        self._pipeline: dict | None = None

    def load(self) -> dict:
        """設定をロード"""
        if self._pipeline is None:
            with open(self.config_path) as f:
                self._pipeline = yaml.safe_load(f)
        return self._pipeline

    def get_process_order(self) -> list[str]:
        """実行順序を取得"""
        pipeline = self.load()
        processes = sorted(
            pipeline["processes"],
            key=lambda p: p["order"]
        )
        return [p["id"] for p in processes]

    def get_dependencies(self, process_id: str) -> list[str]:
        """依存プロセスを取得"""
        pipeline = self.load()
        for process in pipeline["processes"]:
            if process["id"] == process_id:
                return process.get("depends_on", [])
        return []

    def validate_pipeline(self) -> list[str]:
        """パイプライン設定を検証"""
        errors = []
        pipeline = self.load()
        process_ids = {p["id"] for p in pipeline["processes"]}

        for process in pipeline["processes"]:
            for dep in process.get("depends_on", []):
                if dep not in process_ids:
                    errors.append(
                        f"Process '{process['id']}' depends on unknown process '{dep}'"
                    )

        # 循環依存チェック
        if self._has_cycle():
            errors.append("Circular dependency detected in pipeline")

        return errors

    def _has_cycle(self) -> bool:
        """循環依存検出"""
        pipeline = self.load()
        visited = set()
        rec_stack = set()

        def dfs(process_id: str) -> bool:
            visited.add(process_id)
            rec_stack.add(process_id)

            for dep in self.get_dependencies(process_id):
                if dep not in visited:
                    if dfs(dep):
                        return True
                elif dep in rec_stack:
                    return True

            rec_stack.remove(process_id)
            return False

        for process in pipeline["processes"]:
            if process["id"] not in visited:
                if dfs(process["id"]):
                    return True

        return False
```

---

## 7. 一括実行

### 7.1 パイプライン実行エンジン

```python
# services/pipeline_executor.py

class PipelineExecutor:
    """パイプライン一括実行"""

    def __init__(
        self,
        session: AsyncSession,
        llm_service: LLMService,
        services: dict[str, BaseProcessService]
    ):
        self.session = session
        self.llm = llm_service
        self.services = services
        self.pipeline_loader = PipelineLoader()

    async def execute_all(
        self,
        project_id: str,
        initial_input: dict
    ) -> dict[str, Any]:
        """全プロセスを順次実行"""
        results = {}
        process_order = self.pipeline_loader.get_process_order()

        for process_id in process_order:
            service = self.services.get(process_id)
            if not service:
                continue

            # 入力準備（初回は初期入力、以降は上流出力）
            if process_id == process_order[0]:
                input_data = initial_input
            else:
                input_data = await service.get_auto_input(project_id)

            if input_data is None:
                raise ProcessError(f"No input available for {process_id}")

            # 実行
            try:
                result = await service.execute(project_id, input_data)
                results[process_id] = result
            except Exception as e:
                results[process_id] = {"error": str(e)}
                break  # エラー時は中断

        return results

    async def execute_from(
        self,
        project_id: str,
        start_process_id: str
    ) -> dict[str, Any]:
        """指定プロセスから再実行"""
        results = {}
        process_order = self.pipeline_loader.get_process_order()

        # 開始位置を特定
        start_idx = process_order.index(start_process_id)

        for process_id in process_order[start_idx:]:
            # ... 上記と同様
            pass

        return results
```

---

## 8. API エンドポイント

```python
# routers/processes.py

@router.get("/projects/{project_id}/process-state")
async def get_all_process_states(
    project_id: str,
    state_manager: ProcessStateManager = Depends(get_state_manager)
) -> list[ProcessStateResponse]:
    """プロジェクトの全プロセス状態を取得"""
    states = await state_manager.get_all_states(project_id)
    return [ProcessStateResponse.from_orm(s) for s in states]

@router.post("/projects/{project_id}/processes/{process_id}/execute")
async def execute_process(
    project_id: str,
    process_id: str,
    input_data: ProcessInputRequest,
    service: BaseProcessService = Depends(get_process_service)
) -> ProcessOutputResponse:
    """個別プロセスを実行"""
    result = await service.execute(project_id, input_data)
    return ProcessOutputResponse(
        process_id=process_id,
        status="completed",
        output=result
    )

@router.post("/projects/{project_id}/pipeline/execute")
async def execute_pipeline(
    project_id: str,
    initial_input: PipelineInputRequest,
    executor: PipelineExecutor = Depends(get_pipeline_executor)
) -> PipelineOutputResponse:
    """パイプライン一括実行"""
    results = await executor.execute_all(project_id, initial_input)
    return PipelineOutputResponse(results=results)

@router.post("/projects/{project_id}/processes/{process_id}/reset")
async def reset_process(
    project_id: str,
    process_id: str,
    cascade: bool = True,
    state_manager: ProcessStateManager = Depends(get_state_manager)
):
    """プロセス状態をリセット"""
    await state_manager.reset(project_id, process_id, cascade=cascade)
    return {"message": "Process reset successfully"}
```

---

## 9. 関連ドキュメント

- [02-LLM-INTEGRATION.md](./02-LLM-INTEGRATION.md) - LLMサービス
- [03-PROMPT-MANAGEMENT.md](./03-PROMPT-MANAGEMENT.md) - プロンプト管理
- [05-DATA-MODEL.md](./05-DATA-MODEL.md) - データモデル詳細
