"""
Repositorio para operaciones de base de datos de carpetas de tesorería.
"""
from uuid import UUID
from typing import Optional, List
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from db.models import CarpetaTesoreria, Factura


class CarpetaTesoreriaRepository:
    """Repositorio para gestionar carpetas de tesorería."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, carpeta_id: UUID) -> Optional[CarpetaTesoreria]:
        """Obtiene una carpeta por ID con sus relaciones cargadas."""
        stmt = (
            select(CarpetaTesoreria)
            .where(CarpetaTesoreria.id == carpeta_id)
            .options(
                selectinload(CarpetaTesoreria.parent),
                selectinload(CarpetaTesoreria.children),
                selectinload(CarpetaTesoreria.facturas)
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_all(self, parent_id: Optional[UUID] = None) -> List[CarpetaTesoreria]:
        """Obtiene todas las carpetas, opcionalmente filtradas por parent_id."""
        stmt = (
            select(CarpetaTesoreria)
            .options(
                selectinload(CarpetaTesoreria.children)
                    .selectinload(CarpetaTesoreria.children)
                    .selectinload(CarpetaTesoreria.children),
                selectinload(CarpetaTesoreria.facturas)
            )
        )
        
        if parent_id is not None:
            stmt = stmt.where(CarpetaTesoreria.parent_id == parent_id)
        else:
            # Solo carpetas raíz si no se especifica parent_id
            stmt = stmt.where(CarpetaTesoreria.parent_id.is_(None))
        
        result = await self.db.execute(stmt)
        carpetas = list(result.scalars().all())
        
        # Asegurarnos de que todos los children están cargados
        for carpeta in carpetas:
            await self._load_children_recursive(carpeta)
        
        return carpetas
    
    async def _load_children_recursive(self, carpeta: CarpetaTesoreria):
        """Carga recursivamente todos los children de una carpeta."""
        if carpeta.children:
            for child in carpeta.children:
                # Cargar los facturas del child
                await self.db.refresh(child, ['facturas', 'children'])
                if child.children:
                    await self._load_children_recursive(child)
    
    async def create(
        self,
        nombre: str,
        parent_id: Optional[UUID] = None,
        created_by: Optional[UUID] = None
    ) -> CarpetaTesoreria:
        """Crea una nueva carpeta de tesorería."""
        carpeta = CarpetaTesoreria(
            nombre=nombre,
            parent_id=parent_id,
            created_by=created_by
        )
        self.db.add(carpeta)
        await self.db.commit()
        await self.db.refresh(carpeta)
        return await self.get_by_id(carpeta.id)
    
    async def update(
        self,
        carpeta_id: UUID,
        nombre: Optional[str] = None,
        parent_id: Optional[UUID] = None
    ) -> Optional[CarpetaTesoreria]:
        """Actualiza una carpeta existente."""
        carpeta = await self.get_by_id(carpeta_id)
        if not carpeta:
            return None
        
        if nombre is not None:
            carpeta.nombre = nombre
        if parent_id is not None:
            carpeta.parent_id = parent_id
        
        await self.db.commit()
        await self.db.refresh(carpeta)
        return await self.get_by_id(carpeta.id)
    
    async def delete(self, carpeta_id: UUID) -> bool:
        """Elimina una carpeta y sus hijos en cascada."""
        carpeta = await self.get_by_id(carpeta_id)
        if not carpeta:
            return False
        
        await self.db.delete(carpeta)
        await self.db.commit()
        return True
    
    async def get_facturas_by_carpeta(self, carpeta_id: UUID) -> List[Factura]:
        """Obtiene todas las facturas asignadas a una carpeta."""
        stmt = (
            select(Factura)
            .where(Factura.carpeta_tesoreria_id == carpeta_id)
            .options(
                selectinload(Factura.area),
                selectinload(Factura.estado)
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
    
    async def asignar_factura_a_carpeta(
        self,
        factura_id: UUID,
        carpeta_id: Optional[UUID]
    ) -> Optional[Factura]:
        """Asigna o desasigna una factura a una carpeta de tesorería."""
        stmt = select(Factura).where(Factura.id == factura_id)
        result = await self.db.execute(stmt)
        factura = result.scalar_one_or_none()
        
        if not factura:
            return None
        
        factura.carpeta_tesoreria_id = carpeta_id
        await self.db.commit()
        await self.db.refresh(factura)
        return factura
    
    async def search(self, query: str) -> List[CarpetaTesoreria]:
        """Busca carpetas por nombre."""
        stmt = (
            select(CarpetaTesoreria)
            .where(CarpetaTesoreria.nombre.ilike(f"%{query}%"))
            .options(
                selectinload(CarpetaTesoreria.children),
                selectinload(CarpetaTesoreria.facturas)
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
