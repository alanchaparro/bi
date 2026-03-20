from __future__ import annotations

from sqlalchemy import case, literal

VIGENTE_CATEGORY = "VIGENTE"
MOROSO_CATEGORY = "MOROSO"
TRAMO_CAP = 7


def normalize_tramo(value: object) -> int:
    try:
        tramo = int(float(value or 0))
    except (TypeError, ValueError):
        tramo = 0
    if tramo <= 0:
        return 0
    if tramo >= TRAMO_CAP:
        return TRAMO_CAP
    return tramo


def tramo_from_cuotas_vencidas(cuotas_vencidas: object) -> int:
    return normalize_tramo(cuotas_vencidas)


def categoria_from_tramo(tramo: object) -> str:
    tramo_num = normalize_tramo(tramo)
    return MOROSO_CATEGORY if tramo_num > 3 else VIGENTE_CATEGORY


def category_expr_for_tramo(tramo_column):
    return case((tramo_column > 3, literal(MOROSO_CATEGORY)), else_=literal(VIGENTE_CATEGORY))
