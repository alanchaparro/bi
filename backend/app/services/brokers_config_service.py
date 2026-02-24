from app.core.security import ROLE_PERMISSIONS, hash_password
from app.core.config import settings
from app.repositories import brokers_config
import mysql.connector
import time


class BrokersConfigService:
    @staticmethod
    def get_mysql_connection(db):
        return brokers_config.get_mysql_connection(db)

    @staticmethod
    def save_mysql_connection(db, value: dict, actor: str):
        return brokers_config.save_mysql_connection(db, value, actor)

    @staticmethod
    def test_mysql_connection(value: dict | None = None) -> dict:
        payload = value or {}
        cfg = {
            'host': str(payload.get('host') or settings.mysql_host or '').strip(),
            'port': int(payload.get('port') or settings.mysql_port or 3306),
            'user': str(payload.get('user') or settings.mysql_user or '').strip(),
            'password': str(payload.get('password') or settings.mysql_password or ''),
            'database': str(payload.get('database') or settings.mysql_database or '').strip(),
            'ssl_disabled': bool(payload.get('ssl_disabled', getattr(settings, 'mysql_ssl_disabled', True))),
            'connection_timeout': 8,
            'consume_results': True,
        }
        started = time.perf_counter()
        conn = mysql.connector.connect(**cfg)
        try:
            cursor = conn.cursor()
            try:
                cursor.execute('SELECT 1')
                cursor.fetchone()
            finally:
                cursor.close()
        finally:
            conn.close()
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {
            'ok': True,
            'message': 'Conexion MySQL OK',
            'latency_ms': latency_ms,
        }

    @staticmethod
    def get_supervisors_scope(db):
        return brokers_config.get_supervisor_scope(db)

    @staticmethod
    def save_supervisors_scope(db, supervisors: list[str], actor: str):
        normalized = sorted(list({str(s).strip().upper() for s in supervisors if str(s).strip()}))
        return brokers_config.save_supervisor_scope(db, normalized, actor)

    @staticmethod
    def get_commissions(db):
        return brokers_config.get_commission_rules(db)

    @staticmethod
    def save_commissions(db, rules: list[dict], actor: str):
        return brokers_config.save_commission_rules(db, rules, actor)

    @staticmethod
    def get_prizes(db):
        return brokers_config.get_prize_rules(db)

    @staticmethod
    def save_prizes(db, rules: list[dict], actor: str):
        return brokers_config.save_prize_rules(db, rules, actor)

    @staticmethod
    def get_brokers_preferences(db, username: str):
        return brokers_config.get_user_preferences(db, username, 'brokers.filters')

    @staticmethod
    def save_brokers_preferences(db, username: str, value: dict):
        return brokers_config.save_user_preferences(db, username, 'brokers.filters', value)

    @staticmethod
    def get_cartera_preferences(db, username: str):
        return brokers_config.get_user_preferences(db, username, 'cartera_filters_v1')

    @staticmethod
    def save_cartera_preferences(db, username: str, value: dict):
        return brokers_config.save_user_preferences(db, username, 'cartera_filters_v1', value)

    @staticmethod
    def get_cartera_tramo_rules(db):
        return brokers_config.get_cartera_tramo_rules(db)

    @staticmethod
    def save_cartera_tramo_rules(db, value: dict, actor: str):
        return brokers_config.save_cartera_tramo_rules(db, value, actor)

    @staticmethod
    def get_cartera_uns(db):
        return brokers_config.get_cartera_uns(db)

    @staticmethod
    def list_auth_users(db):
        return brokers_config.list_auth_users(db)

    @staticmethod
    def create_auth_user(db, username: str, password: str, role: str, is_active: bool, actor: str):
        uname = str(username or '').strip().lower()
        if not uname:
            raise ValueError('Username requerido')

        normalized_role = str(role or '').strip().lower() or 'viewer'
        if normalized_role not in ROLE_PERMISSIONS:
            raise ValueError('Rol invalido')

        if brokers_config.get_auth_user(db, uname):
            raise RuntimeError('El usuario ya existe')

        pwd_hash = hash_password(password)
        return brokers_config.create_auth_user(db, uname, pwd_hash, normalized_role, bool(is_active), actor)

    @staticmethod
    def update_auth_user(
        db,
        username: str,
        role: str | None,
        is_active: bool | None,
        password: str | None,
        actor: str,
        actor_username: str | None = None,
    ):
        uname = str(username or '').strip().lower()
        row = brokers_config.get_auth_user(db, uname)
        if row is None:
            raise LookupError('Usuario no encontrado')

        normalized_role = None
        if role is not None:
            normalized_role = str(role or '').strip().lower()
            if normalized_role not in ROLE_PERMISSIONS:
                raise ValueError('Rol invalido')

        actor_u = str(actor_username or '').strip().lower()
        if actor_u and actor_u == uname and is_active is False:
            raise ValueError('No puedes desactivar tu propio usuario')

        pwd_hash = hash_password(password) if (password is not None and str(password).strip()) else None
        return brokers_config.update_auth_user(db, row, normalized_role, is_active, pwd_hash, actor)
