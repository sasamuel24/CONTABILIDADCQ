"""
Repositorio para operaciones de áreas.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from db.models import Area


class AreaRepository:
    """Repositorio para gestionar operaciones de áreas."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(self) -> List[Area]:
        """Obtiene todas las áreas."""
        result = await self.db.execute(select(Area).order_by(Area.nombre))
        return result.scalars().all()
