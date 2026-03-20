from __future__ import annotations

from datetime import datetime

from sqlalchemy import Numeric, case, cast, func, literal
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.db.session import engine
from app.models.brokers import (
    AnalyticsAnualesAgg,
    AnalyticsContractSnapshot,
    AnalyticsFact,
    AnalyticsRendimientoAgg,
    AnalyticsSourceFreshness,
    CarteraFact,
    CarteraCorteAgg,
    CobranzasCohorteAgg,
    CobranzasFact,
    DimCategoria,
    DimContractMonth,
    DimSupervisor,
    DimTime,
    DimUn,
    DimVia,
    DimNegocioContrato,
    MvOptionsAnuales,
    MvOptionsCartera,
    MvOptionsCohorte,
    MvOptionsRendimiento,
)
from app.schemas.analytics import AnalyticsFilters
from app.services.analytics_service import AnalyticsService


def _normalize_dim(value, default: str) -> str:
    return str(value or default).strip().upper() or default


def refresh_dim_time(db: Session, affected_months: set[str], month_serial) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if month_serial(str(m).strip()) > 0}, key=month_serial)
    if not months:
        return 0, 0

    deleted = db.query(DimTime).filter(DimTime.month_key.in_(months)).delete(synchronize_session=False)
    db.commit()
    now = datetime.utcnow()
    mappings: list[dict] = []
    for month_key in months:
        serial = month_serial(month_key)
        month = int(month_key.split("/")[0])
        year = int(month_key.split("/")[1])
        quarter = ((month - 1) // 3) + 1
        mappings.append(
            {
                "month_key": month_key,
                "year": year,
                "quarter": quarter,
                "month": month,
                "month_name": f"{month:02d}",
                "sort_key": serial,
                "updated_at": now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(DimTime, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def refresh_dim_contract_month_and_catalogs(db: Session, affected_months: set[str], month_serial) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if month_serial(str(m).strip()) > 0}, key=month_serial)
    if not months:
        return 0, 0

    now = datetime.utcnow()
    deleted = db.query(DimContractMonth).filter(DimContractMonth.gestion_month.in_(months)).delete(synchronize_session=False)
    db.commit()

    rows = db.query(DimNegocioContrato).filter(DimNegocioContrato.gestion_month.in_(months)).all()
    mappings: list[dict] = []
    for row in rows:
        mappings.append(
            {
                "contract_id": str(row.contract_id or "").strip(),
                "gestion_month": str(row.gestion_month or "").strip(),
                "sale_month": str(row.sale_month or "").strip(),
                "sale_year": int(row.sale_year or 0),
                "un_canonica": _normalize_dim(row.un_canonica, "S/D"),
                "supervisor_canonico": _normalize_dim(row.supervisor_canonico, "S/D"),
                "categoria_canonica": _normalize_dim(row.categoria_canonica, "VIGENTE"),
                "via_canonica": _normalize_dim(row.via_canonica, "DEBITO"),
                "tramo": int(row.tramo or 0),
                "updated_at": now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(DimContractMonth, mappings)
        db.commit()

    db.query(DimUn).delete(synchronize_session=False)
    db.query(DimSupervisor).delete(synchronize_session=False)
    db.query(DimVia).delete(synchronize_session=False)
    db.query(DimCategoria).delete(synchronize_session=False)
    db.commit()

    un_values = {
        str(v[0] or "").strip().upper()
        for v in db.query(DimContractMonth.un_canonica).distinct().all()
        if str(v[0] or "").strip()
    }
    supervisor_values = {
        str(v[0] or "").strip().upper()
        for v in db.query(DimContractMonth.supervisor_canonico).distinct().all()
        if str(v[0] or "").strip()
    }
    via_values = {
        str(v[0] or "").strip().upper()
        for v in db.query(DimContractMonth.via_canonica).distinct().all()
        if str(v[0] or "").strip()
    }
    categoria_values = {
        str(v[0] or "").strip().upper()
        for v in db.query(DimContractMonth.categoria_canonica).distinct().all()
        if str(v[0] or "").strip()
    }

    if un_values:
        db.bulk_insert_mappings(
            DimUn,
            [{"un_raw": value, "un_canonica": value, "mapping_version": "v1", "updated_at": now} for value in sorted(un_values)],
        )
    if supervisor_values:
        db.bulk_insert_mappings(
            DimSupervisor,
            [{"supervisor_raw": value, "supervisor_canonico": value, "updated_at": now} for value in sorted(supervisor_values)],
        )
    if via_values:
        db.bulk_insert_mappings(
            DimVia,
            [{"via_raw": value, "via_canonica": value, "updated_at": now} for value in sorted(via_values)],
        )
    if categoria_values:
        db.bulk_insert_mappings(
            DimCategoria,
            [{"categoria_raw": value, "categoria_canonica": value, "updated_at": now} for value in sorted(categoria_values)],
        )
    db.commit()
    return int(deleted or 0), len(mappings)


def refresh_dim_negocio_contrato(
    db: Session,
    affected_months: set[str],
    month_serial,
    *,
    seed_default_un_mappings,
    load_un_canonical_map,
    canonical_un,
    canonical_via,
    categoria_from_tramo,
    month_from_any,
    year_of,
) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if str(m).strip()}, key=month_serial)
    if not months:
        return 0, 0

    deleted = db.query(DimNegocioContrato).filter(DimNegocioContrato.gestion_month.in_(months)).delete(synchronize_session=False)
    db.commit()

    seed_default_un_mappings(db)
    un_map = load_un_canonical_map(db)
    supervisor_rows = (
        db.query(
            AnalyticsFact.contract_id.label("contract_id"),
            AnalyticsFact.gestion_month.label("gestion_month"),
            func.max(
                case(
                    (func.upper(func.coalesce(AnalyticsFact.supervisor, "")) != "S/D", AnalyticsFact.supervisor),
                    else_=literal(""),
                )
            ).label("supervisor"),
        )
        .filter(AnalyticsFact.gestion_month.in_(months))
        .group_by(AnalyticsFact.contract_id, AnalyticsFact.gestion_month)
        .all()
    )
    supervisor_map: dict[tuple[str, str], str] = {}
    for row in supervisor_rows:
        key = (str(row.contract_id or "").strip(), str(row.gestion_month or "").strip())
        supervisor = str(row.supervisor or "").strip().upper()
        if key[0] and key[1] and supervisor:
            supervisor_map[key] = supervisor

    rows = (
        db.query(
            CarteraFact.contract_id,
            CarteraFact.gestion_month,
            func.max(CarteraFact.un).label("un_raw"),
            func.max(CarteraFact.supervisor).label("supervisor_raw"),
            func.max(CarteraFact.via_cobro).label("via_raw"),
            func.max(CarteraFact.tramo).label("tramo"),
            func.max(CarteraFact.contract_month).label("contract_month"),
        )
        .filter(CarteraFact.gestion_month.in_(months))
        .group_by(CarteraFact.contract_id, CarteraFact.gestion_month)
        .all()
    )
    now = datetime.utcnow()
    mappings: list[dict] = []
    for row in rows:
        contract_id = str(row.contract_id or "").strip()
        gestion_month = str(row.gestion_month or "").strip()
        if not contract_id or not gestion_month:
            continue
        tramo = int(row.tramo or 0)
        supervisor_raw = _normalize_dim(row.supervisor_raw, "S/D")
        supervisor_canon = supervisor_raw if supervisor_raw != "S/D" else str(supervisor_map.get((contract_id, gestion_month)) or "S/D")
        categoria = categoria_from_tramo(tramo)
        sale_month = month_from_any(row.contract_month)
        sale_year = year_of(sale_month)
        mappings.append(
            {
                "contract_id": contract_id,
                "gestion_month": gestion_month,
                "sale_month": sale_month,
                "sale_year": int(sale_year or 0),
                "un_raw": _normalize_dim(row.un_raw, "S/D"),
                "supervisor_raw": supervisor_raw,
                "via_raw": _normalize_dim(row.via_raw, "S/D"),
                "tramo": tramo,
                "categoria": categoria,
                "un_canonica": canonical_un(un_map, row.un_raw),
                "supervisor_canonico": supervisor_canon,
                "via_canonica": canonical_via(row.via_raw),
                "categoria_canonica": categoria,
                "mapping_version": "v1",
                "updated_at": now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(DimNegocioContrato, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def refresh_analytics_rendimiento_agg(db: Session, affected_months: set[str], month_serial, canonical_via) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if str(m).strip()}, key=month_serial)
    if not months:
        return 0, 0

    deleted = (
        db.query(AnalyticsRendimientoAgg)
        .filter(AnalyticsRendimientoAgg.gestion_month.in_(months))
        .delete(synchronize_session=False)
    )
    db.commit()

    if db.bind is not None and db.bind.dialect.name == "postgresql":
        cuota_text = cast(CarteraFact.payload_json, JSONB).op("->>")("monto_cuota")
        cuota_fallback_expr = case(
            (cuota_text.op("~")(r"^-?\d+(\.\d+)?$"), cast(cuota_text, Numeric)),
            else_=literal(0),
        )
    else:
        cuota_fallback_expr = literal(0)
    cuota_effective_expr = case(
        (cast(func.coalesce(CarteraFact.cuota_amount, 0.0), Numeric) > 0, cast(func.coalesce(CarteraFact.cuota_amount, 0.0), Numeric)),
        else_=cuota_fallback_expr,
    )
    debt_expr = cast(func.coalesce(CarteraFact.monto_vencido, 0.0), Numeric) + cuota_effective_expr

    debt_rows = (
        db.query(
            CarteraFact.contract_id,
            CarteraFact.gestion_month,
            func.coalesce(func.sum(debt_expr), 0.0).label("debt"),
        )
        .filter(CarteraFact.gestion_month.in_(months))
        .group_by(CarteraFact.contract_id, CarteraFact.gestion_month)
        .all()
    )
    debt_map: dict[tuple[str, str], float] = {}
    for row in debt_rows:
        debt_map[(str(row.contract_id or "").strip(), str(row.gestion_month or "").strip())] = float(row.debt or 0.0)

    dim_rows = db.query(DimNegocioContrato).filter(DimNegocioContrato.gestion_month.in_(months)).all()
    contract_state: dict[tuple[str, str], dict] = {}
    for row in dim_rows:
        contract_id = str(row.contract_id or "").strip()
        month = str(row.gestion_month or "").strip()
        if not contract_id or not month:
            continue
        key = (contract_id, month)
        contract_state[key] = {
            "gestion_month": month,
            "un": _normalize_dim(row.un_canonica, "S/D"),
            "supervisor": _normalize_dim(row.supervisor_canonico, "S/D"),
            "via_cobro": canonical_via(row.via_canonica),
            "categoria": _normalize_dim(row.categoria_canonica, "VIGENTE"),
            "tramo": int(row.tramo or 0),
            "debt": float(debt_map.get(key, 0.0)),
            "paid_total": 0.0,
            "paid_via_cobrador": 0.0,
            "paid_via_debito": 0.0,
        }

    paid_rows = (
        db.query(
            CobranzasFact.contract_id,
            CobranzasFact.payment_month,
            CobranzasFact.payment_via_class,
            func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0).label("paid"),
        )
        .filter(CobranzasFact.payment_month.in_(months))
        .group_by(CobranzasFact.contract_id, CobranzasFact.payment_month, CobranzasFact.payment_via_class)
        .all()
    )
    for row in paid_rows:
        state = contract_state.get((str(row.contract_id or "").strip(), str(row.payment_month or "").strip()))
        if state is None:
            continue
        amount = float(row.paid or 0.0)
        via = canonical_via(row.payment_via_class)
        state["paid_total"] += amount
        if via == "COBRADOR":
            state["paid_via_cobrador"] += amount
        else:
            state["paid_via_debito"] += amount

    bucket_map: dict[tuple[str, str, str, str, str, int], dict] = {}
    for state in contract_state.values():
        debt_val = float(state["debt"] or 0.0)
        paid_raw = float(state["paid_total"] or 0.0)
        paid_capped = min(max(paid_raw, 0.0), max(debt_val, 0.0))
        if paid_raw > 0.0 and paid_capped < paid_raw:
            ratio = paid_capped / paid_raw
            paid_via_cobrador = float(state["paid_via_cobrador"] or 0.0) * ratio
            paid_via_debito = float(state["paid_via_debito"] or 0.0) * ratio
        else:
            paid_via_cobrador = float(state["paid_via_cobrador"] or 0.0)
            paid_via_debito = float(state["paid_via_debito"] or 0.0)
        bkey = (
            str(state["gestion_month"]),
            str(state["un"]),
            str(state["supervisor"]),
            str(state["via_cobro"]),
            str(state["categoria"]),
            int(state["tramo"]),
        )
        bucket = bucket_map.setdefault(
            bkey,
            {
                "gestion_month": bkey[0],
                "un": bkey[1],
                "supervisor": bkey[2],
                "via_cobro": bkey[3],
                "categoria": bkey[4],
                "tramo": bkey[5],
                "debt_total": 0.0,
                "paid_total": 0.0,
                "paid_via_cobrador": 0.0,
                "paid_via_debito": 0.0,
                "contracts_total": 0,
                "contracts_paid": 0,
            },
        )
        bucket["debt_total"] += debt_val
        bucket["paid_total"] += paid_capped
        bucket["paid_via_cobrador"] += paid_via_cobrador
        bucket["paid_via_debito"] += paid_via_debito
        bucket["contracts_total"] += 1
        if paid_capped > 0.0:
            bucket["contracts_paid"] += 1

    now = datetime.utcnow()
    mappings = []
    for bucket in bucket_map.values():
        item = dict(bucket)
        item["updated_at"] = now
        mappings.append(item)
    if mappings:
        db.bulk_insert_mappings(AnalyticsRendimientoAgg, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def refresh_analytics_anuales_agg(db: Session, affected_months: set[str], month_serial) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if str(m).strip()}, key=month_serial)
    if not months:
        return 0, 0

    cutoff = months[-1]
    deleted = db.query(AnalyticsAnualesAgg).filter(AnalyticsAnualesAgg.cutoff_month == cutoff).delete(synchronize_session=False)
    db.commit()

    base = AnalyticsService.fetch_anuales_summary_v1(db, AnalyticsFilters())
    rows = list(base.get("rows") or [])
    now = datetime.utcnow()
    mappings: list[dict] = []
    for row in rows:
        year = int(str(row.get("year") or 0) or 0)
        if year <= 0:
            continue
        contracts = int(row.get("contracts") or 0)
        contracts_vig = int(row.get("contractsVigentes") or 0)
        culminados = int(row.get("culminados") or 0)
        culminados_vig = int(row.get("culminadosVigentes") or 0)
        tkp_contrato = float(row.get("tkpContrato") or 0.0)
        tkp_pago = float(row.get("tkpPago") or 0.0)
        tkp_trans = float(row.get("tkpTransaccional") or 0.0)
        tkp_cul_contrato = float(row.get("tkpContratoCulminado") or 0.0)
        tkp_cul_pago = float(row.get("tkpPagoCulminado") or 0.0)
        tkp_cul_contrato_v = float(row.get("tkpContratoCulminadoVigente") or 0.0)
        tkp_cul_pago_v = float(row.get("tkpPagoCulminadoVigente") or 0.0)
        ltv = float(row.get("ltvCulminadoVigente") or 0.0)
        mappings.append(
            {
                "cutoff_month": cutoff,
                "sale_year": year,
                "sale_month": "*",
                "un": "*",
                "contracts": contracts,
                "contracts_vigentes": contracts_vig,
                "cuota_total": tkp_contrato * contracts,
                "paid_to_cutoff_total": tkp_trans * max(contracts, 1),
                "tx_to_cutoff_total": contracts,
                "paid_by_contract_month_total": tkp_pago * max(contracts, 1),
                "paid_by_contract_month_count": contracts,
                "culminados": culminados,
                "culminados_vigentes": culminados_vig,
                "cuota_cul_total": tkp_cul_contrato * max(culminados, 1),
                "cuota_cul_total_vigente": tkp_cul_contrato_v * max(culminados_vig, 1),
                "paid_by_contract_month_cul_total": tkp_cul_pago * max(culminados, 1),
                "paid_by_contract_month_cul_count": culminados,
                "paid_by_contract_month_cul_total_vigente": tkp_cul_pago_v * max(culminados_vig, 1),
                "paid_by_contract_month_cul_count_vigente": culminados_vig,
                "total_cobrado_cul_vigente": ltv * max(culminados_vig, 1),
                "total_deberia_cul_vigente": float(max(culminados_vig, 1)),
                "months_weighted_numerator_cul_vigente": float(max(culminados_vig, 1)),
                "updated_at": now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(AnalyticsAnualesAgg, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def refresh_cartera_corte_agg(
    db: Session,
    affected_months: set[str],
    month_serial,
    *,
    categoria_expr,
    contract_year_expr,
) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if str(m).strip()}, key=month_serial)
    if not months:
        return 0, 0

    deleted = db.query(CarteraCorteAgg).filter(CarteraCorteAgg.gestion_month.in_(months)).delete(synchronize_session=False)
    db.commit()

    monto_cuota_expr = cast(func.coalesce(CarteraFact.cuota_amount, 0.0), Numeric)
    via_cartera_class_expr = case(
        (func.upper(func.coalesce(CarteraFact.via_cobro, "")) == literal("COBRADOR"), literal("COBRADOR")),
        else_=literal("DEBITO"),
    )
    supervisor_sq = (
        db.query(
            AnalyticsFact.contract_id.label("contract_id"),
            AnalyticsFact.gestion_month.label("gestion_month"),
            func.max(
                case(
                    (func.upper(func.coalesce(AnalyticsFact.supervisor, "")) != "S/D", AnalyticsFact.supervisor),
                    else_=literal(""),
                )
            ).label("supervisor"),
        )
        .filter(AnalyticsFact.gestion_month.in_(months))
        .group_by(AnalyticsFact.contract_id, AnalyticsFact.gestion_month)
        .subquery()
    )
    supervisor_expr = case(
        (func.upper(func.coalesce(CarteraFact.supervisor, "")) != "S/D", CarteraFact.supervisor),
        (func.coalesce(supervisor_sq.c.supervisor, "") != "", supervisor_sq.c.supervisor),
        else_=literal("S/D"),
    )

    paid_sq = (
        db.query(
            CobranzasFact.contract_id.label("contract_id"),
            CobranzasFact.payment_month.label("payment_month"),
            func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0).label("paid_total"),
            func.coalesce(
                func.sum(case((CobranzasFact.payment_via_class == "COBRADOR", CobranzasFact.payment_amount), else_=literal(0.0))),
                0.0,
            ).label("paid_via_cobrador"),
            func.coalesce(
                func.sum(case((CobranzasFact.payment_via_class == "DEBITO", CobranzasFact.payment_amount), else_=literal(0.0))),
                0.0,
            ).label("paid_via_debito"),
            func.max(case((CobranzasFact.payment_amount > 0, literal(1)), else_=literal(0))).label("contracts_paid_total"),
            func.max(
                case(
                    ((CobranzasFact.payment_via_class == "COBRADOR") & (CobranzasFact.payment_amount > 0), literal(1)),
                    else_=literal(0),
                )
            ).label("contracts_paid_via_cobrador"),
            func.max(
                case(
                    ((CobranzasFact.payment_via_class == "DEBITO") & (CobranzasFact.payment_amount > 0), literal(1)),
                    else_=literal(0),
                )
            ).label("contracts_paid_via_debito"),
        )
        .filter(CobranzasFact.payment_month.in_(months))
        .group_by(CobranzasFact.contract_id, CobranzasFact.payment_month)
        .subquery()
    )

    grouped_rows = (
        db.query(
            CarteraFact.gestion_month.label("gestion_month"),
            CarteraFact.close_month.label("close_month"),
            CarteraFact.close_year.label("close_year"),
            contract_year_expr.label("contract_year"),
            CarteraFact.un.label("un"),
            supervisor_expr.label("supervisor"),
            via_cartera_class_expr.label("via_cobro"),
            categoria_expr.label("categoria"),
            CarteraFact.tramo.label("tramo"),
            func.coalesce(func.sum(CarteraFact.contracts_total), 0).label("contracts_total"),
            func.coalesce(func.sum(case((categoria_expr == "VIGENTE", CarteraFact.contracts_total), else_=literal(0))), 0).label("vigentes_total"),
            func.coalesce(func.sum(case((categoria_expr == "MOROSO", CarteraFact.contracts_total), else_=literal(0))), 0).label("morosos_total"),
            func.coalesce(func.sum(monto_cuota_expr + CarteraFact.monto_vencido), 0.0).label("monto_total"),
            func.coalesce(func.sum(CarteraFact.monto_vencido), 0.0).label("monto_vencido_total"),
            func.coalesce(func.sum(case((via_cartera_class_expr == "COBRADOR", CarteraFact.contracts_total), else_=literal(0))), 0).label("contracts_cobrador"),
            func.coalesce(func.sum(case((via_cartera_class_expr == "DEBITO", CarteraFact.contracts_total), else_=literal(0))), 0).label("contracts_debito"),
            func.coalesce(func.sum(paid_sq.c.paid_total), 0.0).label("paid_total"),
            func.coalesce(func.sum(paid_sq.c.paid_via_cobrador), 0.0).label("paid_via_cobrador"),
            func.coalesce(func.sum(paid_sq.c.paid_via_debito), 0.0).label("paid_via_debito"),
            func.coalesce(func.sum(paid_sq.c.contracts_paid_total), 0).label("contracts_paid_total"),
            func.coalesce(func.sum(paid_sq.c.contracts_paid_via_cobrador), 0).label("contracts_paid_via_cobrador"),
            func.coalesce(func.sum(paid_sq.c.contracts_paid_via_debito), 0).label("contracts_paid_via_debito"),
        )
        .outerjoin(paid_sq, (paid_sq.c.contract_id == CarteraFact.contract_id) & (paid_sq.c.payment_month == CarteraFact.gestion_month))
        .outerjoin(supervisor_sq, (supervisor_sq.c.contract_id == CarteraFact.contract_id) & (supervisor_sq.c.gestion_month == CarteraFact.gestion_month))
        .filter(CarteraFact.gestion_month.in_(months))
        .group_by(
            CarteraFact.gestion_month,
            CarteraFact.close_month,
            CarteraFact.close_year,
            contract_year_expr,
            CarteraFact.un,
            supervisor_expr,
            via_cartera_class_expr,
            categoria_expr,
            CarteraFact.tramo,
        )
        .all()
    )

    now = datetime.utcnow()
    mappings: list[dict] = []
    for row in grouped_rows:
        mappings.append(
            {
                "gestion_month": str(row.gestion_month),
                "close_month": str(row.close_month),
                "close_year": int(row.close_year or 0),
                "contract_year": int(row.contract_year) if row.contract_year is not None else 0,
                "un": str(row.un or "S/D"),
                "supervisor": str(row.supervisor or "S/D"),
                "via_cobro": str(row.via_cobro or "S/D"),
                "categoria": str(row.categoria or "VIGENTE"),
                "tramo": int(row.tramo or 0),
                "contracts_total": int(row.contracts_total or 0),
                "vigentes_total": int(row.vigentes_total or 0),
                "morosos_total": int(row.morosos_total or 0),
                "monto_total": float(row.monto_total or 0.0),
                "monto_vencido_total": float(row.monto_vencido_total or 0.0),
                "contracts_cobrador": int(row.contracts_cobrador or 0),
                "contracts_debito": int(row.contracts_debito or 0),
                "paid_total": float(row.paid_total or 0.0),
                "paid_via_cobrador": float(row.paid_via_cobrador or 0.0),
                "paid_via_debito": float(row.paid_via_debito or 0.0),
                "contracts_paid_total": int(row.contracts_paid_total or 0),
                "contracts_paid_via_cobrador": int(row.contracts_paid_via_cobrador or 0),
                "contracts_paid_via_debito": int(row.contracts_paid_via_debito or 0),
                "updated_at": now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(CarteraCorteAgg, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def refresh_cobranzas_cohorte_agg(
    db: Session,
    affected_months: set[str],
    month_serial,
    *,
    effective_by_cutoff: dict[str, str],
    categoria_expr,
) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if month_serial(str(m).strip()) > 0}, key=month_serial)
    if not months:
        return 0, 0

    valid_cutoffs = sorted(effective_by_cutoff.keys(), key=month_serial)
    if not valid_cutoffs:
        return 0, 0

    deleted = db.query(CobranzasCohorteAgg).filter(CobranzasCohorteAgg.cutoff_month.in_(valid_cutoffs)).delete(synchronize_session=False)
    db.commit()

    via_expr = case(
        (func.upper(func.coalesce(CarteraFact.via_cobro, "")) == literal("COBRADOR"), literal("COBRADOR")),
        else_=literal("DEBITO"),
    )
    monto_cuota_expr = cast(func.coalesce(CarteraFact.cuota_amount, 0.0), Numeric)

    payments_sq = (
        db.query(
            CobranzasFact.payment_month.label("cutoff_month"),
            CobranzasFact.contract_id.label("contract_id"),
            func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0).label("cobrado"),
            func.coalesce(func.sum(case((CobranzasFact.payment_amount > 0, literal(1)), else_=literal(0))), 0).label("transacciones"),
        )
        .filter(CobranzasFact.payment_month.in_(valid_cutoffs))
        .group_by(CobranzasFact.payment_month, CobranzasFact.contract_id)
        .subquery()
    )

    if engine.dialect.name == "postgresql":
        payload_jsonb = cast(CarteraFact.payload_json, JSONB)
        fecha_contrato_raw = func.coalesce(payload_jsonb.op("->>")("fecha_contrato"), literal(""))
        fecha_iso_norm = func.replace(fecha_contrato_raw, "/", "-")
        sale_month_from_payload = case(
            (
                fecha_iso_norm.op("~")(r"^\d{4}-\d{1,2}-\d{1,2}$"),
                func.concat(
                    func.lpad(func.split_part(fecha_iso_norm, "-", 2), 2, "0"),
                    literal("/"),
                    func.split_part(fecha_iso_norm, "-", 1),
                ),
            ),
            (
                fecha_contrato_raw.op("~")(r"^\d{1,2}/\d{1,2}/\d{4}$"),
                func.concat(
                    func.lpad(func.split_part(fecha_contrato_raw, "/", 2), 2, "0"),
                    literal("/"),
                    func.split_part(fecha_contrato_raw, "/", 3),
                ),
            ),
            else_=literal(""),
        )
        sale_month_expr = func.coalesce(func.nullif(CarteraFact.contract_month, ""), sale_month_from_payload, literal(""))
    else:
        sale_month_expr = func.coalesce(CarteraFact.contract_month, literal(""))

    now = datetime.utcnow()
    mappings: list[dict] = []
    for cutoff_month in valid_cutoffs:
        effective_month = str(effective_by_cutoff.get(cutoff_month) or "").strip()
        if month_serial(effective_month) <= 0:
            continue
        grouped_rows = (
            db.query(
                literal(cutoff_month).label("cutoff_month"),
                sale_month_expr.label("sale_month"),
                func.upper(func.coalesce(CarteraFact.un, "S/D")).label("un"),
                func.upper(func.coalesce(CarteraFact.supervisor, "S/D")).label("supervisor"),
                via_expr.label("via"),
                categoria_expr.label("categoria"),
                func.count().label("activos"),
                func.coalesce(func.sum(case((func.coalesce(payments_sq.c.cobrado, 0.0) > 0, literal(1)), else_=literal(0))), 0).label("pagaron"),
                func.coalesce(func.sum(monto_cuota_expr + CarteraFact.monto_vencido), 0.0).label("deberia"),
                func.coalesce(func.sum(func.coalesce(payments_sq.c.cobrado, 0.0)), 0.0).label("cobrado"),
                func.coalesce(func.sum(func.coalesce(payments_sq.c.transacciones, 0)), 0).label("transacciones"),
            )
            .outerjoin(
                payments_sq,
                (payments_sq.c.contract_id == CarteraFact.contract_id) & (payments_sq.c.cutoff_month == literal(cutoff_month)),
            )
            .filter(CarteraFact.gestion_month == effective_month)
            .group_by(
                sale_month_expr,
                func.upper(func.coalesce(CarteraFact.un, "S/D")),
                func.upper(func.coalesce(CarteraFact.supervisor, "S/D")),
                via_expr,
                categoria_expr,
            )
            .all()
        )
        cutoff_serial = month_serial(cutoff_month)
        for row in grouped_rows:
            sale_month = str(row.sale_month or "").strip()
            sale_serial = month_serial(sale_month)
            if sale_serial <= 0 or sale_serial > cutoff_serial:
                continue
            mappings.append(
                {
                    "cutoff_month": cutoff_month,
                    "sale_month": sale_month,
                    "sale_year": int(sale_month[-4:]) if sale_serial > 0 else 0,
                    "un": _normalize_dim(row.un, "S/D"),
                    "supervisor": _normalize_dim(row.supervisor, "S/D"),
                    "via_cobro": _normalize_dim(row.via, "DEBITO"),
                    "categoria": _normalize_dim(row.categoria, "VIGENTE"),
                    "activos": int(row.activos or 0),
                    "pagaron": int(row.pagaron or 0),
                    "deberia": float(row.deberia or 0.0),
                    "cobrado": float(row.cobrado or 0.0),
                    "transacciones": int(row.transacciones or 0),
                    "updated_at": now,
                }
            )
    if mappings:
        db.bulk_insert_mappings(CobranzasCohorteAgg, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def refresh_analytics_snapshot(
    db: Session,
    mode: str,
    year_from: int | None,
    target_months: set[str],
    normalized_rows: list[dict] | None,
    *,
    to_int,
    to_float,
) -> None:
    query = db.query(AnalyticsContractSnapshot)
    if target_months:
        query = query.filter(AnalyticsContractSnapshot.sale_month.in_(target_months))
    elif mode == "full_year" and year_from is not None:
        query = query.filter(func.substr(AnalyticsContractSnapshot.sale_month, 4, 4) == str(year_from))
    elif mode == "full_all":
        pass
    query.delete(synchronize_session=False)
    db.commit()

    def _append_snapshot_rows(source_rows: list[dict], now: datetime) -> int:
        inserted = 0
        snapshot_rows: list[dict] = []
        for row in source_rows:
            contracts = max(1, to_int(row.get("contracts_total"), 1))
            debt_total = to_float(row.get("debt_total"))
            paid_total = to_float(row.get("paid_total"))
            if contracts <= 0 or (debt_total == 0 and paid_total == 0):
                payload = row.get("payload_json") or "{}"
                if not isinstance(payload, dict):
                    import json
                    payload = json.loads(payload)
                contracts = max(1, to_int(payload.get("contracts_total"), 1))
                debt_total = to_float(payload.get("debt_total"))
                paid_total = to_float(payload.get("paid_total"))
            debt_per = debt_total / contracts
            paid_per = paid_total / contracts
            base_id = str(row.get("contract_id") or "")
            if not base_id:
                continue
            for idx in range(contracts):
                snapshot_rows.append(
                    {
                        "contract_id": f"{base_id}_{idx}",
                        "sale_month": row.get("gestion_month"),
                        "close_month": row.get("gestion_month"),
                        "supervisor": row.get("supervisor"),
                        "un": row.get("un"),
                        "via": row.get("via"),
                        "tramo": int(row.get("tramo") or 0),
                        "debt": debt_per,
                        "paid": paid_per,
                        "created_at": now,
                    }
                )
                if len(snapshot_rows) >= 5000:
                    db.bulk_insert_mappings(AnalyticsContractSnapshot, snapshot_rows)
                    db.commit()
                    inserted += len(snapshot_rows)
                    snapshot_rows = []
        if snapshot_rows:
            db.bulk_insert_mappings(AnalyticsContractSnapshot, snapshot_rows)
            db.commit()
            inserted += len(snapshot_rows)
        return inserted

    now = datetime.utcnow()
    source_rows = list(normalized_rows or [])
    if source_rows:
        _append_snapshot_rows(source_rows, now)
        return

    page_size = 1000
    last_id = 0
    while True:
        fact_query = db.query(AnalyticsFact).filter(AnalyticsFact.id > last_id).order_by(AnalyticsFact.id.asc())
        if mode == "full_year" and year_from is not None:
            fact_query = fact_query.filter(func.substr(AnalyticsFact.gestion_month, 4, 4) == str(year_from))
        elif mode != "full_all" and target_months:
            fact_query = fact_query.filter(AnalyticsFact.gestion_month.in_(target_months))
        rows = fact_query.limit(page_size).all()
        if not rows:
            break
        batch = [
            {
                "contract_id": row.contract_id,
                "gestion_month": row.gestion_month,
                "supervisor": row.supervisor,
                "un": row.un,
                "via": row.via,
                "tramo": row.tramo,
                "contracts_total": row.contracts_total,
                "debt_total": row.debt_total,
                "paid_total": row.paid_total,
                "payload_json": row.payload_json,
            }
            for row in rows
        ]
        _append_snapshot_rows(batch, now)
        last_id = int(rows[-1].id or last_id)


def refresh_mv_options_tables(db: Session, affected_months: set[str], month_serial) -> dict[str, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if month_serial(str(m).strip()) > 0}, key=month_serial)
    if not months:
        return {"cartera": 0, "cohorte": 0, "rendimiento": 0, "anuales": 0}

    now = datetime.utcnow()

    db.query(MvOptionsCartera).filter(MvOptionsCartera.gestion_month.in_(months)).delete(synchronize_session=False)
    rows_cartera = (
        db.query(
            CarteraCorteAgg.gestion_month,
            CarteraCorteAgg.close_month,
            CarteraCorteAgg.un,
            CarteraCorteAgg.supervisor,
            CarteraCorteAgg.via_cobro,
            CarteraCorteAgg.categoria,
            CarteraCorteAgg.tramo,
            CarteraCorteAgg.contract_year,
        )
        .filter(CarteraCorteAgg.gestion_month.in_(months))
        .group_by(
            CarteraCorteAgg.gestion_month,
            CarteraCorteAgg.close_month,
            CarteraCorteAgg.un,
            CarteraCorteAgg.supervisor,
            CarteraCorteAgg.via_cobro,
            CarteraCorteAgg.categoria,
            CarteraCorteAgg.tramo,
            CarteraCorteAgg.contract_year,
        )
        .all()
    )
    cartera_mappings = [
        {
            "gestion_month": str(r.gestion_month or "").strip(),
            "close_month": str(r.close_month or "").strip(),
            "un": _normalize_dim(r.un, "S/D"),
            "supervisor": _normalize_dim(r.supervisor, "S/D"),
            "via_cobro": _normalize_dim(r.via_cobro, "DEBITO"),
            "categoria": _normalize_dim(r.categoria, "VIGENTE"),
            "tramo": int(r.tramo or 0),
            "contract_year": int(r.contract_year or 0),
            "updated_at": now,
        }
        for r in rows_cartera
    ]
    if cartera_mappings:
        db.bulk_insert_mappings(MvOptionsCartera, cartera_mappings)

    db.query(MvOptionsCohorte).filter(MvOptionsCohorte.cutoff_month.in_(months)).delete(synchronize_session=False)
    rows_cohorte = (
        db.query(
            CobranzasCohorteAgg.cutoff_month,
            CobranzasCohorteAgg.un,
            CobranzasCohorteAgg.supervisor,
            CobranzasCohorteAgg.via_cobro,
            CobranzasCohorteAgg.categoria,
        )
        .filter(CobranzasCohorteAgg.cutoff_month.in_(months))
        .group_by(
            CobranzasCohorteAgg.cutoff_month,
            CobranzasCohorteAgg.un,
            CobranzasCohorteAgg.supervisor,
            CobranzasCohorteAgg.via_cobro,
            CobranzasCohorteAgg.categoria,
        )
        .all()
    )
    cohorte_mappings = [
        {
            "cutoff_month": str(r.cutoff_month or "").strip(),
            "un": _normalize_dim(r.un, "S/D"),
            "supervisor": _normalize_dim(r.supervisor, "S/D"),
            "via_cobro": _normalize_dim(r.via_cobro, "DEBITO"),
            "categoria": _normalize_dim(r.categoria, "VIGENTE"),
            "updated_at": now,
        }
        for r in rows_cohorte
    ]
    if cohorte_mappings:
        db.bulk_insert_mappings(MvOptionsCohorte, cohorte_mappings)

    db.query(MvOptionsRendimiento).filter(MvOptionsRendimiento.gestion_month.in_(months)).delete(synchronize_session=False)
    rows_rend = (
        db.query(
            AnalyticsRendimientoAgg.gestion_month,
            AnalyticsRendimientoAgg.un,
            AnalyticsRendimientoAgg.supervisor,
            AnalyticsRendimientoAgg.via_cobro,
            AnalyticsRendimientoAgg.categoria,
            AnalyticsRendimientoAgg.tramo,
        )
        .filter(AnalyticsRendimientoAgg.gestion_month.in_(months))
        .group_by(
            AnalyticsRendimientoAgg.gestion_month,
            AnalyticsRendimientoAgg.un,
            AnalyticsRendimientoAgg.supervisor,
            AnalyticsRendimientoAgg.via_cobro,
            AnalyticsRendimientoAgg.categoria,
            AnalyticsRendimientoAgg.tramo,
        )
        .all()
    )
    rend_mappings = [
        {
            "gestion_month": str(r.gestion_month or "").strip(),
            "un": _normalize_dim(r.un, "S/D"),
            "supervisor": _normalize_dim(r.supervisor, "S/D"),
            "via_cobro": _normalize_dim(r.via_cobro, "DEBITO"),
            "categoria": _normalize_dim(r.categoria, "VIGENTE"),
            "tramo": int(r.tramo or 0),
            "updated_at": now,
        }
        for r in rows_rend
    ]
    if rend_mappings:
        db.bulk_insert_mappings(MvOptionsRendimiento, rend_mappings)

    db.query(MvOptionsAnuales).filter(MvOptionsAnuales.cutoff_month.in_(months)).delete(synchronize_session=False)
    rows_anuales = (
        db.query(
            AnalyticsAnualesAgg.cutoff_month,
            AnalyticsAnualesAgg.sale_month,
            AnalyticsAnualesAgg.sale_year,
            AnalyticsAnualesAgg.un,
        )
        .filter(AnalyticsAnualesAgg.cutoff_month.in_(months))
        .group_by(
            AnalyticsAnualesAgg.cutoff_month,
            AnalyticsAnualesAgg.sale_month,
            AnalyticsAnualesAgg.sale_year,
            AnalyticsAnualesAgg.un,
        )
        .all()
    )
    anuales_mappings = [
        {
            "cutoff_month": str(r.cutoff_month or "").strip(),
            "sale_month": str(r.sale_month or "").strip(),
            "sale_year": int(r.sale_year or 0),
            "un": _normalize_dim(r.un, "S/D"),
            "updated_at": now,
        }
        for r in rows_anuales
        if month_serial(str(r.cutoff_month or "").strip()) > 0
    ]
    if anuales_mappings:
        db.bulk_insert_mappings(MvOptionsAnuales, anuales_mappings)

    db.commit()
    return {
        "cartera": len(cartera_mappings),
        "cohorte": len(cohorte_mappings),
        "rendimiento": len(rend_mappings),
        "anuales": len(anuales_mappings),
    }


def bootstrap_mv_options_full(db: Session, month_serial) -> dict[str, int]:
    now = datetime.utcnow()

    db.query(MvOptionsCartera).delete(synchronize_session=False)
    rows_cartera = (
        db.query(
            CarteraCorteAgg.gestion_month,
            CarteraCorteAgg.close_month,
            CarteraCorteAgg.un,
            CarteraCorteAgg.supervisor,
            CarteraCorteAgg.via_cobro,
            CarteraCorteAgg.categoria,
            CarteraCorteAgg.tramo,
            CarteraCorteAgg.contract_year,
        )
        .group_by(
            CarteraCorteAgg.gestion_month,
            CarteraCorteAgg.close_month,
            CarteraCorteAgg.un,
            CarteraCorteAgg.supervisor,
            CarteraCorteAgg.via_cobro,
            CarteraCorteAgg.categoria,
            CarteraCorteAgg.tramo,
            CarteraCorteAgg.contract_year,
        )
        .all()
    )
    cartera_mappings = [
        {
            "gestion_month": str(r.gestion_month or "").strip(),
            "close_month": str(r.close_month or "").strip(),
            "un": _normalize_dim(r.un, "S/D"),
            "supervisor": _normalize_dim(r.supervisor, "S/D"),
            "via_cobro": _normalize_dim(r.via_cobro, "DEBITO"),
            "categoria": _normalize_dim(r.categoria, "VIGENTE"),
            "tramo": int(r.tramo or 0),
            "contract_year": int(r.contract_year or 0),
            "updated_at": now,
        }
        for r in rows_cartera
        if month_serial(str(r.gestion_month or "").strip()) > 0
    ]
    if cartera_mappings:
        db.bulk_insert_mappings(MvOptionsCartera, cartera_mappings)

    db.query(MvOptionsCohorte).delete(synchronize_session=False)
    rows_cohorte = (
        db.query(
            CobranzasCohorteAgg.cutoff_month,
            CobranzasCohorteAgg.un,
            CobranzasCohorteAgg.supervisor,
            CobranzasCohorteAgg.via_cobro,
            CobranzasCohorteAgg.categoria,
        )
        .group_by(
            CobranzasCohorteAgg.cutoff_month,
            CobranzasCohorteAgg.un,
            CobranzasCohorteAgg.supervisor,
            CobranzasCohorteAgg.via_cobro,
            CobranzasCohorteAgg.categoria,
        )
        .all()
    )
    cohorte_mappings = [
        {
            "cutoff_month": str(r.cutoff_month or "").strip(),
            "un": _normalize_dim(r.un, "S/D"),
            "supervisor": _normalize_dim(r.supervisor, "S/D"),
            "via_cobro": _normalize_dim(r.via_cobro, "DEBITO"),
            "categoria": _normalize_dim(r.categoria, "VIGENTE"),
            "updated_at": now,
        }
        for r in rows_cohorte
        if month_serial(str(r.cutoff_month or "").strip()) > 0
    ]
    if cohorte_mappings:
        db.bulk_insert_mappings(MvOptionsCohorte, cohorte_mappings)

    db.query(MvOptionsRendimiento).delete(synchronize_session=False)
    rows_rend = (
        db.query(
            AnalyticsRendimientoAgg.gestion_month,
            AnalyticsRendimientoAgg.un,
            AnalyticsRendimientoAgg.supervisor,
            AnalyticsRendimientoAgg.via_cobro,
            AnalyticsRendimientoAgg.categoria,
            AnalyticsRendimientoAgg.tramo,
        )
        .group_by(
            AnalyticsRendimientoAgg.gestion_month,
            AnalyticsRendimientoAgg.un,
            AnalyticsRendimientoAgg.supervisor,
            AnalyticsRendimientoAgg.via_cobro,
            AnalyticsRendimientoAgg.categoria,
            AnalyticsRendimientoAgg.tramo,
        )
        .all()
    )
    rend_mappings = [
        {
            "gestion_month": str(r.gestion_month or "").strip(),
            "un": _normalize_dim(r.un, "S/D"),
            "supervisor": _normalize_dim(r.supervisor, "S/D"),
            "via_cobro": _normalize_dim(r.via_cobro, "DEBITO"),
            "categoria": _normalize_dim(r.categoria, "VIGENTE"),
            "tramo": int(r.tramo or 0),
            "updated_at": now,
        }
        for r in rows_rend
        if month_serial(str(r.gestion_month or "").strip()) > 0
    ]
    if rend_mappings:
        db.bulk_insert_mappings(MvOptionsRendimiento, rend_mappings)

    db.query(MvOptionsAnuales).delete(synchronize_session=False)
    rows_anuales = (
        db.query(
            AnalyticsAnualesAgg.cutoff_month,
            AnalyticsAnualesAgg.sale_month,
            AnalyticsAnualesAgg.sale_year,
            AnalyticsAnualesAgg.un,
        )
        .group_by(
            AnalyticsAnualesAgg.cutoff_month,
            AnalyticsAnualesAgg.sale_month,
            AnalyticsAnualesAgg.sale_year,
            AnalyticsAnualesAgg.un,
        )
        .all()
    )
    anuales_mappings = [
        {
            "cutoff_month": str(r.cutoff_month or "").strip(),
            "sale_month": str(r.sale_month or "").strip(),
            "sale_year": int(r.sale_year or 0),
            "un": _normalize_dim(r.un, "S/D"),
            "updated_at": now,
        }
        for r in rows_anuales
        if month_serial(str(r.cutoff_month or "").strip()) > 0
    ]
    if anuales_mappings:
        db.bulk_insert_mappings(MvOptionsAnuales, anuales_mappings)

    db.commit()
    return {
        "cartera": len(cartera_mappings),
        "cohorte": len(cohorte_mappings),
        "rendimiento": len(rend_mappings),
        "anuales": len(anuales_mappings),
    }


def mv_options_consistency_report(db: Session, month_serial) -> dict:
    def _distinct_months(model, column_name: str) -> set[str]:
        col = getattr(model, column_name)
        return {
            str(v[0] or "").strip()
            for v in db.query(col).distinct().all()
            if month_serial(str(v[0] or "").strip()) > 0
        }

    checks = {
        "cartera": {"expected": _distinct_months(CarteraCorteAgg, "gestion_month"), "actual": _distinct_months(MvOptionsCartera, "gestion_month")},
        "cohorte": {"expected": _distinct_months(CobranzasCohorteAgg, "cutoff_month"), "actual": _distinct_months(MvOptionsCohorte, "cutoff_month")},
        "rendimiento": {"expected": _distinct_months(AnalyticsRendimientoAgg, "gestion_month"), "actual": _distinct_months(MvOptionsRendimiento, "gestion_month")},
        "anuales": {"expected": _distinct_months(AnalyticsAnualesAgg, "cutoff_month"), "actual": _distinct_months(MvOptionsAnuales, "cutoff_month")},
    }
    out: dict[str, dict] = {}
    ok = True
    for key, item in checks.items():
        expected = item["expected"]
        actual = item["actual"]
        missing = sorted(expected - actual, key=month_serial)
        stale = sorted(actual - expected, key=month_serial)
        row_ok = not missing and not stale
        ok = ok and row_ok
        out[key] = {
            "ok": row_ok,
            "expected_months": len(expected),
            "actual_months": len(actual),
            "missing_months": missing,
            "stale_months": stale,
        }
    return {"ok": ok, "checks": out, "last_checked_at": datetime.utcnow().isoformat()}


def refresh_source_freshness_snapshots(db: Session, last_job_id: str | None = None) -> None:
    table = AnalyticsSourceFreshness.__table__
    now = datetime.utcnow()
    sources = [
        ("cartera_fact", None),
        ("cobranzas_fact", CobranzasFact.updated_at),
        ("cartera_corte_agg", CarteraCorteAgg.updated_at),
        ("cobranzas_cohorte_agg", CobranzasCohorteAgg.updated_at),
        ("analytics_rendimiento_agg", AnalyticsRendimientoAgg.updated_at),
        ("analytics_anuales_agg", AnalyticsAnualesAgg.updated_at),
        ("dim_negocio_contrato", DimNegocioContrato.updated_at),
        ("analytics_contract_snapshot", AnalyticsContractSnapshot.created_at),
        ("mv_options_cartera", MvOptionsCartera.updated_at),
        ("mv_options_cohorte", MvOptionsCohorte.updated_at),
        ("mv_options_rendimiento", MvOptionsRendimiento.updated_at),
        ("mv_options_anuales", MvOptionsAnuales.updated_at),
    ]
    rows: list[dict] = []
    for source_name, source_col in sources:
        if source_name == "cartera_fact":
            from app.models.brokers import CarteraFact
            source_col = CarteraFact.updated_at
        dt = db.query(source_col).order_by(source_col.desc()).limit(1).scalar()
        rows.append({"source_table": source_name, "max_updated_at": dt, "updated_at": now, "last_job_id": last_job_id})
    if engine.dialect.name == "postgresql":
        stmt = pg_insert(table).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=[table.c.source_table],
            set_={"max_updated_at": stmt.excluded.max_updated_at, "updated_at": now, "last_job_id": stmt.excluded.last_job_id},
        )
    else:
        stmt = sqlite_insert(table).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["source_table"],
            set_={"max_updated_at": stmt.excluded.max_updated_at, "updated_at": now, "last_job_id": stmt.excluded.last_job_id},
        )
    db.execute(stmt)
    db.commit()
