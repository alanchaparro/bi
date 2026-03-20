from __future__ import annotations

ENTERPRISE_SCOPE_IDS = (1, 2, 5)
COBRANZAS_EXCLUDED_CONTRACT_IDS = (55411, 55414, 59127, 59532, 60402)


def enterprise_in_scope(enterprise_id: object) -> bool:
    try:
        return int(enterprise_id) in ENTERPRISE_SCOPE_IDS
    except (TypeError, ValueError):
        return False


def contract_is_excluded_from_cobranzas(contract_id: object) -> bool:
    try:
        return int(contract_id) in COBRANZAS_EXCLUDED_CONTRACT_IDS
    except (TypeError, ValueError):
        return False
