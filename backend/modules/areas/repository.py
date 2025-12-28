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
    
    async def create(self, area_data: dict) -> Area:
        """Crea una nueva área."""
        area = Area(**area_data)
        self.db.add(area)
        await self.db.commit()
        await self.db.refresh(area)
        return area
