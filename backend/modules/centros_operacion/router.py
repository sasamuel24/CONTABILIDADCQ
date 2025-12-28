"""
Router de FastAPI para el módulo de centros de operación.
"""
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from db.session import get_db
from modules.centros_operacion.repository import CentroOperacionRepository
from modules.centros_operacion.service import CentroOperacionService
from modules.centros_operacion.schemas import (
    CentroOperacionCreate,
    CentroOperacionUpdate,
    CentroOperacionResponse
)
from modules.centros_costo.repository import CentroCostoRepository


router = APIRouter(tags=["Centros de Operación"])


def get_service(db: AsyncSession = Depends(get_db)) -> CentroOperacionService:
    """Dependency para obtener el servicio de centros de operación."""
    repository = CentroOperacionRepository(db)
    centro_costo_repo = CentroCostoRepository(db)
    return CentroOperacionService(repository, centro_costo_repo)


@router.get("/centros-operacion", response_model=List[CentroOperacionResponse])
async def list_centros_operacion(
    centro_costo_id: Optional[UUID] = Query(None, description="Filtrar por centro de costo"),
    activos_only: bool = Query(True, description="Solo centros de operación activos"),
    service: CentroOperacionService = Depends(get_service)
):
    """
    Lista todos los centros de operación.
    
    Por defecto solo retorna los activos. Use activos_only=false para ver todos.
    Puede filtrar por centro de costo con el parámetro centro_costo_id.
    """
    return await service.get_all(centro_costo_id=centro_costo_id, activos_only=activos_only)


@router.get("/centros-operacion/{centro_id}", response_model=CentroOperacionResponse)
async def get_centro_operacion(
    centro_id: UUID,
    service: CentroOperacionService = Depends(get_service)
):
    """Obtiene un centro de operación por ID."""
    return await service.get_by_id(centro_id)


@router.post(
    "/centros-operacion",
    response_model=CentroOperacionResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_centro_operacion(
    data: CentroOperacionCreate,
    service: CentroOperacionService = Depends(get_service)
):
    """Crea un nuevo centro de operación."""
    return await service.create(data)


@router.patch("/centros-operacion/{centro_id}", response_model=CentroOperacionResponse)
async def update_centro_operacion(
    centro_id: UUID,
    data: CentroOperacionUpdate,
    service: CentroOperacionService = Depends(get_service)
):
    """Actualiza un centro de operación."""
    return await service.update(centro_id, data)


@router.delete("/centros-operacion/{centro_id}", response_model=CentroOperacionResponse)
async def deactivate_centro_operacion(
    centro_id: UUID,
    service: CentroOperacionService = Depends(get_service)
):
    """
    Desactiva un centro de operación (soft delete).
    
    No elimina el registro, solo lo marca como inactivo.
    """
    return await service.deactivate(centro_id)
