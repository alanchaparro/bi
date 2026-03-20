from __future__ import annotations

import re
from datetime import datetime


def month_serial(mm_yyyy: object) -> int:
    text = str(mm_yyyy or "").strip()
    parts = text.split("/")
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
        return 0
    month = int(parts[0])
    year = int(parts[1])
    if month < 1 or month > 12 or year <= 0:
        return 0
    return year * 12 + month


def normalize_month(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if "/" in text:
        parts = text.split("/")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit() and len(parts[1]) == 4:
            month = int(parts[0])
            if 1 <= month <= 12:
                return f"{month:02d}/{parts[1]}"
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).strftime("%m/%Y")
        except ValueError:
            continue
    return ""


def add_months(mm_yyyy: object, delta_months: int) -> str:
    serial = month_serial(mm_yyyy)
    if serial <= 0:
        return ""
    absolute = serial + int(delta_months)
    if absolute <= 0:
        return ""
    year = absolute // 12
    month = absolute % 12
    if month == 0:
        month = 12
        year -= 1
    if year <= 0:
        return ""
    return f"{month:02d}/{year}"


def month_from_any(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if re.match(r"^\d{1,2}/\d{4}$", text):
        return normalize_month(text)
    match = re.match(r"^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?", text)
    if match:
        return f"{int(match.group(2)):02d}/{match.group(1)}"
    match = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", text)
    if match:
        return f"{int(match.group(2)):02d}/{match.group(3)}"
    return ""


def latest_month(values: list[str] | tuple[str, ...] | set[str]) -> str:
    valid = sorted({normalize_month(v) for v in values if normalize_month(v)}, key=month_serial)
    return valid[-1] if valid else ""
