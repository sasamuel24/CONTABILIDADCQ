"""
Repositorio para operaciones de áreas.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
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
    
    async def get_by_id(self, area_id: UUID) -> Area:
        """Obtiene un área por su ID."""
        result = await self.db.execute(select(Area).where(Area.id == area_id))
        return result.scalar_one_or_none()
    
    async def delete(self, area_id: UUID) -> bool:
        """Elimina un área por su ID."""
        area = await self.get_by_id(area_id)
        if area:
            await self.db.delete(area)
            await self.db.commit()
            return True
        return False
