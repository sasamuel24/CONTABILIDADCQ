"""
Capa de servicio para la lógica de negocio de facturas.
"""
from modules.facturas.repository import FacturaRepository
from modules.facturas.schemas import FacturaCreate, FacturaUpdate, FacturaResponse
from typing import List
from core.logging import logger


class FacturaService:
    """Servicio que contiene la lógica de negocio de facturas."""
    
    def __init__(self, repository: FacturaRepository):
        self.repository = repository
    
    async def list_facturas(self, skip: int = 0, limit: int = 100) -> List[FacturaResponse]:
        """Lista todas las facturas con paginación."""
        logger.info(f"Listando facturas: skip={skip}, limit={limit}")
        facturas = await self.repository.get_all(skip=skip, limit=limit)
        return [FacturaResponse.model_validate(f) for f in facturas]
    
    async def get_factura(self, factura_id: int) -> FacturaResponse:
        """Obtiene una factura por ID."""
        logger.info(f"Obteniendo factura con ID: {factura_id}")
        factura = await self.repository.get_by_id(factura_id)
        if not factura:
            raise ValueError(f"Factura con ID {factura_id} no encontrada")
        return FacturaResponse.model_validate(factura)
    
    async def create_factura(self, factura_data: FacturaCreate) -> FacturaResponse:
        """Crea una nueva factura."""
        logger.info(f"Creando nueva factura: {factura_data.numero_factura}")
        # Validaciones de negocio adicionales aquí
        factura = await self.repository.create(factura_data.model_dump())
        return FacturaResponse.model_validate(factura)
    
    async def update_factura(self, factura_id: int, factura_data: FacturaUpdate) -> FacturaResponse:
        """Actualiza una factura existente."""
        logger.info(f"Actualizando factura ID: {factura_id}")
        factura = await self.repository.update(factura_id, factura_data.model_dump(exclude_unset=True))
        if not factura:
            raise ValueError(f"Factura con ID {factura_id} no encontrada")
        return FacturaResponse.model_validate(factura)
