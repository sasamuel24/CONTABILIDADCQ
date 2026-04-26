from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from db.session import get_db
from core.auth import get_current_user
from modules.aprobadores_gerencia.service import AprobadorGerenciaService
from modules.aprobadores_gerencia.schemas import (
    AprobadorGerenciaCreate,
    AprobadorGerenciaUpdate,
    AprobadorGerenciaOut,
)

router = APIRouter(prefix="/aprobadores-gerencia", tags=["Aprobadores Gerencia"])


def _svc(db: AsyncSession = Depends(get_db)) -> AprobadorGerenciaService:
    return AprobadorGerenciaService(db)


@router.get("/", response_model=List[AprobadorGerenciaOut])
async def listar_todos(
    svc: AprobadorGerenciaService = Depends(_svc),
    _: dict = Depends(get_current_user),
):
    """Lista todos los aprobadores (activos e inactivos). Solo usuarios autenticados."""
    return await svc.listar_todos()


@router.get("/activos", response_model=List[AprobadorGerenciaOut])
async def listar_activos(
    svc: AprobadorGerenciaService = Depends(_svc),
    _: dict = Depends(get_current_user),
):
    """Lista solo los aprobadores activos (para el selector al enviar correo)."""
    return await svc.listar_activos()


@router.post("/", response_model=AprobadorGerenciaOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: AprobadorGerenciaCreate,
    svc: AprobadorGerenciaService = Depends(_svc),
    _: dict = Depends(get_current_user),
):
    """Crea un nuevo aprobador de gerencia. Solo admin."""
    return await svc.crear(data)


@router.put("/{aprobador_id}", response_model=AprobadorGerenciaOut)
async def actualizar(
    aprobador_id: UUID,
    data: AprobadorGerenciaUpdate,
    svc: AprobadorGerenciaService = Depends(_svc),
    _: dict = Depends(get_current_user),
):
    """Edita nombre, cargo o email de un aprobador."""
    return await svc.actualizar(aprobador_id, data)


@router.patch("/{aprobador_id}/toggle", response_model=AprobadorGerenciaOut)
async def toggle_activo(
    aprobador_id: UUID,
    svc: AprobadorGerenciaService = Depends(_svc),
    _: dict = Depends(get_current_user),
):
    """Activa o desactiva un aprobador sin eliminarlo."""
    return await svc.toggle_activo(aprobador_id)


@router.delete("/{aprobador_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    aprobador_id: UUID,
    svc: AprobadorGerenciaService = Depends(_svc),
    _: dict = Depends(get_current_user),
):
    """Elimina un aprobador permanentemente."""
    await svc.eliminar(aprobador_id)
