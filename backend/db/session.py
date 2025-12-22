"""
Gestión de sesiones de base de datos asíncronas con SQLAlchemy.
"""
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession
)
from typing import AsyncGenerator
from core.config import settings


# Motor de base de datos asíncrono
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True
)

# Fábrica de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency para obtener una sesión de base de datos.
    Uso: db: AsyncSession = Depends(get_db)
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
