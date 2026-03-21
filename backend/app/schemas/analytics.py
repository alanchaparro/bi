from pydantic import BaseModel, Field, field_validator


def _is_month(v: str) -> bool:
    if not isinstance(v, str):
        return False
    parts = v.split('/')
    if len(parts) != 2:
        return False
    m, y = parts
    return m.isdigit() and y.isdigit() and len(y) == 4 and 1 <= int(m) <= 12


class AnalyticsFilters(BaseModel):
    un: list[str] = Field(default_factory=list)
    anio: list[str] = Field(default_factory=list)
    gestion_month: list[str] = Field(default_factory=list)
    contract_month: list[str] = Field(default_factory=list)
    close_month: list[str] = Field(default_factory=list)
    via_cobro: list[str] = Field(default_factory=list)
    via_pago: list[str] = Field(default_factory=list)
    categoria: list[str] = Field(default_factory=list)
    supervisor: list[str] = Field(default_factory=list)
    tramo: list[str] = Field(default_factory=list)

    @field_validator('gestion_month', 'contract_month', 'close_month')
    @classmethod
    def validate_months(cls, values: list[str]):
        for v in values:
            if not _is_month(v):
                raise ValueError(f'mes inválido: {v}')
        return values

    @field_validator('anio')
    @classmethod
    def validate_years(cls, values: list[str]):
        for v in values:
            if not (str(v).isdigit() and len(str(v)) == 4):
                raise ValueError(f'año inválido: {v}')
        return values


class ExportRequest(BaseModel):
    format: str | None = Field(default=None, pattern='^(csv|pdf)$')
    endpoint: str = Field(min_length=3, max_length=64)
    filters: AnalyticsFilters = Field(default_factory=AnalyticsFilters)


class PortfolioSummaryIn(AnalyticsFilters):
    include_rows: bool = Field(default=False)


class PortfolioOptionsOut(BaseModel):
    options: dict[str, list[str]]
    meta: dict[str, str | bool | None]


class PortfolioCorteOptionsOut(BaseModel):
    options: dict[str, list[str]]
    meta: dict[str, str | bool | None]


class PortfolioCorteSummaryOut(BaseModel):
    kpis: dict[str, float | int]
    charts: dict[str, dict]
    meta: dict[str, str | bool | None]


class PortfolioRoloSummaryOut(BaseModel):
    kpis: dict[str, float | int | str | None]
    charts: dict[str, dict]
    rows: list[dict[str, str | float | int]]
    meta: dict[str, str | bool | None]


class CobranzasCohorteIn(BaseModel):
    cutoff_month: str | None = None
    un: list[str] = Field(default_factory=list)
    via_cobro: list[str] = Field(default_factory=list)
    categoria: list[str] = Field(default_factory=list)
    supervisor: list[str] = Field(default_factory=list)

    @field_validator('cutoff_month')
    @classmethod
    def validate_cutoff_month(cls, value: str | None):
        if value is None or value == '':
            return None
        if not _is_month(value):
            raise ValueError(f'mes inválido: {value}')
        return value


class CobranzasCohorteOptionsOut(BaseModel):
    options: dict[str, list[str]]
    default_cutoff: str | None = None
    meta: dict[str, str | bool | None]


class CobranzasCohorteFirstPaintIn(CobranzasCohorteIn):
    top_n_sale_months: int = Field(default=12, ge=1, le=36)


class CobranzasCohorteDetailIn(CobranzasCohorteIn):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=24, ge=1, le=120)
    sort_by: str = Field(default='sale_month', pattern='^(sale_month|cobrado|deberia|pagaron)$')
    sort_dir: str = Field(default='asc', pattern='^(asc|desc)$')
