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
