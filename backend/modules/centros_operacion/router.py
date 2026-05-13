"""
Router de FastAPI para el módulo de centros de operación.
"""
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from db.session import get_db
from modules.centros_operacion.repository import CentroOperacionRepository
from modules.centros_operacion.service import CentroOperacionService
from modules.centros_operacion.schemas import (
    CentroOperacionCreate,
    CentroOperacionUpdate,
    CentroOperacionResponse,
)
from uuid import UUID


router = APIRouter(tags=["Centros de Operación"])


def get_service(db: AsyncSession = Depends(get_db)) -> CentroOperacionService:
    return CentroOperacionService(CentroOperacionRepository(db))


@router.get("/centros-operacion", response_model=List[CentroOperacionResponse])
async def list_centros_operacion(
    activos_only: bool = Query(True, description="Solo centros de operación activos"),
    service: CentroOperacionService = Depends(get_service),
):
    """Lista todos los centros de operación."""
    return await service.get_all(activos_only=activos_only)


@router.get("/centros-operacion/{centro_id}", response_model=CentroOperacionResponse)
async def get_centro_operacion(
    centro_id: UUID,
    service: CentroOperacionService = Depends(get_service),
):
    """Obtiene un centro de operación por ID."""
    return await service.get_by_id(centro_id)


@router.post("/centros-operacion", response_model=CentroOperacionResponse, status_code=status.HTTP_201_CREATED)
async def create_centro_operacion(
    data: CentroOperacionCreate,
    service: CentroOperacionService = Depends(get_service),
):
    """Crea un nuevo centro de operación."""
    return await service.create(data)


@router.patch("/centros-operacion/{centro_id}", response_model=CentroOperacionResponse)
async def update_centro_operacion(
    centro_id: UUID,
    data: CentroOperacionUpdate,
    service: CentroOperacionService = Depends(get_service),
):
    """Actualiza un centro de operación."""
    return await service.update(centro_id, data)


@router.delete("/centros-operacion/{centro_id}", response_model=CentroOperacionResponse)
async def deactivate_centro_operacion(
    centro_id: UUID,
    service: CentroOperacionService = Depends(get_service),
):
    """Desactiva un centro de operación (soft delete)."""
    return await service.deactivate(centro_id)
