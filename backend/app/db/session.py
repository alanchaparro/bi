from pathlib import Path
from tempfile import gettempdir
import warnings

from sqlalchemy import create_engine, event
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


def _resolve_database_url(raw_url: str) -> str:
    parsed = make_url(raw_url)
    if not parsed.drivername.startswith('sqlite'):
        return raw_url

    db_path = parsed.database
    if not db_path or db_path == ':memory:' or str(db_path).startswith('file:'):
        return raw_url

    target_path = Path(db_path)
    if not target_path.is_absolute():
        target_path = (Path.cwd() / target_path).resolve()

    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        return str(parsed.set(database=str(target_path)))
    except OSError:
        fallback_dir = Path(gettempdir()) / 'bi-clone-nuevo-data'
        fallback_dir.mkdir(parents=True, exist_ok=True)
        fallback_path = fallback_dir / target_path.name
        warnings.warn(
            f'SQLite path not writable ({target_path.parent}); using fallback {fallback_path.parent}',
            RuntimeWarning,
            stacklevel=2,
        )
        return str(parsed.set(database=str(fallback_path)))


database_url = _resolve_database_url(settings.database_url)
is_sqlite = database_url.startswith('sqlite')
connect_args = {'check_same_thread': False, 'timeout': 30} if is_sqlite else {}
engine_kwargs = {
    'pool_pre_ping': True,
    'connect_args': connect_args,
}
if not is_sqlite:
    engine_kwargs.update(
        {
            'pool_size': max(1, int(settings.db_pool_size or 10)),
            'max_overflow': max(0, int(settings.db_max_overflow or 20)),
            'pool_timeout': max(1, int(settings.db_pool_timeout or 30)),
            'pool_recycle': max(30, int(settings.db_pool_recycle or 1800)),
        }
    )

engine = create_engine(database_url, **engine_kwargs)


if is_sqlite:
    @event.listens_for(engine, 'connect')
    def _sqlite_pragmas(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute('PRAGMA journal_mode=WAL;')
        cursor.execute('PRAGMA busy_timeout=30000;')
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
