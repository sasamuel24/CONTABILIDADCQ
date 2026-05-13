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
    CentroOperacionResponse,
)
from core.logging import logger


class CentroOperacionService:
    """Servicio que contiene la lógica de negocio de centros de operación."""

    def __init__(self, repository: CentroOperacionRepository):
        self.repository = repository

    async def create(self, data: CentroOperacionCreate) -> CentroOperacionResponse:
        """Crea un nuevo centro de operación."""
        existing = await self.repository.get_by_codigo(data.codigo)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un centro de operación con código '{data.codigo}'"
            )
        centro = await self.repository.create(data.model_dump())
        return CentroOperacionResponse.model_validate(centro)

    async def get_by_id(self, centro_id: UUID) -> CentroOperacionResponse:
        """Obtiene un centro de operación por ID."""
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Centro de operación con ID {centro_id} no encontrado"
            )
        return CentroOperacionResponse.model_validate(centro)

    async def get_all(self, activos_only: bool = False) -> List[CentroOperacionResponse]:
        """Obtiene todos los centros de operación."""
        centros = await self.repository.get_all(activos_only=activos_only)
        return [CentroOperacionResponse.model_validate(c) for c in centros]

    async def update(self, centro_id: UUID, data: CentroOperacionUpdate) -> CentroOperacionResponse:
        """Actualiza un centro de operación."""
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Centro de operación con ID {centro_id} no encontrado"
            )
        if data.codigo and data.codigo != centro.codigo:
            existing = await self.repository.get_by_codigo(data.codigo)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe otro centro de operación con código '{data.codigo}'"
                )
        updated = await self.repository.update(centro, data.model_dump(exclude_unset=True))
        return CentroOperacionResponse.model_validate(updated)

    async def deactivate(self, centro_id: UUID) -> CentroOperacionResponse:
        """Desactiva un centro de operación (soft delete)."""
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Centro de operación con ID {centro_id} no encontrado"
            )
        updated = await self.repository.update(centro, {"activo": False})
        return CentroOperacionResponse.model_validate(updated)
