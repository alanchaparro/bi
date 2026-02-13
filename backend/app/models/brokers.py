from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db.base import Base


class BrokersSupervisorScope(Base):
    __tablename__ = 'brokers_supervisor_scope'

    id = Column(Integer, primary_key=True, index=True)
    supervisors_json = Column(Text, nullable=False, default='[]')
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class CommissionRules(Base):
    __tablename__ = 'commission_rules'

    id = Column(Integer, primary_key=True, index=True)
    rules_json = Column(Text, nullable=False, default='[]')
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class PrizeRules(Base):
    __tablename__ = 'prize_rules'

    id = Column(Integer, primary_key=True, index=True)
    rules_json = Column(Text, nullable=False, default='[]')
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = 'audit_log'

    id = Column(Integer, primary_key=True, index=True)
    entity = Column(String(64), nullable=False)
    action = Column(String(32), nullable=False)
    actor = Column(String(64), nullable=False, default='system')
    payload_json = Column(Text, nullable=False, default='{}')
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
