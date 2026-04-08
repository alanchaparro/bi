"""Ids de menú lateral (alineados con frontend/src/config/routes.ts NAV_ITEMS)."""

from __future__ import annotations

# Orden estable para matrices en UI y API.
CONFIG_SUBNAV_IDS: tuple[str, ...] = (
    'config_usuarios',
    'config_roles_menus',
    'config_layouts_filtros',
    'config_negocio',
    'config_importaciones',
    'config_programacion',
)

ALL_NAV_IDS: tuple[str, ...] = (
    'cartera',
    'analisisCartera',
    'roloCartera',
    'analisisCarteraAnuales',
    'analisisCarteraRendimiento',
    'analisisCobranzaCohorte',
    'eerr',
) + CONFIG_SUBNAV_IDS

NAV_LABELS: dict[str, str] = {
    'cartera': 'Resumen de Cartera',
    'analisisCartera': 'Análisis de Cartera',
    'roloCartera': 'Rolo de Cartera',
    'analisisCarteraAnuales': 'Análisis Anuales',
    'analisisCarteraRendimiento': 'Rendimiento de Cartera',
    'analisisCobranzaCohorte': 'Análisis Cobranzas Corte',
    'eerr': 'EERR',
    'config_usuarios': 'Config.: usuarios y roles',
    'config_roles_menus': 'Config.: roles y menús',
    'config_layouts_filtros': 'Config.: layouts de filtros',
    'config_negocio': 'Config.: negocio y apariencia',
    'config_importaciones': 'Config.: importaciones (MySQL)',
    'config_programacion': 'Config.: programación sync',
}

# Hasta que existan filas en auth_role_nav, se usa este mapa (paridad con sidebar sin BD).
DEFAULT_NAV_IDS_BY_ROLE: dict[str, tuple[str, ...]] = {
    'admin': ALL_NAV_IDS,
    'analyst': ALL_NAV_IDS,
    'viewer': ALL_NAV_IDS,
}

KNOWN_ROLES: tuple[str, ...] = tuple(DEFAULT_NAV_IDS_BY_ROLE.keys())

ALL_NAV_IDS_SET = frozenset(ALL_NAV_IDS)
