"""
Endpoints de la causación FSP en Siesa (rol contabilidad + admin).

El flujo del modal "Causar en Siesa":
1. GET  /siesa/facturas/{id}/preparar   → prefill + problemas + historial
2. GET  /siesa/maestros                 → opciones de los selects
3. POST /siesa/facturas/{id}/causar     → envío (con guardar_como_default)
4. POST /siesa/causaciones/{id}/verificar → consecutivo real / envíos dudosos
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.auth import get_current_user
from db.session import get_db
from db.models import User
from modules.siesa.builder import normalizar_nit
from modules.siesa.constants import CENTROS_COSTO, CONDICIONES_PAGO, MOTIVOS, TIPOS_PROVEEDOR
from modules.siesa.repository import SiesaRepository
from modules.siesa.schemas import (
    CausacionOut,
    CausarIn,
    CausarOut,
    ConfigProveedorIn,
    ConfigProveedorOut,
    MaestrosOut,
    PrepararOut,
    VerificarOut,
)
from modules.siesa.service import SiesaService

router = APIRouter(prefix="/siesa", tags=["Siesa"])

ROLES_CAUSACION = {"contabilidad", "admin"}


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


def _exigir_rol_causacion(user: User) -> None:
    role = user.role.code.lower() if user.role else ""
    if role not in ROLES_CAUSACION:
        raise HTTPException(
            status_code=403,
            detail="Solo Contabilidad puede causar facturas en Siesa.",
        )


def _svc(db: AsyncSession = Depends(get_db)) -> SiesaService:
    return SiesaService(db)


# =============================================================================
# Maestros y mapeo por proveedor
# =============================================================================

@router.get("/maestros", response_model=MaestrosOut, summary="Maestros Siesa para los selects del modal")
async def get_maestros(user: User = Depends(_get_user_db)):
    _exigir_rol_causacion(user)
    return MaestrosOut(
        motivos=MOTIVOS,
        centros_costo=CENTROS_COSTO,
        tipos_proveedor=TIPOS_PROVEEDOR,
        condiciones_pago=CONDICIONES_PAGO,
    )


@router.get(
    "/proveedores/{nit}",
    response_model=ConfigProveedorOut,
    summary="Mapeo Siesa de un proveedor (por NIT, con o sin DV)",
)
async def get_config_proveedor(
    nit: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_get_user_db),
):
    _exigir_rol_causacion(user)
    config = await SiesaRepository(db).get_config_por_nit(normalizar_nit(nit))
    if not config:
        raise HTTPException(status_code=404, detail="El proveedor no tiene mapeo Siesa guardado.")
    return config


@router.put(
    "/proveedores/{nit}",
    response_model=ConfigProveedorOut,
    summary="Crear o actualizar el mapeo Siesa de un proveedor",
)
async def upsert_config_proveedor(
    nit: str,
    data: ConfigProveedorIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_get_user_db),
):
    _exigir_rol_causacion(user)
    nit_limpio = normalizar_nit(nit)
    if not nit_limpio:
        raise HTTPException(status_code=400, detail="NIT inválido.")
    campos = data.model_dump(exclude={"retenciones"})
    retenciones = [r.model_dump() for r in data.retenciones]
    return await SiesaRepository(db).upsert_config(nit_limpio, campos, retenciones)


# =============================================================================
# Causación
# =============================================================================

@router.get(
    "/facturas/{factura_id}/preparar",
    response_model=PrepararOut,
    summary="Preparar la causación: prefill del modal, problemas y historial",
)
async def preparar_causacion(
    factura_id: UUID,
    svc: SiesaService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    _exigir_rol_causacion(user)
    return await svc.preparar(factura_id)


@router.post(
    "/facturas/{factura_id}/causar",
    response_model=CausarOut,
    summary="Causar la factura como FSP en Siesa",
)
async def causar_factura(
    factura_id: UUID,
    data: CausarIn,
    svc: SiesaService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    """
    Errores posibles:
    - 400: datos incompletos o descuadre aritmético (regla #11) — no se envió.
    - 409: ya causada, o envío previo con estado desconocido (verificar antes).
    - 422: el ERP rechazó el documento — `detail` trae sección + campo + causa.
    - 502: fallo de red con estado desconocido — verificar antes de reintentar.
    - 503: integración deshabilitada o sin credenciales.
    """
    _exigir_rol_causacion(user)
    return await svc.causar(factura_id, data, user.id)


@router.get(
    "/facturas/{factura_id}/causaciones",
    response_model=list[CausacionOut],
    summary="Historial de causaciones de una factura",
)
async def historial_causaciones(
    factura_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_get_user_db),
):
    _exigir_rol_causacion(user)
    return await SiesaRepository(db).get_causaciones_de_factura(factura_id)


@router.post(
    "/causaciones/{causacion_id}/verificar",
    response_model=VerificarOut,
    summary="Verificar una causación contra Siesa (consecutivo real / envíos dudosos)",
)
async def verificar_causacion(
    causacion_id: UUID,
    svc: SiesaService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    _exigir_rol_causacion(user)
    return await svc.verificar(causacion_id)
