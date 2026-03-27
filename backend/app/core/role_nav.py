"""Ids de menú lateral (alineados con frontend/src/config/routes.ts NAV_ITEMS)."""

from __future__ import annotations

# Orden estable para matrices en UI y API.
ALL_NAV_IDS: tuple[str, ...] = (
    'cartera',
    'analisisCartera',
    'roloCartera',
    'analisisCarteraAnuales',
    'analisisCarteraRendimiento',
    'analisisCobranzaCohorte',
    'config',
)

NAV_LABELS: dict[str, str] = {
    'cartera': 'Resumen de Cartera',
    'analisisCartera': 'Análisis de Cartera',
    'roloCartera': 'Rolo de Cartera',
    'analisisCarteraAnuales': 'Análisis Anuales',
    'analisisCarteraRendimiento': 'Rendimiento de Cartera',
    'analisisCobranzaCohorte': 'Análisis Cobranzas Corte',
    'config': 'Configuración',
}

# Hasta que existan filas en auth_role_nav, se usa este mapa (paridad con sidebar sin BD).
DEFAULT_NAV_IDS_BY_ROLE: dict[str, tuple[str, ...]] = {
    'admin': ALL_NAV_IDS,
    'analyst': ALL_NAV_IDS,
    'viewer': ALL_NAV_IDS,
}

KNOWN_ROLES: tuple[str, ...] = tuple(DEFAULT_NAV_IDS_BY_ROLE.keys())

ALL_NAV_IDS_SET = frozenset(ALL_NAV_IDS)
