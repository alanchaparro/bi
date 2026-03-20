#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

from sqlalchemy import create_engine, text


DEFAULT_DATABASE_URL = "postgresql+psycopg2://cobranzas_user:change_me_postgres@localhost:5432/cobranzas_prod"


@dataclass
class ProfileQuery:
    name: str
    sql: str
    params: dict[str, Any]


def _fetch_scalar(conn, sql: str, params: dict[str, Any] | None = None) -> Any:
    row = conn.execute(text(sql), params or {}).first()
    if row is None:
        return None
    return row[0]


def _table_count(conn, table_name: str) -> int:
    return int(_fetch_scalar(conn, f"SELECT count(*) FROM {table_name}") or 0)


def _latest_month(conn, table_name: str, field_name: str) -> str | None:
    value = _fetch_scalar(conn, f"SELECT max({field_name}) FROM {table_name}")
    text_value = str(value or "").strip()
    return text_value or None


def _explain(conn, query: ProfileQuery) -> dict[str, Any]:
    rows = conn.execute(
        text(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query.sql}"),
        query.params,
    ).scalar()
    plan = rows[0] if isinstance(rows, list) and rows else rows
    if not isinstance(plan, dict):
        return {"name": query.name, "plan": plan}
    root = dict(plan.get("Plan") or {})
    return {
        "name": query.name,
        "planning_time_ms": float(plan.get("Planning Time") or 0.0),
        "execution_time_ms": float(plan.get("Execution Time") or 0.0),
        "root_node_type": root.get("Node Type"),
        "root_relation": root.get("Relation Name"),
        "root_index": root.get("Index Name"),
        "shared_hit_blocks": int(plan.get("Shared Hit Blocks") or 0),
        "shared_read_blocks": int(plan.get("Shared Read Blocks") or 0),
        "plan": plan,
    }


def main() -> int:
    database_url = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
    engine = create_engine(database_url, future=True)

    with engine.connect() as conn:
        counts = {
            "cartera_fact": _table_count(conn, "cartera_fact"),
            "cobranzas_fact": _table_count(conn, "cobranzas_fact"),
            "analytics_fact": _table_count(conn, "analytics_fact"),
            "cartera_corte_agg": _table_count(conn, "cartera_corte_agg"),
            "mv_options_cartera": _table_count(conn, "mv_options_cartera"),
            "analytics_rendimiento_agg": _table_count(conn, "analytics_rendimiento_agg"),
            "mv_options_rendimiento": _table_count(conn, "mv_options_rendimiento"),
            "cobranzas_cohorte_agg": _table_count(conn, "cobranzas_cohorte_agg"),
            "mv_options_cohorte": _table_count(conn, "mv_options_cohorte"),
            "analytics_anuales_agg": _table_count(conn, "analytics_anuales_agg"),
            "mv_options_anuales": _table_count(conn, "mv_options_anuales"),
            "dim_negocio_contrato": _table_count(conn, "dim_negocio_contrato"),
        }
        latest = {
            "cartera_gestion_month": _latest_month(conn, "cartera_corte_agg", "gestion_month"),
            "cartera_close_month": _latest_month(conn, "cartera_corte_agg", "close_month"),
            "rendimiento_gestion_month": _latest_month(conn, "analytics_rendimiento_agg", "gestion_month"),
            "cohorte_cutoff_month": _latest_month(conn, "cobranzas_cohorte_agg", "cutoff_month"),
            "anuales_cutoff_month": _latest_month(conn, "analytics_anuales_agg", "cutoff_month"),
        }

        queries: list[ProfileQuery] = []

        if counts["mv_options_cartera"] > 0:
            queries.append(
                ProfileQuery(
                    name="portfolio_corte_v2_options",
                    sql="""
                    SELECT DISTINCT un, supervisor, via_cobro, categoria, tramo, gestion_month, close_month, contract_year
                    FROM mv_options_cartera
                    WHERE (:gestion_month IS NULL OR gestion_month = :gestion_month)
                    """,
                    params={"gestion_month": latest["cartera_gestion_month"]},
                )
            )
        if counts["cartera_corte_agg"] > 0:
            queries.append(
                ProfileQuery(
                    name="portfolio_corte_v2_summary",
                    sql="""
                    SELECT
                      coalesce(sum(contracts_total), 0) AS contracts_total,
                      coalesce(sum(vigentes_total), 0) AS vigentes_total,
                      coalesce(sum(morosos_total), 0) AS morosos_total,
                      coalesce(sum(monto_total), 0.0) AS monto_total,
                      coalesce(sum(paid_total), 0.0) AS paid_total
                    FROM cartera_corte_agg
                    WHERE (:gestion_month IS NULL OR gestion_month = :gestion_month)
                    """,
                    params={"gestion_month": latest["cartera_gestion_month"]},
                )
            )
        if counts["analytics_rendimiento_agg"] > 0:
            queries.append(
                ProfileQuery(
                    name="rendimiento_v2_summary",
                    sql="""
                    SELECT
                      coalesce(sum(debt_total), 0.0) AS debt_total,
                      coalesce(sum(paid_total), 0.0) AS paid_total,
                      coalesce(sum(contracts_total), 0) AS contracts_total,
                      coalesce(sum(contracts_paid), 0) AS contracts_paid
                    FROM analytics_rendimiento_agg
                    WHERE (:gestion_month IS NULL OR gestion_month = :gestion_month)
                    """,
                    params={"gestion_month": latest["rendimiento_gestion_month"]},
                )
            )
        if counts["cobranzas_cohorte_agg"] > 0:
            queries.append(
                ProfileQuery(
                    name="cobranzas_cohorte_v2_first_paint",
                    sql="""
                    SELECT sale_month, activos, pagaron, deberia, cobrado
                    FROM cobranzas_cohorte_agg
                    WHERE (:cutoff_month IS NULL OR cutoff_month = :cutoff_month)
                    ORDER BY sale_month DESC
                    LIMIT 12
                    """,
                    params={"cutoff_month": latest["cohorte_cutoff_month"]},
                )
            )
        if counts["analytics_anuales_agg"] > 0:
            queries.append(
                ProfileQuery(
                    name="anuales_v2_summary",
                    sql="""
                    SELECT sale_year, contracts, contracts_vigentes, cuota_total, paid_to_cutoff_total
                    FROM analytics_anuales_agg
                    WHERE (:cutoff_month IS NULL OR cutoff_month = :cutoff_month)
                    ORDER BY sale_year ASC
                    """,
                    params={"cutoff_month": latest["anuales_cutoff_month"]},
                )
            )

        output = {
            "database_url": database_url,
            "counts": counts,
            "latest": latest,
            "profiling_enabled": bool(queries),
            "notes": [],
            "queries": [],
        }

        if not queries:
            output["notes"].append(
                "No hay volumen suficiente en tablas materializadas/facts para que EXPLAIN ANALYZE sea representativo."
            )
            output["notes"].append(
                "Cargar sync real y volver a correr este script antes de decidir indices nuevos."
            )
        else:
            for query in queries:
                output["queries"].append(_explain(conn, query))

    print(json.dumps(output, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
