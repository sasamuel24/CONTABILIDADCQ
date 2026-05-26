"""Router FastAPI para el módulo de anticipos."""
from fastapi import APIRouter, Depends, Query, status, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional

from db.session import get_db
from core.auth import get_current_user
from db.models import User
from modules.anticipos.service import AnticipioService
from modules.anticipos.schemas import (
    AnticipioCreate, AnticipioDesembolsar, AnticipioRechazar,
    AnticipioOut, AnticipioListResponse,
)

router = APIRouter(tags=["Anticipos"])

ROLES_TESORERIA = {"admin", "tesoreria", "tes"}


async def _get_user_db(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    user_id = UUID(current_user["user_id"])
    result = await db.execute(
        select(User)
        .options(selectinload(User.role), selectinload(User.area))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado.")
    return user


def _svc(db: AsyncSession = Depends(get_db)) -> AnticipioService:
    return AnticipioService(db)


# ------------------------------------------------------------------
# Empleado: solicitar anticipo
# ------------------------------------------------------------------

@router.post(
    "/anticipos",
    response_model=AnticipioOut,
    status_code=status.HTTP_201_CREATED,
    summary="Solicitar un anticipo (cualquier usuario)",
)
async def crear_anticipo(
    data: AnticipioCreate,
    svc: AnticipioService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    return await svc.crear(user.id, data)


@router.get(
    "/anticipos/mis-anticipos",
    response_model=AnticipioListResponse,
    summary="Mis solicitudes de anticipo",
)
async def mis_anticipos(
    estado: Optional[str] = Query(None),
    svc: AnticipioService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    return await svc.listar_mis(user.id, estado)


# ------------------------------------------------------------------
# Aprobación / Rechazo via token (públicos, sin auth JWT)
# ------------------------------------------------------------------

@router.get(
    "/anticipos/aprobar/{token}",
    response_model=AnticipioOut,
    summary="Aprobador aprueba anticipo via enlace de email",
)
async def aprobar_anticipo(
    token: str,
    svc: AnticipioService = Depends(_svc),
):
    return await svc.aprobar(token)


@router.post(
    "/anticipos/rechazar/{token}",
    response_model=AnticipioOut,
    summary="Aprobador rechaza anticipo via enlace de email",
)
async def rechazar_anticipo(
    token: str,
    data: AnticipioRechazar,
    svc: AnticipioService = Depends(_svc),
):
    return await svc.rechazar(token, data)


# ------------------------------------------------------------------
# Tesorería
# ------------------------------------------------------------------

@router.get(
    "/anticipos",
    response_model=AnticipioListResponse,
    summary="Listar anticipos (Tesorería)",
)
async def listar_anticipos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    estado: Optional[str] = Query(None),
    svc: AnticipioService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    if role not in ROLES_TESORERIA:
        raise HTTPException(status_code=403, detail="Solo Tesorería puede ver los anticipos.")
    return await svc.listar_tesoreria(skip, limit, estado)


@router.post(
    "/anticipos/{anticipo_id}/desembolsar",
    response_model=AnticipioOut,
    summary="Tesorería desembolsa el anticipo y crea el paquete de gastos",
)
async def desembolsar_anticipo(
    anticipo_id: UUID,
    data: AnticipioDesembolsar,
    svc: AnticipioService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    if role not in ROLES_TESORERIA:
        raise HTTPException(status_code=403, detail="Solo Tesorería puede desembolsar anticipos.")
    return await svc.desembolsar(anticipo_id, user.id, data)


@router.get(
    "/anticipos/{anticipo_id}",
    response_model=AnticipioOut,
    summary="Detalle de un anticipo",
)
async def get_anticipo(
    anticipo_id: UUID,
    svc: AnticipioService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    is_tesoreria = role in ROLES_TESORERIA
    return await svc.get_by_id(anticipo_id, user.id, is_tesoreria)


@router.patch(
    "/anticipos/{anticipo_id}/cerrar",
    response_model=AnticipioOut,
    summary="Cerrar un anticipo manualmente (Tesorería)",
)
async def cerrar_anticipo(
    anticipo_id: UUID,
    svc: AnticipioService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    if role not in ROLES_TESORERIA:
        raise HTTPException(status_code=403, detail="Solo Tesorería puede cerrar anticipos.")
    return await svc.cerrar(anticipo_id)
