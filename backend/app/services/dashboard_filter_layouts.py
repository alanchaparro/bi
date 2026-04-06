"""Normalización de layouts de filtros del dashboard (persistidos en user_preferences)."""

from __future__ import annotations

import re

PREF_KEY = 'dashboard_filter_layouts_v1'

# Espejo de frontend/src/config/analyticsFilterLayouts.ts — validar contra estos pools por sección.
DEFAULT_LAYOUTS: dict[str, dict[str, list[str]]] = {
    'cartera': {
        'macro': ['un', 'via_cobro', 'categoria', 'tramo'],
        'micro': ['gestion_month', 'contract_year', 'supervisor'],
        'floating': ['gestion_month', 'un'],
    },
    'analisisCartera': {
        'macro': ['un', 'via_cobro', 'categoria', 'tramo'],
        'micro': ['gestion_month', 'close_month', 'contract_year', 'supervisor'],
        'floating': ['gestion_month', 'close_month', 'un'],
    },
    'roloCartera': {
        'macro': ['un', 'via_cobro'],
        'micro': ['close_month', 'contract_year', 'supervisor'],
        'floating': ['close_month', 'un'],
    },
    'analisisCarteraAnuales': {
        'macro': ['un'],
        'micro': ['contract_year', 'contract_month_combo'],
        'floating': ['un', 'contract_year', 'contract_month_combo'],
    },
    'analisisCarteraRendimiento': {
        'macro': ['un', 'via_cobro', 'via_pago', 'categoria', 'tramo'],
        'micro': ['gestion_month', 'supervisor'],
        'floating': ['gestion_month', 'un', 'via_cobro', 'categoria'],
    },
    'analisisCobranzaCohorte': {
        'macro': [
            'cobro_cutoff_month',
            'via_cobro',
            'supervisor',
            'categoria',
            'un',
        ],
        'micro': [],
        'floating': ['cobro_cutoff_month', 'un', 'via_cobro', 'categoria'],
    },
}

_GRID_CLASS_RE = re.compile(r'^[a-zA-Z][a-zA-Z0-9_-]{0,119}$')


def _pool_for_section(section_id: str) -> set[str]:
    d = DEFAULT_LAYOUTS.get(section_id) or {}
    return set(d.get('macro', []) + d.get('micro', []) + d.get('floating', []))


def _dedupe_preserve(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in seq:
        s = str(x).strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def normalize_dashboard_filter_layouts_payload(raw: dict | None) -> dict:
    """Devuelve { 'version': 1, 'sections': { sid: { macro, micro, grid_class_*, slot_styles } } }."""
    if not isinstance(raw, dict):
        raw = {}
    version = raw.get('version')
    if version not in (None, 1):
        version = 1
    sections_in = raw.get('sections')
    if not isinstance(sections_in, dict):
        sections_in = {}
    out_sections: dict[str, dict] = {}

    for sid, body in sections_in.items():
        sid_s = str(sid).strip()
        if sid_s not in DEFAULT_LAYOUTS:
            continue
        if not isinstance(body, dict):
            continue
        pool = _pool_for_section(sid_s)
        macro = _dedupe_preserve([x for x in (body.get('macro') or []) if str(x).strip() in pool])
        micro = _dedupe_preserve([x for x in (body.get('micro') or []) if str(x).strip() in pool])
        floating_raw = body.get('floating')
        if floating_raw is None:
            canon_f = (DEFAULT_LAYOUTS.get(sid_s) or {}).get('floating') or []
            floating = _dedupe_preserve([x for x in canon_f if str(x).strip() in pool])
        else:
            floating = _dedupe_preserve(
                [x for x in (floating_raw or []) if str(x).strip() in pool]
            )
        used = set(macro) | set(micro) | set(floating)
        if not used:
            continue

        gcm = body.get('grid_class_macro')
        gci = body.get('grid_class_micro')
        grid_class_macro = str(gcm).strip() if gcm else None
        grid_class_micro = str(gci).strip() if gci else None
        if grid_class_macro and not _GRID_CLASS_RE.match(grid_class_macro):
            grid_class_macro = None
        if grid_class_micro and not _GRID_CLASS_RE.match(grid_class_micro):
            grid_class_micro = None

        slot_styles_in = body.get('slot_styles') or {}
        slot_styles: dict[str, dict] = {}
        if isinstance(slot_styles_in, dict):
            for k, v in slot_styles_in.items():
                key = str(k).strip()
                if key not in used:
                    continue
                if not isinstance(v, dict):
                    continue
                style: dict = {}
                cs = v.get('column_span')
                if cs is not None:
                    try:
                        n = int(cs)
                        if 2 <= n <= 4:
                            style['column_span'] = n
                    except (TypeError, ValueError):
                        pass
                mw = v.get('min_width_px')
                if mw is not None:
                    try:
                        mwi = int(mw)
                        if 72 <= mwi <= 420:
                            style['min_width_px'] = mwi
                    except (TypeError, ValueError):
                        pass
                sc_raw = v.get('control_scale')
                if isinstance(sc_raw, str):
                    sc = sc_raw.strip().lower()
                    if sc in ('compact', 'comfortable'):
                        style['control_scale'] = sc
                lc_raw = v.get('low_cardinality_control')
                if isinstance(lc_raw, str) and lc_raw.strip().lower() == 'multi_dropdown':
                    style['low_cardinality_control'] = 'multi_dropdown'
                uc_raw = v.get('un_control')
                if isinstance(uc_raw, str):
                    ucl = uc_raw.strip().lower()
                    if ucl in ('tags_split_row', 'multi_dropdown'):
                        style['un_control'] = ucl
                if style:
                    slot_styles[key] = style

        entry: dict = {'macro': macro, 'micro': micro, 'floating': floating}
        if grid_class_macro:
            entry['grid_class_macro'] = grid_class_macro
        if grid_class_micro:
            entry['grid_class_micro'] = grid_class_micro
        if slot_styles:
            entry['slot_styles'] = slot_styles
        out_sections[sid_s] = entry

    return {'version': 1, 'sections': out_sections}
