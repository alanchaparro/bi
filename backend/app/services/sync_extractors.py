from __future__ import annotations

import logging
import re
from pathlib import Path

from app.core.config import settings
from app.domain.exclusion_rules import COBRANZAS_EXCLUDED_CONTRACT_IDS, ENTERPRISE_SCOPE_IDS

logger = logging.getLogger(__name__)

SYNC_DOMAIN_QUERIES = {
    "analytics": "query_analytics.sql",
    "cartera": "query.sql",
    "cobranzas": "query_cobranzas.sql",
    "contratos": "query_contratos.sql",
    "gestores": "query_gestores.sql",
}
SYNC_DOMAIN_QUERIES_V2 = {
    "cartera": "sql/v2/query_cartera.sql",
    "cobranzas": "sql/v2/query_cobranzas.sql",
    "contratos": "sql/v2/query_contratos.sql",
    "gestores": "sql/v2/query_gestores.sql",
}
INCLUDE_DIRECTIVE_RE = re.compile(r"^\s*--\s*@include\s+(.+?)\s*$")

MYSQL_PRECHECK_QUERIES = {
    "cartera": f"""
        SELECT MAX(ccd.closed_date) AS max_updated, MAX(ccd.contract_id) AS max_id
        FROM epem.contract_closed_dates ccd
        JOIN epem.contracts c ON ccd.contract_id = c.id
        WHERE ccd.closed_date > '2020-12-31' AND c.enterprise_id IN {ENTERPRISE_SCOPE_IDS}
    """,
    "cobranzas": f"""
        SELECT MAX(p.updated_at) AS max_updated, MAX(p.id) AS max_id
        FROM account_payment_ways apw
        JOIN payments p ON apw.payment_id = p.id
        JOIN contracts c ON p.contract_id = c.id
        WHERE p.status = 1
          AND p.type < 2
          AND p.date >= '2021-01-01'
          AND c.enterprise_id IN {ENTERPRISE_SCOPE_IDS}
          AND p.contract_id NOT IN {COBRANZAS_EXCLUDED_CONTRACT_IDS}
    """,
    "contratos": f"""
        SELECT MAX(c.updated_at) AS max_updated, MAX(c.id) AS max_id
        FROM contracts c
        JOIN enterprises e ON e.id = c.enterprise_id
        WHERE c.status IN (5, 6) AND e.id IN {ENTERPRISE_SCOPE_IDS}
    """,
    "gestores": f"""
        SELECT MAX(cp.from_date) AS max_updated, MAX(dcp.contract_id) AS max_id
        FROM detail_client_portfolios dcp
        JOIN contracts c ON dcp.contract_id = c.id
        JOIN client_portfolios cp ON dcp.clientportfolio_id = cp.id
        JOIN users u ON cp.manager_id = u.id
        WHERE u.id <> 696
          AND cp.from_date >= '2024-01-01'
          AND c.enterprise_id IN {ENTERPRISE_SCOPE_IDS}
          AND cp.status = 1
    """,
}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def path_within(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def query_variant_for_domain(domain: str) -> str:
    domain_key = str(domain or "").strip().lower()
    if domain_key not in SYNC_DOMAIN_QUERIES_V2:
        return "v1"
    env_by_domain = {
        "cartera": "sync_query_variant_cartera",
        "cobranzas": "sync_query_variant_cobranzas",
        "contratos": "sync_query_variant_contratos",
        "gestores": "sync_query_variant_gestores",
    }
    attr = env_by_domain.get(domain_key)
    raw = str(getattr(settings, attr, "v1") if attr else "v1").strip().lower()
    if raw not in {"v1", "v2"}:
        logger.warning("[sync:%s] invalid query variant=%s, fallback=v1", domain_key, raw)
        return "v1"
    return raw


def query_filename_for(domain: str) -> str:
    domain_key = str(domain or "").strip().lower()
    if domain_key not in SYNC_DOMAIN_QUERIES:
        raise KeyError(f"unknown sync domain: {domain_key}")
    variant = query_variant_for_domain(domain_key)
    if variant == "v2" and domain_key in SYNC_DOMAIN_QUERIES_V2:
        return SYNC_DOMAIN_QUERIES_V2[domain_key]
    return SYNC_DOMAIN_QUERIES[domain_key]


def query_file_for(domain: str) -> str:
    try:
        return query_filename_for(domain)
    except Exception:
        return SYNC_DOMAIN_QUERIES.get(str(domain or "").strip().lower(), "")


def query_path_for(domain: str) -> Path:
    return repo_root() / query_filename_for(domain)


def relative_repo_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root().resolve()).as_posix()
    except ValueError:
        return str(path)


def load_sql_with_includes(
    query_path: Path,
    *,
    depth: int = 0,
    max_depth: int = 5,
    stack: tuple[Path, ...] | None = None,
) -> tuple[str, list[str]]:
    resolved_path = query_path.resolve()
    if stack is None:
        stack = tuple()
    if depth > max_depth:
        chain = " -> ".join(relative_repo_path(p) for p in stack)
        raise ValueError(f"include depth exceeded (max={max_depth}): {chain}")
    if resolved_path in stack:
        chain = " -> ".join(relative_repo_path(p) for p in (*stack, resolved_path))
        raise ValueError(f"circular include detected: {chain}")
    if not resolved_path.exists():
        raise FileNotFoundError(f"SQL file not found: {relative_repo_path(resolved_path)}")

    allowed_roots = (
        (repo_root() / "sql" / "common").resolve(),
        (repo_root() / "sql" / "v2").resolve(),
    )
    output_lines: list[str] = []
    includes: list[str] = []
    text = resolved_path.read_text(encoding="utf-8")
    for line in text.splitlines():
        match = INCLUDE_DIRECTIVE_RE.match(line)
        if not match:
            output_lines.append(line)
            continue
        include_ref = str(match.group(1) or "").strip()
        include_path = (repo_root() / include_ref).resolve()
        if not any(path_within(include_path, root) for root in allowed_roots):
            raise ValueError(f"include path not allowed: {include_ref}")
        if not include_path.exists():
            raise FileNotFoundError(f"include file not found: {include_ref}")
        include_sql, nested = load_sql_with_includes(
            include_path,
            depth=depth + 1,
            max_depth=max_depth,
            stack=(*stack, resolved_path),
        )
        includes.append(relative_repo_path(include_path))
        includes.extend(nested)
        output_lines.append(include_sql)
    return "\n".join(output_lines).strip() + "\n", includes
