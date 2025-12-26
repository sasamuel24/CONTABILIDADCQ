"""
Capa de servicio para la lógica de negocio de facturas.
"""
from modules.facturas.repository import FacturaRepository
from modules.facturas.schemas import (
    FacturaCreate,
    FacturaResponse,
    FacturasPaginatedResponse,
    FacturaListItem,
    EstadoUpdateResponse
)
from typing import List, Optional
from core.logging import logger
from fastapi import HTTPException, status
from uuid import UUID


class FacturaService:
    """Servicio que contiene la lógica de negocio de facturas."""
    
    def __init__(self, repository: FacturaRepository):
        self.repository = repository
    
    async def list_facturas(
        self,
        skip: int = 0,
        limit: int = 100,
        area_id: Optional[UUID] = None
    ) -> FacturasPaginatedResponse:
        """Lista todas las facturas con paginación y filtros."""
        logger.info(f"Listando facturas: skip={skip}, limit={limit}, area_id={area_id}")
        facturas, total = await self.repository.get_all(skip=skip, limit=limit, area_id=area_id)
        
        items = []
        for f in facturas:
            items.append(FacturaListItem(
                id=f.id,
                proveedor=f.proveedor,
                numero_factura=f.numero_factura,
                fecha_emision=f.fecha_emision,
                area=f.area.nombre if f.area else "Sin área",
                total=float(f.total),
                estado=f.estado.label if f.estado else "Sin estado"
            ))
        
        page = (skip // limit) + 1 if limit > 0 else 1
        
        return FacturasPaginatedResponse(
            items=items,
            total=total,
            page=page,
            per_page=limit
        )
    
    async def get_factura(self, factura_id: UUID) -> FacturaResponse:
        """Obtiene una factura por ID."""
        logger.info(f"Obteniendo factura con ID: {factura_id}")
        factura = await self.repository.get_by_id(factura_id)
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        return FacturaResponse(
            id=factura.id,
            proveedor=factura.proveedor,
            numero_factura=factura.numero_factura,
            fecha_emision=factura.fecha_emision,
            area_id=factura.area_id,
            area=factura.area.nombre if factura.area else "Sin área",
            total=float(factura.total),
            estado_id=factura.estado_id,
            estado=factura.estado.label if factura.estado else "Sin estado",
            assigned_to_user_id=factura.assigned_to_user_id,
            assigned_at=factura.assigned_at,
            created_at=factura.created_at,
            updated_at=factura.updated_at
        )
    
    async def get_factura_by_numero(self, numero_factura: str) -> FacturaResponse:
        """Obtiene una factura por número."""
        logger.info(f"Obteniendo factura con número: {numero_factura}")
        factura = await self.repository.get_by_numero(numero_factura)
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con número {numero_factura} no encontrada"
            )
        
        return await self.get_factura(factura.id)
    
    async def create_factura(self, factura_data: FacturaCreate) -> FacturaResponse:
        """Crea una nueva factura."""
        logger.info(f"Creando nueva factura: {factura_data.numero_factura}")
        factura = await self.repository.create(factura_data.model_dump())
        return await self.get_factura(factura.id)
    
    async def update_estado(
        self,
        factura_id: UUID,
        estado_id: int
    ) -> EstadoUpdateResponse:
        """Actualiza el estado de una factura."""
        logger.info(f"Actualizando estado de factura ID: {factura_id}")
        
        factura = await self.repository.update_estado(factura_id, estado_id)
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        return EstadoUpdateResponse(
            id=factura.id,
            estado=factura.estado.label if factura.estado else "Sin estado",
            updated_at=factura.updated_at
        )
