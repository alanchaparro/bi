from typing import Literal

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = 'bearer'
    role: str
    permissions: list[str]


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=1024)


class RevokeIn(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=1024)


class SupervisorsScopeIn(BaseModel):
    supervisors: list[str] = Field(default_factory=list)


class SupervisorsScopeOut(BaseModel):
    supervisors: list[str] = Field(default_factory=list)


class RulesIn(BaseModel):
    rules: list[dict] = Field(default_factory=list)


class RulesOut(BaseModel):
    rules: list[dict] = Field(default_factory=list)


class BrokersFilters(BaseModel):
    supervisors: list[str] = Field(default_factory=list)
    uns: list[str] = Field(default_factory=list)
    vias: list[str] = Field(default_factory=list)
    years: list[str] = Field(default_factory=list)
    months: list[str] = Field(default_factory=list)
    categorias: list[str] = Field(default_factory=list)
    tramos: list[str] = Field(default_factory=list)


class BrokersPreferencesIn(BaseModel):
    filters: BrokersFilters = Field(default_factory=BrokersFilters)


class BrokersPreferencesOut(BaseModel):
    filters: BrokersFilters = Field(default_factory=BrokersFilters)


class CarteraTramoRule(BaseModel):
    un: str = Field(min_length=1, max_length=128)
    category: str = Field(min_length=1, max_length=16)
    tramos: list[int] = Field(default_factory=list)


class CarteraTramoRulesIn(BaseModel):
    rules: list[CarteraTramoRule] = Field(default_factory=list)


class CarteraTramoRulesOut(BaseModel):
    rules: list[CarteraTramoRule] = Field(default_factory=list)


class CarteraUnsOut(BaseModel):
    uns: list[str] = Field(default_factory=list)


class AuthUserItemOut(BaseModel):
    username: str
    role: str
    is_active: bool
    created_at: str | None = None
    updated_at: str | None = None


class AuthUsersOut(BaseModel):
    users: list[AuthUserItemOut] = Field(default_factory=list)


class AuthUserCreateIn(BaseModel):
    username: str = Field(min_length=3, max_length=128)
    password: str = Field(min_length=6, max_length=256)
    role: str = Field(default='viewer', min_length=3, max_length=32)
    is_active: bool = True


class AuthUserUpdateIn(BaseModel):
    role: str | None = Field(default=None, min_length=3, max_length=32)
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=256)


class RoleNavItemMeta(BaseModel):
    id: str
    label: str


class RoleNavMatrixOut(BaseModel):
    roles: list[str]
    nav_items: list[RoleNavItemMeta]
    nav_by_role: dict[str, list[str]]


class RoleNavMatrixPutIn(BaseModel):
    nav_by_role: dict[str, list[str]]


class MysqlConnectionIn(BaseModel):
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=3306, ge=1, le=65535)
    user: str = Field(min_length=1, max_length=128)
    password: str = Field(default='', max_length=256)
    database: str = Field(min_length=1, max_length=255)
    ssl_disabled: bool = True


class MysqlConnectionOut(BaseModel):
    host: str
    port: int
    user: str
    password: str
    database: str
    ssl_disabled: bool = True


class MysqlConnectionTestOut(BaseModel):
    ok: bool
    message: str
    latency_ms: int | None = None


class FilterSlotStyleOut(BaseModel):
    column_span: int | None = None
    min_width_px: int | None = None
    control_scale: str | None = None
    low_cardinality_control: str | None = None
    un_control: str | None = None


class SectionLayoutOut(BaseModel):
    macro: list[str] = Field(default_factory=list)
    micro: list[str] = Field(default_factory=list)
    floating: list[str] = Field(default_factory=list)
    grid_class_macro: str | None = None
    grid_class_micro: str | None = None
    slot_styles: dict[str, FilterSlotStyleOut] = Field(default_factory=dict)


class DashboardFilterLayoutsOut(BaseModel):
    version: Literal[1] = 1
    sections: dict[str, SectionLayoutOut] = Field(default_factory=dict)


class FilterSlotStyleIn(BaseModel):
    column_span: int | None = Field(default=None, ge=1, le=4)
    min_width_px: int | None = Field(default=None, ge=72, le=420)
    control_scale: str | None = Field(default=None, max_length=32)
    low_cardinality_control: str | None = Field(default=None, max_length=32)
    un_control: str | None = Field(default=None, max_length=32)


class SectionLayoutIn(BaseModel):
    macro: list[str] = Field(default_factory=list)
    micro: list[str] = Field(default_factory=list)
    # None = omitido en JSON (migración → defaults en normalize); [] = FAB sin filtros.
    floating: list[str] | None = Field(default=None)
    grid_class_macro: str | None = Field(default=None, max_length=120)
    grid_class_micro: str | None = Field(default=None, max_length=120)
    slot_styles: dict[str, FilterSlotStyleIn] = Field(default_factory=dict)


class DashboardFilterLayoutsPutIn(BaseModel):
    version: int = 1
    sections: dict[str, SectionLayoutIn] = Field(default_factory=dict)
