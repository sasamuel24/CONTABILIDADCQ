"""
Repositorio para operaciones de carpetas.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload, noload
from typing import List, Optional
from uuid import UUID
from db.models import Carpeta, Factura, Estado


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
    
    async def get_tree_data(self) -> tuple[List[Carpeta], list]:
        """Devuelve los datos crudos para armar el árbol de carpetas en el service.

        En lugar de recorrer relaciones ORM (que disparan cascada: el modelo tiene
        Carpeta.parent/children/factura/facturas en lazy="selectin", y cada Factura
        arrastra sus 16 relaciones selectin), hace solo DOS queries planas:
          1. Todas las carpetas, SIN relaciones (noload '*'), solo columnas.
          2. Todas las facturas que están en alguna carpeta, solo las columnas que
             el response (FacturaEnCarpeta) usa + el label del estado vía join.
        El árbol se reconstruye en memoria por parent_id / carpeta_id. Esto elimina
        por completo la cascada y la dependencia de la profundidad del árbol.
        """
        carpetas_result = await self.db.execute(
            select(Carpeta)
            .options(noload("*"))
            .order_by(Carpeta.nombre)
        )
        carpetas = list(carpetas_result.scalars().all())

        facturas_result = await self.db.execute(
            select(
                Factura.id,
                Factura.numero_factura,
                Factura.proveedor,
                Factura.total,
                Factura.carpeta_id,
                Estado.label.label("estado"),
            )
            .outerjoin(Estado, Factura.estado_id == Estado.id)
            .where(Factura.carpeta_id.isnot(None))
        )
        facturas = facturas_result.all()

        return carpetas, facturas
    
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
