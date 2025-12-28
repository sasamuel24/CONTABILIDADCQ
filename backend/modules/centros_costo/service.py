"""
Servicio para lógica de negocio de centros de costo.
"""
from uuid import UUID
from typing import List
from fastapi import HTTPException, status

from modules.centros_costo.repository import CentroCostoRepository
from modules.centros_costo.schemas import (
    CentroCostoCreate,
    CentroCostoUpdate,
    CentroCostoResponse
)
from core.logging import logger


class CentroCostoService:
    """Servicio que contiene la lógica de negocio de centros de costo."""
    
    def __init__(self, repository: CentroCostoRepository):
        self.repository = repository
    
    async def create(self, data: CentroCostoCreate) -> CentroCostoResponse:
        """Crea un nuevo centro de costo."""
        logger.info(f"Creando centro de costo: {data.nombre}")
        
        # Validar que no exista otro con el mismo nombre
        existing = await self.repository.get_by_nombre(data.nombre)
        if existing:
            logger.warning(f"Centro de costo con nombre '{data.nombre}' ya existe")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un centro de costo con el nombre '{data.nombre}'"
            )
        
        centro = await self.repository.create(data.model_dump())
        logger.info(f"Centro de costo creado exitosamente: {centro.id}")
        
        return CentroCostoResponse.model_validate(centro)
    
    async def get_by_id(self, centro_id: UUID) -> CentroCostoResponse:
        """Obtiene un centro de costo por ID."""
        logger.info(f"Obteniendo centro de costo: {centro_id}")
        
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            logger.warning(f"Centro de costo {centro_id} no encontrado")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Centro de costo con ID {centro_id} no encontrado"
            )
        
        return CentroCostoResponse.model_validate(centro)
    
    async def get_all(self, activos_only: bool = False) -> List[CentroCostoResponse]:
        """Obtiene todos los centros de costo."""
        logger.info(f"Obteniendo centros de costo (activos_only={activos_only})")
        
        centros = await self.repository.get_all(activos_only=activos_only)
        return [CentroCostoResponse.model_validate(c) for c in centros]
    
    async def update(self, centro_id: UUID, data: CentroCostoUpdate) -> CentroCostoResponse:
        """Actualiza un centro de costo."""
        logger.info(f"Actualizando centro de costo: {centro_id}")
        
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            logger.warning(f"Centro de costo {centro_id} no encontrado")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Centro de costo con ID {centro_id} no encontrado"
            )
        
        # Validar nombre único si se está actualizando
        if data.nombre:
            existing = await self.repository.get_by_nombre(data.nombre)
            if existing and existing.id != centro_id:
                logger.warning(f"Centro de costo con nombre '{data.nombre}' ya existe")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe otro centro de costo con el nombre '{data.nombre}'"
                )
        
        updated = await self.repository.update(centro, data.model_dump(exclude_unset=True))
        logger.info(f"Centro de costo actualizado exitosamente: {centro_id}")
        
        return CentroCostoResponse.model_validate(updated)
    
    async def deactivate(self, centro_id: UUID) -> CentroCostoResponse:
        """Desactiva un centro de costo (soft delete)."""
        logger.info(f"Desactivando centro de costo: {centro_id}")
        
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            logger.warning(f"Centro de costo {centro_id} no encontrado")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Centro de costo con ID {centro_id} no encontrado"
            )
        
        updated = await self.repository.update(centro, {"activo": False})
        logger.info(f"Centro de costo desactivado exitosamente: {centro_id}")
        
        return CentroCostoResponse.model_validate(updated)
