from __future__ import annotations


def _to_float(value: object) -> float:
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0


def monto_a_cobrar(monto_vencido: object, monto_cuota: object) -> float:
    return _to_float(monto_vencido) + _to_float(monto_cuota)
