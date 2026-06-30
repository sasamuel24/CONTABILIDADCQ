"""
Repositorio para operaciones de base de datos de carpetas de tesorería.
"""
from uuid import UUID
from typing import Optional, List
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, noload
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
                selectinload(CarpetaTesoreria.children)
                    .selectinload(CarpetaTesoreria.facturas).noload("*"),
                selectinload(CarpetaTesoreria.facturas).noload("*")
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_all(self, parent_id: Optional[UUID] = None) -> List[CarpetaTesoreria]:
        """Obtiene todas las carpetas, opcionalmente filtradas por parent_id.

        Las facturas de cada carpeta solo aportan id/numero_factura/proveedor/total
        (ver FacturaEnCarpetaTesoreria). El modelo Factura tiene 16 relaciones
        lazy="selectin", así que sin frenarlas cada factura del árbol arrastraría
        files/asignaciones/comentarios/tokens/etc en cascada. Cargamos las facturas
        en cada nivel del árbol con noload('*') para traer SOLO sus columnas.

        Antes esto se resolvía con `_load_children_recursive`, que hacía un
        `db.refresh(child, [...])` por cada carpeta hija = N+1 de round-trips además
        de la cascada. Al cargar el árbol con selectin explícito por nivel ya no hace
        falta esa recursión.
        """
        stmt = (
            select(CarpetaTesoreria)
            .options(
                selectinload(CarpetaTesoreria.facturas).noload("*"),
                selectinload(CarpetaTesoreria.children)
                    .selectinload(CarpetaTesoreria.facturas).noload("*"),
                selectinload(CarpetaTesoreria.children)
                    .selectinload(CarpetaTesoreria.children)
                    .selectinload(CarpetaTesoreria.facturas).noload("*"),
                selectinload(CarpetaTesoreria.children)
                    .selectinload(CarpetaTesoreria.children)
                    .selectinload(CarpetaTesoreria.children)
                    .selectinload(CarpetaTesoreria.facturas).noload("*"),
            )
        )

        if parent_id is not None:
            stmt = stmt.where(CarpetaTesoreria.parent_id == parent_id)
        else:
            # Solo carpetas raíz si no se especifica parent_id
            stmt = stmt.where(CarpetaTesoreria.parent_id.is_(None))

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

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
        parent_id: Optional[UUID] = None,
        archivo_egreso_url: Optional[str] = None,
        update_archivo: bool = False
    ) -> Optional[CarpetaTesoreria]:
        """Actualiza una carpeta existente.
        
        Args:
            update_archivo: Si es True, actualiza archivo_egreso_url incluso si es None
        """
        carpeta = await self.get_by_id(carpeta_id)
        if not carpeta:
            return None
        
        if nombre is not None:
            carpeta.nombre = nombre
        if parent_id is not None:
            carpeta.parent_id = parent_id
        if update_archivo:
            carpeta.archivo_egreso_url = archivo_egreso_url
        
        await self.db.commit()
        await self.db.refresh(carpeta)
        
        # Retornar sin recargar relaciones completamente
        return carpeta
    
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
                selectinload(CarpetaTesoreria.children)
                    .selectinload(CarpetaTesoreria.facturas).noload("*"),
                selectinload(CarpetaTesoreria.facturas).noload("*")
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
