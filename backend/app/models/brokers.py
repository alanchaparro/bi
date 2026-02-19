from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, Index, Integer, String, Text

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


class SyncRun(Base):
    __tablename__ = 'sync_runs'

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(64), nullable=False, unique=True, index=True)
    domain = Column(String(32), nullable=False, index=True)
    mode = Column(String(32), nullable=False)
    year_from = Column(Integer, nullable=True)
    close_month = Column(String(7), nullable=True)
    target_table = Column(String(64), nullable=True)
    running = Column(Boolean, nullable=False, default=True, index=True)
    stage = Column(String(64), nullable=True)
    progress_pct = Column(Integer, nullable=False, default=0)
    status_message = Column(String(512), nullable=True)
    rows_inserted = Column(Integer, nullable=False, default=0)
    rows_updated = Column(Integer, nullable=False, default=0)
    rows_skipped = Column(Integer, nullable=False, default=0)
    rows_read = Column(Integer, nullable=False, default=0)
    rows_upserted = Column(Integer, nullable=False, default=0)
    rows_unchanged = Column(Integer, nullable=False, default=0)
    duplicates_detected = Column(Integer, nullable=False, default=0)
    error = Column(Text, nullable=True)
    log_json = Column(Text, nullable=False, default='[]')
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    duration_sec = Column(Float, nullable=True)
    actor = Column(String(128), nullable=False, default='system')


class SyncRecord(Base):
    __tablename__ = 'sync_records'

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(32), nullable=False, index=True)
    contract_id = Column(String(64), nullable=False)
    gestion_month = Column(String(7), nullable=False, index=True)
    supervisor = Column(String(128), nullable=False, default='S/D')
    un = Column(String(128), nullable=False, default='S/D')
    via = Column(String(32), nullable=False, default='S/D')
    tramo = Column(Integer, nullable=False, default=0)
    payload_json = Column(Text, nullable=False, default='{}')
    source_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class CarteraFact(Base):
    __tablename__ = 'cartera_fact'

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(String(64), nullable=False)
    close_date = Column(Date, nullable=False, index=True)
    close_month = Column(String(7), nullable=False, index=True)
    close_year = Column(Integer, nullable=False, index=True)
    gestion_month = Column(String(7), nullable=False, index=True)
    supervisor = Column(String(128), nullable=False, default='S/D')
    un = Column(String(128), nullable=False, default='S/D')
    via_cobro = Column(String(32), nullable=False, default='S/D')
    tramo = Column(Integer, nullable=False, default=0)
    category = Column(String(16), nullable=False, default='VIGENTE')
    contracts_total = Column(Integer, nullable=False, default=1)
    monto_vencido = Column(Float, nullable=False, default=0.0)
    total_saldo = Column(Float, nullable=False, default=0.0)
    capital_saldo = Column(Float, nullable=False, default=0.0)
    capital_vencido = Column(Float, nullable=False, default=0.0)
    source_hash = Column(String(64), nullable=False)
    payload_json = Column(Text, nullable=False, default='{}')
    loaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnalyticsFact(Base):
    __tablename__ = 'analytics_fact'

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(String(64), nullable=False)
    gestion_month = Column(String(7), nullable=False, index=True)
    supervisor = Column(String(128), nullable=False, default='S/D')
    un = Column(String(128), nullable=False, default='S/D')
    via = Column(String(32), nullable=False, default='S/D')
    tramo = Column(Integer, nullable=False, default=0)
    contracts_total = Column(Integer, nullable=False, default=1)
    debt_total = Column(Float, nullable=False, default=0.0)
    paid_total = Column(Float, nullable=False, default=0.0)
    source_hash = Column(String(64), nullable=False)
    payload_json = Column(Text, nullable=False, default='{}')
    loaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class CobranzasFact(Base):
    __tablename__ = 'cobranzas_fact'

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(String(64), nullable=False)
    gestion_month = Column(String(7), nullable=False, index=True)
    supervisor = Column(String(128), nullable=False, default='S/D')
    un = Column(String(128), nullable=False, default='S/D')
    via = Column(String(32), nullable=False, default='S/D')
    tramo = Column(Integer, nullable=False, default=0)
    source_hash = Column(String(64), nullable=False)
    payload_json = Column(Text, nullable=False, default='{}')
    loaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ContratosFact(Base):
    __tablename__ = 'contratos_fact'

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(String(64), nullable=False)
    gestion_month = Column(String(7), nullable=False, index=True)
    supervisor = Column(String(128), nullable=False, default='S/D')
    un = Column(String(128), nullable=False, default='S/D')
    via = Column(String(32), nullable=False, default='S/D')
    tramo = Column(Integer, nullable=False, default=0)
    source_hash = Column(String(64), nullable=False)
    payload_json = Column(Text, nullable=False, default='{}')
    loaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class GestoresFact(Base):
    __tablename__ = 'gestores_fact'

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(String(64), nullable=False)
    gestion_month = Column(String(7), nullable=False, index=True)
    supervisor = Column(String(128), nullable=False, default='S/D')
    un = Column(String(128), nullable=False, default='S/D')
    via = Column(String(32), nullable=False, default='S/D')
    tramo = Column(Integer, nullable=False, default=0)
    source_hash = Column(String(64), nullable=False)
    payload_json = Column(Text, nullable=False, default='{}')
    loaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


Index('ix_acs_contract_id', AnalyticsContractSnapshot.contract_id)
Index('ix_acs_sale_month', AnalyticsContractSnapshot.sale_month)
Index('ix_acs_close_month', AnalyticsContractSnapshot.close_month)
Index('ix_acs_supervisor', AnalyticsContractSnapshot.supervisor)
Index('ix_acs_un', AnalyticsContractSnapshot.un)
Index('ix_acs_via', AnalyticsContractSnapshot.via)
Index('ux_user_preferences_username_key', UserPreference.username, UserPreference.pref_key, unique=True)
Index(
    'ux_sync_records_business_key',
    SyncRecord.domain,
    SyncRecord.contract_id,
    SyncRecord.gestion_month,
    SyncRecord.supervisor,
    SyncRecord.un,
    SyncRecord.via,
    SyncRecord.tramo,
    unique=True,
)
Index('ux_cartera_fact_contract_close_date', CarteraFact.contract_id, CarteraFact.close_date, unique=True)
Index('ix_cartera_fact_un_close_month', CarteraFact.un, CarteraFact.close_month)
Index('ix_cartera_fact_supervisor_close_month', CarteraFact.supervisor, CarteraFact.close_month)
Index('ix_cartera_fact_tramo_close_month', CarteraFact.tramo, CarteraFact.close_month)
Index('ix_cartera_fact_un_close_month_tramo', CarteraFact.un, CarteraFact.close_month, CarteraFact.tramo)
Index(
    'ux_analytics_fact_business_key',
    AnalyticsFact.contract_id,
    AnalyticsFact.gestion_month,
    AnalyticsFact.supervisor,
    AnalyticsFact.un,
    AnalyticsFact.via,
    AnalyticsFact.tramo,
    unique=True,
)
Index('ix_analytics_fact_un_gestion_month', AnalyticsFact.un, AnalyticsFact.gestion_month)
Index(
    'ux_cobranzas_fact_business_key',
    CobranzasFact.contract_id,
    CobranzasFact.gestion_month,
    CobranzasFact.supervisor,
    CobranzasFact.un,
    CobranzasFact.via,
    CobranzasFact.tramo,
    unique=True,
)
Index('ix_cobranzas_fact_un_gestion_month', CobranzasFact.un, CobranzasFact.gestion_month)
Index(
    'ux_contratos_fact_business_key',
    ContratosFact.contract_id,
    ContratosFact.gestion_month,
    ContratosFact.supervisor,
    ContratosFact.un,
    ContratosFact.via,
    ContratosFact.tramo,
    unique=True,
)
Index('ix_contratos_fact_un_gestion_month', ContratosFact.un, ContratosFact.gestion_month)
Index(
    'ux_gestores_fact_business_key',
    GestoresFact.contract_id,
    GestoresFact.gestion_month,
    GestoresFact.supervisor,
    GestoresFact.un,
    GestoresFact.via,
    GestoresFact.tramo,
    unique=True,
)
Index('ix_gestores_fact_un_gestion_month', GestoresFact.un, GestoresFact.gestion_month)
