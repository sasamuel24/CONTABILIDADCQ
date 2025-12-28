"""
Router de FastAPI para el módulo de centros de costo.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from db.session import get_db
from modules.centros_costo.repository import CentroCostoRepository
from modules.centros_costo.service import CentroCostoService
from modules.centros_costo.schemas import (
    CentroCostoCreate,
    CentroCostoUpdate,
    CentroCostoResponse
)


router = APIRouter(tags=["Centros de Costo"])


def get_service(db: AsyncSession = Depends(get_db)) -> CentroCostoService:
    """Dependency para obtener el servicio de centros de costo."""
    repository = CentroCostoRepository(db)
    return CentroCostoService(repository)


@router.get("/centros-costo", response_model=List[CentroCostoResponse])
async def list_centros_costo(
    activos_only: bool = True,
    service: CentroCostoService = Depends(get_service)
):
    """
    Lista todos los centros de costo.
    
    Por defecto solo retorna los activos. Use activos_only=false para ver todos.
    """
    return await service.get_all(activos_only=activos_only)


@router.get("/centros-costo/{centro_id}", response_model=CentroCostoResponse)
async def get_centro_costo(
    centro_id: UUID,
    service: CentroCostoService = Depends(get_service)
):
    """Obtiene un centro de costo por ID."""
    return await service.get_by_id(centro_id)


@router.post(
    "/centros-costo",
    response_model=CentroCostoResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_centro_costo(
    data: CentroCostoCreate,
    service: CentroCostoService = Depends(get_service)
):
    """Crea un nuevo centro de costo."""
    return await service.create(data)


@router.patch("/centros-costo/{centro_id}", response_model=CentroCostoResponse)
async def update_centro_costo(
    centro_id: UUID,
    data: CentroCostoUpdate,
    service: CentroCostoService = Depends(get_service)
):
    """Actualiza un centro de costo."""
    return await service.update(centro_id, data)


@router.delete("/centros-costo/{centro_id}", response_model=CentroCostoResponse)
async def deactivate_centro_costo(
    centro_id: UUID,
    service: CentroCostoService = Depends(get_service)
):
    """
    Desactiva un centro de costo (soft delete).
    
    No elimina el registro, solo lo marca como inactivo.
    """
    return await service.deactivate(centro_id)
