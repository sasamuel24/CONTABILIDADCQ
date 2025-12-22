"""
Configuración base de SQLAlchemy y modelos ORM.
"""
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime
from datetime import datetime


class Base(DeclarativeBase):
    """Clase base para todos los modelos ORM."""
    pass


class TimestampMixin:
    """Mixin para agregar campos de timestamp a los modelos."""
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
