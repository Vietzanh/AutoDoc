"""
Database models (SQLModel/SQLAlchemy) — users, documents, jobs.
"""

from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import NullPool

from src.core.config import get_settings


# ── Engine & session factory ─────────────────────────────────────────────────

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        # NullPool opens a fresh connection per thread instead of sharing one.
        # This prevents "cannot commit - no transaction is active" errors when
        # multiple background threads try to use the DB simultaneously.
        _engine = create_engine(
            settings.DATABASE_URL.replace("+aiosqlite", ""),
            connect_args={"check_same_thread": False},
            poolclass=NullPool,
        )
    return _engine


def get_session():
    """FastAPI dependency — yields a new session per request."""
    session = Session(get_engine())
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    """Create all tables. Call once at startup."""
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
