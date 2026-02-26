from pydantic import BaseModel, Field, field_validator, model_validator


SYNC_DOMAINS = {'analytics', 'cartera', 'cobranzas', 'contratos', 'gestores'}


class SyncRunIn(BaseModel):
    domain: str = Field(min_length=3, max_length=32)
    year_from: int | None = Field(default=None)
    close_month: str | None = Field(default=None)
    close_month_from: str | None = Field(default=None)
    close_month_to: str | None = Field(default=None)

    @field_validator('domain')
    @classmethod
    def validate_domain(cls, value: str) -> str:
        normalized = str(value or '').strip().lower()
        if normalized not in SYNC_DOMAINS:
            raise ValueError(f'dominio invalido: {value}')
        return normalized

    @field_validator('year_from')
    @classmethod
    def validate_year(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value < 2000 or value > 2100:
            raise ValueError('year_from fuera de rango permitido')
        return value

    @field_validator('close_month')
    @classmethod
    def validate_close_month(cls, value: str | None) -> str | None:
        return cls._normalize_mm_yyyy(value, 'close_month')

    @field_validator('close_month_from')
    @classmethod
    def validate_close_month_from(cls, value: str | None) -> str | None:
        return cls._normalize_mm_yyyy(value, 'close_month_from')

    @field_validator('close_month_to')
    @classmethod
    def validate_close_month_to(cls, value: str | None) -> str | None:
        return cls._normalize_mm_yyyy(value, 'close_month_to')

    @model_validator(mode='after')
    def validate_range(self) -> 'SyncRunIn':
        has_from = bool(self.close_month_from)
        has_to = bool(self.close_month_to)
        if has_from != has_to:
            raise ValueError('Para rango de cierre debe indicar desde y hasta (MM/YYYY).')
        if has_from and has_to:
            from_month = self._month_serial(self.close_month_from or '')
            to_month = self._month_serial(self.close_month_to or '')
            if from_month > to_month:
                raise ValueError('Rango de cierre invalido: desde no puede ser mayor que hasta.')
        return self

    @staticmethod
    def _month_serial(value: str) -> int:
        parts = value.split('/')
        month = int(parts[0]) if len(parts) > 0 and parts[0].isdigit() else 0
        year = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
        return year * 12 + month

    @staticmethod
    def _normalize_mm_yyyy(value: str | None, field_name: str) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        parts = text.split('/')
        if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
            raise ValueError(f'{field_name} invalido, formato esperado MM/YYYY')
        month = int(parts[0])
        year = int(parts[1])
        if month < 1 or month > 12:
            raise ValueError(f'{field_name} invalido, mes fuera de rango')
        if year < 2000 or year > 2100:
            raise ValueError(f'{field_name} invalido, anio fuera de rango')
        return f'{month:02d}/{year}'


class SyncRunOut(BaseModel):
    job_id: str
    domain: str
    mode: str
    year_from: int | None = None
    close_month: str | None = None
    close_month_from: str | None = None
    close_month_to: str | None = None
    target_table: str | None = None
    started_at: str
    status: str = 'accepted'


class SyncStatusOut(BaseModel):
    job_id: str | None = None
    domain: str
    running: bool = False
    stage: str | None = None
    progress_pct: int = 0
    status_message: str | None = None
    mode: str | None = None
    year_from: int | None = None
    close_month: str | None = None
    close_month_from: str | None = None
    close_month_to: str | None = None
    rows_inserted: int = 0
    rows_updated: int = 0
    rows_skipped: int = 0
    rows_read: int = 0
    rows_upserted: int = 0
    rows_unchanged: int = 0
    throughput_rows_per_sec: float | None = None
    eta_seconds: int | None = None
    current_query_file: str | None = None
    job_step: str | None = None
    queue_position: int | None = None
    watermark: dict | None = None
    chunk_key: str | None = None
    chunk_status: str | None = None
    skipped_unchanged_chunks: int = 0
    affected_months: list[str] = Field(default_factory=list)
    target_table: str | None = None
    agg_refresh_started: bool = False
    agg_refresh_completed: bool = False
    agg_rows_written: int = 0
    agg_duration_sec: float | None = None
    duplicates_detected: int = 0
    error: str | None = None
    log: list[str] = Field(default_factory=list)
    started_at: str | None = None
    finished_at: str | None = None
    duration_sec: float | None = None


class SyncPerfSummaryOut(BaseModel):
    generated_at: str
    totals: dict[str, int | float]
    by_domain: dict[str, dict[str, int | float]]
    top_slowest_jobs: list[dict[str, str | int | float | None]] = Field(default_factory=list)


class SyncPreviewOut(BaseModel):
    domain: str
    mode: str
    year_from: int | None = None
    close_month: str | None = None
    close_month_from: str | None = None
    close_month_to: str | None = None
    estimated_rows: int
    max_rows_allowed: int | None = None
    would_exceed_limit: bool = False
    sampled: bool = False
    scan_mode: str = 'full'
    sample_rows: int = 0
    estimate_confidence: str = 'high'
    estimated_duration_sec: int | None = None
    risk_level: str = 'low'


class SyncWatermarkOut(BaseModel):
    domain: str
    query_file: str
    partition_key: str
    last_updated_at: str | None = None
    last_source_id: str | None = None
    last_success_job_id: str | None = None
    last_row_count: int = 0
    updated_at: str | None = None


class SyncWatermarkResetIn(BaseModel):
    domain: str = Field(min_length=3, max_length=32)
    query_file: str | None = None
    partition_key: str | None = None

    @field_validator('domain')
    @classmethod
    def validate_domain_reset(cls, value: str) -> str:
        normalized = str(value or '').strip().lower()
        if normalized not in SYNC_DOMAINS:
            raise ValueError(f'dominio invalido: {value}')
        return normalized


class SyncWatermarkResetOut(BaseModel):
    domain: str
    query_file: str | None = None
    partition_key: str | None = None
    deleted: int = 0


class SyncChunkLogOut(BaseModel):
    chunk_key: str
    stage: str
    status: str
    rows: int
    duration_sec: float
    throughput_rows_per_sec: float
    details: dict = Field(default_factory=dict)
    created_at: str | None = None


class SyncChunkLogsOut(BaseModel):
    job_id: str
    domain: str | None = None
    chunks: list[SyncChunkLogOut] = Field(default_factory=list)
