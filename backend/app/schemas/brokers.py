from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    role: str
    permissions: list[str]


class SupervisorsScopeIn(BaseModel):
    supervisors: list[str] = Field(default_factory=list)


class SupervisorsScopeOut(BaseModel):
    supervisors: list[str] = Field(default_factory=list)


class RulesIn(BaseModel):
    rules: list[dict] = Field(default_factory=list)


class RulesOut(BaseModel):
    rules: list[dict] = Field(default_factory=list)
