"""
Router para endpoints de unidades de negocio.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from db.session import get_db
from core.auth import get_current_user
from db.models import User
from .service import UnidadNegocioService
from .schemas import (
    UnidadNegocioCreate,
    UnidadNegocioUpdate,
    UnidadNegocioResponse,
    UnidadNegocioList
)


router = APIRouter(
    tags=["Unidades de Negocio"]
)


@router.get("/unidades-negocio", response_model=List[UnidadNegocioList])
async def get_unidades_negocio(
    activas_only: bool = Query(False, description="Filtrar solo unidades activas"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene todas las unidades de negocio.
    
    - **activas_only**: Si es True, retorna solo unidades activas
    """
    service = UnidadNegocioService(db)
    return await service.get_all(activas_only=activas_only)


@router.get("/unidades-negocio/{unidad_id}", response_model=UnidadNegocioResponse)
async def get_unidad_negocio(
    unidad_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtiene una unidad de negocio por su ID."""
    service = UnidadNegocioService(db)
    return await service.get_by_id(unidad_id)


@router.post("/unidades-negocio", response_model=UnidadNegocioResponse, status_code=201)
async def create_unidad_negocio(
    unidad_data: UnidadNegocioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crea una nueva unidad de negocio."""
    service = UnidadNegocioService(db)
    return await service.create(unidad_data)


@router.put("/unidades-negocio/{unidad_id}", response_model=UnidadNegocioResponse)
async def update_unidad_negocio(
    unidad_id: UUID,
    unidad_data: UnidadNegocioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualiza una unidad de negocio existente."""
    service = UnidadNegocioService(db)
    return await service.update(unidad_id, unidad_data)


@router.delete("/unidades-negocio/{unidad_id}", status_code=204)
async def delete_unidad_negocio(
    unidad_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Elimina una unidad de negocio."""
    service = UnidadNegocioService(db)
    await service.delete(unidad_id)
    return None
