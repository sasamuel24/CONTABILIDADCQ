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
    
    async def create_area(self, area_data: AreaCreate) -> AreaResponse:
        """Crea una nueva área."""
        logger.info(f"Creando área: {area_data.nombre}")
        
        try:
            area = await self.repository.create(area_data.model_dump())
            logger.info(f"Área creada exitosamente: {area.id}")
            return AreaResponse.model_validate(area)
        except Exception as e:
            logger.error(f"Error al crear área: {str(e)}")
            if "duplicate key value" in str(e).lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"El área '{area_data.nombre}' ya existe"
                )
            raise HTTPException(
                status_code=500,
                detail=f"Error al crear área: {str(e)}"
            )
