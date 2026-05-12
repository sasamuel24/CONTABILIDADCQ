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
        Sincroniza factura.centro_costo_id / centro_operacion_id con la primera
        fila de distribución para que submit_responsable los encuentre válidos.
        """
        distribuciones = await self.repository.bulk_replace(
            factura_id,
            bulk_update.distribuciones
        )

        # Sincronizar campos directos de la factura con la primera distribución
        if distribuciones:
            from db.models import Factura
            from sqlalchemy import select
            result = await self.session.execute(
                select(Factura).where(Factura.id == factura_id)
            )
            factura = result.scalar_one_or_none()
            if factura:
                primera = distribuciones[0]
                factura.centro_costo_id = primera.centro_costo_id
                factura.centro_operacion_id = primera.centro_operacion_id

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
