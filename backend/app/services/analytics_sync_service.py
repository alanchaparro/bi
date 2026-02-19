"""Sincroniza analytics_contract_snapshot desde MySQL legacy (query_analytics.sql)."""
from datetime import datetime
from pathlib import Path

import mysql.connector
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.brokers import AnalyticsContractSnapshot


def get_query_path() -> Path:
    """Ruta a query_analytics.sql (raíz del proyecto)."""
    return Path(__file__).resolve().parents[3] / 'query_analytics.sql'


def _normalize_month(v: str) -> str:
    s = str(v or '').strip()
    if '/' not in s:
        return s
    parts = s.split('/')
    if len(parts) != 2:
        return s
    return f"{parts[0].zfill(2)}/{parts[1]}"


def _month_serial(mm_yyyy: str) -> int:
    s = str(mm_yyyy or '').strip()
    parts = s.split('/')
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
        return 0
    m = int(parts[0])
    y = int(parts[1])
    if m < 1 or m > 12:
        return 0
    return y * 12 + m


def _select_window_months(months: set[str], window_months: int) -> set[str]:
    if window_months <= 0:
        return set(months)
    valid = [(m, _month_serial(m)) for m in months]
    valid = [(m, serial) for m, serial in valid if serial > 0]
    if not valid:
        return set()
    max_serial = max(serial for _, serial in valid)
    min_serial = max_serial - window_months + 1
    return {m for m, serial in valid if serial >= min_serial}


def sync_from_mysql(db: Session, progress_cb=None) -> dict:
    """
    Carga analytics_contract_snapshot desde MySQL legacy ejecutando query_analytics.sql.
    - modo incremental: reemplaza solo los ultimos N meses detectados.
    - modo full: recarga completa.
    Retorna {rows_inserted, mode, months_replaced, error}.
    """
    query_path = get_query_path()
    if not query_path.exists():
        return {'rows_inserted': 0, 'error': 'query_analytics.sql no encontrado.'}

    if not settings.mysql_database:
        return {'rows_inserted': 0, 'error': 'MYSQL_DATABASE no configurado en .env'}

    if callable(progress_cb):
        progress_cb(stage='connecting_mysql', progress_pct=5, message='Conectando a MySQL...')

    mysql_config = {
        'host': settings.mysql_host,
        'port': settings.mysql_port,
        'user': settings.mysql_user,
        'password': settings.mysql_password,
        'database': settings.mysql_database,
        'connection_timeout': 10,
    }
    try:
        conn = mysql.connector.connect(**mysql_config)
        try:
            if hasattr(conn, '_socket') and conn._socket is not None:
                conn._socket.settimeout(120)
        except Exception:
            pass
        cursor = conn.cursor(dictionary=True)
        query_sql = query_path.read_text(encoding='utf-8')
        if callable(progress_cb):
            progress_cb(stage='querying_mysql', progress_pct=15, message='Ejecutando query_analytics.sql...')
        cursor.execute(query_sql)
        rows_raw = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        return {'rows_inserted': 0, 'error': f'Error MySQL: {e}'}

    rows_inserted = 0
    mode = str(settings.analytics_sync_mode or 'incremental').strip().lower()
    if mode not in {'incremental', 'full'}:
        mode = 'incremental'
    window_months = int(settings.analytics_sync_window_months or 3)
    months_replaced: list[str] = []
    try:
        if callable(progress_cb):
            progress_cb(stage='normalizing', progress_pct=30, message='Normalizando dataset...')
        now = datetime.utcnow()
        batch_size = 5000
        batch = []
        normalized_rows = []
        source_months: set[str] = set()
        for i, row in enumerate(rows_raw):
            gestion = _normalize_month(row.get('gestion_month', '') or '')
            if not gestion or '/' not in gestion:
                continue
            source_months.add(gestion)
            un = str(row.get('un', '') or 'S/D').strip().upper() or 'S/D'
            via = str(row.get('via_cobro', '') or 'S/D').strip().upper() or 'S/D'
            if via != 'COBRADOR':
                via = 'DEBITO'
            supervisor = str(row.get('supervisor', '') or 'S/D').strip().upper() or 'S/D'
            tramo = int(float(row.get('tramo', 0) or 0))
            debt = float(row.get('debt_total', 0) or 0)
            paid = float(row.get('paid_total', 0) or 0)
            contracts = max(1, int(row.get('contracts_total', 1) or 1))
            debt_per = debt / contracts
            paid_per = paid / contracts
            normalized_rows.append(
                {
                    'index': i,
                    'sale_month': gestion,
                    'close_month': gestion,
                    'supervisor': supervisor,
                    'un': un,
                    'via': via,
                    'tramo': tramo,
                    'debt_per': debt_per,
                    'paid_per': paid_per,
                    'contracts': contracts,
                }
            )

        months_to_replace: set[str] = set()
        if callable(progress_cb):
            progress_cb(stage='preparing_replace', progress_pct=45, message='Preparando reemplazo de meses...')
        if mode == 'full':
            months_to_replace = set(source_months)
            db.query(AnalyticsContractSnapshot).delete()
            db.commit()
        else:
            months_to_replace = _select_window_months(source_months, window_months)
            if months_to_replace:
                db.query(AnalyticsContractSnapshot).filter(
                    AnalyticsContractSnapshot.sale_month.in_(months_to_replace)
                ).delete(synchronize_session=False)
                db.commit()

        months_replaced = sorted(months_to_replace, key=_month_serial)

        if callable(progress_cb):
            progress_cb(stage='inserting', progress_pct=60, message='Insertando filas en snapshot...')
        total_candidates = 0
        for row in normalized_rows:
            if mode == 'incremental' and row['sale_month'] not in months_to_replace:
                continue
            total_candidates += int(row['contracts'])
        inserted_counter = 0
        next_report = 0

        for row in normalized_rows:
            if mode == 'incremental' and row['sale_month'] not in months_to_replace:
                continue
            i = row['index']
            contracts = int(row['contracts'])
            for j in range(contracts):
                batch.append({
                    'contract_id': f'sync_{i}_{j}',
                    'sale_month': row['sale_month'],
                    'close_month': row['close_month'],
                    'supervisor': row['supervisor'],
                    'un': row['un'],
                    'via': row['via'],
                    'tramo': row['tramo'],
                    'debt': row['debt_per'],
                    'paid': row['paid_per'],
                    'created_at': now,
                })
                if len(batch) >= batch_size:
                    db.bulk_insert_mappings(AnalyticsContractSnapshot, batch)
                    db.commit()
                    rows_inserted += len(batch)
                    inserted_counter += len(batch)
                    batch = []
                    if callable(progress_cb) and total_candidates > 0:
                        pct = 60 + int((inserted_counter / total_candidates) * 35)
                        if pct > 95:
                            pct = 95
                        if pct >= next_report:
                            progress_cb(
                                stage='inserting',
                                progress_pct=pct,
                                message=f'Insertando filas... {inserted_counter}/{total_candidates}',
                            )
                            next_report = pct + 5
        if batch:
            db.bulk_insert_mappings(AnalyticsContractSnapshot, batch)
            db.commit()
            rows_inserted += len(batch)
            inserted_counter += len(batch)
        if callable(progress_cb):
            progress_cb(stage='completed', progress_pct=100, message='Sincronizacion finalizada.')
        return {
            'rows_inserted': rows_inserted,
            'mode': mode,
            'months_replaced': months_replaced,
            'error': None,
        }
    except Exception as e:
        db.rollback()
        return {'rows_inserted': 0, 'mode': mode, 'months_replaced': months_replaced, 'error': str(e)}
