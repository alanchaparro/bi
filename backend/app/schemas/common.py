from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    error_code: str
    message: str
    details: dict | str | None = None
    trace_id: str | None = None


class MessageOut(BaseModel):
    ok: bool = True
    message: str = 'ok'
