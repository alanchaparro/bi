from __future__ import annotations


def normalize_un(value: object) -> str:
    return str(value or "S/D").strip().upper() or "S/D"


def default_un_mappings() -> list[tuple[str, str]]:
    return [
        ("ODONTOLOGIA", "ODONTOLOGIA"),
        ("ODONTOLOGIA TTO", "ODONTOLOGIA TTO"),
    ]


def canonical_un(un_map: dict[str, str], value: object) -> str:
    raw = normalize_un(value)
    return str(un_map.get(raw) or raw)


def canonical_via(value: object) -> str:
    raw = str(value or "").strip().upper()
    if raw == "COBRADOR" or "COBR" in raw:
        return "COBRADOR"
    return "DEBITO"
