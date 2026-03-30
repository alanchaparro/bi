from __future__ import annotations


def payload_get_ci(data: dict | None, *candidates: str) -> object | None:
    """
    Devuelve el primer valor presente en `data` probando cada nombre en `candidates`,
    con coincidencia insensible a mayúsculas (útil para filas MySQL -> JSON).
    """
    if not isinstance(data, dict) or not data:
        return None
    for key in candidates:
        if key in data:
            val = data.get(key)
            if val is not None and not (isinstance(val, str) and not str(val).strip()):
                return val
    lower = {str(k).lower(): k for k in data.keys()}
    for key in candidates:
        resolved = lower.get(key.lower())
        if resolved is not None:
            val = data.get(resolved)
            if val is not None and not (isinstance(val, str) and not str(val).strip()):
                return val
    return None


def payload_coalesce_numeric(data: dict | None, *candidates: str) -> object | None:
    """Primer campo de `candidates` con valor numérico presente (vía payload_get_ci por nombre)."""
    for name in candidates:
        val = payload_get_ci(data, name)
        if val is not None:
            return val
    return None
