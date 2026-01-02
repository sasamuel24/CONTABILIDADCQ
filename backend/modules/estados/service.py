"""
Servicio para lógica de negocio de estados.
"""
from modules.estados.repository import EstadoRepository
from modules.estados.schemas import EstadoResponse, EstadoCreate, EstadoUpdate
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
    
    async def update_estado(self, estado_id: int, estado_data: EstadoUpdate) -> EstadoResponse:
        """
        Actualiza un estado existente.
        
        Validaciones:
        - El estado debe existir
        - Si se cambia el código, no debe existir otro estado con ese código
        """
        logger.info(f"Actualizando estado ID: {estado_id}")
        
        # Verificar que el estado existe
        estado_actual = await self.repository.get_by_id(estado_id)
        if not estado_actual:
            logger.warning(f"Estado con ID {estado_id} no encontrado")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Estado con ID {estado_id} no encontrado"
            )
        
        # Si se está cambiando el código, validar que no exista
        if estado_data.code and estado_data.code != estado_actual.code:
            existing_estado = await self.repository.get_by_code(estado_data.code)
            if existing_estado:
                logger.warning(f"Estado con code '{estado_data.code}' ya existe")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Ya existe un estado con el código '{estado_data.code}'"
                )
        
        # Actualizar el estado
        try:
            update_data = estado_data.model_dump(exclude_unset=True)
            estado = await self.repository.update(estado_id, update_data)
            logger.info(f"Estado actualizado exitosamente: {estado.id} - {estado.code}")
            return EstadoResponse.model_validate(estado)
        except Exception as e:
            logger.error(f"Error actualizando estado: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar el estado"
            )
