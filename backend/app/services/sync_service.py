import hashlib
import json
import logging
import os
import threading
import tempfile
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

import mysql.connector
from sqlalchemy import func, text as sa_text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.core.analytics_cache import invalidate_prefix
from app.core.config import settings
from app.db.session import SessionLocal, engine
from app.models.brokers import (
    AnalyticsContractSnapshot,
    AnalyticsFact,
    CarteraFact,
    CobranzasFact,
    ContratosFact,
    GestoresFact,
    SyncRecord,
    SyncRun,
)


SYNC_DOMAIN_QUERIES = {
    'analytics': 'query_analytics.sql',
    'cartera': 'query.sql',
    'cobranzas': 'query_cobranzas.sql',
    'contratos': 'query_contratos.sql',
    'gestores': 'query_gestores.sql',
}

BUSINESS_KEY_FIELDS = ['domain', 'contract_id', 'gestion_month', 'supervisor', 'un', 'via', 'tramo']
FACT_TABLE_BY_DOMAIN = {
    'analytics': AnalyticsFact,
    'cartera': CarteraFact,
    'cobranzas': CobranzasFact,
    'contratos': ContratosFact,
    'gestores': GestoresFact,
}


def _target_table_name(domain: str) -> str:
    return FACT_TABLE_BY_DOMAIN[domain].__tablename__

_state_lock = threading.Lock()
_state_by_domain: dict[str, dict] = {}
_running_by_domain: set[str] = set()
logger = logging.getLogger(__name__)


def _query_path_for(domain: str) -> Path:
    filename = SYNC_DOMAIN_QUERIES[domain]
    return Path(__file__).resolve().parents[3] / filename


def _month_serial(mm_yyyy: str) -> int:
    text = str(mm_yyyy or '').strip()
    parts = text.split('/')
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
        return 0
    month = int(parts[0])
    year = int(parts[1])
    if month < 1 or month > 12:
        return 0
    return year * 12 + month


def _year_of(mm_yyyy: str) -> int:
    text = str(mm_yyyy or '').strip()
    parts = text.split('/')
    if len(parts) != 2 or not parts[1].isdigit():
        return 0
    return int(parts[1])


def _month_range(from_mm_yyyy: str, to_mm_yyyy: str) -> list[str]:
    start = _month_serial(from_mm_yyyy)
    end = _month_serial(to_mm_yyyy)
    if start <= 0 or end <= 0 or start > end:
        return []
    out: list[str] = []
    current = start
    while current <= end:
        year = current // 12
        month = current % 12
        if month == 0:
            month = 12
            year -= 1
        out.append(f'{month:02d}/{year}')
        current += 1
    return out


def _parse_month(value: object) -> str:
    if value is None:
        return ''
    text = str(value).strip()
    if not text:
        return ''
    if '/' in text:
        parts = text.split('/')
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit() and len(parts[1]) == 4:
            month = int(parts[0])
            if 1 <= month <= 12:
                return f'{month:02d}/{parts[1]}'
    formats = ['%Y-%m-%d', '%Y/%m/%d', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']
    for fmt in formats:
        try:
            dt = datetime.strptime(text, fmt)
            return dt.strftime('%m/%Y')
        except ValueError:
            continue
    return ''


def _parse_date_key(value: object) -> str:
    """Normalize a date-like value to YYYY-MM-DD for dedup keys."""
    if value is None:
        return ''
    text = str(value).strip()
    if not text:
        return ''
    formats = [
        '%Y-%m-%d',
        '%Y/%m/%d',
        '%d/%m/%Y',
        '%Y-%m-%d %H:%M:%S',
        '%Y/%m/%d %H:%M:%S',
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(text, fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue
    return ''


def _parse_iso_date(value: object) -> date | None:
    text = _parse_date_key(value)
    if not text:
        return None
    try:
        return datetime.strptime(text, '%Y-%m-%d').date()
    except ValueError:
        return None


def _normalize_key(row: dict, *candidates: str) -> str:
    for key in candidates:
        if key in row and str(row.get(key) or '').strip():
            return str(row.get(key)).strip()
    lower = {str(k).lower(): k for k in row.keys()}
    for key in candidates:
        k = lower.get(key.lower())
        if k and str(row.get(k) or '').strip():
            return str(row.get(k)).strip()
    return ''


def _normalize_record(domain: str, row: dict, seq: int) -> dict:
    contract_id = _normalize_key(row, 'contract_id', 'id_contrato', 'id')
    if not contract_id:
        contract_id = f'{domain}_{seq}'

    gestion_month = _normalize_key(row, 'gestion_month')
    if not gestion_month:
        y = _normalize_key(row, 'Año', 'anio', 'year')
        m = _normalize_key(row, 'Mes', 'mes', 'month')
        if y.isdigit() and m.isdigit():
            gestion_month = f'{int(m):02d}/{y}'
    if not gestion_month:
        # Business rule: for cartera, the processing year must map to close date.
        if domain == 'cartera':
            gestion_month = _parse_month(_normalize_key(row, 'fecha_cierre', 'closed_date', 'close_date'))
        if not gestion_month:
            gestion_month = _parse_month(
                _normalize_key(row, 'from_date', 'date', 'fecha_contrato', 'fecha_cierre', 'Actualizado_al')
            )
    if not gestion_month:
        gestion_month = datetime.utcnow().strftime('%m/%Y')

    supervisor = _normalize_key(row, 'supervisor', 'Supervisor', 'Gestor', 'Vendedor').upper() or 'S/D'
    un = _normalize_key(row, 'un', 'UN').upper() or 'S/D'
    via = _normalize_key(row, 'via', 'via_cobro', 'via_de_cobro', 'VP').upper() or 'S/D'

    if domain == 'cartera':
        tramo_text = _normalize_key(row, 'cuotas_vencidas', 'quotas_expirations', 'tramo')
    else:
        tramo_text = _normalize_key(row, 'tramo')
    try:
        tramo = int(float(tramo_text)) if tramo_text else 0
    except ValueError:
        tramo = 0
    if tramo < 0:
        tramo = 0
    if tramo >= 7:
        tramo = 7

    payload_json = json.dumps(row, ensure_ascii=False, sort_keys=True, default=str)
    source_hash = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()
    close_date = _parse_date_key(_normalize_key(row, 'fecha_cierre', 'closed_date', 'close_date'))
    return {
        'domain': domain,
        'contract_id': str(contract_id)[:64],
        'gestion_month': str(gestion_month)[:7],
        'supervisor': str(supervisor)[:128],
        'un': str(un)[:128],
        'via': str(via)[:32],
        'tramo': tramo,
        'close_date': close_date,
        'payload_json': payload_json,
        'source_hash': source_hash,
    }


def _fact_row_from_normalized(domain: str, normalized: dict) -> dict:
    payload = {}
    try:
        payload = json.loads(normalized.get('payload_json') or '{}')
    except Exception:
        payload = {}

    gestion_month = str(normalized.get('gestion_month') or '')
    close_year = _year_of(gestion_month) or datetime.utcnow().year
    close_date = _parse_iso_date(normalized.get('close_date'))
    if close_date is None:
        try:
            close_date = datetime.strptime(f'01/{gestion_month}', '%d/%m/%Y').date()
        except ValueError:
            close_date = datetime.utcnow().date()
    tramo = int(normalized.get('tramo') or 0)
    tramo = 7 if tramo >= 7 else max(0, tramo)
    category = 'MOROSO' if tramo > 3 else 'VIGENTE'

    base = {
        'contract_id': normalized['contract_id'],
        'gestion_month': gestion_month,
        'supervisor': normalized['supervisor'],
        'un': normalized['un'],
        'source_hash': normalized['source_hash'],
        'payload_json': normalized['payload_json'],
        'loaded_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }
    if domain == 'cartera':
        return {
            **base,
            'close_date': close_date,
            'close_month': gestion_month,
            'close_year': close_year,
            'via_cobro': normalized['via'],
            'tramo': tramo,
            'category': category,
            'contracts_total': max(1, _to_int(payload.get('contracts_total') or 1, 1)),
            'monto_vencido': _to_float(payload.get('monto_vencido') or payload.get('expired_amount') or payload.get('capital_vencido')),
            'total_saldo': _to_float(payload.get('total_saldo') or payload.get('total_residue')),
            'capital_saldo': _to_float(payload.get('capital_saldo') or payload.get('capital_amount_residue')),
            'capital_vencido': _to_float(payload.get('capital_vencido') or payload.get('expired_capital_amount')),
        }
    if domain == 'analytics':
        return {
            **base,
            'via': normalized['via'],
            'tramo': tramo,
            'contracts_total': max(1, _to_int(payload.get('contracts_total') or 1, 1)),
            'debt_total': _to_float(payload.get('debt_total') or payload.get('debt') or payload.get('total_saldo')),
            'paid_total': _to_float(payload.get('paid_total') or payload.get('paid')),
        }
    return {
        **base,
        'via': normalized['via'],
        'tramo': tramo,
    }


def _source_dedupe_key(normalized: dict) -> tuple:
    """
    Source dedupe key:
    - cartera: business rule requested by user (contract_id + close_date).
    - others: keep previous wide key.
    """
    domain = str(normalized.get('domain') or '').strip().lower()
    if domain == 'cartera':
        close_date = normalized.get('close_date') or normalized.get('gestion_month') or ''
        return (
            normalized.get('domain'),
            normalized.get('contract_id'),
            close_date,
        )
    return tuple(normalized[k] for k in BUSINESS_KEY_FIELDS)


def _set_state(domain: str, updates: dict) -> None:
    with _state_lock:
        current = dict(_state_by_domain.get(domain) or {})
        current.update(updates)
        _state_by_domain[domain] = current


def _append_log(domain: str, line: str) -> None:
    with _state_lock:
        current = dict(_state_by_domain.get(domain) or {'log': []})
        logs = list(current.get('log') or [])
        logs.append(line)
        current['log'] = logs[-200:]
        _state_by_domain[domain] = current
    logger.info('[sync:%s] %s', domain, line)


def _iter_from_mysql(query_path: Path):
    cfg = {
        'host': settings.mysql_host,
        'port': settings.mysql_port,
        'user': settings.mysql_user,
        'password': settings.mysql_password,
        'database': settings.mysql_database,
        'connection_timeout': 20,
        'consume_results': True,
    }
    conn = mysql.connector.connect(**cfg)
    try:
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute(query_path.read_text(encoding='utf-8'))
            batch_size = max(100, int(settings.sync_fetch_batch_size or 5000))
            while True:
                batch = cursor.fetchmany(batch_size)
                if not batch:
                    break
                yield batch
            # Drain any trailing result sets to avoid "Unread result found".
            while cursor.nextset():
                while True:
                    trailing = cursor.fetchmany(batch_size)
                    if not trailing:
                        break
        finally:
            # Best effort: ensure connection has no pending results before close.
            try:
                conn.consume_results()
            except Exception:
                pass
            cursor.close()
    finally:
        conn.close()


def _delete_target_window(db: Session, domain: str, mode: str, year_from: int | None, target_months: set[str]) -> None:
    q = db.query(SyncRecord).filter(SyncRecord.domain == domain)
    if mode == 'full_year' and year_from is not None:
        q = q.filter(func.substr(SyncRecord.gestion_month, 4, 4) == str(year_from))
    elif mode == 'full_all':
        pass
    elif target_months:
        q = q.filter(SyncRecord.gestion_month.in_(target_months))
    q.delete(synchronize_session=False)
    db.commit()


def _upsert_sync_records(db: Session, rows: list[dict]) -> int:
    if not rows:
        return 0
    now = datetime.utcnow()
    values = []
    for row in rows:
        values.append(
            {
                'domain': row['domain'],
                'contract_id': row['contract_id'],
                'gestion_month': row['gestion_month'],
                'supervisor': row['supervisor'],
                'un': row['un'],
                'via': row['via'],
                'tramo': row['tramo'],
                'payload_json': row['payload_json'],
                'source_hash': row['source_hash'],
                'created_at': now,
                'updated_at': now,
            }
        )
    table = SyncRecord.__table__
    dialect = engine.dialect.name
    index_cols = [
        table.c.domain,
        table.c.contract_id,
        table.c.gestion_month,
        table.c.supervisor,
        table.c.un,
        table.c.via,
        table.c.tramo,
    ]
    if dialect == 'postgresql':
        insert_stmt = pg_insert(table).values(values)
        stmt = insert_stmt.on_conflict_do_update(
            index_elements=index_cols,
            set_={
                'payload_json': insert_stmt.excluded.payload_json,
                'source_hash': insert_stmt.excluded.source_hash,
                'updated_at': now,
            },
        )
    else:
        insert_stmt = sqlite_insert(table).values(values)
        stmt = insert_stmt.on_conflict_do_update(
            index_elements=index_cols,
            set_={
                'payload_json': insert_stmt.excluded.payload_json,
                'source_hash': insert_stmt.excluded.source_hash,
                'updated_at': now,
            },
        )
    db.execute(stmt)
    db.commit()
    return len(values)


def _ensure_cartera_partitions(db: Session, months: set[str]) -> None:
    if engine.dialect.name != 'postgresql' or not months:
        return
    partitioned = db.execute(
        sa_text(
            """
            SELECT 1
            FROM pg_partitioned_table p
            JOIN pg_class c ON c.oid = p.partrelid
            WHERE c.relname = 'cartera_fact'
            LIMIT 1
            """
        )
    ).scalar()
    if not partitioned:
        # Compat mode: if cartera_fact exists as regular table, skip partition DDL.
        return
    for mm_yyyy in months:
        parts = str(mm_yyyy).split('/')
        if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
            continue
        month = int(parts[0])
        year = int(parts[1])
        if month < 1 or month > 12:
            continue
        part_name = f'cartera_fact_{year}_{month:02d}'
        start = f'{year:04d}-{month:02d}-01'
        if month == 12:
            end = f'{year + 1:04d}-01-01'
        else:
            end = f'{year:04d}-{month + 1:02d}-01'
        db.execute(
            sa_text(
                f"""
                CREATE TABLE IF NOT EXISTS {part_name}
                PARTITION OF cartera_fact
                FOR VALUES FROM ('{start}') TO ('{end}')
                """
            )
        )
    db.commit()


def _delete_target_window_fact(
    db: Session,
    domain: str,
    mode: str,
    year_from: int | None,
    close_month: str | None,
    target_months: set[str],
) -> None:
    model = FACT_TABLE_BY_DOMAIN[domain]
    q = db.query(model)
    if domain == 'cartera':
        if mode == 'full_month' and close_month:
            q = q.filter(CarteraFact.close_month == close_month)
        elif mode == 'full_year' and year_from is not None:
            q = q.filter(CarteraFact.close_year == int(year_from))
        elif mode == 'full_all':
            pass
        elif target_months:
            q = q.filter(CarteraFact.close_month.in_(target_months))
    else:
        if mode == 'full_year' and year_from is not None:
            q = q.filter(func.substr(model.gestion_month, 4, 4) == str(year_from))
        elif mode == 'full_all':
            pass
        elif target_months:
            q = q.filter(model.gestion_month.in_(target_months))
    q.delete(synchronize_session=False)
    db.commit()


def _upsert_fact_rows(db: Session, domain: str, rows: list[dict]) -> tuple[int, int]:
    if not rows:
        return 0, 0
    model = FACT_TABLE_BY_DOMAIN[domain]
    table = model.__table__
    now = datetime.utcnow()
    values = []
    for n in rows:
        record = _fact_row_from_normalized(domain, n)
        record['loaded_at'] = now
        record['updated_at'] = now
        values.append(record)

    if domain == 'cartera':
        index_cols = [table.c.contract_id, table.c.close_date]
    else:
        index_cols = [table.c.contract_id, table.c.gestion_month, table.c.supervisor, table.c.un, table.c.via, table.c.tramo]

    if engine.dialect.name == 'postgresql':
        insert_stmt = pg_insert(table).values(values)
    else:
        insert_stmt = sqlite_insert(table).values(values)
    excluded = insert_stmt.excluded
    if domain == 'cartera':
        set_map = {
            'close_month': excluded.close_month,
            'close_year': excluded.close_year,
            'gestion_month': excluded.gestion_month,
            'supervisor': excluded.supervisor,
            'un': excluded.un,
            'via_cobro': excluded.via_cobro,
            'tramo': excluded.tramo,
            'category': excluded.category,
            'contracts_total': excluded.contracts_total,
            'monto_vencido': excluded.monto_vencido,
            'total_saldo': excluded.total_saldo,
            'capital_saldo': excluded.capital_saldo,
            'capital_vencido': excluded.capital_vencido,
            'source_hash': excluded.source_hash,
            'payload_json': excluded.payload_json,
            'updated_at': now,
        }
    else:
        set_map = {
            'source_hash': excluded.source_hash,
            'payload_json': excluded.payload_json,
            'updated_at': now,
        }
        if domain == 'analytics':
            set_map.update(
                {
                    'contracts_total': excluded.contracts_total,
                    'debt_total': excluded.debt_total,
                    'paid_total': excluded.paid_total,
                }
            )
    stmt = insert_stmt.on_conflict_do_update(
        index_elements=index_cols,
        set_=set_map,
        where=table.c.source_hash != excluded.source_hash,
    )
    result = db.execute(stmt)
    db.commit()
    changed = int(result.rowcount or 0)
    unchanged = max(0, len(values) - changed)
    return changed, unchanged


def _to_float(value: object) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _to_int(value: object, default: int = 0) -> int:
    try:
        return int(float(value))
    except Exception:
        return default


def _refresh_analytics_snapshot(
    db: Session,
    mode: str,
    year_from: int | None,
    target_months: set[str],
    normalized_rows: list[dict],
) -> None:
    q = db.query(AnalyticsContractSnapshot)
    if mode == 'full_year' and year_from is not None:
        q = q.filter(func.substr(AnalyticsContractSnapshot.sale_month, 4, 4) == str(year_from))
    elif mode == 'full_all':
        pass
    elif target_months:
        q = q.filter(AnalyticsContractSnapshot.sale_month.in_(target_months))
    q.delete(synchronize_session=False)
    db.commit()

    now = datetime.utcnow()
    snapshot_rows: list[dict] = []
    for row in normalized_rows:
        payload = json.loads(row['payload_json'])
        contracts = max(1, _to_int(payload.get('contracts_total'), 1))
        debt_total = _to_float(payload.get('debt_total'))
        paid_total = _to_float(payload.get('paid_total'))
        debt_per = debt_total / contracts
        paid_per = paid_total / contracts
        base_id = str(row['contract_id'])
        for i in range(contracts):
            snapshot_rows.append(
                {
                    'contract_id': f'{base_id}_{i}',
                    'sale_month': row['gestion_month'],
                    'close_month': row['gestion_month'],
                    'supervisor': row['supervisor'],
                    'un': row['un'],
                    'via': row['via'],
                    'tramo': int(row['tramo']),
                    'debt': debt_per,
                    'paid': paid_per,
                    'created_at': now,
                }
            )
    if snapshot_rows:
        db.bulk_insert_mappings(AnalyticsContractSnapshot, snapshot_rows)
        db.commit()


def _persist_sync_run(db: Session, payload: dict) -> None:
    row = db.query(SyncRun).filter(SyncRun.job_id == payload['job_id']).first()
    if row is None:
        row = SyncRun(job_id=payload['job_id'])
        db.add(row)
    for key, value in payload.items():
        if key == 'log':
            row.log_json = json.dumps(value or [], ensure_ascii=False)
        elif hasattr(row, key):
            setattr(row, key, value)
    db.commit()


def _cleanup_stale_running_jobs() -> None:
    """
    After process/container restarts, jobs can remain running=true in DB
    without a live worker thread. Mark them as failed to avoid frozen UI status.
    """
    db = SessionLocal()
    try:
        rows = db.query(SyncRun).filter(SyncRun.running.is_(True)).all()
        if not rows:
            return
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        for row in rows:
            row.running = False
            row.stage = 'failed'
            row.progress_pct = 100
            row.status_message = 'Sincronizacion interrumpida (reinicio del servicio)'
            row.error = 'job_interrupted_on_restart'
            row.finished_at = now
            if row.started_at:
                row.duration_sec = round((now - row.started_at).total_seconds(), 2)
            existing_log = []
            try:
                existing_log = json.loads(row.log_json or '[]')
            except Exception:
                existing_log = []
            existing_log.append(f'Error: job_interrupted_on_restart ({now.isoformat()})')
            row.log_json = json.dumps(existing_log[-200:], ensure_ascii=False)
        db.commit()
    finally:
        db.close()


def _execute_job(
    job_id: str,
    actor: str,
    domain: str,
    mode: str,
    year_from: int | None,
    close_month: str | None,
    close_month_from: str | None,
    close_month_to: str | None,
) -> None:
    started_at = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        logger.info(
            '[sync:%s:%s] start mode=%s year_from=%s close_month=%s close_month_from=%s close_month_to=%s actor=%s',
            domain,
            job_id,
            mode,
            year_from,
            close_month,
            close_month_from,
            close_month_to,
            actor,
        )
        _persist_sync_run(
            db,
            {
                'job_id': job_id,
                'domain': domain,
                'mode': mode,
                'year_from': year_from,
                'close_month': close_month,
                'close_month_from': close_month_from,
                'close_month_to': close_month_to,
                'target_table': _target_table_name(domain),
                'running': True,
                'stage': 'starting',
                'progress_pct': 1,
                'status_message': 'Iniciando sincronizacion',
                'rows_inserted': 0,
                'rows_updated': 0,
                'rows_skipped': 0,
                'rows_read': 0,
                'rows_upserted': 0,
                'rows_unchanged': 0,
                'duplicates_detected': 0,
                'error': None,
                'started_at': started_at.replace(tzinfo=None),
                'finished_at': None,
                'duration_sec': None,
                'actor': actor,
                'log': [
                    f'Inicio: {started_at.isoformat()}',
                    f'Domain: {domain}',
                    f'Modo: {mode}',
                    f'Mes cierre: {close_month or "-"}',
                    f'Rango cierre: {(close_month_from or "-")} -> {(close_month_to or "-")}',
                ],
            },
        )
        _set_state(
            domain,
            {
                'job_id': job_id,
                'domain': domain,
                'mode': mode,
                'year_from': year_from,
                'close_month': close_month,
                'close_month_from': close_month_from,
                'close_month_to': close_month_to,
                'target_table': _target_table_name(domain),
                'running': True,
                'stage': 'starting',
                'progress_pct': 1,
                'status_message': 'Iniciando sincronizacion',
                'rows_inserted': 0,
                'rows_updated': 0,
                'rows_skipped': 0,
                'rows_read': 0,
                'rows_upserted': 0,
                'rows_unchanged': 0,
                'duplicates_detected': 0,
                'error': None,
                'log': [
                    f'Inicio: {started_at.isoformat()}',
                    f'Domain: {domain}',
                    f'Modo: {mode}',
                    f'Mes cierre: {close_month or "-"}',
                    f'Rango cierre: {(close_month_from or "-")} -> {(close_month_to or "-")}',
                ],
                'started_at': started_at.isoformat(),
                'finished_at': None,
                'duration_sec': None,
            },
        )

        range_months = _month_range(close_month_from or '', close_month_to or '') if mode == 'range_months' else []
        range_months_set = set(range_months)

        query_path = _query_path_for(domain)
        if not query_path.exists():
            raise RuntimeError(f'No existe query para dominio {domain}: {query_path.name}')
        _set_state(domain, {'stage': 'connecting_mysql', 'progress_pct': 8, 'status_message': 'Conectando a MySQL'})
        _append_log(domain, 'Conectando a MySQL...')
        max_rows = max(1, int(settings.sync_max_rows or 250000))
        source_rows = 0
        _set_state(domain, {'stage': 'normalizing', 'progress_pct': 35, 'status_message': 'Normalizando filas'})

        normalized_rows: list[dict] = []
        source_months: set[str] = set()
        source_keys: set[tuple] = set()
        duplicates_detected = 0
        normalized_count = 0
        temp_rows_path: str | None = None
        temp_rows_file = None
        # Stream large domains to disk to keep memory stable and show incremental progress.
        if domain in {'cartera', 'cobranzas', 'contratos', 'gestores'}:
            fd, temp_rows_path = tempfile.mkstemp(prefix=f'sync_{domain}_', suffix='.jsonl')
            os.close(fd)
            temp_rows_file = open(temp_rows_path, 'w', encoding='utf-8')
        seq = 0
        try:
            for batch in _iter_from_mysql(query_path):
                source_rows += len(batch)
                # Keep hard cap only for full_all; scoped modes are streamed safely.
                hard_limit = max_rows if mode == 'full_all' else None
                if hard_limit is not None and source_rows > hard_limit:
                    raise RuntimeError(
                        f'La consulta excede el maximo permitido ({hard_limit} filas). '
                        'Acota la query o ejecuta por anio.'
                    )
                norm_pct = min(74, 35 + int(source_rows / 25000))
                _set_state(
                    domain,
                    {
                        'stage': 'normalizing',
                        'progress_pct': norm_pct,
                        'status_message': f'Normalizando filas ({source_rows} leidas)',
                        'rows_read': source_rows,
                        'duplicates_detected': duplicates_detected,
                    },
                )
                for row in batch:
                    n = _normalize_record(domain, row, seq)
                    seq += 1
                    if mode == 'full_month' and close_month and n['gestion_month'] != close_month:
                        continue
                    if mode == 'range_months' and range_months_set and n['gestion_month'] not in range_months_set:
                        continue
                    if mode == 'full_year' and year_from is not None and _year_of(n['gestion_month']) != year_from:
                        continue
                    source_months.add(n['gestion_month'])
                    key = _source_dedupe_key(n)
                    if key in source_keys:
                        duplicates_detected += 1
                        continue
                    source_keys.add(key)
                    normalized_count += 1
                    if temp_rows_file is not None:
                        temp_rows_file.write(json.dumps(n, ensure_ascii=False) + '\n')
                    else:
                        normalized_rows.append(n)
                if source_rows % 50000 == 0:
                    _append_log(
                        domain,
                        f'Normalizando... leidas={source_rows}, unicas={normalized_count}, duplicadas={duplicates_detected}',
                    )
        finally:
            if temp_rows_file is not None:
                temp_rows_file.close()

        _append_log(domain, f'Filas fuente: {source_rows}')
        target_months = set(source_months)
        _ensure_cartera_partitions(db, target_months if domain == 'cartera' else set())

        _set_state(domain, {'stage': 'replacing_window', 'progress_pct': 55, 'status_message': 'Reemplazando ventana'})
        _delete_target_window(db, domain, mode, year_from, target_months)
        _delete_target_window_fact(db, domain, mode, year_from, close_month, target_months)
        _append_log(domain, f'Meses objetivo: {", ".join(sorted(target_months, key=_month_serial)) or "-"}')

        _set_state(domain, {'stage': 'upserting', 'progress_pct': 75, 'status_message': 'Aplicando UPSERT'})
        rows_inserted = 0
        rows_upserted = 0
        rows_unchanged = 0
        month_counts: dict[str, int] = {}
        processed_by_month: dict[str, int] = {}
        if temp_rows_path is not None:
            if domain == 'cartera':
                with open(temp_rows_path, 'r', encoding='utf-8') as f_count:
                    for line in f_count:
                        line = line.strip()
                        if not line:
                            continue
                        item = json.loads(line)
                        month_key = str(item.get('gestion_month') or '')
                        if not month_key:
                            continue
                        month_counts[month_key] = month_counts.get(month_key, 0) + 1
                        processed_by_month.setdefault(month_key, 0)
            chunk_size = max(500, int(settings.sync_fetch_batch_size or 5000))
            processed = 0
            if domain == 'cartera' and month_counts:
                ordered_months = sorted(month_counts.keys(), key=_month_serial)
                for month_key in ordered_months:
                    _append_log(domain, f'Procesando mes {month_key}...')
                    chunk: list[dict] = []
                    with open(temp_rows_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            item = json.loads(line)
                            if str(item.get('gestion_month') or '') != month_key:
                                continue
                            chunk.append(item)
                            if len(chunk) >= chunk_size:
                                rows_inserted += _upsert_sync_records(db, chunk)
                                changed, unchanged = _upsert_fact_rows(db, domain, chunk)
                                rows_upserted += changed
                                rows_unchanged += unchanged
                                processed += len(chunk)
                                processed_by_month[month_key] = processed_by_month.get(month_key, 0) + len(chunk)
                                chunk = []
                                pct = 75 + int((processed / max(1, normalized_count)) * 20)
                                _set_state(
                                    domain,
                                    {
                                        'stage': 'upserting',
                                        'progress_pct': min(95, pct),
                                        'status_message': f'Aplicando UPSERT {month_key} ({processed_by_month.get(month_key, 0)}/{month_counts.get(month_key, 0)})',
                                        'rows_inserted': rows_inserted,
                                        'rows_read': source_rows,
                                        'rows_upserted': rows_upserted,
                                        'rows_unchanged': rows_unchanged,
                                        'target_table': _target_table_name(domain),
                                        'duplicates_detected': duplicates_detected,
                                    },
                                )
                    if chunk:
                        rows_inserted += _upsert_sync_records(db, chunk)
                        changed, unchanged = _upsert_fact_rows(db, domain, chunk)
                        rows_upserted += changed
                        rows_unchanged += unchanged
                        processed += len(chunk)
                        processed_by_month[month_key] = processed_by_month.get(month_key, 0) + len(chunk)
                    _append_log(
                        domain,
                        f'[OK] Mes {month_key} finalizado ({processed_by_month.get(month_key, 0)} filas, upsert={rows_upserted}, sin_cambios={rows_unchanged})',
                    )
                    pct = 75 + int((processed / max(1, normalized_count)) * 20)
                    _set_state(
                        domain,
                        {
                            'stage': 'upserting',
                            'progress_pct': min(95, pct),
                            'status_message': f'Mes {month_key} finalizado',
                            'rows_inserted': rows_inserted,
                            'rows_read': source_rows,
                            'rows_upserted': rows_upserted,
                            'rows_unchanged': rows_unchanged,
                            'target_table': _target_table_name(domain),
                            'duplicates_detected': duplicates_detected,
                        },
                    )
            else:
                chunk: list[dict] = []
                with open(temp_rows_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        chunk.append(json.loads(line))
                        if len(chunk) >= chunk_size:
                            rows_inserted += _upsert_sync_records(db, chunk)
                            changed, unchanged = _upsert_fact_rows(db, domain, chunk)
                            rows_upserted += changed
                            rows_unchanged += unchanged
                            processed += len(chunk)
                            chunk = []
                            pct = 75 + int((processed / max(1, normalized_count)) * 20)
                            _set_state(
                                domain,
                                {
                                    'stage': 'upserting',
                                    'progress_pct': min(95, pct),
                                    'status_message': f'Aplicando UPSERT ({processed}/{normalized_count})',
                                    'rows_inserted': rows_inserted,
                                    'rows_read': source_rows,
                                    'rows_upserted': rows_upserted,
                                    'rows_unchanged': rows_unchanged,
                                    'target_table': _target_table_name(domain),
                                    'duplicates_detected': duplicates_detected,
                                },
                            )
                            if processed % 50000 == 0:
                                _append_log(
                                    domain,
                                    f'UPSERT... procesadas={processed}/{normalized_count}, upsert_destino={rows_upserted}, sin_cambios={rows_unchanged}',
                                )
                if chunk:
                    rows_inserted += _upsert_sync_records(db, chunk)
                    changed, unchanged = _upsert_fact_rows(db, domain, chunk)
                    rows_upserted += changed
                    rows_unchanged += unchanged
                    processed += len(chunk)
                    _set_state(
                        domain,
                        {
                            'stage': 'upserting',
                            'progress_pct': 95,
                            'status_message': f'Aplicando UPSERT ({processed}/{normalized_count})',
                            'rows_inserted': rows_inserted,
                            'rows_read': source_rows,
                            'rows_upserted': rows_upserted,
                            'rows_unchanged': rows_unchanged,
                            'target_table': _target_table_name(domain),
                            'duplicates_detected': duplicates_detected,
                        },
                    )
                    _append_log(
                        domain,
                        f'UPSERT... procesadas={processed}/{normalized_count}, upsert_destino={rows_upserted}, sin_cambios={rows_unchanged}',
                    )
            try:
                os.remove(temp_rows_path)
            except Exception:
                pass
        else:
            rows_inserted = _upsert_sync_records(db, normalized_rows)
            rows_upserted, rows_unchanged = _upsert_fact_rows(db, domain, normalized_rows)
            _set_state(
                domain,
                {
                    'rows_inserted': rows_inserted,
                    'rows_read': source_rows,
                    'rows_upserted': rows_upserted,
                    'rows_unchanged': rows_unchanged,
                    'target_table': _target_table_name(domain),
                },
            )
        if domain == 'analytics':
            _set_state(domain, {'stage': 'refreshing_snapshot', 'progress_pct': 88, 'status_message': 'Actualizando snapshot analytics'})
            _refresh_analytics_snapshot(db, mode, year_from, target_months, normalized_rows)

        finished_at = datetime.now(timezone.utc)
        duration_sec = round((finished_at - started_at).total_seconds(), 2)
        log = list((_state_by_domain.get(domain) or {}).get('log') or [])
        log.append(f'Filas aplicadas: {rows_inserted}')
        log.append(f'Filas upsert tabla destino: {rows_upserted}')
        log.append(f'Filas sin cambios tabla destino: {rows_unchanged}')
        log.append(f'Duplicados detectados en fuente: {duplicates_detected}')
        log.append(f'Fin: {finished_at.isoformat()}')

        final_state = {
            'job_id': job_id,
            'domain': domain,
            'mode': mode,
            'year_from': year_from,
            'close_month': close_month,
            'close_month_from': close_month_from,
            'close_month_to': close_month_to,
            'running': False,
            'stage': 'completed',
            'progress_pct': 100,
            'status_message': 'Sincronizacion finalizada',
            'rows_inserted': rows_inserted,
            'rows_updated': 0,
            'rows_skipped': 0,
            'rows_read': source_rows,
            'rows_upserted': rows_upserted,
            'rows_unchanged': rows_unchanged,
            'target_table': _target_table_name(domain),
            'duplicates_detected': duplicates_detected,
            'error': None,
            'log': log[-200:],
            'started_at': started_at.isoformat(),
            'finished_at': finished_at.isoformat(),
            'duration_sec': duration_sec,
        }
        _set_state(domain, final_state)
        if domain == 'cartera':
            invalidated_options = invalidate_prefix('portfolio/options')
            invalidated_summary = invalidate_prefix('portfolio/summary')
            _append_log(
                domain,
                f'Cache invalido: portfolio/options={invalidated_options}, portfolio/summary={invalidated_summary}',
            )
        logger.info(
            '[sync:%s:%s] completed rows_inserted=%s duplicates=%s duration_sec=%s',
            domain,
            job_id,
            rows_inserted,
            duplicates_detected,
            duration_sec,
        )
        _persist_sync_run(
            db,
            {
                'job_id': job_id,
                'domain': domain,
                'mode': mode,
                'year_from': year_from,
                'close_month': close_month,
                'close_month_from': close_month_from,
                'close_month_to': close_month_to,
                'running': False,
                'stage': 'completed',
                'progress_pct': 100,
                'status_message': 'Sincronizacion finalizada',
                'rows_inserted': rows_inserted,
                'rows_updated': 0,
                'rows_skipped': 0,
                'rows_read': source_rows,
                'rows_upserted': rows_upserted,
                'rows_unchanged': rows_unchanged,
                'target_table': _target_table_name(domain),
                'duplicates_detected': duplicates_detected,
                'error': None,
                'finished_at': finished_at.replace(tzinfo=None),
                'duration_sec': duration_sec,
                'log': final_state['log'],
                'actor': actor,
            },
        )
    except Exception as exc:
        finished_at = datetime.now(timezone.utc)
        duration_sec = round((finished_at - started_at).total_seconds(), 2)
        error = str(exc)
        _append_log(domain, f'Error: {error}')
        logger.exception('[sync:%s:%s] failed: %s', domain, job_id, error)
        failed_state = {
            'running': False,
            'stage': 'failed',
            'progress_pct': 100,
            'status_message': 'Sincronizacion con error',
            'error': error,
            'finished_at': finished_at.isoformat(),
            'duration_sec': duration_sec,
        }
        _set_state(domain, failed_state)
        _persist_sync_run(
            db,
            {
                'job_id': job_id,
                'domain': domain,
                'mode': mode,
                'year_from': year_from,
                'close_month': close_month,
                'close_month_from': close_month_from,
                'close_month_to': close_month_to,
                'target_table': _target_table_name(domain),
                'running': False,
                'stage': 'failed',
                'progress_pct': 100,
                'status_message': 'Sincronizacion con error',
                'rows_read': 0,
                'rows_upserted': 0,
                'rows_unchanged': 0,
                'error': error,
                'finished_at': finished_at.replace(tzinfo=None),
                'duration_sec': duration_sec,
                'log': list((_state_by_domain.get(domain) or {}).get('log') or []),
                'actor': actor,
            },
        )
    finally:
        db.close()
        with _state_lock:
            _running_by_domain.discard(domain)


class SyncService:
    @staticmethod
    def start(
        domain: str,
        year_from: int | None,
        close_month: str | None,
        close_month_from: str | None,
        close_month_to: str | None,
        actor: str,
    ) -> dict:
        if domain == 'cartera' and close_month_from and close_month_to:
            if close_month_from == close_month_to:
                mode = 'full_month'
                close_month = close_month_from
            else:
                mode = 'range_months'
        elif domain == 'cartera' and close_month:
            mode = 'full_month'
        else:
            mode = 'full_year' if year_from is not None else 'full_all'
        _cleanup_stale_running_jobs()
        with _state_lock:
            if _running_by_domain:
                running = ', '.join(sorted(_running_by_domain))
                raise RuntimeError(f'Ya existe una sincronizacion en curso ({running})')
            if domain in _running_by_domain:
                raise RuntimeError(f'Ya existe una sincronizacion en curso para {domain}')
            _running_by_domain.add(domain)
        job_id = str(uuid.uuid4())
        started_at = datetime.now(timezone.utc).isoformat()
        thread = threading.Thread(
            target=_execute_job,
            args=(job_id, actor, domain, mode, year_from, close_month, close_month_from, close_month_to),
            daemon=True,
            name=f'sync-{domain}-{job_id[:8]}',
        )
        thread.start()
        return {
            'job_id': job_id,
            'domain': domain,
            'mode': mode,
            'year_from': year_from,
            'close_month': close_month,
            'close_month_from': close_month_from,
            'close_month_to': close_month_to,
            'target_table': _target_table_name(domain),
            'started_at': started_at,
            'status': 'accepted',
        }

    @staticmethod
    def status(domain: str, job_id: str | None = None) -> dict:
        with _state_lock:
            state = dict(_state_by_domain.get(domain) or {})
        if state and (job_id is None or state.get('job_id') == job_id):
            state.setdefault('domain', domain)
            return state

        db = SessionLocal()
        try:
            q = db.query(SyncRun).filter(SyncRun.domain == domain)
            if job_id:
                q = q.filter(SyncRun.job_id == job_id)
            else:
                q = q.order_by(SyncRun.started_at.desc())
            row = q.first()
            if row is None:
                return {'domain': domain, 'running': False, 'progress_pct': 0, 'log': []}
            return {
                'job_id': row.job_id,
                'domain': row.domain,
                'running': bool(row.running),
                'stage': row.stage,
                'progress_pct': int(row.progress_pct or 0),
                'status_message': row.status_message,
                'mode': row.mode,
                'year_from': row.year_from,
                'close_month': row.close_month,
                'close_month_from': getattr(row, 'close_month_from', None),
                'close_month_to': getattr(row, 'close_month_to', None),
                'rows_inserted': int(row.rows_inserted or 0),
                'rows_updated': int(row.rows_updated or 0),
                'rows_skipped': int(row.rows_skipped or 0),
                'rows_read': int(getattr(row, 'rows_read', 0) or 0),
                'rows_upserted': int(getattr(row, 'rows_upserted', 0) or 0),
                'rows_unchanged': int(getattr(row, 'rows_unchanged', 0) or 0),
                'target_table': getattr(row, 'target_table', None),
                'duplicates_detected': int(row.duplicates_detected or 0),
                'error': row.error,
                'log': json.loads(row.log_json or '[]'),
                'started_at': row.started_at.isoformat() if row.started_at else None,
                'finished_at': row.finished_at.isoformat() if row.finished_at else None,
                'duration_sec': row.duration_sec,
            }
        finally:
            db.close()
