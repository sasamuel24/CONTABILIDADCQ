"""
Servicio para lógica de negocio de centros de operación.
"""
from uuid import UUID
from typing import List, Optional
from fastapi import HTTPException, status

from modules.centros_operacion.repository import CentroOperacionRepository
from modules.centros_operacion.schemas import (
    CentroOperacionCreate,
    CentroOperacionUpdate,
    CentroOperacionResponse
)
from modules.centros_costo.repository import CentroCostoRepository
from core.logging import logger


class CentroOperacionService:
    """Servicio que contiene la lógica de negocio de centros de operación."""
    
    def __init__(
        self, 
        repository: CentroOperacionRepository,
        centro_costo_repo: CentroCostoRepository
    ):
        self.repository = repository
        self.centro_costo_repo = centro_costo_repo
    
    async def create(self, data: CentroOperacionCreate) -> CentroOperacionResponse:
        """Crea un nuevo centro de operación."""
        logger.info(f"Creando centro de operación: {data.nombre}")
        
        # Validar que el centro de costo existe
        centro_costo = await self.centro_costo_repo.get_by_id(data.centro_costo_id)
        if not centro_costo:
            logger.warning(f"Centro de costo {data.centro_costo_id} no encontrado")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Centro de costo con ID {data.centro_costo_id} no encontrado"
            )
        
        # Validar que no exista otro con el mismo nombre en el mismo CC
        existing = await self.repository.get_by_nombre_and_cc(
            data.nombre, 
            data.centro_costo_id
        )
        if existing:
            logger.warning(
                f"Centro de operación '{data.nombre}' ya existe en CC {data.centro_costo_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un centro de operación con el nombre '{data.nombre}' "
                       f"en el centro de costo '{centro_costo.nombre}'"
            )
        
        centro = await self.repository.create(data.model_dump())
        logger.info(f"Centro de operación creado exitosamente: {centro.id}")
        
        response = CentroOperacionResponse.model_validate(centro)
        response.centro_costo_nombre = centro.centro_costo.nombre
        return response
    
    async def get_by_id(self, centro_id: UUID) -> CentroOperacionResponse:
        """Obtiene un centro de operación por ID."""
        logger.info(f"Obteniendo centro de operación: {centro_id}")
        
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            logger.warning(f"Centro de operación {centro_id} no encontrado")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Centro de operación con ID {centro_id} no encontrado"
            )
        
        response = CentroOperacionResponse.model_validate(centro)
        response.centro_costo_nombre = centro.centro_costo.nombre
        return response
    
    async def get_all(
        self, 
        centro_costo_id: Optional[UUID] = None,
        activos_only: bool = False
    ) -> List[CentroOperacionResponse]:
        """Obtiene todos los centros de operación."""
        logger.info(
            f"Obteniendo centros de operación "
            f"(centro_costo_id={centro_costo_id}, activos_only={activos_only})"
        )
        
        centros = await self.repository.get_all(
            centro_costo_id=centro_costo_id,
            activos_only=activos_only
        )
        
        return [
            CentroOperacionResponse(
                **centro.__dict__,
                centro_costo_nombre=centro.centro_costo.nombre
            )
            for centro in centros
        ]
    
    async def update(
        self, 
        centro_id: UUID, 
        data: CentroOperacionUpdate
    ) -> CentroOperacionResponse:
        """Actualiza un centro de operación."""
        logger.info(f"Actualizando centro de operación: {centro_id}")
        
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            logger.warning(f"Centro de operación {centro_id} no encontrado")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Centro de operación con ID {centro_id} no encontrado"
            )
        
        # Validar centro de costo si se está actualizando
        if data.centro_costo_id:
            centro_costo = await self.centro_costo_repo.get_by_id(data.centro_costo_id)
            if not centro_costo:
                logger.warning(f"Centro de costo {data.centro_costo_id} no encontrado")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Centro de costo con ID {data.centro_costo_id} no encontrado"
                )
        
        # Validar nombre único si se está actualizando nombre o centro de costo
        if data.nombre or data.centro_costo_id:
            nombre = data.nombre or centro.nombre
            cc_id = data.centro_costo_id or centro.centro_costo_id
            
            existing = await self.repository.get_by_nombre_and_cc(nombre, cc_id)
            if existing and existing.id != centro_id:
                logger.warning(f"Centro de operación '{nombre}' ya existe en CC {cc_id}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe otro centro de operación con el nombre '{nombre}' "
                           f"en ese centro de costo"
                )
        
        updated = await self.repository.update(centro, data.model_dump(exclude_unset=True))
        logger.info(f"Centro de operación actualizado exitosamente: {centro_id}")
        
        response = CentroOperacionResponse.model_validate(updated)
        response.centro_costo_nombre = updated.centro_costo.nombre
        return response
    
    async def deactivate(self, centro_id: UUID) -> CentroOperacionResponse:
        """Desactiva un centro de operación (soft delete)."""
        logger.info(f"Desactivando centro de operación: {centro_id}")
        
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            logger.warning(f"Centro de operación {centro_id} no encontrado")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Centro de operación con ID {centro_id} no encontrado"
            )
        
        updated = await self.repository.update(centro, {"activo": False})
        logger.info(f"Centro de operación desactivado exitosamente: {centro_id}")
        
        response = CentroOperacionResponse.model_validate(updated)
        response.centro_costo_nombre = updated.centro_costo.nombre
        return response
