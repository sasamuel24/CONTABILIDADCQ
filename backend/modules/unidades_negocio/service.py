"""
Lógica de negocio para unidades de negocio.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from fastapi import HTTPException, status

from .repository import UnidadNegocioRepository
from .schemas import (
    UnidadNegocioCreate,
    UnidadNegocioUpdate,
    UnidadNegocioResponse,
    UnidadNegocioList
)


class UnidadNegocioService:
    """Servicio para gestionar unidades de negocio."""
    
    def __init__(self, db: AsyncSession):
        self.repository = UnidadNegocioRepository(db)
    
    async def get_all(self, activas_only: bool = False) -> List[UnidadNegocioList]:
        """Obtiene todas las unidades de negocio."""
        unidades = await self.repository.get_all(activas_only=activas_only)
        return [UnidadNegocioList.model_validate(u) for u in unidades]
    
    async def get_by_id(self, unidad_id: UUID) -> UnidadNegocioResponse:
        """Obtiene una unidad de negocio por su ID."""
        unidad = await self.repository.get_by_id(unidad_id)
        if not unidad:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Unidad de negocio no encontrada"
            )
        return UnidadNegocioResponse.model_validate(unidad)
    
    async def create(self, unidad_data: UnidadNegocioCreate) -> UnidadNegocioResponse:
        """Crea una nueva unidad de negocio."""
        # Verificar que el código no exista
        existing = await self.repository.get_by_codigo(unidad_data.codigo)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe una unidad de negocio con el código '{unidad_data.codigo}'"
            )
        
        unidad = await self.repository.create(unidad_data.model_dump())
        return UnidadNegocioResponse.model_validate(unidad)
    
    async def update(
        self,
        unidad_id: UUID,
        unidad_data: UnidadNegocioUpdate
    ) -> UnidadNegocioResponse:
        """Actualiza una unidad de negocio existente."""
        # Si se actualiza el código, verificar que no exista
        if unidad_data.codigo:
            existing = await self.repository.get_by_codigo(unidad_data.codigo)
            if existing and existing.id != unidad_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe una unidad de negocio con el código '{unidad_data.codigo}'"
                )
        
        unidad = await self.repository.update(
            unidad_id,
            unidad_data.model_dump(exclude_unset=True)
        )
        
        if not unidad:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Unidad de negocio no encontrada"
            )
        
        return UnidadNegocioResponse.model_validate(unidad)
    
    async def delete(self, unidad_id: UUID) -> None:
        """Elimina una unidad de negocio."""
        success = await self.repository.delete(unidad_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Unidad de negocio no encontrada"
            )
