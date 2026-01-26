"""
Repositorio para operaciones de unidades de negocio.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from db.models import UnidadNegocio


class UnidadNegocioRepository:
    """Repositorio para gestionar operaciones de unidades de negocio."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(self, activas_only: bool = False) -> List[UnidadNegocio]:
        """Obtiene todas las unidades de negocio."""
        query = select(UnidadNegocio).order_by(UnidadNegocio.codigo)
        
        if activas_only:
            query = query.where(UnidadNegocio.activa == True)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_by_id(self, unidad_id: UUID) -> Optional[UnidadNegocio]:
        """Obtiene una unidad de negocio por su ID."""
        result = await self.db.execute(
            select(UnidadNegocio).where(UnidadNegocio.id == unidad_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_codigo(self, codigo: str) -> Optional[UnidadNegocio]:
        """Obtiene una unidad de negocio por su código."""
        result = await self.db.execute(
            select(UnidadNegocio).where(UnidadNegocio.codigo == codigo)
        )
        return result.scalar_one_or_none()
    
    async def create(self, unidad_data: dict) -> UnidadNegocio:
        """Crea una nueva unidad de negocio."""
        unidad = UnidadNegocio(**unidad_data)
        self.db.add(unidad)
        await self.db.flush()
        await self.db.refresh(unidad)
        return unidad
    
    async def update(self, unidad_id: UUID, unidad_data: dict) -> Optional[UnidadNegocio]:
        """Actualiza una unidad de negocio existente."""
        unidad = await self.get_by_id(unidad_id)
        if not unidad:
            return None
        
        for key, value in unidad_data.items():
            if value is not None:
                setattr(unidad, key, value)
        
        await self.db.flush()
        await self.db.refresh(unidad)
        return unidad
    
    async def delete(self, unidad_id: UUID) -> bool:
        """Elimina una unidad de negocio."""
        unidad = await self.get_by_id(unidad_id)
        if not unidad:
            return False
        
        await self.db.delete(unidad)
        await self.db.flush()
        return True
