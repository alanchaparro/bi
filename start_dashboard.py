import csv
import gzip
import http.server
import json
import os
import pickle
import re
import socketserver
import subprocess
import threading
import time
import webbrowser
from collections import defaultdict
from urllib.parse import parse_qs, urlparse

PORT = 5000
CACHE_DIR = ".cache"
ANALYTICS_INDEX_CACHE_FILE = os.path.join(CACHE_DIR, "analytics_index.pkl.gz")
ANALYTICS_MONTHLY_FILE = "analytics_monthly.csv"
ANALYTICS_META_FILE = "analytics_meta.json"

DATA_FILES = {
    "cartera": "cartera.csv",
    "cobranzas": "cobranzas_prepagas.csv",
    "gestores": "gestores.csv",
    "contratos": "contratos.csv",
}

DATA_CACHE = {
    "stamp": "",
    "rows": {"cartera": [], "cobranzas": [], "gestores": [], "contratos": []},
    "mtime": {"cartera": 0, "cobranzas": 0, "gestores": 0, "contratos": 0},
    "aggr": {},
}

ANALYTICS_CACHE = {}
LOOKUP_CACHE = {
    "supervisor_by_id": {},
    "gestores_by_key": {},
    "mtime": {"gestores": 0, "contratos": 0},
}
ANALYTICS_INDEX = {
    "stamp": "",
    "cartera_entries": [],
    "paid_total_by_key": {},
    "paid_by_via_by_key": {},
}
ANALYTICS_INDEX_LOCK = threading.Lock()
ANALYTICS_MONTHLY_CACHE = {
    "mtime": 0,
    "rows": [],
}
ANALYTICS_MONTHLY_LOCK = threading.Lock()


def log_event(event, **fields):
    payload = {"event": event, "ts": time.time(), **fields}
    print(json.dumps(payload, ensure_ascii=False))


def norm_d(value):
    val = str(value or "").strip()
    if "/" not in val:
        return val
    parts = re.sub(r"[^0-9/]", "", val).split("/")
    if len(parts) < 2:
        return val
    return f"{parts[0].zfill(2)}/{parts[1]}"


def month_from_date(value):
    val = str(value or "").strip()
    if not val:
        return ""
    if re.match(r"^\d{1,2}/\d{4}$", val):
        return norm_d(val)
    m = re.match(r"^(\d{4})[-/](\d{1,2})[-/]\d{1,2}", val)
    if m:
        return f"{str(m.group(2)).zfill(2)}/{m.group(1)}"
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})", val)
    if m:
        return f"{str(m.group(2)).zfill(2)}/{m.group(3)}"
    return ""


def month_to_serial(mm_yyyy):
    m = re.match(r"^(\d{1,2})/(\d{4})$", str(mm_yyyy or "").strip())
    if not m:
        return -1
    month = int(m.group(1))
    year = int(m.group(2))
    return year * 12 + month


def year_from_mm_yyyy(mm_yyyy):
    m = re.match(r"^\d{1,2}/(\d{4})$", str(mm_yyyy or "").strip())
    return m.group(1) if m else ""


def months_between_date_and_month(date_yyyy_mm_dd, mm_yyyy):
    date_val = str(date_yyyy_mm_dd or "").strip()
    month_val = str(mm_yyyy or "").strip()
    d = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", date_val)
    m = re.match(r"^(\d{1,2})/(\d{4})$", month_val)
    if not d or not m:
        return 0
    contract_year = int(d.group(1))
    contract_month = int(d.group(2))
    gestion_month = int(m.group(1))
    gestion_year = int(m.group(2))
    diff = (gestion_year - contract_year) * 12 + (gestion_month - contract_month)
    if diff < 0:
        diff = 0
    return 1 if diff == 0 else diff


def normalize_via_cobro(via):
    raw = str(via or "").strip().upper()
    return "COBRADOR" if raw in {"COBRADOR", "COB"} else "DEBITO"


def to_float(value, default=0.0):
    try:
        return float(str(value).replace(",", "."))
    except Exception:
        return default


def to_int(value, default=0):
    try:
        return int(float(value))
    except Exception:
        return default


def read_csv_rows(path):
    if not os.path.exists(path):
        return []
    rows = []
    with open(path, "r", encoding="utf-8-sig", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def normalize_row(dataset, row):
    item = dict(row)
    if dataset == "cartera":
        item["_cId"] = re.sub(r"[^0-9]", "", str(item.get("id_contrato", "")))
        item["_feNorm"] = month_from_date(item.get("Fecha gestion", "")) or norm_d(item.get("Fecha gestion", "")) or "S/D"
        item["_saleMonth"] = month_from_date(item.get("fecha_contrato", "")) or "S/D"
        item["_cierreMonth"] = month_from_date(item.get("fecha_cierre", "")) or "S/D"
        sm = str(item.get("_saleMonth", "")).split("/")
        item["_saleMonthNum"] = sm[0] if len(sm) == 2 else ""
        item["_saleYear"] = sm[1] if len(sm) == 2 else ""
    elif dataset == "cobranzas":
        raw_m = item.get("Mes") or item.get("mes") or item.get("month") or 0
        raw_a = item.get("Año") or item.get("AÃ±o") or item.get("Ano") or item.get("Ao") or item.get("year") or ""
        m_str = str(raw_m)
        item["_feNorm"] = f"{m_str.zfill(2)}/{raw_a}" if raw_a else ""
        item["_cId"] = re.sub(r"[^0-9]", "", str(item.get("contract_id") or item.get("id_contrato") or ""))
    elif dataset == "gestores":
        from_date = str(item.get("from_date", ""))
        parts = from_date.split("-")
        if len(parts) >= 2:
            item["_feNorm"] = f"{parts[1].zfill(2)}/{parts[0]}"
        else:
            item["_feNorm"] = ""
        item["_cId"] = re.sub(r"[^0-9]", "", str(item.get("contract_id", "")))
    elif dataset == "contratos":
        item["_cId"] = re.sub(r"[^0-9]", "", str(item.get("id") or item.get("contract_id") or ""))
        item["_contractMonth"] = month_from_date(item.get("date", "")) or "S/D"
        item["_culminacionMonth"] = month_from_date(item.get("fecha_de_culminacion", "")) or ""
        item["_supervisor"] = str(item.get("Supervisor") or "S/D").strip() or "S/D"
        item["_contractYear"] = item["_contractMonth"].split("/")[1] if "/" in item["_contractMonth"] else "S/D"
    return item


def normalize_rows(dataset, rows):
    return [normalize_row(dataset, r) for r in rows]


def iter_csv_rows(path):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8-sig", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield row


def invalidate_analytics_cache():
    ANALYTICS_CACHE.clear()


def invalidate_analytics_index():
    ANALYTICS_INDEX["stamp"] = ""
    ANALYTICS_INDEX["cartera_entries"] = []
    ANALYTICS_INDEX["paid_total_by_key"] = {}
    ANALYTICS_INDEX["paid_by_via_by_key"] = {}
    try:
        if os.path.exists(ANALYTICS_INDEX_CACHE_FILE):
            os.remove(ANALYTICS_INDEX_CACHE_FILE)
    except Exception:
        pass


def refresh_data_cache(force=False):
    changed = force
    mtimes = {}
    for name, path in DATA_FILES.items():
        mtimes[name] = os.path.getmtime(path) if os.path.exists(path) else 0
        if mtimes[name] != DATA_CACHE["mtime"].get(name):
            changed = True

    if not changed and DATA_CACHE["stamp"]:
        return

    rows = {}
    for name, path in DATA_FILES.items():
        rows[name] = normalize_rows(name, read_csv_rows(path))

    stamp = "|".join([f"{k}:{len(rows[k])}:{mtimes[k]}" for k in ["cartera", "cobranzas", "gestores", "contratos"]])

    DATA_CACHE["rows"] = rows
    DATA_CACHE["mtime"] = mtimes
    DATA_CACHE["stamp"] = stamp
    DATA_CACHE["aggr"] = build_aggregates(rows)
    invalidate_analytics_cache()
    log_event("data_cache_refreshed", stamp=stamp)


def build_aggregates(rows):
    cob_by_key_amount = defaultdict(float)
    cob_by_key_detailed = {}
    cob_by_contract_month = defaultdict(dict)

    for r in rows["cobranzas"]:
        c_id = r.get("_cId", "")
        mm = r.get("_feNorm", "")
        if not c_id or not mm:
            continue
        key = f"{c_id}_{mm}"
        monto = to_float(r.get("monto") or 0)
        via = str(r.get("VP") or "S/D").strip() or "S/D"
        cob_by_key_amount[key] += monto
        if key not in cob_by_key_detailed:
            cob_by_key_detailed[key] = {"total": 0.0, "byVia": defaultdict(float)}
        cob_by_key_detailed[key]["total"] += monto
        cob_by_key_detailed[key]["byVia"][via] += monto
        cob_by_contract_month[c_id][mm] = cob_by_contract_month[c_id].get(mm, 0.0) + monto

    contracts_by_id = {}
    supervisor_by_id = {}
    for c in rows["contratos"]:
        c_id = c.get("_cId", "")
        if not c_id:
            continue
        contracts_by_id[c_id] = c
        supervisor_by_id[c_id] = str(c.get("_supervisor") or "S/D").strip() or "S/D"

    gestores_by_key = {}
    for g in rows["gestores"]:
        c_id = g.get("_cId", "")
        mm = g.get("_feNorm", "")
        if c_id and mm:
            gestores_by_key[f"{c_id}_{mm}"] = str(g.get("Gestor") or "S/D")

    # Convert nested defaultdicts
    for key, val in cob_by_key_detailed.items():
        val["byVia"] = dict(val["byVia"])

    return {
        "cob_by_key_amount": dict(cob_by_key_amount),
        "cob_by_key_detailed": cob_by_key_detailed,
        "cob_by_contract_month": dict(cob_by_contract_month),
        "contracts_by_id": contracts_by_id,
        "supervisor_by_id": supervisor_by_id,
        "gestores_by_key": gestores_by_key,
    }


def split_multi(values):
    out = []
    for raw in values:
        for part in str(raw).split(","):
            part = part.strip()
            if part:
                out.append(part)
    return out


def parse_filter_set(params, name):
    vals = params.get(name, [])
    return set(split_multi(vals))


def parse_debug_flag(params):
    raw = str((params.get("debug", ["0"]) or ["0"])[0]).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def validate_month_set(month_set):
    for m in month_set:
        if not re.match(r"^\d{2}/\d{4}$", m):
            return False
    return True


def validate_year_set(year_set):
    for y in year_set:
        if not re.match(r"^\d{4}$", str(y)):
            return False
    return True


def analytics_cache_key(endpoint, params):
    parts = []
    for k in sorted(params.keys()):
        parts.append(f"{k}={','.join(sorted(split_multi(params.get(k, []))))}")
    return f"{endpoint}|{analytics_source_stamp()}|{'&'.join(parts)}"


def data_stamp():
    return "|".join([f"{k}:{(os.path.getmtime(v) if os.path.exists(v) else 0)}" for k, v in DATA_FILES.items()])


def analytics_source_stamp():
    monthly_mtime = os.path.getmtime(ANALYTICS_MONTHLY_FILE) if os.path.exists(ANALYTICS_MONTHLY_FILE) else 0
    meta_mtime = os.path.getmtime(ANALYTICS_META_FILE) if os.path.exists(ANALYTICS_META_FILE) else 0
    return f"{data_stamp()}|analytics_monthly:{monthly_mtime}|analytics_meta:{meta_mtime}"


def clear_analytics_monthly_cache():
    ANALYTICS_MONTHLY_CACHE["mtime"] = 0
    ANALYTICS_MONTHLY_CACHE["rows"] = []


def parse_monthly_paid(row, sel_via_pago):
    paid_total = to_float(row.get("paid_total", 0))
    contracts_paid = to_int(row.get("contracts_paid", 0))
    if not sel_via_pago:
        return paid_total, contracts_paid

    paid = 0.0
    contracts_paid_filtered = 0
    if "DEBITO" in sel_via_pago:
        paid += to_float(row.get("paid_via_debito", 0))
        contracts_paid_filtered += to_int(row.get("contracts_paid_via_debito", 0))
    if "COBRADOR" in sel_via_pago:
        paid += to_float(row.get("paid_via_cobrador", 0))
        contracts_paid_filtered += to_int(row.get("contracts_paid_via_cobrador", 0))
    contracts_total = to_int(row.get("contracts_total", 0))
    if contracts_paid_filtered > contracts_total:
        contracts_paid_filtered = contracts_total
    return paid, contracts_paid_filtered


def load_analytics_monthly_rows(force=False):
    if not os.path.exists(ANALYTICS_MONTHLY_FILE):
        clear_analytics_monthly_cache()
        return []

    mtime = os.path.getmtime(ANALYTICS_MONTHLY_FILE)
    if not force and ANALYTICS_MONTHLY_CACHE["mtime"] == mtime and ANALYTICS_MONTHLY_CACHE["rows"]:
        return ANALYTICS_MONTHLY_CACHE["rows"]

    with ANALYTICS_MONTHLY_LOCK:
        if not force and ANALYTICS_MONTHLY_CACHE["mtime"] == mtime and ANALYTICS_MONTHLY_CACHE["rows"]:
            return ANALYTICS_MONTHLY_CACHE["rows"]

        rows = []
        for raw in iter_csv_rows(ANALYTICS_MONTHLY_FILE):
            gm = norm_d(raw.get("gestion_month", "")) or ""
            if not re.match(r"^\d{2}/\d{4}$", gm):
                continue
            tr = str(raw.get("tramo", "0")).strip()
            if tr == "":
                tr = "0"
            via = str(raw.get("via_cobro", "")).strip().upper()
            cat = str(raw.get("categoria", "")).strip().upper()

            rows.append({
                "gestion_month": gm,
                "un": str(raw.get("un", "S/D")).strip() or "S/D",
                "tramo": tr,
                "categoria": "VIGENTE" if cat.startswith("VIG") else "MOROSO",
                "via_cobro": "COBRADOR" if via == "COBRADOR" else "DEBITO",
                "supervisor": str(raw.get("supervisor", "S/D")).strip() or "S/D",
                "contracts_total": to_int(raw.get("contracts_total", 0)),
                "contracts_paid": to_int(raw.get("contracts_paid", 0)),
                "debt_total": to_float(raw.get("debt_total", 0)),
                "paid_total": to_float(raw.get("paid_total", 0)),
                "paid_via_debito": to_float(raw.get("paid_via_debito", 0)),
                "paid_via_cobrador": to_float(raw.get("paid_via_cobrador", 0)),
                "contracts_paid_via_debito": to_int(raw.get("contracts_paid_via_debito", 0)),
                "contracts_paid_via_cobrador": to_int(raw.get("contracts_paid_via_cobrador", 0)),
            })

        ANALYTICS_MONTHLY_CACHE["mtime"] = mtime
        ANALYTICS_MONTHLY_CACHE["rows"] = rows
        log_event("analytics_monthly_loaded", rows=len(rows))
        return rows


def compute_portfolio_summary_and_trend_from_monthly(params):
    rows = load_analytics_monthly_rows()
    sel_un = parse_filter_set(params, "un")
    sel_fecha = parse_filter_set(params, "gestion_month")
    sel_via = parse_filter_set(params, "via_cobro")
    sel_cat = parse_filter_set(params, "categoria")
    sel_super = parse_filter_set(params, "supervisor")
    sel_tramo = parse_filter_set(params, "tramo")
    sel_via_pago = parse_filter_set(params, "via_pago")

    by_gestion = {}
    totals = {"total": 0, "vigente": 0, "moroso": 0, "cobrador": 0, "debito": 0, "totalDebt": 0.0, "totalPaid": 0.0}

    for r in rows:
        if sel_un and r["un"] not in sel_un:
            continue
        if sel_fecha and r["gestion_month"] not in sel_fecha:
            continue
        if sel_via and r["via_cobro"] not in sel_via:
            continue
        if sel_cat and r["categoria"] not in sel_cat:
            continue
        if sel_super and r["supervisor"] not in sel_super:
            continue
        if sel_tramo and r["tramo"] not in sel_tramo:
            continue

        paid_val, paid_contracts = parse_monthly_paid(r, sel_via_pago)
        m = r["gestion_month"]
        if m not in by_gestion:
            by_gestion[m] = {
                "total": 0,
                "vigente": 0,
                "moroso": 0,
                "cobrador": 0,
                "debito": 0,
                "debt": 0.0,
                "paid": 0.0,
                "paidContracts": 0,
            }

        ct = r["contracts_total"]
        debt = r["debt_total"]
        row = by_gestion[m]
        row["total"] += ct
        if r["categoria"] == "VIGENTE":
            row["vigente"] += ct
        else:
            row["moroso"] += ct
        if r["via_cobro"] == "COBRADOR":
            row["cobrador"] += ct
        else:
            row["debito"] += ct
        row["debt"] += debt
        row["paid"] += paid_val
        row["paidContracts"] += paid_contracts

        totals["total"] += ct
        if r["categoria"] == "VIGENTE":
            totals["vigente"] += ct
        else:
            totals["moroso"] += ct
        if r["via_cobro"] == "COBRADOR":
            totals["cobrador"] += ct
        else:
            totals["debito"] += ct
        totals["totalDebt"] += debt
        totals["totalPaid"] += paid_val

    return totals, by_gestion


def compute_performance_from_monthly(params):
    rows = load_analytics_monthly_rows()
    sel_un = parse_filter_set(params, "un")
    sel_tramo = parse_filter_set(params, "tramo")
    sel_fecha = parse_filter_set(params, "gestion_month")
    sel_via_cobro = parse_filter_set(params, "via_cobro")
    sel_via_pago = parse_filter_set(params, "via_pago")
    sel_cat = parse_filter_set(params, "categoria")
    sel_super = parse_filter_set(params, "supervisor")

    stats = {
        "totalDebt": 0.0,
        "totalPaid": 0.0,
        "totalContracts": 0,
        "totalContractsPaid": 0,
        "tramoStats": {},
        "unStats": {},
        "viaCStats": {},
        "gestorStats": {},
        "matrixStats": {},
        "trendStats": {},
    }

    for r in rows:
        if sel_un and r["un"] not in sel_un:
            continue
        if sel_tramo and r["tramo"] not in sel_tramo:
            continue
        if sel_fecha and r["gestion_month"] not in sel_fecha:
            continue
        if sel_via_cobro and r["via_cobro"] not in sel_via_cobro:
            continue
        if sel_cat and r["categoria"] not in sel_cat:
            continue
        if sel_super and r["supervisor"] not in sel_super:
            continue

        contracts_total = r["contracts_total"]
        paid_val, paid_contracts = parse_monthly_paid(r, sel_via_pago)
        debt = r["debt_total"]
        fe_norm = r["gestion_month"]
        tramo = r["tramo"]
        un = r["un"]
        via_c = r["via_cobro"]
        gestor = r["supervisor"]

        stats["totalDebt"] += debt
        stats["totalPaid"] += paid_val
        stats["totalContracts"] += contracts_total
        stats["totalContractsPaid"] += paid_contracts

        stats["trendStats"].setdefault(fe_norm, {"d": 0.0, "p": 0.0, "c": 0, "cp": 0})
        stats["trendStats"][fe_norm]["d"] += debt
        stats["trendStats"][fe_norm]["p"] += paid_val
        stats["trendStats"][fe_norm]["c"] += contracts_total
        stats["trendStats"][fe_norm]["cp"] += paid_contracts

        stats["tramoStats"].setdefault(tramo, {"d": 0.0, "p": 0.0})
        stats["tramoStats"][tramo]["d"] += debt
        stats["tramoStats"][tramo]["p"] += paid_val

        stats["unStats"].setdefault(un, {"d": 0.0, "p": 0.0})
        stats["unStats"][un]["d"] += debt
        stats["unStats"][un]["p"] += paid_val

        stats["viaCStats"].setdefault(via_c, {"d": 0.0, "p": 0.0})
        stats["viaCStats"][via_c]["d"] += debt
        stats["viaCStats"][via_c]["p"] += paid_val

        stats["gestorStats"].setdefault(gestor, {"d": 0.0, "p": 0.0})
        stats["gestorStats"][gestor]["d"] += debt
        stats["gestorStats"][gestor]["p"] += paid_val

        stats["matrixStats"].setdefault(via_c, {})
        if not sel_via_pago:
            if r["paid_via_debito"] > 0:
                stats["matrixStats"][via_c]["DEBITO"] = stats["matrixStats"][via_c].get("DEBITO", 0.0) + r["paid_via_debito"]
            if r["paid_via_cobrador"] > 0:
                stats["matrixStats"][via_c]["COBRADOR"] = stats["matrixStats"][via_c].get("COBRADOR", 0.0) + r["paid_via_cobrador"]
        else:
            if "DEBITO" in sel_via_pago and r["paid_via_debito"] > 0:
                stats["matrixStats"][via_c]["DEBITO"] = stats["matrixStats"][via_c].get("DEBITO", 0.0) + r["paid_via_debito"]
            if "COBRADOR" in sel_via_pago and r["paid_via_cobrador"] > 0:
                stats["matrixStats"][via_c]["COBRADOR"] = stats["matrixStats"][via_c].get("COBRADOR", 0.0) + r["paid_via_cobrador"]

    return stats


def load_analytics_index_from_disk(stamp):
    try:
        if not os.path.exists(ANALYTICS_INDEX_CACHE_FILE):
            return False
        with gzip.open(ANALYTICS_INDEX_CACHE_FILE, "rb") as f:
            payload = pickle.load(f)
        if not isinstance(payload, dict):
            return False
        if payload.get("stamp") != stamp:
            return False
        ANALYTICS_INDEX["stamp"] = payload.get("stamp", "")
        ANALYTICS_INDEX["cartera_entries"] = payload.get("cartera_entries", [])
        ANALYTICS_INDEX["paid_total_by_key"] = payload.get("paid_total_by_key", {})
        ANALYTICS_INDEX["paid_by_via_by_key"] = payload.get("paid_by_via_by_key", {})
        invalidate_analytics_cache()
        log_event(
            "analytics_index_loaded_disk",
            cartera_rows=len(ANALYTICS_INDEX["cartera_entries"]),
            cobranza_keys=len(ANALYTICS_INDEX["paid_total_by_key"]),
        )
        return True
    except Exception as e:
        log_event("analytics_index_load_failed", error=str(e))
        return False


def save_analytics_index_to_disk():
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        payload = {
            "stamp": ANALYTICS_INDEX["stamp"],
            "cartera_entries": ANALYTICS_INDEX["cartera_entries"],
            "paid_total_by_key": ANALYTICS_INDEX["paid_total_by_key"],
            "paid_by_via_by_key": ANALYTICS_INDEX["paid_by_via_by_key"],
        }
        with gzip.open(ANALYTICS_INDEX_CACHE_FILE, "wb") as f:
            pickle.dump(payload, f, protocol=pickle.HIGHEST_PROTOCOL)
        log_event("analytics_index_saved_disk", path=ANALYTICS_INDEX_CACHE_FILE)
    except Exception as e:
        log_event("analytics_index_save_failed", error=str(e))


def refresh_lookup_cache():
    m_contratos = os.path.getmtime(DATA_FILES["contratos"]) if os.path.exists(DATA_FILES["contratos"]) else 0
    m_gestores = os.path.getmtime(DATA_FILES["gestores"]) if os.path.exists(DATA_FILES["gestores"]) else 0
    if (
        LOOKUP_CACHE["supervisor_by_id"]
        and LOOKUP_CACHE["gestores_by_key"]
        and LOOKUP_CACHE["mtime"]["contratos"] == m_contratos
        and LOOKUP_CACHE["mtime"]["gestores"] == m_gestores
    ):
        return

    supervisor_by_id = {}
    for raw in iter_csv_rows(DATA_FILES["contratos"]):
        c = normalize_row("contratos", raw)
        c_id = c.get("_cId", "")
        if c_id:
            supervisor_by_id[c_id] = str(c.get("_supervisor") or "S/D").strip() or "S/D"

    gestores_by_key = {}
    for raw in iter_csv_rows(DATA_FILES["gestores"]):
        g = normalize_row("gestores", raw)
        c_id = g.get("_cId", "")
        mm = g.get("_feNorm", "")
        if c_id and mm:
            gestores_by_key[f"{c_id}_{mm}"] = str(g.get("Gestor") or "S/D")

    LOOKUP_CACHE["supervisor_by_id"] = supervisor_by_id
    LOOKUP_CACHE["gestores_by_key"] = gestores_by_key
    LOOKUP_CACHE["mtime"]["contratos"] = m_contratos
    LOOKUP_CACHE["mtime"]["gestores"] = m_gestores


def ensure_analytics_index():
    stamp = data_stamp()
    if ANALYTICS_INDEX["stamp"] == stamp and ANALYTICS_INDEX["cartera_entries"]:
        return
    with ANALYTICS_INDEX_LOCK:
        if ANALYTICS_INDEX["stamp"] == stamp and ANALYTICS_INDEX["cartera_entries"]:
            return
        if load_analytics_index_from_disk(stamp):
            return

        refresh_lookup_cache()
        supervisor_by_id = LOOKUP_CACHE["supervisor_by_id"]

        cartera_entries = []
        for raw in iter_csv_rows(DATA_FILES["cartera"]):
            c_id = re.sub(r"[^0-9]", "", str(raw.get("id_contrato", "")))
            fe = month_from_date(raw.get("Fecha gestion", "")) or norm_d(raw.get("Fecha gestion", "")) or "S/D"
            if not c_id or not re.match(r"^\d{2}/\d{4}$", fe):
                continue
            tr_raw = raw.get("tramo") or 0
            tr_num = to_int(tr_raw)
            via_c = normalize_via_cobro(raw.get("via_de_cobro"))
            debt = to_float(raw.get("monto_cuota") or 0) + to_float(raw.get("monto_vencido") or 0)
            cartera_entries.append({
                "key": f"{c_id}_{fe}",
                "c_id": c_id,
                "fe": fe,
                "un": str(raw.get("UN") or "S/D"),
                "tramo": str(tr_raw),
                "tramo_num": tr_num,
                "cat": "VIGENTE" if tr_num <= 3 else "MOROSO",
                "via_c": via_c,
                "sup": supervisor_by_id.get(c_id, "S/D"),
                "debt": debt,
            })

        paid_total_by_key = defaultdict(float)
        paid_by_via_by_key = {}
        for raw in iter_csv_rows(DATA_FILES["cobranzas"]):
            c_id = re.sub(r"[^0-9]", "", str(raw.get("contract_id") or raw.get("id_contrato") or ""))
            raw_m = raw.get("Mes") or raw.get("mes") or raw.get("month") or 0
            raw_a = raw.get("Año") or raw.get("AÃ±o") or raw.get("Ano") or raw.get("Ao") or raw.get("year") or ""
            fe = f"{str(raw_m).zfill(2)}/{raw_a}" if raw_a else ""
            if not c_id or not re.match(r"^\d{2}/\d{4}$", fe):
                continue
            key = f"{c_id}_{fe}"
            amount = to_float(raw.get("monto") or 0)
            if amount == 0:
                continue
            via_real = str(raw.get("VP") or "S/D").strip() or "S/D"
            paid_total_by_key[key] += amount
            if key not in paid_by_via_by_key:
                paid_by_via_by_key[key] = defaultdict(float)
            paid_by_via_by_key[key][via_real] += amount

        # Convert nested defaultdicts so payload/caches are plain dicts.
        for key in list(paid_by_via_by_key.keys()):
            paid_by_via_by_key[key] = dict(paid_by_via_by_key[key])

        ANALYTICS_INDEX["stamp"] = stamp
        ANALYTICS_INDEX["cartera_entries"] = cartera_entries
        ANALYTICS_INDEX["paid_total_by_key"] = dict(paid_total_by_key)
        ANALYTICS_INDEX["paid_by_via_by_key"] = paid_by_via_by_key
        invalidate_analytics_cache()
        save_analytics_index_to_disk()
        log_event(
            "analytics_index_built",
            cartera_rows=len(cartera_entries),
            cobranza_keys=len(ANALYTICS_INDEX["paid_total_by_key"]),
        )


def has_any_filter(params):
    keys = {"un", "anio", "gestion_month", "contract_month", "via_cobro", "categoria", "supervisor", "tramo", "via_pago"}
    for k in keys:
        if parse_filter_set(params, k):
            return True
    return False


def compute_portfolio_summary_and_trend(params):
    ensure_analytics_index()
    cartera_entries = ANALYTICS_INDEX["cartera_entries"]
    paid_total_by_key = ANALYTICS_INDEX["paid_total_by_key"]
    sel_un = parse_filter_set(params, "un")
    sel_fecha = parse_filter_set(params, "gestion_month")
    sel_via = parse_filter_set(params, "via_cobro")
    sel_cat = parse_filter_set(params, "categoria")
    sel_super = parse_filter_set(params, "supervisor")

    by_gestion = {}
    keys_by_month = defaultdict(set)
    totals = {"total": 0, "vigente": 0, "moroso": 0, "cobrador": 0, "debito": 0, "totalDebt": 0.0, "totalPaid": 0.0}

    for r in cartera_entries:
        c_id = r["c_id"]
        un = r["un"]
        fe = r["fe"]
        if sel_un and un not in sel_un:
            continue
        if sel_fecha and fe not in sel_fecha:
            continue

        is_vigente = r["tramo_num"] <= 3
        cat = r["cat"]
        via = r["via_c"]
        sup = r["sup"]

        if sel_via and via not in sel_via:
            continue
        if sel_cat and cat not in sel_cat:
            continue
        if sel_super and sup not in sel_super:
            continue

        if fe not in by_gestion:
            by_gestion[fe] = {"total": 0, "vigente": 0, "moroso": 0, "cobrador": 0, "debito": 0, "debt": 0.0, "paid": 0.0, "paidContracts": 0}

        row = by_gestion[fe]
        row["total"] += 1
        row["vigente"] += 1 if is_vigente else 0
        row["moroso"] += 0 if is_vigente else 1
        row["cobrador"] += 1 if via == "COBRADOR" else 0
        row["debito"] += 0 if via == "COBRADOR" else 1

        debt = r["debt"]
        row["debt"] += debt

        paid_key = r["key"]
        keys_by_month[fe].add(paid_key)

        totals["total"] += 1
        totals["vigente"] += 1 if is_vigente else 0
        totals["moroso"] += 0 if is_vigente else 1
        totals["cobrador"] += 1 if via == "COBRADOR" else 0
        totals["debito"] += 0 if via == "COBRADOR" else 1
        totals["totalDebt"] += debt

    if not keys_by_month:
        return totals, by_gestion

    all_needed_keys = set()
    for month_keys in keys_by_month.values():
        all_needed_keys.update(month_keys)

    for fe, month_keys in keys_by_month.items():
        row_paid = 0.0
        row_paid_contracts = 0
        for key in month_keys:
            p = paid_total_by_key.get(key, 0.0)
            row_paid += p
            if p > 0:
                row_paid_contracts += 1
        by_gestion[fe]["paid"] = row_paid
        by_gestion[fe]["paidContracts"] = row_paid_contracts

    totals["totalPaid"] = sum(v["paid"] for v in by_gestion.values())

    return totals, by_gestion


def compute_performance(params):
    ensure_analytics_index()
    gestores_by_key = LOOKUP_CACHE["gestores_by_key"]
    cartera_entries = ANALYTICS_INDEX["cartera_entries"]
    paid_total_by_key = ANALYTICS_INDEX["paid_total_by_key"]
    paid_by_via_by_key = ANALYTICS_INDEX["paid_by_via_by_key"]
    sel_un = parse_filter_set(params, "un")
    sel_tramo = parse_filter_set(params, "tramo")
    sel_fecha = parse_filter_set(params, "gestion_month")
    sel_via_cobro = parse_filter_set(params, "via_cobro")
    sel_via_pago = parse_filter_set(params, "via_pago")
    sel_cat = parse_filter_set(params, "categoria")
    sel_super = parse_filter_set(params, "supervisor")

    portfolio_map = {}
    for r in cartera_entries:
        c_id = r["c_id"]
        fe = r["fe"]
        un_val = r["un"]
        tr_val = r["tramo"]
        tr_num = r["tramo_num"]
        cat_val = r["cat"]
        via_c = r["via_c"]
        sup = r["sup"]

        if sel_un and un_val not in sel_un:
            continue
        if sel_tramo and tr_val not in sel_tramo:
            continue
        if sel_cat and cat_val not in sel_cat:
            continue
        if sel_via_cobro and via_c not in sel_via_cobro:
            continue
        if sel_super and sup not in sel_super:
            continue
        if sel_fecha and fe not in sel_fecha:
            continue

        key = r["key"]
        debt = r["debt"]
        if key not in portfolio_map:
            portfolio_map[key] = {
                "un": un_val,
                "tramo": tr_val,
                "viaC": via_c,
                "gestor": gestores_by_key.get(key, "S/D"),
                "debt": 0.0,
                "paid": 0.0,
                "paidDetails": {},
            }
        portfolio_map[key]["debt"] += debt

    stats = {
        "totalDebt": 0.0,
        "totalPaid": 0.0,
        "totalContracts": 0,
        "totalContractsPaid": 0,
        "tramoStats": {},
        "unStats": {},
        "viaCStats": {},
        "gestorStats": {},
        "matrixStats": {},
        "trendStats": {},
    }

    if portfolio_map:
        for key in portfolio_map.keys():
            if sel_via_pago:
                details_src = paid_by_via_by_key.get(key, {})
                paid = 0.0
                paid_details = {}
                for via_real, amount in details_src.items():
                    if via_real in sel_via_pago:
                        paid += amount
                        paid_details[via_real] = amount
            else:
                paid = paid_total_by_key.get(key, 0.0)
                paid_details = dict(paid_by_via_by_key.get(key, {}))

            portfolio_map[key]["paid"] = paid
            portfolio_map[key]["paidDetails"] = paid_details

    for key, info in portfolio_map.items():
        fe_norm = key.split("_")[1]
        paid = info.get("paid", 0.0)
        paid_details = info.get("paidDetails", {})

        debt = info["debt"]
        stats["totalDebt"] += debt
        stats["totalPaid"] += paid
        stats["totalContracts"] += 1
        if paid > 0:
            stats["totalContractsPaid"] += 1

        if fe_norm not in stats["trendStats"]:
            stats["trendStats"][fe_norm] = {"d": 0.0, "p": 0.0, "c": 0, "cp": 0}
        stats["trendStats"][fe_norm]["d"] += debt
        stats["trendStats"][fe_norm]["p"] += paid
        stats["trendStats"][fe_norm]["c"] += 1
        if paid > 0:
            stats["trendStats"][fe_norm]["cp"] += 1

        t = info["tramo"]
        u = info["un"]
        vc = info["viaC"]
        g = info["gestor"]

        stats["tramoStats"].setdefault(t, {"d": 0.0, "p": 0.0})
        stats["tramoStats"][t]["d"] += debt
        stats["tramoStats"][t]["p"] += paid

        stats["unStats"].setdefault(u, {"d": 0.0, "p": 0.0})
        stats["unStats"][u]["d"] += debt
        stats["unStats"][u]["p"] += paid

        stats["viaCStats"].setdefault(vc, {"d": 0.0, "p": 0.0})
        stats["viaCStats"][vc]["d"] += debt
        stats["viaCStats"][vc]["p"] += paid

        stats["gestorStats"].setdefault(g, {"d": 0.0, "p": 0.0})
        stats["gestorStats"][g]["d"] += debt
        stats["gestorStats"][g]["p"] += paid

        stats["matrixStats"].setdefault(vc, {})
        for via_real, amount in paid_details.items():
            stats["matrixStats"][vc][via_real] = stats["matrixStats"][vc].get(via_real, 0.0) + amount

    return stats


def compute_movement_moroso_trend(params):
    ensure_analytics_index()
    cartera_entries = ANALYTICS_INDEX["cartera_entries"]
    sel_un = parse_filter_set(params, "un")
    sel_anio = parse_filter_set(params, "anio")
    sel_fecha = parse_filter_set(params, "gestion_month")
    sel_via = parse_filter_set(params, "via_cobro")
    sel_cat = parse_filter_set(params, "categoria")
    sel_super = parse_filter_set(params, "supervisor")

    has_moroso_selected = (not sel_cat) or ("MOROSO" in sel_cat)
    by_contract_month = {}

    for row in cartera_entries:
        c_id = row.get("c_id", "")
        gestion = row.get("fe", "")
        if not c_id or not re.match(r"^\d{2}/\d{4}$", str(gestion)):
            continue
        un = str(row.get("un", "S/D") or "S/D")
        via = str(row.get("via_c", "DEBITO") or "DEBITO")
        sup = str(row.get("sup", "S/D") or "S/D")
        tramo = to_int(row.get("tramo_num", 0))
        key = f"{c_id}_{gestion}"
        if key not in by_contract_month:
            by_contract_month[key] = {
                "c_id": c_id,
                "gestion": gestion,
                "un": un,
                "via": via,
                "sup": sup,
                "tramo": tramo,
                "cuota_total": 0.0,
                "cuota_count": 0,
            }
        cur = by_contract_month[key]
        if tramo > cur["tramo"]:
            cur["tramo"] = tramo

    # Re-read lightweight cuota accumulation from cache rows, keeping one source for date normalization.
    refresh_data_cache()
    for r in DATA_CACHE["rows"]["cartera"]:
        c_id = str(r.get("_cId", ""))
        gestion = str(r.get("_feNorm", ""))
        key = f"{c_id}_{gestion}"
        if key not in by_contract_month:
            continue
        cuota_raw = r.get("monto_cuota")
        cuota_val = to_float(cuota_raw, 0.0)
        if cuota_raw not in (None, "", "S/D"):
            by_contract_month[key]["cuota_total"] += cuota_val
            by_contract_month[key]["cuota_count"] += 1

    by_contract_timeline = defaultdict(list)
    for item in by_contract_month.values():
        by_contract_timeline[item["c_id"]].append(item)
    for c_id in by_contract_timeline.keys():
        by_contract_timeline[c_id].sort(key=lambda x: month_to_serial(x["gestion"]))

    def find_snapshot_at_or_before(c_id, month):
        timeline = by_contract_timeline.get(c_id, [])
        if not timeline:
            return None
        target = month_to_serial(month)
        prev = None
        for row in timeline:
            serial = month_to_serial(row["gestion"])
            if serial <= 0:
                continue
            if serial > target:
                break
            prev = row
            if row["gestion"] == month:
                break
        return prev

    by_gestion_counts = defaultdict(int)
    by_gestion_vigente_base = defaultdict(int)
    by_gestion_avg_cuota_total = defaultdict(float)
    by_gestion_avg_cuota_count = defaultdict(int)
    available_gestiones = set()

    for curr in by_contract_month.values():
        gestion = curr["gestion"]
        if sel_anio and (gestion.split("/")[1] not in sel_anio):
            continue
        if sel_fecha and (gestion not in sel_fecha):
            continue
        if sel_un and (curr["un"] not in sel_un):
            continue
        if sel_via and (curr["via"] not in sel_via):
            continue
        if sel_super and (curr["sup"] not in sel_super):
            continue

        available_gestiones.add(gestion)
        if curr["tramo"] <= 3:
            by_gestion_vigente_base[gestion] += 1

        if not has_moroso_selected or curr["tramo"] <= 3:
            continue
        prev_month = month_to_serial(gestion) - 1
        if prev_month <= 0:
            continue
        prev_gestion = f"{((prev_month - 1) % 12) + 1:02d}/{(prev_month - 1) // 12}"
        prev = find_snapshot_at_or_before(curr["c_id"], prev_gestion)
        if not prev:
            continue
        if to_int(prev.get("tramo", 0)) > 3:
            continue

        by_gestion_counts[gestion] += 1
        cuota_count = curr["cuota_count"]
        cuota_avg = (curr["cuota_total"] / cuota_count) if cuota_count > 0 else 0.0
        by_gestion_avg_cuota_total[gestion] += cuota_avg
        by_gestion_avg_cuota_count[gestion] += 1

    label_set = set(available_gestiones)
    # If specific management months are requested, keep them visible even with zero rows,
    # so charts can render a continuous user-selected slice.
    if sel_fecha:
        for m in sel_fecha:
            if re.match(r"^\d{2}/\d{4}$", str(m)):
                label_set.add(str(m))
    labels = sorted(list(label_set), key=month_to_serial)
    transitions = [by_gestion_counts.get(m, 0) for m in labels]
    vigente_base = [by_gestion_vigente_base.get(m, 0) for m in labels]
    pct = []
    avg_cuota = []
    for m in labels:
        den = by_gestion_vigente_base.get(m, 0)
        num = by_gestion_counts.get(m, 0)
        pct.append(round((num / den) * 100, 3) if den > 0 else 0.0)
        c = by_gestion_avg_cuota_count.get(m, 0)
        avg_cuota.append((by_gestion_avg_cuota_total.get(m, 0.0) / c) if c > 0 else 0.0)

    return {
        "labels": labels,
        "moroso_transition_count": transitions,
        "vigente_base_count": vigente_base,
        "moroso_transition_pct": pct,
        "avg_cuota": avg_cuota,
        "meta": {
            "source": "api",
            "signature": analytics_cache_key("/analytics/movement/moroso-trend", params),
            "filters": {
                "un": sorted(list(sel_un)),
                "anio": sorted(list(sel_anio)),
                "gestion_month": sorted(list(sel_fecha)),
                "via_cobro": sorted(list(sel_via)),
                "categoria": sorted(list(sel_cat)),
                "supervisor": sorted(list(sel_super)),
            },
        },
    }


def compute_anuales_summary(params):
    refresh_data_cache()
    cartera_rows = DATA_CACHE["rows"]["cartera"]
    cobranzas_rows = DATA_CACHE["rows"]["cobranzas"]
    contratos_rows = DATA_CACHE["rows"]["contratos"]
    if not cartera_rows or not cobranzas_rows or not contratos_rows:
        return {"rows": [], "cutoff": "", "meta": {"source": "api"}}

    sel_un = parse_filter_set(params, "un")
    sel_anio = parse_filter_set(params, "anio")
    sel_contract_month = parse_filter_set(params, "contract_month")

    all_gestion = sorted(
        list({str(r.get("_feNorm", "")) for r in cartera_rows if re.match(r"^\d{2}/\d{4}$", str(r.get("_feNorm", "")))}),
        key=month_to_serial
    )
    cutoff_month = all_gestion[-1] if all_gestion else ""
    cutoff_serial = month_to_serial(cutoff_month)
    if cutoff_serial <= 0:
        return {"rows": [], "cutoff": "", "meta": {"source": "api"}}

    by_contract_month = {}
    for r in cartera_rows:
        c_id = str(r.get("_cId", ""))
        fe = str(r.get("_feNorm", ""))
        if not c_id or not re.match(r"^\d{2}/\d{4}$", fe):
            continue
        key = f"{c_id}_{fe}"
        cuota_raw = r.get("monto_cuota")
        cuota_num = to_float(cuota_raw, 0.0)
        if key not in by_contract_month:
            by_contract_month[key] = {"c_id": c_id, "month": fe, "cuota_sum": cuota_num, "cuota_count": 1 if str(cuota_raw or "").strip() else 0}
        else:
            by_contract_month[key]["cuota_sum"] += cuota_num
            if str(cuota_raw or "").strip():
                by_contract_month[key]["cuota_count"] += 1

    by_contract_timeline = defaultdict(list)
    for item in by_contract_month.values():
        count = item["cuota_count"]
        item["cuota_avg"] = (item["cuota_sum"] / count) if count > 0 else 0.0
        by_contract_timeline[item["c_id"]].append(item)
    for c_id in by_contract_timeline.keys():
        by_contract_timeline[c_id].sort(key=lambda x: month_to_serial(x["month"]))

    def find_snapshot_at_or_before(c_id, month):
        timeline = by_contract_timeline.get(c_id, [])
        if not timeline:
            return None
        target = month_to_serial(month)
        prev = None
        for row in timeline:
            serial = month_to_serial(row["month"])
            if serial > target:
                break
            prev = row
            if serial == target:
                break
        return prev

    def find_snapshot_at_or_after(c_id, month):
        timeline = by_contract_timeline.get(c_id, [])
        if not timeline:
            return None
        target = month_to_serial(month)
        for row in timeline:
            if month_to_serial(row["month"]) >= target:
                return row
        return None

    payment_by_contract_month = defaultdict(dict)
    for r in cobranzas_rows:
        c_id = str(r.get("_cId", ""))
        month = str(r.get("_feNorm", ""))
        if not c_id or not re.match(r"^\d{2}/\d{4}$", month):
            continue
        monto = to_float(r.get("monto"), 0.0)
        serial = month_to_serial(month)
        if serial <= 0:
            continue
        bucket = payment_by_contract_month[c_id].setdefault(serial, {"amount": 0.0, "tx": 0})
        bucket["amount"] += monto
        bucket["tx"] += 1

    payment_cum_by_contract = {}
    for c_id, month_map in payment_by_contract_month.items():
        serials = sorted(list(month_map.keys()))
        cum_amounts = []
        cum_txs = []
        amt = 0.0
        txs = 0
        for serial in serials:
            amt += month_map[serial].get("amount", 0.0)
            txs += month_map[serial].get("tx", 0)
            cum_amounts.append(amt)
            cum_txs.append(txs)
        payment_cum_by_contract[c_id] = {"serials": serials, "cum_amounts": cum_amounts, "cum_txs": cum_txs}

    def get_cum_paid_up_to(c_id, max_serial):
        entry = payment_cum_by_contract.get(c_id)
        if not entry or not entry["serials"]:
            return {"amount": 0.0, "tx": 0}
        idx = -1
        for i, serial in enumerate(entry["serials"]):
            if serial <= max_serial:
                idx = i
            else:
                break
        if idx < 0:
            return {"amount": 0.0, "tx": 0}
        return {"amount": entry["cum_amounts"][idx], "tx": entry["cum_txs"][idx]}

    cutoff_year = int(year_from_mm_yyyy(cutoff_month)) if year_from_mm_yyyy(cutoff_month) else None

    def year_from_serial(serial):
        if serial <= 0:
            return None
        return (serial - 1) // 12

    def is_payment_year_allowed(serial):
        if cutoff_year is None:
            return True
        y = year_from_serial(serial)
        return (y is not None) and (y <= cutoff_year)

    contract_start_serial_by_id = {}
    for c in contratos_rows:
        c_id = str(c.get("_cId", ""))
        month = str(c.get("_contractMonth", ""))
        serial = month_to_serial(month)
        if not c_id or serial <= 0:
            continue
        prev = contract_start_serial_by_id.get(c_id)
        if prev is None or serial < prev:
            contract_start_serial_by_id[c_id] = serial
    for c_id, timeline in by_contract_timeline.items():
        if not timeline:
            continue
        first_serial = month_to_serial(timeline[0]["month"])
        prev = contract_start_serial_by_id.get(c_id)
        if prev is None or first_serial < prev:
            contract_start_serial_by_id[c_id] = first_serial

    def months_active_between(start_serial, end_serial):
        if start_serial is None or end_serial is None or end_serial < start_serial:
            return 0
        diff = end_serial - start_serial
        return 1 if diff == 0 else diff

    cartera_by_contract_month = defaultdict(dict)
    for r in cartera_rows:
        c_id = str(r.get("_cId", ""))
        mm = str(r.get("_feNorm", ""))
        if c_id and mm:
            cartera_by_contract_month[c_id][mm] = r

    contracts_by_sale_year = defaultdict(list)
    for c in contratos_rows:
        c_id = str(c.get("_cId", ""))
        un = str(c.get("UN", "S/D"))
        sale_month = str(c.get("_contractMonth", ""))
        sale_year = str(c.get("_contractYear", ""))
        if not c_id or not re.match(r"^\d{4}$", sale_year) or not re.match(r"^\d{2}/\d{4}$", sale_month):
            continue
        if sel_un and un not in sel_un:
            continue
        if sel_anio and sale_year not in sel_anio:
            continue
        if sel_contract_month and sale_month not in sel_contract_month:
            continue
        contracts_by_sale_year[sale_year].append(c)

    years = sorted(list(contracts_by_sale_year.keys()), key=lambda x: int(x))
    rows = []
    cob_by_contract_month = DATA_CACHE["aggr"].get("cob_by_contract_month", {})

    for year in years:
        year_contracts = contracts_by_sale_year.get(year, [])
        contract_ids = set()
        contract_ids_vigentes = set()
        cuota_total = 0.0

        for c in year_contracts:
            c_id = str(c.get("_cId", ""))
            if not c_id or c_id in contract_ids:
                continue
            snap = find_snapshot_at_or_before(c_id, cutoff_month) or find_snapshot_at_or_after(c_id, cutoff_month)
            contract_ids.add(c_id)
            cutoff_row = cartera_by_contract_month.get(c_id, {}).get(cutoff_month)
            tramo_cutoff = to_int((cutoff_row or {}).get("tramo"), -999)
            if tramo_cutoff <= 3:
                contract_ids_vigentes.add(c_id)
            cuota_contrato = to_float(c.get("_montoCuota") or c.get("monto_cuota") or c.get("amount"), 0.0)
            if cuota_contrato <= 0:
                cuota_contrato = to_float((snap or {}).get("cuota_avg"), 0.0)
            cuota_total += cuota_contrato

        contracts = len(contract_ids)
        contracts_vigentes = len(contract_ids_vigentes)
        tkp_contrato = (cuota_total / contracts) if contracts > 0 else 0.0

        paid_to_cutoff_total = 0.0
        tx_to_cutoff_total = 0
        paid_by_contract_month_total = 0.0
        paid_by_contract_month_count = 0

        for c_id in contract_ids:
            paid = get_cum_paid_up_to(c_id, cutoff_serial)
            paid_to_cutoff_total += paid["amount"]
            tx_to_cutoff_total += paid["tx"]
            by_month = payment_by_contract_month.get(c_id, {})
            for serial, bucket in by_month.items():
                if serial <= 0 or (not is_payment_year_allowed(serial)):
                    continue
                paid_by_contract_month_total += bucket.get("amount", 0.0)
                paid_by_contract_month_count += 1

        tkp_transaccional = (paid_to_cutoff_total / tx_to_cutoff_total) if tx_to_cutoff_total > 0 else 0.0
        tkp_pago = (paid_by_contract_month_total / paid_by_contract_month_count) if paid_by_contract_month_count > 0 else 0.0

        culminados = 0
        culminados_vigentes = 0
        cuota_cul_total = 0.0
        cuota_cul_total_vigente = 0.0
        paid_by_contract_month_cul_total = 0.0
        paid_by_contract_month_cul_count = 0
        paid_by_contract_month_cul_total_vigente = 0.0
        paid_by_contract_month_cul_count_vigente = 0
        total_cobrado_cul_vigente = 0.0
        total_deberia_cul_vigente = 0.0
        months_weighted_numerator_cul_vigente = 0.0

        for c in year_contracts:
            c_id = str(c.get("_cId", ""))
            culm_month = str(c.get("_culminacionMonth", ""))
            culm_serial = month_to_serial(culm_month)
            if not c_id or culm_serial <= 0 or culm_serial > cutoff_serial:
                continue
            snap = find_snapshot_at_or_before(c_id, culm_month) or find_snapshot_at_or_after(c_id, culm_month)
            culminados += 1
            culm_row = cartera_by_contract_month.get(c_id, {}).get(culm_month)
            tramo_culm = to_int((culm_row or {}).get("tramo"), -999)
            es_vigente = tramo_culm <= 3
            if es_vigente:
                culminados_vigentes += 1
            cuota_cul = to_float((snap or {}).get("cuota_avg"), 0.0)
            if cuota_cul <= 0:
                cuota_cul = to_float(c.get("_montoCuota") or c.get("monto_cuota") or c.get("amount"), 0.0)
            cuota_cul_total += cuota_cul
            if es_vigente:
                cuota_cul_total_vigente += cuota_cul
            by_month = payment_by_contract_month.get(c_id, {})
            for serial, bucket in by_month.items():
                if serial <= 0 or serial > culm_serial or (not is_payment_year_allowed(serial)):
                    continue
                amount = bucket.get("amount", 0.0)
                paid_by_contract_month_cul_total += amount
                paid_by_contract_month_cul_count += 1
                if es_vigente:
                    paid_by_contract_month_cul_total_vigente += amount
                    paid_by_contract_month_cul_count_vigente += 1

            if es_vigente:
                sale_month = str(c.get("_contractMonth") or month_from_date(c.get("date")))
                months = months_between_date_and_month(str(c.get("date", "")), culm_month)
                if months > 0 and sale_month and re.match(r"^\d{2}/\d{4}$", culm_month):
                    deberia = cuota_cul * months
                    contract_month_map = cob_by_contract_month.get(c_id, {})
                    cobrado = 0.0
                    start_serial = month_to_serial(sale_month)
                    end_serial = month_to_serial(culm_month)
                    for mm, amount in contract_month_map.items():
                        s = month_to_serial(mm)
                        if s >= start_serial and s <= end_serial:
                            cobrado += to_float(amount, 0.0)
                    total_cobrado_cul_vigente += cobrado
                    total_deberia_cul_vigente += deberia
                    months_weighted_numerator_cul_vigente += (months * deberia)

        tkp_contrato_culminado = (cuota_cul_total / culminados) if culminados > 0 else 0.0
        tkp_pago_culminado = (paid_by_contract_month_cul_total / paid_by_contract_month_cul_count) if paid_by_contract_month_cul_count > 0 else 0.0
        tkp_contrato_culminado_vigente = (cuota_cul_total_vigente / culminados_vigentes) if culminados_vigentes > 0 else 0.0
        tkp_pago_culminado_vigente = (
            paid_by_contract_month_cul_total_vigente / paid_by_contract_month_cul_count_vigente
        ) if paid_by_contract_month_cul_count_vigente > 0 else 0.0
        ltv_culminado_vigente = (
            (total_cobrado_cul_vigente / total_deberia_cul_vigente) *
            (months_weighted_numerator_cul_vigente / total_deberia_cul_vigente)
        ) if total_deberia_cul_vigente > 0 else 0.0

        rows.append({
            "year": year,
            "contracts": contracts,
            "contractsVigentes": contracts_vigentes,
            "tkpContrato": tkp_contrato,
            "tkpTransaccional": tkp_transaccional,
            "tkpPago": tkp_pago,
            "culminados": culminados,
            "culminadosVigentes": culminados_vigentes,
            "tkpContratoCulminado": tkp_contrato_culminado,
            "tkpPagoCulminado": tkp_pago_culminado,
            "tkpContratoCulminadoVigente": tkp_contrato_culminado_vigente,
            "tkpPagoCulminadoVigente": tkp_pago_culminado_vigente,
            "ltvCulminadoVigente": ltv_culminado_vigente,
        })

    rows.sort(key=lambda x: int(x["year"]))
    return {
        "rows": rows,
        "cutoff": cutoff_month,
        "meta": {
            "source": "api",
            "signature": analytics_cache_key("/analytics/anuales/summary", params),
            "filters": {
                "un": sorted(list(sel_un)),
                "anio": sorted(list(sel_anio)),
                "contract_month": sorted(list(sel_contract_month)),
            }
        }
    }


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def _send_json(self, payload, code=200):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))

    def _send_error_json(self, code, message, details=None):
        self._send_json({"error_code": code, "code": code, "message": message, "details": details}, 400)

    def do_GET(self):
        parsed_path = urlparse(self.path)
        params = parse_qs(parsed_path.query)
        debug_mode = parse_debug_flag(params)

        if parsed_path.path.startswith('/analytics/'):
            start = time.time()
            if not has_any_filter(params):
                return self._send_error_json('FILTER_REQUIRED', 'Incluye al menos un filtro para procesar analytics API')
            use_monthly = os.path.exists(ANALYTICS_MONTHLY_FILE)

            if parsed_path.path == '/analytics/portfolio/summary':
                if not validate_month_set(parse_filter_set(params, 'gestion_month')):
                    return self._send_error_json('INVALID_FILTER', 'gestion_month debe ser MM/YYYY')
                key = analytics_cache_key(parsed_path.path, params)
                if key in ANALYTICS_CACHE:
                    self._send_json(ANALYTICS_CACHE[key])
                    return
                if use_monthly:
                    totals, _ = compute_portfolio_summary_and_trend_from_monthly(params)
                else:
                    totals, _ = compute_portfolio_summary_and_trend(params)
                ANALYTICS_CACHE[key] = totals
                log_event('analytics_summary', ms=round((time.time()-start)*1000, 2), key=key, debug=debug_mode)
                self._send_json(totals)
                return

            if parsed_path.path == '/analytics/portfolio/trend':
                if not validate_month_set(parse_filter_set(params, 'gestion_month')):
                    return self._send_error_json('INVALID_FILTER', 'gestion_month debe ser MM/YYYY')
                key = analytics_cache_key(parsed_path.path, params)
                if key in ANALYTICS_CACHE:
                    self._send_json(ANALYTICS_CACHE[key])
                    return
                if use_monthly:
                    _, by_gestion = compute_portfolio_summary_and_trend_from_monthly(params)
                else:
                    _, by_gestion = compute_portfolio_summary_and_trend(params)
                payload = {"byGestion": by_gestion}
                ANALYTICS_CACHE[key] = payload
                log_event('analytics_trend', ms=round((time.time()-start)*1000, 2), months=len(by_gestion), key=key, debug=debug_mode)
                self._send_json(payload)
                return

            if parsed_path.path == '/analytics/performance/by-management-month':
                if not validate_month_set(parse_filter_set(params, 'gestion_month')):
                    return self._send_error_json('INVALID_FILTER', 'gestion_month debe ser MM/YYYY')
                if not validate_year_set(parse_filter_set(params, 'anio')):
                    return self._send_error_json('INVALID_FILTER', 'anio debe ser YYYY')
                key = analytics_cache_key(parsed_path.path, params)
                if key in ANALYTICS_CACHE:
                    self._send_json(ANALYTICS_CACHE[key])
                    return
                if use_monthly:
                    stats = compute_performance_from_monthly(params)
                else:
                    stats = compute_performance(params)
                ANALYTICS_CACHE[key] = stats
                log_event('analytics_performance', ms=round((time.time()-start)*1000, 2), contracts=stats.get('totalContracts', 0), key=key, debug=debug_mode)
                self._send_json(stats)
                return

            if parsed_path.path == '/analytics/movement/moroso-trend':
                if not validate_month_set(parse_filter_set(params, 'gestion_month')):
                    return self._send_error_json('INVALID_FILTER', 'gestion_month debe ser MM/YYYY')
                if not validate_year_set(parse_filter_set(params, 'anio')):
                    return self._send_error_json('INVALID_FILTER', 'anio debe ser YYYY')
                key = analytics_cache_key(parsed_path.path, params)
                if key in ANALYTICS_CACHE:
                    self._send_json(ANALYTICS_CACHE[key])
                    return
                payload = compute_movement_moroso_trend(params)
                ANALYTICS_CACHE[key] = payload
                log_event(
                    'analytics_movement_moroso',
                    ms=round((time.time()-start)*1000, 2),
                    months=len(payload.get("labels", [])),
                    transitions=sum(payload.get("moroso_transition_count", [])),
                    key=key,
                    debug=debug_mode,
                )
                self._send_json(payload)
                return

            if parsed_path.path == '/analytics/anuales/summary':
                if not validate_month_set(parse_filter_set(params, 'contract_month')):
                    return self._send_error_json('INVALID_FILTER', 'contract_month debe ser MM/YYYY')
                if not validate_year_set(parse_filter_set(params, 'anio')):
                    return self._send_error_json('INVALID_FILTER', 'anio debe ser YYYY')
                key = analytics_cache_key(parsed_path.path, params)
                if key in ANALYTICS_CACHE:
                    self._send_json(ANALYTICS_CACHE[key])
                    return
                payload = compute_anuales_summary(params)
                ANALYTICS_CACHE[key] = payload
                log_event(
                    'analytics_anuales_summary',
                    ms=round((time.time()-start)*1000, 2),
                    years=len(payload.get("rows", [])),
                    key=key,
                    debug=debug_mode,
                )
                self._send_json(payload)
                return

            return self._send_error_json('NOT_FOUND', 'Analytics endpoint no encontrado')

        if parsed_path.path == '/api/run-export':
            export_type = params.get('type', [None])[0]
            success = False
            message = ""

            try:
                if export_type == 'cartera':
                    result = subprocess.run(["python", "export_to_excel.py"], capture_output=True, text=True)
                elif export_type == 'cobranzas':
                    result = subprocess.run(["python", "export_cobranzas.py"], capture_output=True, text=True)
                elif export_type == 'gestores':
                    result = subprocess.run(["python", "export_gestores.py"], capture_output=True, text=True)
                elif export_type == 'contratos':
                    result = subprocess.run(["python", "export_contratos.py"], capture_output=True, text=True)
                elif export_type == 'analytics':
                    result = subprocess.run(["python", "export_analytics.py"], capture_output=True, text=True)
                else:
                    result = None
                    message = "Invalid export type"

                if result is not None:
                    success = result.returncode == 0
                    message = result.stdout if success else ((result.stdout or '') + (('\n' + result.stderr) if result.stderr else ''))
            except Exception as e:
                message = str(e)

            if success:
                DATA_CACHE["stamp"] = ""
                DATA_CACHE["aggr"] = {}
                LOOKUP_CACHE["supervisor_by_id"] = {}
                LOOKUP_CACHE["gestores_by_key"] = {}
                LOOKUP_CACHE["mtime"]["gestores"] = 0
                LOOKUP_CACHE["mtime"]["contratos"] = 0
                clear_analytics_monthly_cache()
                invalidate_analytics_index()
                invalidate_analytics_cache()
            self._send_json({"success": success, "message": message})
            return

        if parsed_path.path == '/api/check-files':
            files = {
                "cartera": os.path.exists("cartera.csv"),
                "cobranzas": os.path.exists("cobranzas_prepagas.csv"),
                "gestores": os.path.exists("gestores.csv"),
                "contratos": os.path.exists("contratos.csv"),
                "analytics": os.path.exists(ANALYTICS_MONTHLY_FILE),
                "analytics_meta": os.path.exists(ANALYTICS_META_FILE),
            }
            self._send_json(files)
            return

        if self.path == '/':
            self.path = '/dashboard.html'
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def run_server():
    Handler = DashboardHandler
    if os.path.exists(ANALYTICS_MONTHLY_FILE):
        threading.Thread(target=load_analytics_monthly_rows, daemon=True).start()
    else:
        threading.Thread(target=ensure_analytics_index, daemon=True).start()

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server started at http://localhost:{PORT}")
        print("Press Ctrl+C to stop.")
        webbrowser.open(f"http://localhost:{PORT}")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            httpd.shutdown()


if __name__ == "__main__":
    run_server()




