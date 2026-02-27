#!/usr/bin/env python3
"""Espera hasta que GET /health responda OK. Uso: python scripts/wait_for_api_health.py [max_wait_seconds]"""
import os
import sys
import time
import urllib.request

def main():
    base = os.getenv("SMOKE_API_V1_BASE", "http://api-v1:8000/api/v1").rstrip("/")
    max_wait = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    deadline = time.monotonic() + max_wait
    while time.monotonic() < deadline:
        try:
            urllib.request.urlopen(f"{base}/health", timeout=5)
            return 0
        except Exception:
            time.sleep(2)
    return 1


if __name__ == "__main__":
    sys.exit(main())
