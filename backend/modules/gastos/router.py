"""Router FastAPI para el módulo de gastos / legalización de técnicos."""
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, status, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional

from db.session import get_db
from core.auth import get_current_user
from db.models import User, ComercialHijo
from modules.gastos.service import GastosService
from modules.gastos.schemas import (
    PaqueteCreate, PaqueteOut, PaqueteListResponse, PaqueteEnviarRequest,
    GastoCreate, GastoUpdate, GastoOut, GastoCreateResponse,
    ArchivoGastoOut, PaqueteDevolver, GastoDevolverRequest,
    PagarPaqueteIn, PagarMasivoIn, PagarMasivoOut,
    ExtraccionDatosOut, ComercialHijoBrief, ValidarMultipleRequest,
    ValorSinImpuestosUpdate, CruceUpdate, AnalisisImpuestoGastoOut, AnalisisImpuestosResponse,
    RechazoPaqueteIn, RechazoPaqueteOut,
)

router = APIRouter(tags=["Gastos"])

# direccion = Director Contable, solo lectura (trazabilidad)
ROLES_ADMIN = {"admin", "fact", "contabilidad", "tesoreria", "tes", "gerencia", "responsable", "direccion"}


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
# HIJOS COMERCIALES
# =============================================================================

@router.get(
    "/gastos/comercial/mis-hijos",
    response_model=list[ComercialHijoBrief],
    summary="Listar los hijos comerciales del usuario actual (rol comercial)",
)
async def listar_mis_hijos_comerciales(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_get_user_db),
):
    """Devuelve los vendedores (hijos) activos a cargo del comercial padre autenticado,
    para legalizar paquetes a su nombre. Si no tiene hijos, devuelve lista vacía."""
    result = await db.execute(
        select(ComercialHijo)
        .where(ComercialHijo.padre_user_id == user.id)
        .where(ComercialHijo.is_active == True)
        .order_by(ComercialHijo.nombre)
    )
    return result.scalars().all()


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
    solo_mis_anticipos: bool = Query(False, description="Solo paquetes con anticipo del usuario actual"),
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    """
    - **Técnico**: devuelve solo sus propios paquetes.
    - **Admin / Contabilidad / Tesorería / Gerencia**: devuelve todos.
    - **solo_mis_anticipos=true**: fuerza filtrar solo los propios con anticipo (sin importar el rol).
    """
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""

    if solo_mis_anticipos:
        paquetes, total = await svc.list_paquetes_mis_anticipos(user.id, skip, limit)
    elif role in ROLES_ADMIN or area in ROLES_ADMIN:
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
    role_code = user.role.code.lower() if user.role else ""
    if not user.area_id and role_code not in ("tarjeta_cq", "comercial"):
        raise HTTPException(status_code=400, detail="El usuario no tiene un área asignada.")
    area_code = user.area.code.lower() if user.area else ""
    return await svc.crear_paquete(user.id, user.area_id, data, area_code=area_code, role_code=role_code)


@router.get(
    "/gastos/paquetes/aprobar-por-token",
    response_model=PaqueteOut,
    summary="Aprobar paquete mediante token de email (público, sin JWT)",
)
async def aprobar_por_token_endpoint(
    token: str = Query(..., description="Token de aprobación recibido por email"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint público (no requiere JWT).
    Aprueba un paquete de gastos usando el token enviado por email al aprobador.
    """
    svc = GastosService(db)
    ip = request.client.host if request.client else "unknown"
    return await svc.aprobar_por_token(token, ip)


@router.post(
    "/gastos/paquetes/rechazar-por-token",
    response_model=RechazoPaqueteOut,
    summary="Rechazar paquete con motivo desde el email (público, sin JWT)",
)
async def rechazar_por_token_endpoint(
    data: RechazoPaqueteIn,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint público (no requiere JWT), pareja de `/aprobar-por-token`. El aprobador
    elige "Rechazar" en el correo, escribe el motivo y esta ruta lo registra: el
    paquete vuelve a 'devuelto' con el motivo visible en DocuFlow y se avisa por
    correo a quien lo legalizó.
    """
    svc = GastosService(db)
    ip = request.client.host if request and request.client else "unknown"
    return await svc.rechazar_por_token(data.token, data.motivo, ip)


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
    summary="Enviar paquete para revisión / aprobación",
)
async def enviar_paquete(
    paquete_id: UUID,
    body: Optional[PaqueteEnviarRequest] = None,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    aprobador_id = body.aprobador_id if body else None
    return await svc.enviar(paquete_id, user.id, aprobador_id=aprobador_id)


@router.post(
    "/gastos/paquetes/{paquete_id}/reenviar-correo-aprobacion",
    summary="Reenviar correo de solicitud de aprobación (admin/responsable/propietario)",
)
async def reenviar_correo_aprobacion(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    """Genera un nuevo token y reenvía el correo de aprobación al aprobador."""
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    es_gestor = role in {"admin", "responsable", "fact"} or area in {"admin", "responsable", "mant", "fact"}
    return await svc.reenviar_correo_aprobacion(paquete_id, user.id, solo_propietario=not es_gestor)


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
    "/gastos/paquetes/{paquete_id}/validar",
    response_model=PaqueteOut,
    summary="Validar paquete comercial y enviarlo al gerente (responsable/admin)",
)
async def validar_paquete_comercial(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    """El Responsable (validador) valida un paquete de tarjeta comercial en 'en_validacion'
    y lo pasa a 'en_revision', generando el correo/token de aprobación al gerente comercial."""
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "responsable"} and area not in {"admin", "responsable"}:
        raise HTTPException(status_code=403, detail="Solo el Responsable puede validar paquetes comerciales.")
    return await svc.validar_comercial(paquete_id, user.id)


@router.post(
    "/gastos/paquetes/{paquete_id}/validar-multiple",
    response_model=PaqueteOut,
    summary="Validar paquete comercial con N solicitudes a distintos aprobadores (responsable/admin)",
)
async def validar_paquete_comercial_multiple(
    paquete_id: UUID,
    data: ValidarMultipleRequest,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    """El Responsable divide los gastos del paquete en varias solicitudes de aprobación,
    cada una dirigida a un aprobador distinto (p.ej. por centro de operación). Todos los
    gastos deben quedar asignados. El paquete queda 'aprobado' cuando todas las
    solicitudes sean aprobadas por sus gerentes."""
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "responsable"} and area not in {"admin", "responsable"}:
        raise HTTPException(status_code=403, detail="Solo el Responsable puede validar paquetes comerciales.")
    return await svc.validar_comercial_multiple(paquete_id, user.id, data)


@router.post(
    "/gastos/paquetes/{paquete_id}/devolver-a-facturacion",
    response_model=PaqueteOut,
    summary="Tesorería devuelve un paquete a Radicación",
)
async def devolver_paquete_a_facturacion(
    paquete_id: UUID,
    data: PaqueteDevolver,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "tesoreria", "tes"} and area not in {"admin", "tesoreria", "tes"}:
        raise HTTPException(status_code=403, detail="Solo Tesorería puede devolver paquetes a Radicación.")
    return await svc.devolver_a_facturacion(paquete_id, user.id, data.motivo)


@router.post(
    "/gastos/paquetes/{paquete_id}/devolver-anticipo",
    response_model=PaqueteOut,
    summary="Tesorería devuelve al empleado un paquete de anticipo con inconsistencias",
)
async def devolver_anticipo_paquete(
    paquete_id: UUID,
    data: PaqueteDevolver,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    if role not in {"admin", "tesoreria", "tes"}:
        raise HTTPException(status_code=403, detail="Solo Tesorería puede devolver paquetes de anticipo.")
    return await svc.devolver_anticipo_paquete(paquete_id, user.id, data.motivo)


@router.post(
    "/gastos/paquetes/{paquete_id}/enviar-tesoreria",
    response_model=PaqueteOut,
    summary="Enviar paquete aprobado a Tesorería (radicación/admin)",
)
async def enviar_tesoreria(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "fact"} and area not in {"admin", "fact"}:
        raise HTTPException(status_code=403, detail="Solo radicación puede enviar paquetes a tesorería.")
    return await svc.enviar_tesoreria(paquete_id, user.id)


@router.post(
    "/gastos/paquetes/{paquete_id}/cruzar",
    response_model=PaqueteOut,
    summary="Marcar paquete como Cruzado: cierre sin pago (radicación/tesorería/admin)",
)
async def marcar_cruzado(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    permitidos = {"admin", "fact", "tesoreria", "tes"}
    if role not in permitidos and area not in permitidos:
        raise HTTPException(status_code=403, detail="Solo Radicación o Tesorería pueden marcar paquetes como cruzados.")
    return await svc.marcar_cruzado(paquete_id, user.id)


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
    if role not in {"admin", "responsable", "fact"} and area not in {"admin", "responsable", "mant", "fact"}:
        raise HTTPException(status_code=403, detail="Solo el Responsable de Mantenimiento o Radicación puede devolver paquetes.")
    return await svc.devolver(paquete_id, user.id, data)


@router.post(
    "/gastos/paquetes/{paquete_id}/pagar",
    response_model=PaqueteOut,
    summary="Marcar paquete como pagado (tesorería)",
)
async def pagar_paquete(
    paquete_id: UUID,
    body: PagarPaqueteIn = None,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "tesoreria", "tes"} and area not in {"admin", "tesoreria", "tes"}:
        raise HTTPException(status_code=403, detail="Solo Tesorería puede marcar como pagado.")
    fecha_pago = body.fecha_pago if body else None
    return await svc.pagar(paquete_id, user.id, fecha_pago=fecha_pago)


@router.post(
    "/gastos/paquetes/{paquete_id}/revertir-pago",
    response_model=PaqueteOut,
    summary="Revertir pago de un paquete (tesorería)",
)
async def revertir_pago(
    paquete_id: UUID,
    data: PaqueteDevolver,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "tesoreria", "tes"} and area not in {"admin", "tesoreria", "tes"}:
        raise HTTPException(status_code=403, detail="Solo Tesorería puede revertir pagos.")
    return await svc.revertir_pago(paquete_id, user.id, data.motivo)


@router.post(
    "/gastos/paquetes/pagar-masivo",
    response_model=PagarMasivoOut,
    summary="Marcar múltiples paquetes como pagados (tesorería)",
)
async def pagar_paquetes_masivo(
    body: PagarMasivoIn,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "tesoreria", "tes"} and area not in {"admin", "tesoreria", "tes"}:
        raise HTTPException(status_code=403, detail="Solo Tesorería puede marcar como pagado.")
    return await svc.pagar_masivo(body.paquete_ids, user.id, fecha_pago=body.fecha_pago)


# =============================================================================
# GASTOS (líneas de detalle)
# =============================================================================

@router.get(
    "/gastos/check-buzon",
    summary="Verifica si un número de recibo existe en el buzón de facturas",
)
async def check_buzon(
    no_recibo: str = Query(..., description="Número de recibo a verificar"),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    from modules.facturas.repository import FacturaRepository
    repo = FacturaRepository(db)
    factura = await repo.get_by_numero(no_recibo)
    if factura:
        return {"existe": True, "proveedor": factura.proveedor}
    return {"existe": False, "proveedor": None}

@router.post(
    "/gastos/paquetes/{paquete_id}/gastos",
    response_model=GastoCreateResponse,
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
    area = user.area.code.lower() if user.area else ""
    return await svc.editar_gasto(paquete_id, gasto_id, user.id, data, user_role=role, user_area=area)


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


@router.get(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/archivos/{archivo_id}/proxy-download",
    summary="Proxy de descarga del soporte (evita CORS con S3)",
)
async def proxy_download_archivo(
    paquete_id: UUID,
    gasto_id: UUID,
    archivo_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    from core.s3_service import s3_service
    role = user.role.code.lower() if user.role else ""
    archivo = await svc.get_archivo_or_404(paquete_id, gasto_id, archivo_id, user.id, role)
    s3_obj = s3_service.get_object(archivo.s3_key)
    content_type = s3_obj.get("ContentType", "application/octet-stream")
    filename = archivo.filename
    return StreamingResponse(
        s3_obj["Body"],
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =============================================================================
# DEVOLUCIÓN INDIVIDUAL DE GASTO (Fase 3)
# =============================================================================

@router.post(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/devolver",
    response_model=GastoOut,
    summary="Devolver un gasto individual con motivo (fact/admin)",
)
async def devolver_gasto_individual(
    paquete_id: UUID,
    gasto_id: UUID,
    data: GastoDevolverRequest,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    """
    Radicación, Admin o el Responsable (validador comercial) devuelve un gasto individual
    al propietario con un motivo. No cambia el estado del paquete completo.
    """
    role = user.role.code.lower() if user.role else ""
    if role not in {"admin", "fact", "responsable"}:
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para devolver gastos individuales."
        )
    return await svc.devolver_gasto_individual(paquete_id, gasto_id, user.id, data.motivo)


@router.post(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/reenviar",
    response_model=GastoOut,
    summary="Reenviar un gasto devuelto (técnico propietario)",
)
async def reenviar_gasto_individual(
    paquete_id: UUID,
    gasto_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    """
    El técnico propietario reenvía un gasto que fue devuelto por Radicación.
    Limpia el motivo de devolución y regresa el gasto a estado 'pendiente'.
    """
    return await svc.reenviar_gasto_individual(paquete_id, gasto_id, user.id)


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


# =============================================================================
# DOCUMENTO CONTABLE GENERAL (nivel paquete) — sube Radicación
# =============================================================================

@router.post(
    "/gastos/paquetes/{paquete_id}/doc-contable",
    response_model=PaqueteOut,
    summary="Subir documento contable general para un paquete (Radicación)",
)
async def subir_doc_contable(
    paquete_id: UUID,
    file: UploadFile = File(...),
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    return await svc.subir_doc_contable(paquete_id, user.id, role, file)


@router.get(
    "/gastos/paquetes/{paquete_id}/doc-contable/download",
    summary="URL prefirmada para descargar el documento contable general",
)
async def download_doc_contable(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    url = await svc.get_doc_contable_download_url(paquete_id, user.id, role)
    return {"download_url": url}


@router.delete(
    "/gastos/paquetes/{paquete_id}/doc-contable",
    response_model=PaqueteOut,
    summary="Eliminar el documento contable general de un paquete",
)
async def eliminar_doc_contable(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    return await svc.eliminar_doc_contable(paquete_id, user.id, role)


# =============================================================================
# CM PDF por gasto individual — sube Radicación
# =============================================================================

@router.post(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/cm-pdf",
    response_model=PaqueteOut,
    summary="Subir CM PDF para un gasto individual (Radicación)",
)
async def subir_cm_pdf_gasto(
    paquete_id: UUID,
    gasto_id: UUID,
    file: UploadFile = File(...),
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    return await svc.subir_cm_pdf_gasto(paquete_id, gasto_id, user.id, role, file)


@router.get(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/cm-pdf/download",
    summary="URL prefirmada para descargar el CM PDF de un gasto",
)
async def download_cm_pdf_gasto(
    paquete_id: UUID,
    gasto_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    url = await svc.get_cm_pdf_gasto_download_url(paquete_id, gasto_id, user.id, role)
    return {"download_url": url}


@router.delete(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/cm-pdf",
    response_model=PaqueteOut,
    summary="Eliminar el CM PDF de un gasto individual",
)
async def eliminar_cm_pdf_gasto(
    paquete_id: UUID,
    gasto_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    role = user.role.code.lower() if user.role else ""
    return await svc.eliminar_cm_pdf_gasto(paquete_id, gasto_id, user.id, role)


# =============================================================================
# IA — EXTRACCIÓN DE DATOS DESDE IMAGEN DE FACTURA
# =============================================================================

@router.post(
    "/gastos/extraer-datos-imagen",
    response_model=ExtraccionDatosOut,
    summary="Extraer datos de factura desde imagen o PDF usando IA (Claude Haiku)",
)
async def extraer_datos_imagen(
    file: UploadFile = File(..., description="Factura en imagen (JPG, PNG, WEBP) o PDF"),
    _user: User = Depends(_get_user_db),
):
    """
    Recibe una factura (foto o PDF) y usa Claude Haiku para extraer:
    NIT/identificación, nombre proveedor, concepto, número de factura,
    valor total y fecha. Devuelve los campos encontrados con nivel de
    confianza (alta / media / baja).
    """
    import base64
    import json
    import anthropic
    from anthropic import AsyncAnthropic
    from core.config import settings

    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="Servicio de IA no configurado. Contacte al administrador."
        )

    content_type = (file.content_type or "").lower()
    nombre = (file.filename or "").lower()
    # Algunos navegadores envían application/octet-stream: resolver por extensión
    if content_type not in _MEDIA_TYPES_IMAGEN and content_type != "application/pdf":
        if nombre.endswith(".pdf"):
            content_type = "application/pdf"
        elif nombre.endswith((".jpg", ".jpeg")):
            content_type = "image/jpeg"
        elif nombre.endswith(".png"):
            content_type = "image/png"
        elif nombre.endswith(".webp"):
            content_type = "image/webp"

    if content_type not in _MEDIA_TYPES_IMAGEN and content_type != "application/pdf":
        raise HTTPException(
            status_code=422,
            detail="Solo se aceptan imágenes JPG, PNG, WEBP o archivos PDF."
        )

    contenido = await file.read()
    contenido_b64 = base64.standard_b64encode(contenido).decode("utf-8")

    if content_type == "application/pdf":
        bloque = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": contenido_b64},
        }
    else:
        bloque = {
            "type": "image",
            "source": {"type": "base64", "media_type": content_type, "data": contenido_b64},
        }

    prompt = """Analiza este documento (imagen o PDF) de una factura o recibo colombiano y extrae los siguientes datos en formato JSON.
Si un campo no es visible o legible, usa null.
Devuelve ÚNICAMENTE el objeto JSON, sin texto adicional, sin markdown.

IMPORTANTE: Este documento representa un pago realizado por la empresa Café Quindío a un tercero.
El campo "pagado_a" y "no_identificacion" corresponden a QUIEN RECIBIÓ el pago (el proveedor, establecimiento o empresa emisora del documento), NO a Café Quindío.

Caso real de ejemplo: un tiquete de transporte de la empresa TAXBELALCAZAR con NIT 8915002771.
En ese tiquete, el campo "Viajero Identificación" muestra 900273380 y el nombre CAFE QUINDIO — esos son datos del PASAJERO/COMPRADOR, NO del beneficiario.
El beneficiario (quien recibió el pago) es TAXBELALCAZAR (NIT 8915002771), que aparece en el encabezado del documento.
Aplica la misma lógica para cualquier documento: el emisor/prestador del servicio es "pagado_a", no el cliente.
Nunca uses "Café Quindío" ni variantes de esa razón social en "pagado_a" ni en "no_identificacion".

REGLAS CRÍTICAS PARA CADA CAMPO:

REGLA no_identificacion:
- Es SIEMPRE el NIT que aparece junto al nombre del EMISOR en el encabezado del documento (la empresa que vende/presta el servicio).
- En facturas electrónicas, está etiquetado como "NIT:" junto al nombre del establecimiento en la parte superior.
- NUNCA uses el número que aparece junto a "Cliente:", "C C / NIT:", "Viajero Identificación" o cualquier campo que identifique al comprador/cliente.
- Ejemplo: factura de DIEGO CORTES CARDONA con "NIT: 18496220-8" en el encabezado y "Cliente: CAFE QUINDIO SAS, C C / NIT: 900273380-1" → no_identificacion = "18496220-8", NUNCA "900273380-1".

REGLA no_recibo:
- Es SIEMPRE el número de la factura electrónica de venta, indicado como "No.", "Factura No.", "Factura electrónica de venta No.", "Tiquete N°" u similar en el documento.
- Incluye el prefijo alfanumérico si existe (ej: "POEL-4795", "FE-001234").
- NUNCA uses números internos como localizadores, CUFE, códigos de autorización u otros códigos técnicos.

Campos a extraer:
- no_identificacion: NIT del EMISOR del documento (encabezado), solo números y guión, sin texto adicional
- pagado_a: nombre del EMISOR del documento (proveedor o establecimiento que recibió el pago)
- concepto: descripción breve del bien o servicio (máximo 300 caracteres)
- no_recibo: número de la factura/tiquete electrónico (incluir prefijo si existe, ej: POEL-4795)
- valor_pagado: valor total a pagar en números enteros (sin signo peso ni puntos de miles ni comas)
- fecha: fecha de emisión del documento en formato YYYY-MM-DD

Adicionalmente incluye:
- confianza: "alta" si detectaste 4 o más campos, "media" si detectaste 2-3, "baja" si detectaste 0-1
- campos_detectados: lista con los nombres de los campos que encontraste (sin null)

Ejemplo 1 (tiquete de transporte):
{"no_identificacion":"8915002771","pagado_a":"TAXBELALCAZAR","concepto":"Tiquete de transporte de pasajeros Armenia - Cali","no_recibo":"3464783","valor_pagado":"45000","fecha":"2026-04-15","confianza":"alta","campos_detectados":["no_identificacion","pagado_a","concepto","no_recibo","valor_pagado","fecha"]}

Ejemplo 2 (factura electrónica de ferretería):
{"no_identificacion":"18496220-8","pagado_a":"DIEGO CORTES CARDONA","concepto":"Pintemos Every Barniz Brillante, Brocha Macro Azul","no_recibo":"POEL-4795","valor_pagado":"11000","fecha":"2026-04-13","confianza":"alta","campos_detectados":["no_identificacion","pagado_a","concepto","no_recibo","valor_pagado","fecha"]}"""

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    try:
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [bloque, {"type": "text", "text": prompt}],
                }
            ],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(
            status_code=503,
            detail="La clave del servicio de IA no es válida. Contacte al administrador."
        )
    except anthropic.APIStatusError as exc:
        # Saldo agotado, límite de tasa, sobrecarga: mensaje claro en vez de 500
        raise HTTPException(
            status_code=503,
            detail=f"El servicio de IA no está disponible ({exc.status_code}). Intenta más tarde."
        )

    raw = message.content[0].text.strip()
    # Limpiar posibles bloques markdown que el modelo incluya
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        datos = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="La IA no pudo interpretar el documento. Intenta con una foto más nítida o un PDF legible."
        )

    return ExtraccionDatosOut(
        no_identificacion=datos.get("no_identificacion"),
        pagado_a=datos.get("pagado_a"),
        concepto=datos.get("concepto"),
        no_recibo=datos.get("no_recibo"),
        valor_pagado=str(datos["valor_pagado"]) if datos.get("valor_pagado") else None,
        fecha=datos.get("fecha"),
        confianza=datos.get("confianza", "baja"),
        campos_detectados=datos.get("campos_detectados", []),
    )


# =============================================================================
# VALOR SIN IMPUESTOS (BASE ANTES DE IVA) — ANÁLISIS IA + AJUSTE MANUAL
# =============================================================================

# Roles que validan los gastos para el archivo plano (Radicación/Facturación)
_ROLES_VSI = {"admin", "fact", "contabilidad"}

# Roles que pueden marcar el check de cruce de un gasto (incluye Tesorería)
_ROLES_CRUCE = _ROLES_VSI | {"tesoreria", "tes"}

_PROMPT_IMPUESTOS = """Analiza este documento (factura, tiquete o recibo colombiano) y extrae el desglose de impuestos.
Devuelve ÚNICAMENTE un objeto JSON, sin texto adicional, sin markdown.

Campos:
- total: valor total pagado del documento, en números enteros (sin signo peso, sin puntos de miles). null si no es legible.
- subtotal: valor antes de impuestos si el documento lo muestra (etiquetado "Subtotal", "Base", "Valor antes de IVA" o similar). Entero o null.
- iva: suma total del IVA discriminado en el documento (cualquier tarifa: 19%, 5%, etc.). Entero. Usa 0 SOLO si el documento muestra explícitamente IVA en $0 o "Excluido/Exento". null si no aparece ninguna línea de IVA.
- impoconsumo: valor del impuesto al consumo (INC, "Impoconsumo", "Ipoconsumo", típico en restaurantes, tarifa 8%). Entero o null si no aparece.
- propina: propina o servicio voluntario si aparece discriminado. Entero o null.
- desglose_visible: true si el documento discrimina impuestos (tiene líneas de Subtotal/IVA/INC), false si solo muestra un valor total sin desglose (típico en tiquetes de transporte, peajes, recibos simples).

Ejemplo restaurante:
{"total":58900,"subtotal":50000,"iva":0,"impoconsumo":4000,"propina":4900,"desglose_visible":true}
Ejemplo ferretería con IVA:
{"total":11900,"subtotal":10000,"iva":1900,"impoconsumo":null,"propina":null,"desglose_visible":true}
Ejemplo tiquete de transporte sin desglose:
{"total":45000,"subtotal":null,"iva":null,"impoconsumo":null,"propina":null,"desglose_visible":false}"""

_MEDIA_TYPES_IMAGEN = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _check_rol_vsi(user: User) -> None:
    role = (user.role.code if user.role else "").lower()
    area = (user.area.code if user.area else "").lower()
    if role not in _ROLES_VSI and area not in _ROLES_VSI:
        raise HTTPException(
            status_code=403,
            detail="Solo Radicación/Facturación puede gestionar el valor sin impuestos.",
        )


async def _extraer_impuestos_soporte(client, contenido: bytes, content_type: str) -> dict:
    """Envía el soporte (imagen o PDF) a Claude Haiku y devuelve el JSON de impuestos."""
    import base64
    import json

    b64 = base64.standard_b64encode(contenido).decode("utf-8")
    if content_type in _MEDIA_TYPES_IMAGEN:
        bloque = {
            "type": "image",
            "source": {"type": "base64", "media_type": content_type, "data": b64},
        }
    elif content_type == "application/pdf":
        bloque = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
        }
    else:
        raise ValueError(f"Tipo de soporte no analizable: {content_type}")

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": [bloque, {"type": "text", "text": _PROMPT_IMPUESTOS}]}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    return json.loads(raw)


@router.post(
    "/gastos/paquetes/{paquete_id}/analizar-impuestos",
    response_model=AnalisisImpuestosResponse,
    summary="Calcular el valor sin impuestos de los gastos del paquete usando IA sobre los soportes",
)
async def analizar_impuestos_paquete(
    paquete_id: UUID,
    force: bool = Query(False, description="Recalcular también gastos que ya tienen valor (excepto los manuales)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_get_user_db),
):
    """
    Para cada gasto activo del paquete sin valor_sin_impuestos, descarga su
    soporte de S3, extrae el desglose de impuestos con Claude Haiku y calcula
    la base antes de IVA/impoconsumo. Solo persiste valores que cuadran
    matemáticamente (base + impuestos ≈ total registrado); el resto queda
    marcado para revisión manual.
    """
    import asyncio
    from decimal import Decimal
    from anthropic import AsyncAnthropic
    from core.config import settings
    from core.s3_service import s3_service
    from db.models import PaqueteGasto, GastoLegalizacion

    _check_rol_vsi(user)
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="Servicio de IA no configurado. Contacte al administrador.")

    result = await db.execute(
        select(PaqueteGasto)
        .options(selectinload(PaqueteGasto.gastos).selectinload(GastoLegalizacion.archivos))
        .where(PaqueteGasto.id == paquete_id)
    )
    paquete = result.scalar_one_or_none()
    if not paquete:
        raise HTTPException(status_code=404, detail="Paquete no encontrado.")

    candidatos = [
        g for g in paquete.gastos
        if g.estado_gasto != "devuelto"
        and (g.valor_sin_impuestos is None or (force and g.vsi_fuente != "manual"))
    ]

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    sem = asyncio.Semaphore(5)

    async def analizar(gasto) -> dict:
        """Solo lectura (S3 + IA). No toca la sesión de BD."""
        soporte = next(
            (a for a in gasto.archivos
             if a.content_type in _MEDIA_TYPES_IMAGEN or a.content_type == "application/pdf"),
            None,
        )
        if not soporte:
            return {"gasto": gasto, "resultado": "sin_soporte",
                    "detalle": "El gasto no tiene soporte analizable (imagen o PDF)."}
        async with sem:
            try:
                contenido = await asyncio.to_thread(s3_service.get_file_content, soporte.s3_key)
                if len(contenido) > 20 * 1024 * 1024:
                    return {"gasto": gasto, "resultado": "error", "detalle": "Soporte demasiado grande para analizar."}
                datos = await _extraer_impuestos_soporte(client, contenido, soporte.content_type)
            except Exception as exc:  # noqa: BLE001 — un soporte ilegible no debe tumbar el lote
                return {"gasto": gasto, "resultado": "error",
                        "detalle": f"No se pudo analizar el soporte: {str(exc)[:300]}"}

        valor_pagado = Decimal(gasto.valor_pagado)
        tolerancia = max(Decimal(100), (valor_pagado * Decimal("0.01")).quantize(Decimal("1")))

        def _num(campo) -> Optional[Decimal]:
            v = datos.get(campo)
            if v is None:
                return None
            try:
                return Decimal(str(v))
            except Exception:
                return None

        iva = _num("iva")
        inc = _num("impoconsumo")
        total_doc = _num("total")
        desglose = bool(datos.get("desglose_visible"))
        impuestos = (iva or Decimal(0)) + (inc or Decimal(0))

        # Sin desglose de impuestos → la base es el total pagado
        if not desglose or impuestos == 0:
            return {"gasto": gasto, "resultado": "sin_desglose", "valor": valor_pagado,
                    "iva": iva, "inc": inc,
                    "detalle": "El soporte no discrimina impuestos; se usa el valor total."}

        # Con impuestos: el total leído debe coincidir con el valor registrado
        if total_doc is None or abs(total_doc - valor_pagado) > tolerancia:
            return {"gasto": gasto, "resultado": "revision", "iva": iva, "inc": inc,
                    "detalle": f"El total leído del soporte ({total_doc}) no coincide con el valor registrado ({valor_pagado})."}

        base = valor_pagado - impuestos
        if base <= 0:
            return {"gasto": gasto, "resultado": "revision", "iva": iva, "inc": inc,
                    "detalle": "Los impuestos leídos superan el valor del gasto."}

        return {"gasto": gasto, "resultado": "ok", "valor": base, "iva": iva, "inc": inc,
                "detalle": None}

    analisis = await asyncio.gather(*(analizar(g) for g in candidatos))

    # Aplicar mutaciones secuencialmente (la sesión async no es thread-safe)
    resultados: list[AnalisisImpuestoGastoOut] = []
    calculados = sin_desglose = para_revision = 0
    for r in analisis:
        gasto = r["gasto"]
        if r["resultado"] == "ok":
            gasto.valor_sin_impuestos = r["valor"]
            gasto.vsi_fuente = "ia"
            calculados += 1
        elif r["resultado"] == "sin_desglose":
            gasto.valor_sin_impuestos = r["valor"]
            gasto.vsi_fuente = "sin_desglose"
            sin_desglose += 1
        else:
            para_revision += 1
        resultados.append(AnalisisImpuestoGastoOut(
            gasto_id=gasto.id,
            pagado_a=gasto.pagado_a,
            resultado=r["resultado"],
            valor_sin_impuestos=r.get("valor"),
            iva_detectado=r.get("iva"),
            impoconsumo_detectado=r.get("inc"),
            detalle=r.get("detalle"),
        ))

    await db.commit()

    return AnalisisImpuestosResponse(
        procesados=len(candidatos),
        calculados=calculados,
        sin_desglose=sin_desglose,
        para_revision=para_revision,
        resultados=resultados,
    )


@router.patch(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/valor-sin-impuestos",
    response_model=GastoOut,
    summary="Digitar/corregir manualmente el valor sin impuestos de un gasto",
)
async def actualizar_valor_sin_impuestos(
    paquete_id: UUID,
    gasto_id: UUID,
    data: ValorSinImpuestosUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_get_user_db),
):
    from db.models import GastoLegalizacion

    _check_rol_vsi(user)

    result = await db.execute(
        select(GastoLegalizacion).where(
            GastoLegalizacion.id == gasto_id,
            GastoLegalizacion.paquete_id == paquete_id,
        )
    )
    gasto = result.scalar_one_or_none()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado en este paquete.")

    from decimal import Decimal
    if data.valor > Decimal(gasto.valor_pagado):
        raise HTTPException(
            status_code=422,
            detail="El valor sin impuestos no puede ser mayor al valor pagado.",
        )

    gasto.valor_sin_impuestos = data.valor
    gasto.vsi_fuente = "manual"
    await db.commit()

    result = await db.execute(
        select(GastoLegalizacion).where(GastoLegalizacion.id == gasto_id)
    )
    return GastoOut.model_validate(result.scalar_one())


@router.patch(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/cruce",
    response_model=GastoOut,
    summary="Marcar/desmarcar el check de cruce de un gasto (visible en Tesorería)",
)
async def actualizar_cruce_gasto(
    paquete_id: UUID,
    gasto_id: UUID,
    data: CruceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_get_user_db),
):
    from db.models import GastoLegalizacion

    role = (user.role.code if user.role else "").lower()
    area = (user.area.code if user.area else "").lower()
    if role not in _ROLES_CRUCE and area not in _ROLES_CRUCE:
        raise HTTPException(
            status_code=403,
            detail="Solo Radicación/Facturación o Tesorería pueden marcar el cruce de un gasto.",
        )

    result = await db.execute(
        select(GastoLegalizacion).where(
            GastoLegalizacion.id == gasto_id,
            GastoLegalizacion.paquete_id == paquete_id,
        )
    )
    gasto = result.scalar_one_or_none()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado en este paquete.")

    gasto.cruce = data.cruce

    # Trazabilidad del cruce: queda en el historial de observaciones del paquete
    from db.models import ComentarioPaquete

    detalle = f"{gasto.pagado_a} — {gasto.concepto} (${float(gasto.valor_pagado):,.0f})"
    if data.cruce:
        texto = f"Cruce marcado en el gasto: {detalle}."
        if data.motivo and data.motivo.strip():
            texto += f" Motivo: {data.motivo.strip()}"
    else:
        texto = f"Cruce desmarcado en el gasto: {detalle}."
        if data.motivo and data.motivo.strip():
            texto += f" Motivo: {data.motivo.strip()}"
    db.add(ComentarioPaquete(
        paquete_id=paquete_id, user_id=user.id,
        texto=texto, tipo="cruce",
    ))
    await db.commit()

    result = await db.execute(
        select(GastoLegalizacion).where(GastoLegalizacion.id == gasto_id)
    )
    return GastoOut.model_validate(result.scalar_one())


# =============================================================================
# EXPORTAR ARCHIVO PLANO XLSX POR PAQUETE
# =============================================================================

@router.get(
    "/gastos/paquetes/{paquete_id}/exportar-plano",
    summary="Exportar gastos de un paquete como archivo plano XLSX (formato contable)",
)
async def exportar_plano_paquete(
    paquete_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(_get_user_db),
):
    import io
    import openpyxl
    from db.models import PaqueteGasto, GastoLegalizacion, User as UserModel

    result = await db.execute(
        select(PaqueteGasto)
        .options(
            selectinload(PaqueteGasto.gastos).selectinload(GastoLegalizacion.centro_costo),
            selectinload(PaqueteGasto.gastos).selectinload(GastoLegalizacion.centro_operacion),
            selectinload(PaqueteGasto.gastos).selectinload(GastoLegalizacion.cuenta_auxiliar),
            selectinload(PaqueteGasto.tecnico).selectinload(UserModel.unidad_negocio),
            selectinload(PaqueteGasto.tecnico).selectinload(UserModel.role),
        )
        .where(PaqueteGasto.id == paquete_id)
    )
    paquete = result.scalar_one_or_none()
    if not paquete:
        raise HTTPException(status_code=404, detail="Paquete no encontrado.")

    # Determinar F351_ID_UN según el rol del técnico
    tecnico = paquete.tecnico
    role_code = (tecnico.role.code if tecnico and tecnico.role else "").lower()
    if role_code in ("tecnico", "mant"):
        paquete_un = "050"
    elif role_code == "tarjeta_cq" and tecnico and tecnico.unidad_negocio:
        paquete_un = tecnico.unidad_negocio.codigo
    else:
        paquete_un = ""

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Movimiento contable"
    ws.append([
        "F350_ID_CO",
        "F350_CONSEC_DOCTO",
        "F351_ID_AUXILIAR",
        "F351_ID_TERCERO",
        "F351_ID_CO_MOV",
        "F351_ID_UN",
        "F351_ID_CCOSTO",
        "F351_ID_FE",
        "F351_VALOR_DB",
        "F351_VALOR_CR",
        "F351_BASE_GRAVABLE",
        "F351_DOCTO_BANCO",
        "F351_NRO_DOCTO_BANCO",
        "F351_NOTAS",
    ])

    ID_CO = "001"
    gastos_activos = [g for g in paquete.gastos if g.estado_gasto != "devuelto"]

    sin_validar = [g for g in gastos_activos if g.valor_sin_impuestos is None]
    if sin_validar:
        nombres = ", ".join(f"{g.pagado_a} (${g.valor_pagado:,.0f})" for g in sin_validar[:5])
        extra = f" y {len(sin_validar) - 5} más" if len(sin_validar) > 5 else ""
        raise HTTPException(
            status_code=409,
            detail=(
                f"{len(sin_validar)} gasto(s) sin valor sin IVA validado: {nombres}{extra}. "
                "Usa 'Calcular sin IVA (IA)' o edítalos manualmente antes de exportar el plano."
            ),
        )

    for gasto in gastos_activos:
        auxiliar_codigo = gasto.cuenta_auxiliar.codigo.strip() if gasto.cuenta_auxiliar else ""
        nit_raw = (gasto.no_identificacion or "").strip().replace(".", "").replace("-", "")
        nit = None
        if nit_raw:
            try:
                nit = int(nit_raw.split("/")[0][:9])
            except ValueError:
                nit = None
        co_codigo       = gasto.centro_operacion.codigo.strip() if gasto.centro_operacion else ""
        cc_codigo       = gasto.centro_costo.codigo.strip()     if gasto.centro_costo     else ""
        notas           = f"{gasto.no_recibo or ''} {gasto.pagado_a} {gasto.concepto}".upper().strip()[:80]
        # Base antes de IVA/impoconsumo validada por Facturación (IA o manual).
        # Los gastos sin validar bloquean el export arriba (409), así que aquí
        # valor_sin_impuestos nunca es None.
        valor_db = gasto.valor_sin_impuestos

        ws.append([
            ID_CO,
            1,                              # F350_CONSEC_DOCTO siempre 1
            auxiliar_codigo,                # F351_ID_AUXILIAR
            nit,                            # F351_ID_TERCERO = NIT
            co_codigo,                      # F351_ID_CO_MOV
            paquete_un,                     # F351_ID_UN
            cc_codigo,                      # F351_ID_CCOSTO
            None,                           # F351_ID_FE (vacío)
            round(float(valor_db)),        # F351_VALOR_DB (sin impuestos)
            0,                              # F351_VALOR_CR
            0,                              # F351_BASE_GRAVABLE
            None,                           # F351_DOCTO_BANCO
            0,                              # F351_NRO_DOCTO_BANCO
            notas,                          # F351_NOTAS
        ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    folio = paquete.folio or str(paquete_id)[:8]
    headers = {
        "Content-Disposition": f'attachment; filename="plano_{folio}.xlsx"',
        "Access-Control-Expose-Headers": "Content-Disposition",
    }
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
