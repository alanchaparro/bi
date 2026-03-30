from __future__ import annotations

from .payload_access import payload_coalesce_numeric


def _to_float(value: object) -> float:
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _to_int_safe(value: object) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def monto_vencido_para_monto_a_cobrar(
    cuotas_vencidas: object,
    monto_vencido: object,
    monto_cuota: object,
    quotas_amount_plazo_original: object,
) -> float:
    """
    AGENTS.md 5.1: con cuotas_vencidas >= 7, acota monto_vencido a la primera vuelta
    (quotas_amount * monto_cuota) si el extracto no desglosa mora por ciclo.
    """
    raw = _to_float(monto_vencido)
    if _to_int_safe(cuotas_vencidas) < 7:
        return raw
    qc = _to_float(monto_cuota)
    n = _to_float(quotas_amount_plazo_original)
    if n <= 0.0 or qc <= 0.0:
        return raw
    cap = n * qc
    return min(raw, cap)


def monto_a_cobrar(monto_vencido: object, monto_cuota: object) -> float:
    return _to_float(monto_vencido) + _to_float(monto_cuota)


def deberia_cartera_from_payload(
    payload: dict | None,
    monto_vencido_col: object,
    monto_cuota_col: object,
) -> float:
    """
    monto_a_cobrar coherente con AGENTS 5.1 usando el JSON de cartera (MySQL) y columnas como respaldo.
    Aplica en API/cohortes aunque `cartera_fact.monto_vencido` esté desactualizado.
    """
    payload = dict(payload or {})
    mc_val = payload_coalesce_numeric(payload, "monto_cuota", "cuota")
    mc = _to_float(mc_val) if mc_val is not None else _to_float(monto_cuota_col)
    mv_val = payload_coalesce_numeric(payload, "monto_vencido", "expired_amount", "capital_vencido")
    mv_raw = _to_float(mv_val) if mv_val is not None else _to_float(monto_vencido_col)
    cv_raw = payload_coalesce_numeric(payload, "cuotas_vencidas", "quotas_expirations")
    plazo = payload_coalesce_numeric(payload, "periodo_cuotas", "quotas_amount")
    mv_eff = monto_vencido_para_monto_a_cobrar(cv_raw, mv_raw, mc, plazo)
    return monto_a_cobrar(mv_eff, mc)
