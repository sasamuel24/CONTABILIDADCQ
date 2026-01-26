from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from uuid import UUID

from modules.distribucion_ccco.repository import DistribucionCCCORepository
from modules.distribucion_ccco.schemas import (
    DistribucionCCCOCreate,
    DistribucionCCCOResponse,
    DistribucionBulkUpdate
)


class DistribucionCCCOService:
    """Servicio para lógica de negocio de distribución CC/CO"""
    
    def __init__(self, session: AsyncSession):
        self.repository = DistribucionCCCORepository(session)
        self.session = session
    
    async def get_by_factura(self, factura_id: UUID) -> list[DistribucionCCCOResponse]:
        """Obtener todas las distribuciones de una factura"""
        distribuciones = await self.repository.get_by_factura(factura_id)
        return [DistribucionCCCOResponse.model_validate(d) for d in distribuciones]
    
    async def update_factura_distribuciones(
        self, 
        factura_id: UUID, 
        bulk_update: DistribucionBulkUpdate
    ) -> list[DistribucionCCCOResponse]:
        """
        Actualizar todas las distribuciones de una factura.
        Valida que los porcentajes sumen 100% (ya validado en el schema).
        """
        # El schema ya valida que sumen 100%, así que aquí solo ejecutamos
        distribuciones = await self.repository.bulk_replace(
            factura_id, 
            bulk_update.distribuciones
        )
        
        await self.session.commit()
        
        return [DistribucionCCCOResponse.model_validate(d) for d in distribuciones]
    
    async def delete_all_by_factura(self, factura_id: UUID) -> dict:
        """Eliminar todas las distribuciones de una factura"""
        count = await self.repository.delete_by_factura(factura_id)
        await self.session.commit()
        
        return {
            "message": f"Se eliminaron {count} distribuciones",
            "deleted_count": count
        }
