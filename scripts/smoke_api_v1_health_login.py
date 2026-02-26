import json
import os
import urllib.request


def main() -> int:
    base = os.getenv("SMOKE_API_V1_BASE", "http://api-v1:8000/api/v1").rstrip("/")
    username = os.getenv("DEMO_ADMIN_USER", "admin")
    password = os.getenv("DEMO_ADMIN_PASSWORD", "change_me_demo_admin_password")

    health_raw = urllib.request.urlopen(f"{base}/health", timeout=15).read().decode("utf-8")
    health = json.loads(health_raw)
    assert health.get("ok") is True, health
    print("health_ok")

    payload = json.dumps({"username": username, "password": password}).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/auth/login",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    login_raw = urllib.request.urlopen(req, timeout=15).read().decode("utf-8")
    login = json.loads(login_raw)
    assert login.get("access_token"), login
    print("login_ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
