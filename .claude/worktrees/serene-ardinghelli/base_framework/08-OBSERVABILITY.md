# 08. Observability - 観測可能性設計

> **目的**: メトリクス収集、ログ管理、トレーシングの仕組みを定義

---

## 1. 観測可能性の3本柱

```
┌─────────────────────────────────────────────────────────────────┐
│                   Three Pillars of Observability                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   Metrics   │    │    Logs     │    │   Traces    │        │
│  │   数値指標   │    │   ログ記録   │    │  分散追跡   │        │
│  ├─────────────┤    ├─────────────┤    ├─────────────┤        │
│  │ - トークン数 │    │ - エラーログ │    │ - リクエスト│        │
│  │ - コスト    │    │ - アクセス   │    │   フロー    │        │
│  │ - 推論時間  │    │ - デバッグ   │    │ - 処理時間  │        │
│  │ - 成功率    │    │ - 監査      │    │ - 依存関係  │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. LLMメトリクス

### 2.1 メトリクスモデル

```python
# models/metrics.py
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from .base import Base, GUID, JSONType
import uuid
from datetime import datetime

class LLMMetrics(Base):
    """LLM使用メトリクス"""
    __tablename__ = "llm_metrics"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)

    # 関連
    project_id = Column(GUID, ForeignKey("projects.id"), index=True)
    process_id = Column(String(100), index=True)
    execution_id = Column(GUID, ForeignKey("process_executions.id"))

    # プロバイダー情報
    provider = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)

    # トークン使用量
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)

    # コスト（USD）
    cost_usd = Column(Float, default=0.0)

    # パフォーマンス
    inference_time_ms = Column(Integer)
    queue_time_ms = Column(Integer, default=0)

    # ステータス
    is_success = Column(Boolean, default=True)
    error_type = Column(String(100))

    # タイムスタンプ
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
```

### 2.2 メトリクスレコーダー

```python
# services/metrics_recorder.py
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.metrics import LLMMetrics
from ..services.llm.pricing import calculate_cost

class MetricsRecorder:
    """メトリクス記録サービス"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def record(
        self,
        project_id: str,
        process_id: str,
        execution_id: str,
        provider: str,
        model: str,
        llm_response: LLMResponse,
        inference_time_ms: int,
        is_success: bool = True,
        error_type: str | None = None
    ):
        """メトリクスを記録"""
        cost = calculate_cost(
            provider=provider,
            model=model,
            prompt_tokens=llm_response.prompt_tokens,
            completion_tokens=llm_response.completion_tokens
        )

        metric = LLMMetrics(
            project_id=project_id,
            process_id=process_id,
            execution_id=execution_id,
            provider=provider,
            model=model,
            prompt_tokens=llm_response.prompt_tokens,
            completion_tokens=llm_response.completion_tokens,
            total_tokens=llm_response.total_tokens,
            cost_usd=cost,
            inference_time_ms=inference_time_ms,
            is_success=is_success,
            error_type=error_type
        )

        self.session.add(metric)
        await self.session.commit()

    async def get_summary(
        self,
        project_id: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None
    ) -> dict:
        """メトリクスサマリーを取得"""
        query = select(
            func.count(LLMMetrics.id).label("total_calls"),
            func.sum(LLMMetrics.prompt_tokens).label("total_prompt_tokens"),
            func.sum(LLMMetrics.completion_tokens).label("total_completion_tokens"),
            func.sum(LLMMetrics.total_tokens).label("total_tokens"),
            func.sum(LLMMetrics.cost_usd).label("total_cost"),
            func.avg(LLMMetrics.inference_time_ms).label("avg_inference_time"),
            func.sum(case((LLMMetrics.is_success == True, 1), else_=0)).label("success_count")
        )

        if project_id:
            query = query.where(LLMMetrics.project_id == project_id)
        if start_date:
            query = query.where(LLMMetrics.created_at >= start_date)
        if end_date:
            query = query.where(LLMMetrics.created_at <= end_date)

        result = await self.session.execute(query)
        row = result.one()

        return {
            "total_calls": row.total_calls or 0,
            "total_tokens": row.total_tokens or 0,
            "total_cost_usd": float(row.total_cost or 0),
            "avg_inference_time_ms": float(row.avg_inference_time or 0),
            "success_rate": (row.success_count / row.total_calls * 100) if row.total_calls else 0
        }

    async def get_by_provider(
        self,
        project_id: str | None = None
    ) -> list[dict]:
        """プロバイダー別集計"""
        query = select(
            LLMMetrics.provider,
            LLMMetrics.model,
            func.count(LLMMetrics.id).label("call_count"),
            func.sum(LLMMetrics.total_tokens).label("total_tokens"),
            func.sum(LLMMetrics.cost_usd).label("total_cost")
        ).group_by(LLMMetrics.provider, LLMMetrics.model)

        if project_id:
            query = query.where(LLMMetrics.project_id == project_id)

        result = await self.session.execute(query)
        return [
            {
                "provider": row.provider,
                "model": row.model,
                "call_count": row.call_count,
                "total_tokens": row.total_tokens,
                "total_cost_usd": float(row.total_cost or 0)
            }
            for row in result
        ]
```

---

## 3. ログ管理

### 3.1 構造化ログ

```python
# utils/logging.py
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    """JSON形式のログフォーマッター"""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }

        # 追加コンテキスト
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "project_id"):
            log_data["project_id"] = record.project_id

        # 例外情報
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, ensure_ascii=False)

def setup_logging(level: str = "INFO"):
    """ログ設定"""
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())

    logging.basicConfig(
        level=getattr(logging, level.upper()),
        handlers=[handler]
    )

# ログアダプター（コンテキスト付与）
class ContextAdapter(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        extra = kwargs.get("extra", {})
        extra.update(self.extra)
        kwargs["extra"] = extra
        return msg, kwargs

def get_logger(name: str, **context) -> ContextAdapter:
    logger = logging.getLogger(name)
    return ContextAdapter(logger, context)
```

### 3.2 リクエストログミドルウェア

```python
# middleware/logging.py
import time
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = get_logger(__name__)

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        start_time = time.time()

        # リクエストログ
        logger.info(
            f"Request started: {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client_ip": request.client.host if request.client else None
            }
        )

        try:
            response = await call_next(request)
            duration_ms = int((time.time() - start_time) * 1000)

            # レスポンスログ
            logger.info(
                f"Request completed: {response.status_code}",
                extra={
                    "request_id": request_id,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms
                }
            )

            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(
                f"Request failed: {str(e)}",
                extra={
                    "request_id": request_id,
                    "duration_ms": duration_ms,
                    "error": str(e)
                },
                exc_info=True
            )
            raise
```

---

## 4. ヘルスチェック

```python
# routers/health.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

router = APIRouter(tags=["health"])

@router.get("/health")
async def health_check(
    session: AsyncSession = Depends(get_session)
) -> dict:
    """ヘルスチェック"""
    checks = {
        "status": "healthy",
        "checks": {}
    }

    # DB接続チェック
    try:
        await session.execute(text("SELECT 1"))
        checks["checks"]["database"] = {"status": "healthy"}
    except Exception as e:
        checks["status"] = "unhealthy"
        checks["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }

    # LLM API チェック（オプション）
    try:
        from ..services.llm.factory import create_llm_service
        llm = create_llm_service()
        if not llm.is_mock:
            checks["checks"]["llm_api"] = {"status": "healthy", "mock": False}
        else:
            checks["checks"]["llm_api"] = {"status": "healthy", "mock": True}
    except Exception as e:
        checks["checks"]["llm_api"] = {
            "status": "degraded",
            "error": str(e)
        }

    return checks

@router.get("/health/ready")
async def readiness_check(
    session: AsyncSession = Depends(get_session)
) -> dict:
    """準備状態チェック（K8s readiness probe用）"""
    try:
        await session.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(status_code=503, detail="Not ready")

@router.get("/health/live")
async def liveness_check() -> dict:
    """生存チェック（K8s liveness probe用）"""
    return {"status": "alive"}
```

---

## 5. メトリクスAPI

```python
# routers/metrics.py
from fastapi import APIRouter, Depends, Query
from datetime import datetime, timedelta

router = APIRouter(prefix="/metrics", tags=["metrics"])

@router.get("/summary")
async def get_metrics_summary(
    project_id: str | None = None,
    days: int = Query(7, ge=1, le=90),
    recorder: MetricsRecorder = Depends(get_metrics_recorder)
) -> dict:
    """メトリクスサマリー"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    return await recorder.get_summary(
        project_id=project_id,
        start_date=start_date,
        end_date=end_date
    )

@router.get("/by-provider")
async def get_metrics_by_provider(
    project_id: str | None = None,
    recorder: MetricsRecorder = Depends(get_metrics_recorder)
) -> list[dict]:
    """プロバイダー別メトリクス"""
    return await recorder.get_by_provider(project_id=project_id)

@router.get("/timeline")
async def get_metrics_timeline(
    project_id: str | None = None,
    days: int = Query(7, ge=1, le=90),
    interval: str = Query("day", regex="^(hour|day|week)$"),
    recorder: MetricsRecorder = Depends(get_metrics_recorder)
) -> list[dict]:
    """時系列メトリクス"""
    return await recorder.get_timeline(
        project_id=project_id,
        days=days,
        interval=interval
    )
```

---

## 6. ダッシュボード用データ

```python
# services/dashboard_service.py

class DashboardService:
    """ダッシュボードデータサービス"""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.metrics = MetricsRecorder(session)

    async def get_overview(self) -> dict:
        """概要データ"""
        # プロジェクト統計
        project_count = await self.session.scalar(
            select(func.count(Project.id)).where(Project.is_deleted == False)
        )

        # 今日のメトリクス
        today = datetime.utcnow().date()
        today_metrics = await self.metrics.get_summary(
            start_date=datetime.combine(today, datetime.min.time())
        )

        # 今月のコスト
        month_start = today.replace(day=1)
        month_metrics = await self.metrics.get_summary(
            start_date=datetime.combine(month_start, datetime.min.time())
        )

        return {
            "project_count": project_count,
            "today": {
                "api_calls": today_metrics["total_calls"],
                "tokens_used": today_metrics["total_tokens"],
                "cost_usd": today_metrics["total_cost_usd"]
            },
            "month": {
                "cost_usd": month_metrics["total_cost_usd"],
                "tokens_used": month_metrics["total_tokens"]
            }
        }
```

---

## 7. アラート設定

```python
# services/alerting.py
from dataclasses import dataclass
from typing import Callable

@dataclass
class AlertRule:
    name: str
    condition: Callable[[dict], bool]
    message: str
    severity: str  # info, warning, critical

class AlertService:
    def __init__(self):
        self.rules: list[AlertRule] = []
        self._setup_default_rules()

    def _setup_default_rules(self):
        # コスト閾値
        self.rules.append(AlertRule(
            name="high_daily_cost",
            condition=lambda m: m.get("daily_cost_usd", 0) > 100,
            message="Daily LLM cost exceeded $100",
            severity="warning"
        ))

        # エラー率
        self.rules.append(AlertRule(
            name="high_error_rate",
            condition=lambda m: m.get("error_rate", 0) > 0.1,
            message="LLM error rate exceeded 10%",
            severity="critical"
        ))

        # 推論時間
        self.rules.append(AlertRule(
            name="slow_inference",
            condition=lambda m: m.get("avg_inference_time_ms", 0) > 60000,
            message="Average inference time exceeded 60 seconds",
            severity="warning"
        ))

    async def check_alerts(self, metrics: dict) -> list[dict]:
        """アラートチェック"""
        triggered = []
        for rule in self.rules:
            if rule.condition(metrics):
                triggered.append({
                    "name": rule.name,
                    "message": rule.message,
                    "severity": rule.severity,
                    "metrics": metrics
                })
        return triggered
```

---

## 8. 関連ドキュメント

- [02-LLM-INTEGRATION.md](./02-LLM-INTEGRATION.md) - LLMコスト追跡
- [06-API-DESIGN.md](./06-API-DESIGN.md) - メトリクスAPI
- [09-CONFIGURATION.md](./09-CONFIGURATION.md) - ログ設定
