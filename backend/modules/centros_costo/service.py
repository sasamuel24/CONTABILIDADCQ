"""
Servicio para lógica de negocio de centros de costo.
"""
from uuid import UUID
from typing import List
from fastapi import HTTPException, status

from modules.centros_costo.repository import CentroCostoRepository
from modules.centros_costo.schemas import CentroCostoCreate, CentroCostoUpdate, CentroCostoResponse
from core.logging import logger


class CentroCostoService:
    def __init__(self, repository: CentroCostoRepository):
        self.repository = repository

    async def create(self, data: CentroCostoCreate) -> CentroCostoResponse:
        existing = await self.repository.get_by_codigo(data.codigo)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Ya existe un centro de costo con código '{data.codigo}'")
        centro = await self.repository.create(data.model_dump())
        return CentroCostoResponse.model_validate(centro)

    async def get_by_id(self, centro_id: UUID) -> CentroCostoResponse:
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Centro de costo con ID {centro_id} no encontrado")
        return CentroCostoResponse.model_validate(centro)

    async def get_all(self, activos_only: bool = False) -> List[CentroCostoResponse]:
        centros = await self.repository.get_all(activos_only=activos_only)
        return [CentroCostoResponse.model_validate(c) for c in centros]

    async def update(self, centro_id: UUID, data: CentroCostoUpdate) -> CentroCostoResponse:
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Centro de costo con ID {centro_id} no encontrado")
        if data.codigo and data.codigo != centro.codigo:
            existing = await self.repository.get_by_codigo(data.codigo)
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Ya existe otro centro de costo con código '{data.codigo}'")
        updated = await self.repository.update(centro, data.model_dump(exclude_unset=True))
        return CentroCostoResponse.model_validate(updated)

    async def deactivate(self, centro_id: UUID) -> CentroCostoResponse:
        centro = await self.repository.get_by_id(centro_id)
        if not centro:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Centro de costo con ID {centro_id} no encontrado")
        updated = await self.repository.update(centro, {"activo": False})
        return CentroCostoResponse.model_validate(updated)
