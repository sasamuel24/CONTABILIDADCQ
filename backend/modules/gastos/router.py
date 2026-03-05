"""Router FastAPI para el módulo de gastos / legalización de técnicos."""
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional

from db.session import get_db
from core.auth import get_current_user
from db.models import User
from modules.gastos.service import GastosService
from modules.gastos.schemas import (
    PaqueteCreate, PaqueteOut, PaqueteListResponse,
    GastoCreate, GastoUpdate, GastoOut,
    ArchivoGastoOut, PaqueteDevolver,
)

router = APIRouter(tags=["Gastos"])

ROLES_ADMIN = {"admin", "fact", "contabilidad", "tesoreria", "tes", "gerencia", "responsable"}


async def _get_user_db(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Obtiene el objeto User completo desde la BD usando el user_id del JWT."""
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


def _svc(db: AsyncSession = Depends(get_db)) -> GastosService:
    return GastosService(db)


# =============================================================================
# PAQUETES
# =============================================================================

@router.get(
    "/gastos/paquetes",
    response_model=PaqueteListResponse,
    summary="Listar paquetes de gastos",
)
async def list_paquetes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    estado: Optional[str] = Query(None),
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    """
    - **Técnico**: devuelve solo sus propios paquetes.
    - **Admin / Contabilidad / Tesorería / Gerencia**: devuelve todos.
    """
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role in ROLES_ADMIN or area in ROLES_ADMIN:
        paquetes, total = await svc.list_paquetes_admin(skip, limit, estado)
    else:
        paquetes, total = await svc.list_paquetes_tecnico(user.id, skip, limit)
    return PaqueteListResponse(paquetes=paquetes, total=total)


@router.post(
    "/gastos/paquetes",
    response_model=PaqueteOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear paquete semanal de gastos",
)
async def crear_paquete(
    data: PaqueteCreate,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    if not user.area_id:
        raise HTTPException(status_code=400, detail="El usuario no tiene un área asignada.")
    return await svc.crear_paquete(user.id, user.area_id, data)


@router.get(
    "/gastos/paquetes/{paquete_id}",
    response_model=PaqueteOut,
    summary="Detalle de un paquete",
)
async def get_paquete(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    return await svc.get_paquete(paquete_id, user.id, role, area)


# =============================================================================
# WORKFLOW
# =============================================================================

@router.post(
    "/gastos/paquetes/{paquete_id}/enviar",
    response_model=PaqueteOut,
    summary="Enviar paquete para revisión",
)
async def enviar_paquete(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    return await svc.enviar(paquete_id, user.id)


@router.post(
    "/gastos/paquetes/{paquete_id}/aprobar",
    response_model=PaqueteOut,
    summary="Aprobar paquete (admin/contabilidad)",
)
async def aprobar_paquete(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "responsable"} and area not in {"admin", "responsable", "mant"}:
        raise HTTPException(status_code=403, detail="Solo el Responsable de Mantenimiento puede aprobar paquetes.")
    return await svc.aprobar(paquete_id, user.id)


@router.post(
    "/gastos/paquetes/{paquete_id}/enviar-tesoreria",
    response_model=PaqueteOut,
    summary="Enviar paquete aprobado a Tesorería (facturación/admin)",
)
async def enviar_tesoreria(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "fact"} and area not in {"admin", "fact"}:
        raise HTTPException(status_code=403, detail="Solo facturación puede enviar paquetes a tesorería.")
    return await svc.enviar_tesoreria(paquete_id, user.id)


@router.post(
    "/gastos/paquetes/{paquete_id}/devolver",
    response_model=PaqueteOut,
    summary="Devolver paquete con observación (admin/contabilidad)",
)
async def devolver_paquete(
    paquete_id: UUID,
    data: PaqueteDevolver,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "responsable"} and area not in {"admin", "responsable", "mant"}:
        raise HTTPException(status_code=403, detail="Solo el Responsable de Mantenimiento puede devolver paquetes.")
    return await svc.devolver(paquete_id, user.id, data)


@router.post(
    "/gastos/paquetes/{paquete_id}/pagar",
    response_model=PaqueteOut,
    summary="Marcar paquete como pagado (tesorería)",
)
async def pagar_paquete(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "tesoreria", "tes"} and area not in {"admin", "tesoreria", "tes"}:
        raise HTTPException(status_code=403, detail="Solo Tesorería puede marcar como pagado.")
    return await svc.pagar(paquete_id, user.id)


# =============================================================================
# GASTOS (líneas de detalle)
# =============================================================================

@router.post(
    "/gastos/paquetes/{paquete_id}/gastos",
    response_model=GastoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar línea de gasto",
)
async def agregar_gasto(
    paquete_id: UUID,
    data: GastoCreate,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    return await svc.agregar_gasto(paquete_id, user.id, data)


@router.patch(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}",
    response_model=GastoOut,
    summary="Editar línea de gasto",
)
async def editar_gasto(
    paquete_id: UUID,
    gasto_id: UUID,
    data: GastoUpdate,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    return await svc.editar_gasto(paquete_id, gasto_id, user.id, data, user_role=role)


@router.delete(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar línea de gasto",
)
async def eliminar_gasto(
    paquete_id: UUID,
    gasto_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    await svc.eliminar_gasto(paquete_id, gasto_id, user.id)


# =============================================================================
# ARCHIVOS SOPORTE
# =============================================================================

@router.post(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/archivos",
    response_model=ArchivoGastoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Subir soporte adjunto para un gasto",
)
async def subir_archivo(
    paquete_id: UUID,
    gasto_id: UUID,
    categoria: str = Form(...),
    file: UploadFile = File(...),
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    return await svc.subir_archivo(paquete_id, gasto_id, user.id, categoria, file)


@router.delete(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/archivos/{archivo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar soporte adjunto de un gasto",
)
async def eliminar_archivo(
    paquete_id: UUID,
    gasto_id: UUID,
    archivo_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    await svc.eliminar_archivo(paquete_id, gasto_id, archivo_id, user.id)


@router.get(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/archivos/{archivo_id}/download",
    summary="URL prefirmada para descargar el soporte de un gasto",
)
async def download_archivo(
    paquete_id: UUID,
    gasto_id: UUID,
    archivo_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    url = await svc.get_download_url(paquete_id, gasto_id, archivo_id, user.id, role)
    return {"download_url": url}


# =============================================================================
# APROBACION DE GERENCIA (nivel paquete)
# =============================================================================

@router.post(
    "/gastos/paquetes/{paquete_id}/aprobacion",
    response_model=PaqueteOut,
    summary="Subir aprobación de gerencia para un paquete",
)
async def subir_aprobacion_gerencia(
    paquete_id: UUID,
    file: UploadFile = File(...),
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    return await svc.subir_aprobacion_gerencia(paquete_id, user.id, role, file)


@router.get(
    "/gastos/paquetes/{paquete_id}/aprobacion/download",
    summary="URL prefirmada para descargar la aprobación de gerencia",
)
async def download_aprobacion_gerencia(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    url = await svc.get_aprobacion_gerencia_download_url(paquete_id, user.id, role)
    return {"download_url": url}
