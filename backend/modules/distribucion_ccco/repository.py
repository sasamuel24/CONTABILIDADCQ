from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import Optional
from uuid import UUID

from db.models import FacturaDistribucionCCCO
from modules.distribucion_ccco.schemas import DistribucionCCCOCreate


class DistribucionCCCORepository:
    """Repositorio para operaciones CRUD de distribución CC/CO"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_factura(self, factura_id: UUID) -> list[FacturaDistribucionCCCO]:
        """Obtener todas las distribuciones de una factura"""
        stmt = (
            select(FacturaDistribucionCCCO)
            .where(FacturaDistribucionCCCO.factura_id == factura_id)
            .order_by(FacturaDistribucionCCCO.created_at)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
    
    async def get_by_id(self, distribucion_id: UUID) -> Optional[FacturaDistribucionCCCO]:
        """Obtener una distribución por ID"""
        stmt = select(FacturaDistribucionCCCO).where(FacturaDistribucionCCCO.id == distribucion_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def create(
        self, 
        factura_id: UUID, 
        distribucion: DistribucionCCCOCreate
    ) -> FacturaDistribucionCCCO:
        """Crear una nueva distribución"""
        db_distribucion = FacturaDistribucionCCCO(
            factura_id=factura_id,
            **distribucion.model_dump()
        )
        self.session.add(db_distribucion)
        await self.session.flush()
        await self.session.refresh(db_distribucion)
        return db_distribucion
    
    async def delete_by_factura(self, factura_id: UUID) -> int:
        """Eliminar todas las distribuciones de una factura. Retorna cantidad eliminada."""
        stmt = delete(FacturaDistribucionCCCO).where(
            FacturaDistribucionCCCO.factura_id == factura_id
        )
        result = await self.session.execute(stmt)
        return result.rowcount
    
    async def bulk_replace(
        self, 
        factura_id: UUID, 
        distribuciones: list[DistribucionCCCOCreate]
    ) -> list[FacturaDistribucionCCCO]:
        """
        Reemplazar todas las distribuciones de una factura.
        Elimina las existentes y crea las nuevas.
        """
        # Eliminar todas las distribuciones existentes
        await self.delete_by_factura(factura_id)
        
        # Crear las nuevas distribuciones
        nuevas_distribuciones = []
        for dist in distribuciones:
            db_dist = await self.create(factura_id, dist)
            nuevas_distribuciones.append(db_dist)
        
        return nuevas_distribuciones
