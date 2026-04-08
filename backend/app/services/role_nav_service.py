from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.role_nav import (
    ALL_NAV_IDS,
    ALL_NAV_IDS_SET,
    CONFIG_SUBNAV_IDS,
    DEFAULT_NAV_IDS_BY_ROLE,
    KNOWN_ROLES,
    NAV_LABELS,
)
from app.models.brokers import AuthRoleNav


def get_nav_ids_for_role(db: Session, role: str) -> list[str]:
    r = (role or 'viewer').strip().lower() or 'viewer'
    rows = db.query(AuthRoleNav).filter(AuthRoleNav.role == r).all()
    if rows:
        raw_ids = {row.nav_id for row in rows}
        out = sorted({nid for nid in raw_ids if nid in ALL_NAV_IDS_SET})
        # Legado: fila nav_id=config (previo a secciones finas); ya no está en ALL_NAV_IDS.
        if 'config' in raw_ids:
            out = sorted(set(out) | set(CONFIG_SUBNAV_IDS))
        # Misma regla que replace_nav_for_role: admin siempre ve Configuración completa.
        if r == 'admin':
            out = sorted(set(out) | set(CONFIG_SUBNAV_IDS))
        return out
    default = DEFAULT_NAV_IDS_BY_ROLE.get(r) or DEFAULT_NAV_IDS_BY_ROLE['viewer']
    return list(default)


def get_matrix(db: Session) -> dict:
    nav_by_role = {role: get_nav_ids_for_role(db, role) for role in KNOWN_ROLES}
    nav_items = [{'id': nid, 'label': NAV_LABELS.get(nid, nid)} for nid in ALL_NAV_IDS]
    return {
        'roles': list(KNOWN_ROLES),
        'nav_items': nav_items,
        'nav_by_role': nav_by_role,
    }


def replace_nav_for_role(db: Session, role: str, nav_ids: list[str], actor: str) -> list[str]:
    r = (role or '').strip().lower()
    if r not in KNOWN_ROLES:
        raise ValueError(f'Rol no válido: {role}')
    clean = sorted({n for n in nav_ids if n in ALL_NAV_IDS_SET})
    # El rol admin conserva todas las secciones de Configuración.
    if r == 'admin':
        clean = sorted(set(clean) | set(CONFIG_SUBNAV_IDS))
    db.query(AuthRoleNav).filter(AuthRoleNav.role == r).delete()
    for nid in clean:
        db.add(AuthRoleNav(role=r, nav_id=nid))
    db.commit()
    return clean


def replace_matrix(db: Session, nav_by_role: dict[str, list[str]], actor: str) -> dict:
    normalized: dict[str, list[str]] = {}
    for k, v in nav_by_role.items():
        rk = k.strip().lower()
        if rk not in KNOWN_ROLES:
            raise ValueError(f'Rol no válido en payload: {k}')
        normalized[rk] = list(v)
    for role in KNOWN_ROLES:
        if role not in normalized:
            raise ValueError('nav_by_role debe incluir admin, analyst y viewer')
        replace_nav_for_role(db, role, normalized[role], actor)
    return get_matrix(db)
