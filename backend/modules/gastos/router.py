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
from db.models import User
from modules.gastos.service import GastosService
from modules.gastos.schemas import (
    PaqueteCreate, PaqueteOut, PaqueteListResponse,
    GastoCreate, GastoUpdate, GastoOut, GastoCreateResponse,
    ArchivoGastoOut, PaqueteDevolver, GastoDevolverRequest,
    PagarPaqueteIn, PagarMasivoIn, PagarMasivoOut,
    ExtraccionDatosOut,
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
    "/gastos/paquetes/{paquete_id}/reenviar-correo-aprobacion",
    summary="Reenviar correo de solicitud de aprobación (admin/responsable)",
)
async def reenviar_correo_aprobacion(
    paquete_id: UUID,
    svc: GastosService = Depends(_svc),
    user: User = Depends(_get_user_db),
):
    """Genera un nuevo token y reenvía el correo de aprobación al aprobador."""
    role = user.role.code.lower() if user.role else ""
    area = user.area.code.lower() if user.area else ""
    if role not in {"admin", "responsable", "fact"} and area not in {"admin", "responsable", "mant", "fact"}:
        raise HTTPException(status_code=403, detail="No tienes permisos para reenviar el correo de aprobación.")
    return await svc.reenviar_correo_aprobacion(paquete_id, user.id)


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
    if role not in {"admin", "responsable", "fact"} and area not in {"admin", "responsable", "mant", "fact"}:
        raise HTTPException(status_code=403, detail="Solo el Responsable de Mantenimiento o Facturación puede devolver paquetes.")
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
    Facturación o Admin devuelve un gasto individual al técnico con un motivo.
    No cambia el estado del paquete completo.
    """
    role = user.role.code.lower() if user.role else ""
    if role not in {"admin", "fact"}:
        raise HTTPException(
            status_code=403,
            detail="Solo Facturación o Admin puede devolver gastos individuales."
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
    El técnico propietario reenvía un gasto que fue devuelto por Facturación.
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
# DOCUMENTO CONTABLE GENERAL (nivel paquete) — sube Facturación
# =============================================================================

@router.post(
    "/gastos/paquetes/{paquete_id}/doc-contable",
    response_model=PaqueteOut,
    summary="Subir documento contable general para un paquete (Facturación)",
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
# CM PDF por gasto individual — sube Facturación
# =============================================================================

@router.post(
    "/gastos/paquetes/{paquete_id}/gastos/{gasto_id}/cm-pdf",
    response_model=PaqueteOut,
    summary="Subir CM PDF para un gasto individual (Facturación)",
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
    summary="Extraer datos de factura desde imagen usando IA (Claude Haiku)",
)
async def extraer_datos_imagen(
    file: UploadFile = File(..., description="Foto de la factura (JPG, PNG)"),
    _user: User = Depends(_get_user_db),
):
    """
    Recibe una imagen de factura y usa Claude Haiku para extraer:
    NIT/identificación, nombre proveedor, concepto, número de factura,
    valor total y fecha. Devuelve los campos encontrados con nivel de
    confianza (alta / media / baja).
    """
    import base64
    import json
    from anthropic import AsyncAnthropic
    from core.config import settings

    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="Servicio de IA no configurado. Contacte al administrador."
        )

    content_type = file.content_type or ""
    if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        raise HTTPException(
            status_code=422,
            detail="Solo se aceptan imágenes JPG, PNG o WEBP."
        )

    imagen_bytes = await file.read()
    imagen_b64 = base64.standard_b64encode(imagen_bytes).decode("utf-8")

    media_type = content_type  # type: ignore[assignment]

    prompt = """Analiza esta imagen de una factura o recibo colombiano y extrae los siguientes datos en formato JSON.
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

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": imagen_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
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
            detail="La IA no pudo interpretar la imagen. Intenta con una foto más nítida."
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
