"""
Servicio para lógica de negocio de áreas.
"""
from modules.areas.repository import AreaRepository
from modules.areas.schemas import AreaResponse
from typing import List
from core.logging import logger


class AreaService:
    """Servicio que contiene la lógica de negocio de áreas."""
    
    def __init__(self, repository: AreaRepository):
        self.repository = repository
    
    async def list_areas(self) -> List[AreaResponse]:
        """Lista todas las áreas."""
        logger.info("Listando áreas")
        areas = await self.repository.get_all()
        return [AreaResponse.model_validate(area) for area in areas]
