"""
Router para endpoints de cuentas auxiliares.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from db.session import get_db
from core.auth import get_current_user
from db.models import User
from .service import CuentaAuxiliarService
from .schemas import (
    CuentaAuxiliarCreate,
    CuentaAuxiliarUpdate,
    CuentaAuxiliarResponse,
    CuentaAuxiliarList
)


router = APIRouter(
    prefix="/cuentas-auxiliares",
    tags=["Cuentas Auxiliares"]
)


@router.get("/", response_model=List[CuentaAuxiliarList])
async def get_cuentas_auxiliares(
    activas_only: bool = Query(False, description="Filtrar solo cuentas activas"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene todas las cuentas auxiliares.
    
    - **activas_only**: Si es True, retorna solo cuentas activas
    """
    service = CuentaAuxiliarService(db)
    return await service.get_all(activas_only=activas_only)


@router.get("/{cuenta_id}", response_model=CuentaAuxiliarResponse)
async def get_cuenta_auxiliar(
    cuenta_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtiene una cuenta auxiliar por su ID."""
    service = CuentaAuxiliarService(db)
    return await service.get_by_id(cuenta_id)


@router.post("/", response_model=CuentaAuxiliarResponse, status_code=201)
async def create_cuenta_auxiliar(
    cuenta_data: CuentaAuxiliarCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crea una nueva cuenta auxiliar."""
    service = CuentaAuxiliarService(db)
    return await service.create(cuenta_data)


@router.put("/{cuenta_id}", response_model=CuentaAuxiliarResponse)
async def update_cuenta_auxiliar(
    cuenta_id: UUID,
    cuenta_data: CuentaAuxiliarUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualiza una cuenta auxiliar existente."""
    service = CuentaAuxiliarService(db)
    return await service.update(cuenta_id, cuenta_data)


@router.delete("/{cuenta_id}", status_code=204)
async def delete_cuenta_auxiliar(
    cuenta_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Elimina una cuenta auxiliar."""
    service = CuentaAuxiliarService(db)
    await service.delete(cuenta_id)
