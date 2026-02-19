from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.db.session import SessionLocal, engine
from app.models.brokers import AnalyticsFact, CarteraFact, CobranzasFact, ContratosFact, GestoresFact, SyncRecord


FACT_BY_DOMAIN = {
    'analytics': AnalyticsFact,
    'cartera': CarteraFact,
    'cobranzas': CobranzasFact,
    'contratos': ContratosFact,
    'gestores': GestoresFact,
}


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


def _year_of(mm_yyyy: str) -> int:
    parts = str(mm_yyyy or '').split('/')
    if len(parts) != 2 or not parts[1].isdigit():
        return 0
    return int(parts[1])


def _close_date_from_payload(payload: dict, month: str) -> datetime.date:
    for key in ['fecha_cierre', 'closed_date', 'close_date']:
        value = str(payload.get(key) or '').strip()
        if not value:
            continue
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%d/%m/%Y']:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
    return datetime.strptime(f'01/{month}', '%d/%m/%Y').date()


def _upsert(db, model, values: list[dict], index_elements: list[str]) -> int:
    if not values:
        return 0
    table = model.__table__
    dialect = engine.dialect.name
    if dialect == 'postgresql':
        stmt = pg_insert(table).values(values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[getattr(table.c, c) for c in index_elements],
            set_={'source_hash': stmt.excluded.source_hash, 'payload_json': stmt.excluded.payload_json, 'updated_at': datetime.utcnow()},
        )
    else:
        stmt = sqlite_insert(table).values(values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[getattr(table.c, c) for c in index_elements],
            set_={'source_hash': stmt.excluded.source_hash, 'payload_json': stmt.excluded.payload_json, 'updated_at': datetime.utcnow()},
        )
    result = db.execute(stmt)
    db.commit()
    return int(result.rowcount or 0)


def run() -> None:
    db = SessionLocal()
    try:
        total = 0
        for domain, model in FACT_BY_DOMAIN.items():
            rows = db.query(SyncRecord).filter(SyncRecord.domain == domain).all()
            batch = []
            for row in rows:
                payload = {}
                try:
                    payload = json.loads(row.payload_json or '{}')
                except Exception:
                    payload = {}
                now = datetime.utcnow()
                if domain == 'cartera':
                    tramo = int(_to_int(payload.get('cuotas_vencidas') or row.tramo, 0))
                    if tramo >= 7:
                        tramo = 7
                    batch.append(
                        {
                            'contract_id': row.contract_id,
                            'close_date': _close_date_from_payload(payload, row.gestion_month),
                            'close_month': row.gestion_month,
                            'close_year': _year_of(row.gestion_month),
                            'gestion_month': row.gestion_month,
                            'supervisor': row.supervisor,
                            'un': row.un,
                            'via_cobro': row.via,
                            'tramo': tramo,
                            'category': 'MOROSO' if tramo > 3 else 'VIGENTE',
                            'contracts_total': max(1, _to_int(payload.get('contracts_total') or 1, 1)),
                            'monto_vencido': _to_float(payload.get('monto_vencido') or payload.get('expired_amount')),
                            'total_saldo': _to_float(payload.get('total_saldo') or payload.get('total_residue')),
                            'capital_saldo': _to_float(payload.get('capital_saldo') or payload.get('capital_amount_residue')),
                            'capital_vencido': _to_float(payload.get('capital_vencido') or payload.get('expired_capital_amount')),
                            'source_hash': row.source_hash,
                            'payload_json': row.payload_json,
                            'loaded_at': now,
                            'updated_at': now,
                        }
                    )
                elif domain == 'analytics':
                    batch.append(
                        {
                            'contract_id': row.contract_id,
                            'gestion_month': row.gestion_month,
                            'supervisor': row.supervisor,
                            'un': row.un,
                            'via': row.via,
                            'tramo': row.tramo,
                            'contracts_total': max(1, _to_int(payload.get('contracts_total') or 1, 1)),
                            'debt_total': _to_float(payload.get('debt_total') or payload.get('debt')),
                            'paid_total': _to_float(payload.get('paid_total') or payload.get('paid')),
                            'source_hash': row.source_hash,
                            'payload_json': row.payload_json,
                            'loaded_at': now,
                            'updated_at': now,
                        }
                    )
                else:
                    batch.append(
                        {
                            'contract_id': row.contract_id,
                            'gestion_month': row.gestion_month,
                            'supervisor': row.supervisor,
                            'un': row.un,
                            'via': row.via,
                            'tramo': row.tramo,
                            'source_hash': row.source_hash,
                            'payload_json': row.payload_json,
                            'loaded_at': now,
                            'updated_at': now,
                        }
                    )

            if domain == 'cartera':
                changed = _upsert(db, model, batch, ['contract_id', 'close_date'])
            else:
                changed = _upsert(db, model, batch, ['contract_id', 'gestion_month', 'supervisor', 'un', 'via', 'tramo'])
            total += changed
            print(f'[backfill] {domain}: source={len(rows)} upserted={changed}')
        print(f'[backfill] total_upserted={total}')
    finally:
        db.close()


if __name__ == '__main__':
    run()
