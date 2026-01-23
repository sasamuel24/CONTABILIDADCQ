"""
Repositorio para operaciones de carpetas.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from db.models import Carpeta


class CarpetaRepository:
    """Repositorio para gestionar operaciones de carpetas."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(self) -> List[Carpeta]:
        """Obtiene todas las carpetas."""
        result = await self.db.execute(
            select(Carpeta)
            .options(
                selectinload(Carpeta.parent),
                selectinload(Carpeta.children)
            )
            .order_by(Carpeta.nombre)
        )
        return list(result.scalars().all())
    
    async def get_root_folders(self) -> List[Carpeta]:
        """Obtiene las carpetas raíz (sin parent_id) con toda la jerarquía."""
        result = await self.db.execute(
            select(Carpeta)
            .options(
                selectinload(Carpeta.facturas),
                selectinload(Carpeta.children).selectinload(Carpeta.facturas),
                selectinload(Carpeta.children).selectinload(Carpeta.children).selectinload(Carpeta.facturas),
                selectinload(Carpeta.children).selectinload(Carpeta.children).selectinload(Carpeta.children).selectinload(Carpeta.facturas)
            )
            .where(Carpeta.parent_id.is_(None))
            .order_by(Carpeta.nombre)
        )
        return list(result.scalars().all())
    
    async def get_by_id(self, carpeta_id: UUID) -> Optional[Carpeta]:
        """Obtiene una carpeta por su ID con toda la jerarquía."""
        result = await self.db.execute(
            select(Carpeta)
            .options(
                selectinload(Carpeta.parent),
                selectinload(Carpeta.children).selectinload(Carpeta.children).selectinload(Carpeta.children)
            )
            .where(Carpeta.id == carpeta_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_parent_id(self, parent_id: UUID) -> List[Carpeta]:
        """Obtiene las carpetas hijas de una carpeta padre."""
        result = await self.db.execute(
            select(Carpeta)
            .options(
                selectinload(Carpeta.parent),
                selectinload(Carpeta.children)
            )
            .where(Carpeta.parent_id == parent_id)
            .order_by(Carpeta.nombre)
        )
        return list(result.scalars().all())
    
    async def get_by_factura_id(self, factura_id: UUID) -> List[Carpeta]:
        """Obtiene las carpetas asociadas a una factura."""
        result = await self.db.execute(
            select(Carpeta)
            .where(Carpeta.factura_id == factura_id)
            .order_by(Carpeta.nombre)
        )
        return list(result.scalars().all())
    
    async def create(self, carpeta_data: dict) -> Carpeta:
        """Crea una nueva carpeta."""
        carpeta = Carpeta(**carpeta_data)
        self.db.add(carpeta)
        await self.db.commit()
        await self.db.refresh(carpeta)
        return carpeta
    
    async def update(self, carpeta_id: UUID, carpeta_data: dict) -> Optional[Carpeta]:
        """Actualiza una carpeta existente."""
        carpeta = await self.get_by_id(carpeta_id)
        if carpeta:
            for key, value in carpeta_data.items():
                if value is not None:
                    setattr(carpeta, key, value)
            await self.db.commit()
            await self.db.refresh(carpeta)
        return carpeta
    
    async def delete(self, carpeta_id: UUID) -> bool:
        """Elimina una carpeta por su ID."""
        carpeta = await self.get_by_id(carpeta_id)
        if carpeta:
            await self.db.delete(carpeta)
            await self.db.commit()
            return True
        return False
