from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


is_sqlite = settings.database_url.startswith('sqlite')
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

engine = create_engine(settings.database_url, **engine_kwargs)


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
