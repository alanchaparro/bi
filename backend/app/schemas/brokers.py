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
