"""
Database session management.

Async engine (asyncpg driver) because FastAPI routes and the WebSocket
manager are async end-to-end — a sync session here would block the event
loop on every query, defeating the purpose of using FastAPI/async in the
first place.

`expire_on_commit=False`: without this, accessing an ORM object's
attributes after a commit (e.g. returning it in a Pydantic response model)
triggers a lazy-load that fails outside the original session context —
a common and confusing async SQLAlchemy pitfall.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.async_database_url,
    echo=settings.DEBUG,
    pool_pre_ping=True,   # detects stale connections (e.g. after DB restart) before using them
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a session, guarantees it's closed after the request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
