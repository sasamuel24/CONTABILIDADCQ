"""
Repositorio para operaciones de estados.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from db.models import Estado


class EstadoRepository:
    """Repositorio para gestionar operaciones de estados."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(self) -> List[Estado]:
        """Obtiene todos los estados activos ordenados."""
        result = await self.db.execute(
            select(Estado).where(Estado.is_active == True).order_by(Estado.order)
        )
        return result.scalars().all()
