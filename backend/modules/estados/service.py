"""
Servicio para lógica de negocio de estados.
"""
from modules.estados.repository import EstadoRepository
from modules.estados.schemas import EstadoResponse
from typing import List
from core.logging import logger


class EstadoService:
    """Servicio que contiene la lógica de negocio de estados."""
    
    def __init__(self, repository: EstadoRepository):
        self.repository = repository
    
    async def list_estados(self) -> List[EstadoResponse]:
        """Lista todos los estados activos."""
        logger.info("Listando estados")
        estados = await self.repository.get_all()
        return [EstadoResponse.model_validate(estado) for estado in estados]
