from __future__ import annotations

from app.domain.portfolio_rules import monto_a_cobrar


def _safe_pct(numerator: object, denominator: object) -> float:
    try:
        num = float(numerator or 0.0)
        den = float(denominator or 0.0)
    except (TypeError, ValueError):
        return 0.0
    if den <= 0.0:
        return 0.0
    return num / den


def rendimiento_monto_pct(cobrado: object, monto_vencido: object, monto_cuota: object) -> float:
    return _safe_pct(cobrado, monto_a_cobrar(monto_vencido, monto_cuota))


def rendimiento_cantidad_pct(contratos_con_cobro: object, contratos_por_cobrar: object) -> float:
    return _safe_pct(contratos_con_cobro, contratos_por_cobrar)
