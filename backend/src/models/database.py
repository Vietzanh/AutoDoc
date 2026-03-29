"""
Database models (SQLModel/SQLAlchemy) — users, documents, jobs.
"""

from datetime import datetime
from typing import Optional
from enum import Enum

from sqlmodel import SQLModel, Field, Session, select, create_engine
from sqlmodel.pool import StaticPool

from src.core.config import get_settings


# ── Engine & session factory ─────────────────────────────────────────────────

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_engine(
            settings.DATABASE_URL.replace("+aiosqlite", ""),
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
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
