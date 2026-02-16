#!/usr/bin/env python3
"""
Inserta datos de prueba en analytics_contract_snapshot para desarrollo y pruebas.

Uso:
    python scripts/seed_brokers_analytics.py

Los supervisores FVBROKEREAS, FVBROKEREASCDE deben estar habilitados en
Supervisores Brokers para que los filtros muestren datos.
"""
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'backend'))

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.brokers import AnalyticsContractSnapshot


def _rows(count: int) -> list[dict]:
    """Genera filas de prueba con supervisores, UN, vía y meses variados."""
    supervisors = ['FVBROKEREAS', 'FVBROKEREASCDE']
    uns = ['MEDICINA ESTETICA', 'COBRADOR', 'SALUD']
    vias = ['COBRADOR', 'DEBITO', 'EFECTIVO']
    months = ['01/2026', '02/2026', '12/2025']

    rows = []
    for i in range(count):
        sup = supervisors[i % len(supervisors)]
        un = uns[i % len(uns)]
        via = vias[i % len(vias)]
        month = months[i % len(months)]
        close = months[(i + 1) % len(months)]
        tramo = 3 + (i % 4)  # 3..6 para variar mora 3m
        debt = 100.0 + (i * 10) % 500
        rows.append({
            'contract_id': f'C{i:06d}',
            'sale_month': month,
            'close_month': close,
            'supervisor': sup,
            'un': un,
            'via': via,
            'tramo': tramo,
            'debt': debt,
            'paid': debt * 0.3,
        })
    return rows


def main():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing = db.query(AnalyticsContractSnapshot).count()
        if existing > 0:
            print(f'Ya existen {existing} filas en analytics_contract_snapshot. Saltando seed.')
            return

        data = _rows(24)
        for d in data:
            db.add(AnalyticsContractSnapshot(**d))
        db.commit()
        print(f'Insertadas {len(data)} filas de prueba en analytics_contract_snapshot.')
        print('Supervisores: FVBROKEREAS, FVBROKEREASCDE')
        print('UN: MEDICINA ESTETICA, COBRADOR, SALUD')
        print('Vía: COBRADOR, DEBITO, EFECTIVO')
        print('Meses: 01/2026, 02/2026, 12/2025')
    finally:
        db.close()


if __name__ == '__main__':
    main()
