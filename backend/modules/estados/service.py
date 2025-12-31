"""
Servicio para lógica de negocio de estados.
"""
from modules.estados.repository import EstadoRepository
from modules.estados.schemas import EstadoResponse, EstadoCreate
from typing import List
from core.logging import logger
from fastapi import HTTPException, status


class EstadoService:
    """Servicio que contiene la lógica de negocio de estados."""
    
    def __init__(self, repository: EstadoRepository):
        self.repository = repository
    
    async def list_estados(self) -> List[EstadoResponse]:
        """Lista todos los estados activos."""
        logger.info("Listando estados")
        estados = await self.repository.get_all()
        return [EstadoResponse.model_validate(estado) for estado in estados]
    
    async def create_estado(self, estado_data: EstadoCreate) -> EstadoResponse:
        """
        Crea un nuevo estado.
        
        Validaciones:
        - El código debe ser único (no puede existir otro estado con el mismo code)
        """
        logger.info(f"Creando estado con code: {estado_data.code}")
        
        # Validar que el código no exista
        existing_estado = await self.repository.get_by_code(estado_data.code)
        if existing_estado:
            logger.warning(f"Estado con code '{estado_data.code}' ya existe")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un estado con el código '{estado_data.code}'"
            )
        
        # Crear el estado
        try:
            estado = await self.repository.create(estado_data.model_dump())
            logger.info(f"Estado creado exitosamente: {estado.id} - {estado.code}")
            return EstadoResponse.model_validate(estado)
        except Exception as e:
            logger.error(f"Error creando estado: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el estado"
            )
