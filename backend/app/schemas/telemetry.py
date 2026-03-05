from datetime import datetime

from pydantic import BaseModel, Field


class FrontendApiCallMetric(BaseModel):
    endpoint: str = Field(min_length=1, max_length=256)
    ms: float = Field(ge=0.0)
    cache_hit: bool | None = None
    bytes: int | None = Field(default=None, ge=0)


class FrontendPerfIn(BaseModel):
    route: str = Field(pattern='^(cartera|cohorte|rendimiento|anuales|brokers)$')
    session_id: str = Field(min_length=8, max_length=128)
    trace_id: str | None = Field(default=None, max_length=128)
    ttfb_ms: float | None = Field(default=None, ge=0.0)
    fcp_ms: float | None = Field(default=None, ge=0.0)
    ready_ms: float = Field(ge=0.0)
    api_calls: list[FrontendApiCallMetric] = Field(default_factory=list)
    timestamp_utc: datetime
    app_version: str = Field(default='dev', min_length=1, max_length=64)


class FrontendPerfSummaryQuery(BaseModel):
    route: str | None = Field(default=None, pattern='^(cartera|cohorte|rendimiento|anuales|brokers)$')
    from_utc: datetime | None = None
    to_utc: datetime | None = None
    limit: int = Field(default=5000, ge=100, le=50000)
