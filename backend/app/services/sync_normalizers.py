from __future__ import annotations

import hashlib
import json
from datetime import UTC, date, datetime

from app.domain import add_months, canonical_via, categoria_from_tramo, month_from_any, monto_a_cobrar, normalize_month, tramo_from_cuotas_vencidas

BUSINESS_KEY_FIELDS = ["domain", "contract_id", "gestion_month", "supervisor", "un", "via", "tramo"]


def _to_float(value: object) -> float:
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _to_int(value: object, default: int = 0) -> int:
    try:
        return int(float(value or default))
    except (TypeError, ValueError):
        return default


def normalize_payment_via_class(value: object) -> str:
    return canonical_via(value)


def normalize_key(row: dict, *candidates: str) -> str:
    for key in candidates:
        if key in row and str(row.get(key) or "").strip():
            return str(row.get(key)).strip()
    lower = {str(k).lower(): k for k in row.keys()}
    for key in candidates:
        resolved = lower.get(key.lower())
        if resolved and str(row.get(resolved) or "").strip():
            return str(row.get(resolved)).strip()
    return ""


def parse_date_key(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


def parse_iso_date(value: object) -> date | None:
    text = parse_date_key(value)
    if not text:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_payment_date(row: dict) -> date | None:
    day = normalize_key(row, "Dia", "day", "dia")
    month = normalize_key(row, "Mes", "mes", "month")
    year = normalize_key(row, "Año", "AÃ±o", "anio", "year")
    if day.isdigit() and month.isdigit() and year.isdigit():
        try:
            return date(int(year), int(month), int(day))
        except ValueError:
            pass
    return parse_iso_date(normalize_key(row, "date", "payment_date", "Actualizado_al"))


def normalize_record(domain: str, row: dict, seq: int) -> dict:
    contract_id = normalize_key(row, "contract_id", "id_contrato", "id") or f"{domain}_{seq}"
    close_date = parse_date_key(normalize_key(row, "fecha_cierre", "closed_date", "close_date"))
    close_month = normalize_month(close_date) if close_date else normalize_month(normalize_key(row, "fecha_cierre", "closed_date", "close_date"))
    raw_gestion_month = normalize_key(row, "gestion_month")
    gestion_month = normalize_month(raw_gestion_month)
    if not gestion_month:
        year = normalize_key(row, "Año", "AÃ±o", "anio", "year")
        month = normalize_key(row, "Mes", "mes", "month")
        if year.isdigit() and month.isdigit():
            gestion_month = f"{int(month):02d}/{year}"
    if not gestion_month:
        if domain == "cartera" and close_month:
            gestion_month = add_months(close_month, 1)
        if not gestion_month:
            gestion_month = normalize_month(normalize_key(row, "from_date", "date", "fecha_contrato", "fecha_cierre", "Actualizado_al"))
    if domain == "cartera" and close_month:
        parsed_raw = normalize_month(raw_gestion_month) if raw_gestion_month else ""
        if not raw_gestion_month or parsed_raw == close_month:
            shifted = add_months(close_month, 1)
            if shifted:
                gestion_month = shifted
    if not gestion_month:
        gestion_month = datetime.now(UTC).strftime("%m/%Y")

    supervisor = normalize_key(row, "supervisor", "Supervisor", "Gestor", "Vendedor").upper() or "S/D"
    un = normalize_key(row, "un", "UN").upper() or "S/D"
    via = normalize_key(row, "via", "via_cobro", "via_de_cobro", "VP").upper() or "S/D"

    if domain == "cartera":
        tramo = tramo_from_cuotas_vencidas(normalize_key(row, "cuotas_vencidas", "quotas_expirations", "tramo"))
    else:
        tramo = tramo_from_cuotas_vencidas(normalize_key(row, "tramo"))

    payload_json = "{}"
    source_hash = ""
    payment_date = None
    payment_month = ""
    payment_year = 0
    payment_amount = 0.0
    payment_via_class = ""
    source_row_id = ""
    analytics_contracts_total = 1
    analytics_debt_total = 0.0
    analytics_paid_total = 0.0

    if domain == "cobranzas":
        source_row_id = normalize_key(row, "payment_way_id", "account_payment_way_id", "apw_id", "id")
        parsed_payment_date = parse_payment_date(row)
        payment_date = parsed_payment_date.strftime("%Y-%m-%d") if parsed_payment_date else ""
        payment_month = normalize_month(parsed_payment_date.strftime("%Y-%m-%d") if parsed_payment_date else "") or gestion_month
        payment_year = int(payment_month[-4:]) if payment_month else datetime.now(UTC).year
        payment_amount = _to_float(normalize_key(row, "monto", "amount", "payment_amount"))
        payment_via_class = normalize_payment_via_class(via)
        signature = (
            f"{source_row_id}|{contract_id}|{gestion_month}|{payment_date}|{payment_amount}|"
            f"{payment_via_class}|{supervisor}|{un}|{via}|{tramo}"
        )
        source_hash = hashlib.sha256(signature.encode("utf-8")).hexdigest()
    elif domain == "analytics":
        analytics_contracts_total = max(1, _to_int(row.get("contracts_total") or row.get("contracts") or row.get("cantidad_contratos") or 1, 1))
        analytics_debt_total = _to_float(row.get("debt_total") or row.get("debt") or row.get("total_saldo") or row.get("deberia"))
        analytics_paid_total = _to_float(row.get("paid_total") or row.get("paid") or row.get("cobrado"))
        signature = (
            f"{contract_id}|{gestion_month}|{supervisor}|{un}|{via}|{tramo}|"
            f"{analytics_contracts_total}|{analytics_debt_total}|{analytics_paid_total}"
        )
        source_hash = hashlib.sha256(signature.encode("utf-8")).hexdigest()
    else:
        payload_json = json.dumps(row, ensure_ascii=False, sort_keys=True, default=str)
        source_hash = hashlib.sha256(payload_json.encode("utf-8")).hexdigest()

    return {
        "domain": domain,
        "contract_id": str(contract_id)[:64],
        "gestion_month": str(gestion_month)[:7],
        "supervisor": str(supervisor)[:128],
        "un": str(un)[:128],
        "via": str(via)[:32],
        "tramo": tramo,
        "close_date": close_date,
        "close_month": str(close_month)[:7] if close_month else "",
        "payment_date": payment_date,
        "payment_month": payment_month,
        "payment_year": payment_year,
        "payment_amount": payment_amount,
        "payment_via_class": payment_via_class,
        "source_row_id": source_row_id,
        "contracts_total": analytics_contracts_total,
        "debt_total": analytics_debt_total,
        "paid_total": analytics_paid_total,
        "payload_json": payload_json,
        "source_hash": source_hash,
    }


def fact_row_from_normalized(domain: str, normalized: dict) -> dict:
    try:
        payload = json.loads(normalized.get("payload_json") or "{}")
    except Exception:
        payload = {}

    gestion_month = str(normalized.get("gestion_month") or "")
    close_month = str(normalized.get("close_month") or "")
    if not normalize_month(close_month):
        close_month = normalize_month(normalized.get("close_date") or "") or gestion_month
    close_year = int(close_month[-4:]) if close_month else datetime.now(UTC).year
    close_date = parse_iso_date(normalized.get("close_date"))
    if close_date is None:
        try:
            close_date = datetime.strptime(f"01/{close_month}", "%d/%m/%Y").date()
        except ValueError:
            close_date = datetime.now(UTC).date()

    tramo = tramo_from_cuotas_vencidas(normalized.get("tramo"))
    category = categoria_from_tramo(tramo)
    loaded_at = datetime.now(UTC).replace(tzinfo=None)
    base = {
        "contract_id": normalized["contract_id"],
        "gestion_month": gestion_month,
        "supervisor": normalized["supervisor"],
        "un": normalized["un"],
        "source_hash": normalized["source_hash"],
        "payload_json": normalized["payload_json"],
        "loaded_at": loaded_at,
        "updated_at": loaded_at,
    }

    if domain == "cartera":
        cuota_amount = _to_float(payload.get("monto_cuota") or payload.get("cuota"))
        monto_vencido = _to_float(payload.get("monto_vencido") or payload.get("expired_amount") or payload.get("capital_vencido"))
        _ = monto_a_cobrar(monto_vencido, cuota_amount)
        return {
            **base,
            "close_date": close_date,
            "close_month": close_month,
            "close_year": close_year,
            "contract_date": parse_iso_date(payload.get("fecha_contrato")),
            "contract_month": month_from_any(payload.get("fecha_contrato")) or "",
            "culm_date": parse_iso_date(payload.get("fecha_culminacion") or payload.get("fecha_culminación") or payload.get("fecha_fin") or payload.get("fecha_terminacion")),
            "culm_month": month_from_any(payload.get("fecha_culminacion") or payload.get("fecha_culminación") or payload.get("fecha_fin") or payload.get("fecha_terminacion")) or "",
            "cuota_amount": cuota_amount,
            "via_cobro": normalized["via"],
            "tramo": tramo,
            "category": category,
            "contracts_total": max(1, _to_int(payload.get("contracts_total") or 1, 1)),
            "monto_vencido": monto_vencido,
            "total_saldo": _to_float(payload.get("total_saldo") or payload.get("total_residue")),
            "capital_saldo": _to_float(payload.get("capital_saldo") or payload.get("capital_amount_residue")),
            "capital_vencido": _to_float(payload.get("capital_vencido") or payload.get("expired_capital_amount")),
        }
    if domain == "analytics":
        return {
            **base,
            "via": normalized["via"],
            "tramo": tramo,
            "contracts_total": max(1, _to_int(normalized.get("contracts_total"), 1)),
            "debt_total": _to_float(normalized.get("debt_total")),
            "paid_total": _to_float(normalized.get("paid_total")),
        }
    if domain == "cobranzas":
        payment_date = parse_iso_date(normalized.get("payment_date"))
        if payment_date is None:
            try:
                payment_date = datetime.strptime(f"01/{gestion_month}", "%d/%m/%Y").date()
            except ValueError:
                payment_date = datetime.now(UTC).date()
        payment_month = str(normalized.get("payment_month") or gestion_month)[:7]
        payment_year = int(normalized.get("payment_year") or (payment_month[-4:] if payment_month else datetime.now(UTC).year))
        return {
            **base,
            "via": normalized["via"],
            "tramo": tramo,
            "source_row_id": str(normalized.get("source_row_id") or "")[:64] or None,
            "payment_date": payment_date,
            "payment_month": payment_month,
            "payment_year": payment_year,
            "payment_amount": _to_float(normalized.get("payment_amount") or payload.get("monto")),
            "payment_via_class": normalize_payment_via_class(normalized.get("payment_via_class") or normalized["via"]),
        }
    return {
        **base,
        "via": normalized["via"],
        "tramo": tramo,
    }


def source_dedupe_key(normalized: dict) -> tuple:
    domain = str(normalized.get("domain") or "").strip().lower()
    if domain == "cartera":
        close_date = normalized.get("close_date") or normalized.get("gestion_month") or ""
        return (normalized.get("domain"), normalized.get("contract_id"), close_date)
    if domain == "cobranzas":
        return (normalized.get("domain"), normalized.get("source_row_id") or normalized.get("source_hash"))
    return tuple(normalized[k] for k in BUSINESS_KEY_FIELDS)


def dedupe_rows_in_chunk(rows: list[dict]) -> tuple[list[dict], int]:
    if not rows:
        return [], 0
    deduped: list[dict] = []
    seen: set[tuple] = set()
    duplicates = 0
    for item in rows:
        key = source_dedupe_key(item)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        deduped.append(item)
    return deduped, duplicates
