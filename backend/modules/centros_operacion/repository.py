"""
Repositorio para operaciones de centros de operación.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from db.models import CentroOperacion, CentroCosto


class CentroOperacionRepository:
    """Repositorio para gestionar operaciones de centros de operación."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, data: dict) -> CentroOperacion:
        """Crea un nuevo centro de operación."""
        centro = CentroOperacion(**data)
        self.db.add(centro)
        await self.db.flush()
        await self.db.refresh(centro, ["centro_costo"])
        return centro
    
    async def get_by_id(self, centro_id: UUID) -> Optional[CentroOperacion]:
        """Obtiene un centro de operación por ID."""
        result = await self.db.execute(
            select(CentroOperacion)
            .options(selectinload(CentroOperacion.centro_costo))
            .where(CentroOperacion.id == centro_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_nombre_and_cc(
        self, 
        nombre: str, 
        centro_costo_id: UUID
    ) -> Optional[CentroOperacion]:
        """Obtiene un centro de operación por nombre y centro de costo."""
        result = await self.db.execute(
            select(CentroOperacion).where(
                CentroOperacion.nombre == nombre,
                CentroOperacion.centro_costo_id == centro_costo_id
            )
        )
        return result.scalar_one_or_none()
    
    async def get_all(
        self, 
        centro_costo_id: Optional[UUID] = None,
        activos_only: bool = False
    ) -> List[CentroOperacion]:
        """Obtiene todos los centros de operación, opcionalmente filtrados por centro de costo."""
        query = select(CentroOperacion).options(selectinload(CentroOperacion.centro_costo))
        
        if centro_costo_id:
            query = query.where(CentroOperacion.centro_costo_id == centro_costo_id)
        
        if activos_only:
            query = query.where(CentroOperacion.activo == True)
        
        query = query.order_by(CentroOperacion.nombre)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def update(self, centro: CentroOperacion, data: dict) -> CentroOperacion:
        """Actualiza un centro de operación."""
        for key, value in data.items():
            if value is not None:
                setattr(centro, key, value)
        await self.db.flush()
        await self.db.refresh(centro, ["centro_costo"])
        return centro
