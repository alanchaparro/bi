import json
import os
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError, URLError


API_BASE = os.getenv("SYNC_VALIDATE_API_BASE", "http://localhost:8000/api/v1").rstrip("/")
USERNAME = os.getenv("SYNC_VALIDATE_USERNAME", "admin")
PASSWORD = os.getenv("SYNC_VALIDATE_PASSWORD", "admin123")
DOMAIN = os.getenv("SYNC_VALIDATE_DOMAIN", "gestores")
YEAR_FROM = os.getenv("SYNC_VALIDATE_YEAR_FROM")
POLL_SECONDS = float(os.getenv("SYNC_VALIDATE_POLL_SECONDS", "2"))
TIMEOUT_SECONDS = int(os.getenv("SYNC_VALIDATE_TIMEOUT_SECONDS", "900"))
HTTP_TIMEOUT_SECONDS = int(os.getenv("SYNC_VALIDATE_HTTP_TIMEOUT_SECONDS", "30"))


def _request(method: str, path: str, payload: dict | None = None, token: str | None = None) -> dict:
    url = f"{API_BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as res:
            body = res.read().decode("utf-8")
            return json.loads(body) if body else {}
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"{method} {path} failed: HTTP {exc.code} {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"{method} {path} failed: {exc}") from exc


def _login() -> str:
    payload = {"username": USERNAME, "password": PASSWORD}
    auth = _request("POST", "/auth/login", payload=payload)
    token = str(auth.get("access_token") or "").strip()
    if not token:
        raise RuntimeError("No access_token from /auth/login")
    return token


def _run_and_wait(token: str, payload: dict, run_index: int) -> dict:
    run = _request("POST", "/sync/run", payload=payload, token=token)
    job_id = str(run.get("job_id") or "").strip()
    if not job_id:
        raise RuntimeError("No job_id from /sync/run")
    started = time.time()
    last_status = {}
    while True:
        if (time.time() - started) > TIMEOUT_SECONDS:
            raise RuntimeError(f"Timeout waiting sync status for job_id={job_id}")
        query = urllib.parse.urlencode({"domain": payload["domain"], "job_id": job_id})
        status = _request("GET", f"/sync/status?{query}", token=token)
        last_status = status
        running = bool(status.get("running"))
        progress = int(status.get("progress_pct") or 0)
        step = str(status.get("job_step") or status.get("stage") or "-")
        message = str(status.get("status_message") or "")
        print(f"[run#{run_index}] job={job_id} progress={progress}% step={step} running={running} msg={message}")
        if not running:
            return status
        time.sleep(max(0.5, POLL_SECONDS))


def main() -> None:
    token = _login()
    payload = {"domain": DOMAIN}
    if YEAR_FROM and str(YEAR_FROM).strip().isdigit():
        payload["year_from"] = int(str(YEAR_FROM).strip())

    preview = _request("POST", "/sync/preview", payload=payload, token=token)
    print(json.dumps({"preview": preview}, ensure_ascii=False))

    first = _run_and_wait(token, payload, 1)
    if first.get("error"):
        raise RuntimeError(f"First run failed: {first.get('error')}")

    second = _run_and_wait(token, payload, 2)
    if second.get("error"):
        raise RuntimeError(f"Second run failed: {second.get('error')}")

    skipped = int(second.get("skipped_unchanged_chunks") or 0)
    chunk_status = str(second.get("chunk_status") or "").strip().lower()
    watermark = second.get("watermark") or {}
    result = {
        "domain": DOMAIN,
        "first_job": first.get("job_id"),
        "second_job": second.get("job_id"),
        "second_chunk_status": chunk_status or None,
        "second_skipped_unchanged_chunks": skipped,
        "watermark": watermark,
    }

    # Acceptance signal for incremental no-change rerun:
    # either explicit unchanged status or at least one skipped unchanged chunk.
    if skipped <= 0 and chunk_status != "unchanged":
        raise RuntimeError(
            "Incremental validation failed: expected skipped_unchanged_chunks > 0 or chunk_status='unchanged'"
        )

    print(json.dumps({"ok": True, "result": result}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
