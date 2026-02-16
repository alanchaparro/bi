from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Index, Integer, String, Text

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


class AuthSession(Base):
    __tablename__ = 'auth_sessions'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(128), nullable=False, index=True)
    refresh_token_hash = Column(String(255), nullable=False, unique=True)
    revoked = Column(Boolean, nullable=False, default=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    rotated_at = Column(DateTime, nullable=True)


class AuthUser(Base):
    __tablename__ = 'auth_users'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(128), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default='viewer')
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuthUserState(Base):
    __tablename__ = 'auth_user_state'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(128), nullable=False, unique=True, index=True)
    failed_attempts = Column(Integer, nullable=False, default=0)
    blocked_until = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class UserPreference(Base):
    __tablename__ = 'user_preferences'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(128), nullable=False, index=True)
    pref_key = Column(String(64), nullable=False, index=True)
    value_json = Column(Text, nullable=False, default='{}')
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnalyticsContractSnapshot(Base):
    __tablename__ = 'analytics_contract_snapshot'

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(String(32), nullable=False)
    sale_month = Column(String(7), nullable=False)
    close_month = Column(String(7), nullable=False)
    supervisor = Column(String(128), nullable=False)
    un = Column(String(128), nullable=False)
    via = Column(String(32), nullable=False)
    tramo = Column(Integer, nullable=False, default=0)
    debt = Column(Float, nullable=False, default=0.0)
    paid = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


Index('ix_acs_contract_id', AnalyticsContractSnapshot.contract_id)
Index('ix_acs_sale_month', AnalyticsContractSnapshot.sale_month)
Index('ix_acs_close_month', AnalyticsContractSnapshot.close_month)
Index('ix_acs_supervisor', AnalyticsContractSnapshot.supervisor)
Index('ix_acs_un', AnalyticsContractSnapshot.un)
Index('ix_acs_via', AnalyticsContractSnapshot.via)
Index('ux_user_preferences_username_key', UserPreference.username, UserPreference.pref_key, unique=True)
