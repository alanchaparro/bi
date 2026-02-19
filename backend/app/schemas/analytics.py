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
    meta: dict[str, str]
