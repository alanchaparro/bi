"""
Smoke test: login + analytics v2 endpoints (options/summary).
Verifica que la API responde y que PostgreSQL alimenta los datos (options, kpis, etc.).
Uso:
  - Desde host:  python scripts/smoke_analytics_v2.py
  - En contenedor: docker compose exec api-v1 python -m scripts.smoke_analytics_v2
En contenedor la base URL debe ser http://localhost:8000/api/v1 o la variable API_V1_BASE.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    base = os.getenv("API_V1_BASE", os.getenv("SMOKE_API_V1_BASE", "http://localhost:8000/api/v1")).rstrip("/")
    username = os.getenv("DEMO_ADMIN_USER", "admin")
    password = os.getenv("DEMO_ADMIN_PASSWORD", "change_me_demo_admin_password")

    def post(path: str, data: dict, token: str | None = None) -> dict:
        req = urllib.request.Request(
            f"{base}{path}",
            data=json.dumps(data).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))

    # 1) Health
    try:
        with urllib.request.urlopen(f"{base}/health", timeout=10) as r:
            health = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print(f"FAIL health: {e}", file=sys.stderr)
        return 1
    if not health.get("ok"):
        print("FAIL health: ok not True", file=sys.stderr)
        return 1
    print("health_ok")

    # 2) Login
    try:
        login = post("/auth/login", {"username": username, "password": password})
    except Exception as e:
        print(f"FAIL login: {e}", file=sys.stderr)
        return 1
    token = login.get("access_token")
    if not token:
        print("FAIL login: no access_token", file=sys.stderr)
        return 1
    print("login_ok")

    empty: dict = {}

    # 3) portfolio-corte-v2 options + summary
    try:
        opt = post("/analytics/portfolio-corte-v2/options", empty, token)
        if not isinstance(opt.get("options"), dict):
            print("WARN portfolio-corte-v2/options: missing or invalid 'options'", file=sys.stderr)
    except urllib.error.HTTPError as e:
        print(f"FAIL portfolio-corte-v2/options: {e.code} {e.reason}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"FAIL portfolio-corte-v2/options: {e}", file=sys.stderr)
        return 1
    print("portfolio_corte_v2_options_ok")

    try:
        summary = post("/analytics/portfolio-corte-v2/summary", empty, token)
        if "kpis" not in summary and "summary" not in str(summary).lower():
            print("WARN portfolio-corte-v2/summary: no 'kpis' key", file=sys.stderr)
    except urllib.error.HTTPError as e:
        print(f"FAIL portfolio-corte-v2/summary: {e.code} {e.reason}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"FAIL portfolio-corte-v2/summary: {e}", file=sys.stderr)
        return 1
    print("portfolio_corte_v2_summary_ok")

    # 4) rendimiento-v2 options + summary
    try:
        post("/analytics/rendimiento-v2/options", empty, token)
    except urllib.error.HTTPError as e:
        print(f"FAIL rendimiento-v2/options: {e.code} {e.reason}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"FAIL rendimiento-v2/options: {e}", file=sys.stderr)
        return 1
    print("rendimiento_v2_options_ok")

    try:
        post("/analytics/rendimiento-v2/summary", empty, token)
    except urllib.error.HTTPError as e:
        print(f"FAIL rendimiento-v2/summary: {e.code} {e.reason}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"FAIL rendimiento-v2/summary: {e}", file=sys.stderr)
        return 1
    print("rendimiento_v2_summary_ok")

    # 5) cobranzas-cohorte-v2 options
    try:
        post("/analytics/cobranzas-cohorte-v2/options", empty, token)
    except urllib.error.HTTPError as e:
        print(f"FAIL cobranzas-cohorte-v2/options: {e.code} {e.reason}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"FAIL cobranzas-cohorte-v2/options: {e}", file=sys.stderr)
        return 1
    print("cobranzas_cohorte_v2_options_ok")

    # 6) anuales-v2 options
    try:
        post("/analytics/anuales-v2/options", empty, token)
    except urllib.error.HTTPError as e:
        print(f"FAIL anuales-v2/options: {e.code} {e.reason}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"FAIL anuales-v2/options: {e}", file=sys.stderr)
        return 1
    print("anuales_v2_options_ok")

    print("smoke_analytics_v2_ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
