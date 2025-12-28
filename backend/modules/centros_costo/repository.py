"""
Repositorio para operaciones de centros de costo.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from db.models import CentroCosto


class CentroCostoRepository:
    """Repositorio para gestionar operaciones de centros de costo."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, data: dict) -> CentroCosto:
        """Crea un nuevo centro de costo."""
        centro = CentroCosto(**data)
        self.db.add(centro)
        await self.db.flush()
        await self.db.refresh(centro)
        return centro
    
    async def get_by_id(self, centro_id: UUID) -> Optional[CentroCosto]:
        """Obtiene un centro de costo por ID."""
        result = await self.db.execute(
            select(CentroCosto).where(CentroCosto.id == centro_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_nombre(self, nombre: str) -> Optional[CentroCosto]:
        """Obtiene un centro de costo por nombre."""
        result = await self.db.execute(
            select(CentroCosto).where(CentroCosto.nombre == nombre)
        )
        return result.scalar_one_or_none()
    
    async def get_all(self, activos_only: bool = False) -> List[CentroCosto]:
        """Obtiene todos los centros de costo."""
        query = select(CentroCosto)
        
        if activos_only:
            query = query.where(CentroCosto.activo == True)
        
        query = query.order_by(CentroCosto.nombre)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def update(self, centro: CentroCosto, data: dict) -> CentroCosto:
        """Actualiza un centro de costo."""
        for key, value in data.items():
            if value is not None:
                setattr(centro, key, value)
        await self.db.flush()
        await self.db.refresh(centro)
        return centro
