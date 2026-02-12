import json
import os
from datetime import datetime, timezone

import mysql.connector
import pandas as pd

from db_config import get_db_config


OUTPUT_FILE = "analytics_monthly.csv"
META_FILE = "analytics_meta.json"
QUERY_FILE = "query_analytics.sql"
SCHEMA_VERSION = "1.0.0"


def normalize_via(value):
    raw = str(value or "").strip().upper()
    return "COBRADOR" if raw == "COBRADOR" else "DEBITO"


def normalize_cat(value):
    raw = str(value or "").strip().upper()
    return "VIGENTE" if raw.startswith("VIG") else "MOROSO"


def normalize_month(value):
    raw = str(value or "").strip()
    if "/" not in raw:
        return raw
    parts = raw.split("/")
    if len(parts) != 2:
        return raw
    return f"{parts[0].zfill(2)}/{parts[1]}"


def normalize_chunk(df):
    if df.empty:
        return df

    df["gestion_month"] = df["gestion_month"].map(normalize_month)
    df["un"] = df["un"].fillna("S/D").astype(str).str.strip()
    df["tramo"] = pd.to_numeric(df["tramo"], errors="coerce").fillna(0).astype(int)
    df["categoria"] = df["categoria"].map(normalize_cat)
    df["via_cobro"] = df["via_cobro"].map(normalize_via)
    df["supervisor"] = df["supervisor"].fillna("S/D").astype(str).str.strip()

    int_cols = ["contracts_total", "contracts_paid", "contracts_paid_via_debito", "contracts_paid_via_cobrador"]
    float_cols = ["debt_total", "paid_total", "paid_via_debito", "paid_via_cobrador"]
    for col in int_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)
    for col in float_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0).astype(float)

    expected_cols = [
        "gestion_month",
        "un",
        "tramo",
        "categoria",
        "via_cobro",
        "supervisor",
        "contracts_total",
        "contracts_paid",
        "debt_total",
        "paid_total",
        "paid_via_debito",
        "paid_via_cobrador",
        "contracts_paid_via_debito",
        "contracts_paid_via_cobrador",
    ]
    return df[expected_cols]


def write_meta(row_count, generated_at):
    payload = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "rows": row_count,
        "dataset": OUTPUT_FILE,
        "query_file": QUERY_FILE,
        "columns": [
            "gestion_month",
            "un",
            "tramo",
            "categoria",
            "via_cobro",
            "supervisor",
            "contracts_total",
            "contracts_paid",
            "debt_total",
            "paid_total",
            "paid_via_debito",
            "paid_via_cobrador",
            "contracts_paid_via_debito",
            "contracts_paid_via_cobrador",
        ],
    }
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def export_analytics():
    db_config = get_db_config()
    if not os.path.exists(QUERY_FILE):
        print(f"Error: {QUERY_FILE} not found.")
        return

    with open(QUERY_FILE, "r", encoding="utf-8") as f:
        query = f.read()

    total_rows = 0
    first_chunk = True
    generated_at = datetime.now(timezone.utc).isoformat()

    try:
        print("Connecting to database...")
        conn = mysql.connector.connect(**db_config)
        print("Executing analytics query...")

        reader = pd.read_sql(query, conn, chunksize=50000)
        for chunk in reader:
            cleaned = normalize_chunk(chunk)
            total_rows += len(cleaned)
            cleaned.to_csv(
                OUTPUT_FILE,
                index=False,
                mode="a" if not first_chunk else "w",
                header=first_chunk,
            )
            first_chunk = False
            print(f"Writing chunk... Total rows so far: {total_rows}")

        if total_rows > 0:
            write_meta(total_rows, generated_at)
            print(f"Export successful! {total_rows} rows saved to {OUTPUT_FILE}.")
            print(f"Metadata written to {META_FILE}.")
        else:
            print("No analytics data found.")
            if os.path.exists(OUTPUT_FILE):
                os.remove(OUTPUT_FILE)
            if os.path.exists(META_FILE):
                os.remove(META_FILE)
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if "conn" in locals() and conn.is_connected():
            conn.close()


if __name__ == "__main__":
    export_analytics()
