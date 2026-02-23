from __future__ import annotations

import logging
from datetime import datetime

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.core.config import settings
from app.models.brokers import CommissionRules

logger = logging.getLogger(__name__)


def bootstrap_database_with_demo_probe() -> None:
    """
    Ensure schema exists and run a short insert/delete probe to validate write path.
    The probe leaves no demo data persisted.
    """
    Base.metadata.create_all(bind=engine)

    if not settings.db_demo_probe_on_start:
        logger.info('DB bootstrap completed (schema ensured, demo probe disabled)')
        return

    db = SessionLocal()
    probe_id = -999999
    try:
        probe = CommissionRules(id=probe_id, rules_json='[]', updated_at=datetime.utcnow())
        db.add(probe)
        db.flush()
        db.delete(probe)
        db.commit()
        logger.info('DB bootstrap completed (schema ensured + demo probe insert/delete)')
    except Exception:
        db.rollback()
        logger.exception('DB bootstrap failed')
        raise
    finally:
        db.close()
