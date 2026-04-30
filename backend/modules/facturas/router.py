"""
Router de FastAPI para el módulo de facturas.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, List, Optional
from uuid import UUID

from db.session import get_db
from modules.facturas.repository import FacturaRepository
from modules.facturas.service import FacturaService
from modules.facturas.schemas import (
    FacturaCreate,
    FacturaUpdate,
    FacturaResponse,
    FacturasPaginatedResponse,
    EstadoUpdateRequest,
    EstadoUpdateResponse,
    InventariosPatchIn,
    InventariosOut,
    AnticipoUpdateIn,
    AnticipoOut,
    SubmitResponsableOut,
    CentrosPatchIn,
    CentrosOut,
    DevolverAResponsableIn,
    DevolverAResponsableOut,
    DevolverAFacturacionIn,
    DevolverAFacturacionOut,
    AsignarCarpetaRequest,
    AsignarCarpetaResponse,
    AsignarCarpetaTesoreriaRequest,
    AsignarCarpetaTesoreriaResponse,
    ExtraccionFacturaPdfOut,
    EnviarCorreoAprobacionIn,
    AprobacionEmailOut,
    IngestaXMLIn,
    IngestaXMLResultOut,
)
from fastapi import UploadFile, File
from core.auth import require_api_key, get_current_user


router = APIRouter(prefix="/facturas", tags=["Facturas"])


def get_factura_service(db: AsyncSession = Depends(get_db)) -> FacturaService:
    """Dependency para obtener el servicio de facturas."""
    repository = FacturaRepository(db)
    return FacturaService(repository, db)


@router.get("/", response_model=FacturasPaginatedResponse)
async def list_facturas(
    skip: int = 0,
    limit: int = 100,
    area_id: Optional[UUID] = Query(None, description="Filtrar por ID de área"),
    area_origen_id: Optional[UUID] = Query(None, description="Filtrar por ID de área de origen"),
    estado: Optional[str] = Query(None, description="Filtrar por estado de la factura"),
    service: FacturaService = Depends(get_factura_service)
):
    """Lista todas las facturas con paginación y filtros opcionales."""
    return await service.list_facturas(skip=skip, limit=limit, area_id=area_id, area_origen_id=area_origen_id, estado=estado)


@router.get(
    "/aprobar-por-token",
    response_model=AprobacionEmailOut,
    summary="Aprobar factura mediante token de email (público, sin autenticación)",
)
async def aprobar_por_token(
    token: str = Query(..., description="Token de aprobación recibido en el correo"),
    request: Request = None,
    service: FacturaService = Depends(get_factura_service),
):
    """
    Endpoint público (sin JWT). El gerente hace clic en el link del correo y esta ruta
    valida el token y registra la aprobación de la factura.
    """
    ip = request.client.host if request and request.client else "unknown"
    result = await service.aprobar_por_token(token, ip)
    return AprobacionEmailOut(**result)


@router.get("/{factura_id}", response_model=FacturaResponse)
async def get_factura(
    factura_id: UUID,
    service: FacturaService = Depends(get_factura_service)
):
    """Obtiene una factura por ID."""
    return await service.get_factura(factura_id)


@router.get("/by-number/{numero_factura}", response_model=FacturaResponse)
async def get_factura_by_numero(
    numero_factura: str,
    service: FacturaService = Depends(get_factura_service)
):
    """Obtiene una factura por número de factura."""
    return await service.get_factura_by_numero(numero_factura)


@router.post(
    "/",
    response_model=FacturaResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)]
)
async def create_factura(
    factura: FacturaCreate,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Crea una nueva factura.
    
    **Requiere API Key:** Header `x-api-key` con la clave válida.
    """
    return await service.create_factura(factura)


@router.patch("/{factura_id}", response_model=FacturaResponse)
async def update_factura(
    factura_id: UUID,
    factura: FacturaUpdate,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Actualiza una factura.
    
    Permite actualizar cualquier campo de la factura, incluyendo:
    - Centro de Costo y Centro de Operación (con validación de pertenencia)
    - Datos básicos (proveedor, monto, etc.)
    - Estado
    """
    return await service.update_factura(factura_id, factura)


@router.patch("/{factura_id}/estado", response_model=EstadoUpdateResponse)
async def update_factura_estado(
    factura_id: UUID,
    request: EstadoUpdateRequest,
    service: FacturaService = Depends(get_factura_service)
):
    """Actualiza el estado de una factura."""
    return await service.update_estado(factura_id, request.estado_id)


@router.post("/{factura_id}/carpeta", response_model=AsignarCarpetaResponse, status_code=status.HTTP_200_OK)
async def asignar_factura_a_carpeta(
    factura_id: UUID,
    request: AsignarCarpetaRequest,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Asigna una factura a una carpeta específica.
    
    - **factura_id**: ID de la factura a asignar
    - **carpeta_id**: ID de la carpeta donde se guardará la factura
    
    **Validaciones:**
    - 404 si la factura no existe
    - 404 si la carpeta no existe
    
    **Retorna:**
    - id: ID de la factura
    - numero_factura: Número de la factura
    - carpeta_id: ID de la carpeta asignada
    - carpeta_nombre: Nombre de la carpeta
    - updated_at: Fecha de actualización
    """
    return await service.asignar_carpeta(factura_id, request.carpeta_id)


@router.post("/{factura_id}/carpeta-tesoreria", response_model=AsignarCarpetaTesoreriaResponse, status_code=status.HTTP_200_OK)
async def asignar_factura_a_carpeta_tesoreria(
    factura_id: UUID,
    request: AsignarCarpetaTesoreriaRequest,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Asigna una factura a una carpeta de tesorería específica.
    
    - **factura_id**: ID de la factura a asignar
    - **carpeta_id**: ID de la carpeta de tesorería donde se guardará la factura
    
    **Validaciones:**
    - 404 si la factura no existe
    - 404 si la carpeta de tesorería no existe
    
    **Retorna:**
    - id: ID de la factura
    - numero_factura: Número de la factura
    - carpeta_id: ID de la carpeta asignada
    - carpeta_nombre: Nombre de la carpeta
    - updated_at: Fecha de actualización
    """
    return await service.asignar_carpeta_tesoreria(factura_id, request.carpeta_id)


@router.get("/{factura_id}/inventarios", response_model=InventariosOut)
async def get_factura_inventarios(
    factura_id: UUID,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Obtiene los inventarios de una factura.
    
    **Retorna:**
    - factura_id: ID de la factura
    - requiere_entrada_inventarios: bool
    - destino_inventarios: TIENDA | ALMACEN | null
    - codigos: lista de códigos con sus valores
    
    **Validaciones:**
    - 404 si factura_id no existe
    """
    return await service.get_inventarios(factura_id)


@router.patch("/{factura_id}/inventarios", response_model=InventariosOut)
async def update_factura_inventarios(
    factura_id: UUID,
    inventarios: InventariosPatchIn,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Actualiza los inventarios de una factura.
    
    **Lógica:**
    
    - Si `requiere_entrada_inventarios = false`:
      - `destino_inventarios` se setea a NULL
      - Se eliminan todos los códigos de inventario
      - Responde con `codigos=[]`
    
    - Si `requiere_entrada_inventarios = true`:
      - `destino_inventarios` es **obligatorio** (400 si falta)
      - `codigos` es **obligatorio** y no puede estar vacío (400 si falta)
      - Códigos requeridos según destino:
        - **TIENDA**: OCT, ECT, FPC
        - **ALMACEN**: OCC, EDO, FPC
      - No se permiten códigos faltantes ni extras (400)
      - Cada valor debe ser no vacío y alfanumérico con guiones (400)
      - Se hace UPSERT: actualiza existentes, crea nuevos, elimina no presentes
    
    **Validaciones:**
    - 404 si factura_id no existe
    - 400 si faltan campos obligatorios
    - 400 si hay códigos faltantes o extras
    - 400 si valores son inválidos
    """
    return await service.update_inventarios(factura_id, inventarios)


@router.get("/{factura_id}/anticipo", response_model=AnticipoOut)
async def get_factura_anticipo(
    factura_id: UUID,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Obtiene los campos de anticipo de una factura.
    
    **Respuesta:**
    - `factura_id`: UUID de la factura
    - `tiene_anticipo`: boolean
    - `porcentaje_anticipo`: float | null
    - `intervalo_entrega_contabilidad`: string (1_SEMANA, 2_SEMANAS, 3_SEMANAS, 1_MES)
    """
    return await service.get_anticipo(factura_id)


@router.patch("/{factura_id}/anticipo", response_model=AnticipoOut)
async def update_factura_anticipo(
    factura_id: UUID,
    anticipo: AnticipoUpdateIn,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Actualiza los campos de anticipo de una factura.
    
    **Campos:**
    - `tiene_anticipo`: boolean - Indica si la factura tiene anticipo
    - `porcentaje_anticipo`: float | null - Porcentaje (0-100) o null
    - `intervalo_entrega_contabilidad`: enum - 1_SEMANA, 2_SEMANAS, 3_SEMANAS, 1_MES
    
    **Reglas de validación (CHECK constraints):**
    
    1. **check_anticipo_porcentaje_required**:
       - Si `tiene_anticipo = true` → `porcentaje_anticipo` NO puede ser null
       - Si `tiene_anticipo = false` → `porcentaje_anticipo` DEBE ser null
    
    2. **check_porcentaje_anticipo_range**:
       - Si `porcentaje_anticipo` no es null → debe estar entre 0 y 100 (inclusive)
    
    3. **intervalo_entrega_contabilidad**:
       - Siempre obligatorio
       - Valores permitidos: 1_SEMANA, 2_SEMANAS, 3_SEMANAS, 1_MES
    
    **Códigos de respuesta:**
    - 200: Actualización exitosa
    - 400: Validación fallida (violación de constraints)
    - 404: Factura no encontrada
    - 422: Error de validación Pydantic (tipo de dato, valores ENUM)
    
    **Ejemplos:**
    
    Factura SIN anticipo:
    ```json
    {
      "tiene_anticipo": false,
      "porcentaje_anticipo": null,
      "intervalo_entrega_contabilidad": "1_SEMANA"
    }
    ```
    
    Factura CON anticipo del 30%:
    ```json
    {
      "tiene_anticipo": true,
      "porcentaje_anticipo": 30.0,
      "intervalo_entrega_contabilidad": "2_SEMANAS"
    }
    ```
    
    Error (tiene_anticipo=true pero porcentaje=null):
    ```json
    {
      "tiene_anticipo": true,
      "porcentaje_anticipo": null,
      "intervalo_entrega_contabilidad": "1_SEMANA"
    }
    ```
    Respuesta 400:
    ```json
    {
      "detail": {
        "message": "Anticipo inválido",
        "errors": [
          {
            "field": "porcentaje_anticipo",
            "code": "check_anticipo_porcentaje_required",
            "reason": "Si tiene_anticipo es true, porcentaje_anticipo no puede ser null"
          }
        ]
      }
    }
    ```
    """
    return await service.update_anticipo(factura_id, anticipo)


@router.post("/{factura_id}/submit-responsable", response_model=SubmitResponsableOut)
async def submit_responsable(
    factura_id: UUID,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Endpoint de transición: Envía la factura desde Responsable a Contabilidad.
    
    **Validaciones antes de enviar:**
    
    1. **Centro de Costo y Operación:**
       - centro_costo_id NO NULL
       - centro_operacion_id NO NULL
    
    2. **Anticipo:**
       - intervalo_entrega_contabilidad NO NULL
       - tiene_anticipo = (porcentaje_anticipo IS NOT NULL)
       - porcentaje_anticipo en rango 0-100
    
    3. **Inventarios:**
       - Si requiere_entrada_inventarios=false:
         * destino_inventarios = NULL
         * presenta_novedad = false
         * NO existe código NP
       - Si requiere_entrada_inventarios=true:
         * destino_inventarios obligatorio (TIENDA|ALMACEN)
         * Códigos según matriz:
           - TIENDA sin novedad: OCT, ECT, FPC
           - TIENDA con novedad: OCT, ECT, FPC, NP
           - ALMACEN sin novedad: OCC, EDO, FPC
           - ALMACEN con novedad: OCC, EDO, FPC, NP
         * Valores no vacíos
    
    **Si todas las validaciones pasan:**
    - Reasigna la factura a área CONTABILIDAD
    - Actualiza estado a EN_CONTABILIDAD
    - Limpia assigned_to_user_id
    - Actualiza assigned_at
    
    **Respuestas:**
    - 200: Factura enviada exitosamente con detalle completo
    - 400: Validaciones fallidas con detalle de errores
    - 404: Factura no encontrada
    
    **Ejemplo de error 400:**
    ```json
    {
      "detail": {
        "message": "No se puede enviar a Contabilidad",
        "missing_fields": ["centro_costo_id", "centro_operacion_id"],
        "missing_codes": ["NP"],
        "extra_codes": [],
        "missing_files": []
      }
    }
    ```
    
    **Ejemplo de éxito 200:**
    ```json
    {
      "factura_id": "uuid",
      "area_actual": "CONTABILIDAD",
      "estado_actual": "EN_CONTABILIDAD",
      "proveedor": "Proveedor ABC",
      "numero_factura": "F-001",
      "fecha_emision": "2025-12-28",
      "total": 1000.00,
      "centro_costo_id": "uuid",
      "centro_operacion_id": "uuid",
      "requiere_entrada_inventarios": true,
      "destino_inventarios": "TIENDA",
      "presenta_novedad": true,
      "inventario_codigos": [
        {"codigo": "OCT", "valor": "T-001", "created_at": "2025-12-28T10:00:00Z"},
        {"codigo": "ECT", "valor": "T-002", "created_at": "2025-12-28T10:00:01Z"},
        {"codigo": "FPC", "valor": "T-003", "created_at": "2025-12-28T10:00:02Z"},
        {"codigo": "NP", "valor": "Novedad-001", "created_at": "2025-12-28T10:00:03Z"}
      ],
      "tiene_anticipo": true,
      "porcentaje_anticipo": 50.0,
      "intervalo_entrega_contabilidad": "2_SEMANAS",
      "files": []
    }
    ```
    """
    return await service.submit_responsable(factura_id)


@router.patch("/{factura_id}/centros", response_model=CentrosOut)
async def update_centros(
    factura_id: UUID,
    centros: CentrosPatchIn,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Asigna Centro de Costo (CC) y Centro de Operación (CO) a una factura.
    
    **Validaciones:**
    1. Factura debe existir (404 si no)
    2. Centro de Costo debe existir (400 si no)
    3. Centro de Operación debe existir (400 si no)
    4. **CRÍTICO**: Centro de Operación debe pertenecer al Centro de Costo seleccionado
       - Se valida que `centro_operacion.centro_costo_id == centro_costo_id`
       - Si no coincide → 400
    
    **Request Body:**
    ```json
    {
      "centro_costo_id": "uuid-del-centro-costo",
      "centro_operacion_id": "uuid-del-centro-operacion"
    }
    ```
    
    **Respuestas:**
    - **200**: Asignación exitosa
      ```json
      {
        "factura_id": "uuid",
        "centro_costo_id": "uuid",
        "centro_operacion_id": "uuid"
      }
      ```
    
    - **400**: Validación fallida
      ```json
      {
        "detail": {
          "message": "Centro de operación no pertenece al centro de costo",
          "centro_costo_id": "uuid-cc",
          "centro_operacion_id": "uuid-co",
          "centro_operacion_real_cc_id": "uuid-cc-real"
        }
      }
      ```
    
    - **404**: Factura no encontrada
      ```json
      {
        "detail": "Factura con ID {uuid} no encontrada"
      }
      ```
    
    **Flujo recomendado en frontend:**
    1. Usuario selecciona Centro de Costo → GET /catalogos/centros-costo
    2. Frontend carga Centros de Operación filtrados → GET /catalogos/centros-costo/{cc_id}/centros-operacion
    3. Usuario selecciona ambos y envía → PATCH /facturas/{id}/centros
    
    Esto garantiza que el CO mostrado en el dropdown ya pertenece al CC, evitando errores de validación.
    """
    return await service.update_centros(factura_id, centros)


@router.post(
    "/{factura_id}/submit-tesoreria",
    response_model=SubmitResponsableOut,
    summary="Enviar factura a Tesorería",
    description="Transición de factura desde CONTABILIDAD a TESORERIA (solo accesible por rol Contabilidad)"
)
async def submit_tesoreria(
    factura_id: UUID,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Envía una factura desde CONTABILIDAD a TESORERIA.
    
    Este endpoint permite que el área de Contabilidad audite y envíe la factura
    a Tesorería manteniendo todos los datos validados anteriormente.
    
    **Validaciones:**
    1. Factura debe existir (404 si no)
    2. Factura debe estar actualmente en área CONTABILIDAD
       - Si NO está en Contabilidad → 409 "La factura no está en Contabilidad"
    3. Factura no debe estar ya en Tesorería
       - Si ya está en Tesorería → 409 "La factura ya fue enviada a Tesorería"
    
    **Acción realizada:**
    - Cambia `area_id` a TESORERIA (b067adcd-13ff-420f-9389-42bfaa78cf9f)
    - Actualiza `estado_id` a 7
    - Limpia `assigned_to_user_id` (NULL)
    - Actualiza `assigned_at` a timestamp actual
    
    **Respuestas:**
    - **200**: Transición exitosa
      ```json
      {
        "factura_id": "uuid",
        "area_id": "uuid-tesoreria",
        "area_actual": "Tesorería",
        "estado_id": 7,
        "estado_actual": "En Tesorería",
        "proveedor": "...",
        "numero_factura": "...",
        "centro_costo_id": "uuid",
        "centro_operacion_id": "uuid",
        "requiere_entrada_inventarios": true,
        "destino_inventarios": "TIENDA",
        "presenta_novedad": false,
        "inventario_codigos": [...],
        "tiene_anticipo": true,
        "porcentaje_anticipo": 50.0,
        "intervalo_entrega_contabilidad": "2_SEMANAS",
        "files": [...]
      }
      ```
    
    - **404**: Factura no encontrada
      ```json
      {
        "detail": "Factura con ID {uuid} no encontrada"
      }
      ```
    
    - **409**: Validación de área fallida
      ```json
      {
        "detail": "La factura no está en Contabilidad"
      }
      ```
      o
      ```json
      {
        "detail": "La factura ya fue enviada a Tesorería"
      }
      ```
    
    **Flujo completo:**
    1. Responsable valida y envía → POST /facturas/{id}/submit-responsable (área pasa a CONTABILIDAD)
    2. Contabilidad audita y envía → POST /facturas/{id}/submit-tesoreria (área pasa a TESORERIA)
    3. Tesorería procesa pago
    """
    return await service.submit_tesoreria(factura_id)


@router.post(
    "/{factura_id}/submit-gadmin-tesoreria",
    response_model=SubmitResponsableOut,
    summary="Enviar factura GADMIN directo a Tesorería",
)
async def submit_gadmin_tesoreria(
    factura_id: UUID,
    service: FacturaService = Depends(get_factura_service)
):
    """Envía una factura del área Gastos Fijos Café Quindío directamente a Tesorería, sin pasar por Contabilidad."""
    return await service.submit_gadmin_tesoreria(factura_id)


@router.post(
    "/{factura_id}/close-tesoreria",
    response_model=SubmitResponsableOut,
    summary="Cerrar factura en Tesorería",
    description="Finaliza el proceso de una factura en Tesorería validando archivos requeridos (PEC, EC, PCE)"
)
async def close_tesoreria(
    factura_id: UUID,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Cierra una factura en TESORERIA después de validar documentos requeridos.
    
    Este endpoint permite que el área de Tesorería finalice el proceso de la factura
    después de subir los documentos obligatorios: PEC, EC y PCE.
    
    **Validaciones:**
    1. Factura debe existir (404 si no)
    2. Factura debe estar actualmente en área TESORERIA
       - Si NO está en Tesorería → 409 "La factura no está en Tesorería"
    3. Deben existir los siguientes archivos adjuntos:
       - **PEC**: Pago Electrónico Certificado
       - **EC**: Estado de Cuenta
       - **PCE**: Pago Con Egreso
       - Si faltan archivos → 400 con lista de archivos faltantes
    
    **Acción realizada:**
    - Cambia `estado_id` a 5 (estado finalizado)
    - Mantiene `area_id` en TESORERIA
    
    **Respuestas:**
    - **200**: Cierre exitoso
      ```json
      {
        "factura_id": "uuid",
        "area_id": "uuid-tesoreria",
        "area_actual": "Tesorería",
        "estado_id": 5,
        "estado_actual": "Finalizada",
        "proveedor": "...",
        "numero_factura": "...",
        "centro_costo_id": "uuid",
        "centro_operacion_id": "uuid",
        "inventario_codigos": [...],
        "tiene_anticipo": true,
        "files": [
          {
            "id": "uuid",
            "filename": "PEC.pdf",
            "doc_type": "PEC",
            "content_type": "application/pdf",
            "size_bytes": 12345,
            "uploaded_at": "2025-12-29T..."
          },
          {
            "doc_type": "EC",
            ...
          },
          {
            "doc_type": "PCE",
            ...
          }
        ]
      }
      ```
    
    - **400**: Faltan archivos requeridos
      ```json
      {
        "detail": {
          "message": "No se puede cerrar la factura en Tesorería",
          "missing_files": ["PEC", "EC"]
        }
      }
      ```
    
    - **404**: Factura no encontrada
      ```json
      {
        "detail": "Factura con ID {uuid} no encontrada"
      }
      ```
    
    - **409**: Factura no está en Tesorería
      ```json
      {
        "detail": "La factura no está en Tesorería"
      }
      ```
    
    **Flujo completo:**
    1. Responsable valida → POST /facturas/{id}/submit-responsable (→ CONTABILIDAD)
    2. Contabilidad audita → POST /facturas/{id}/submit-tesoreria (→ TESORERIA)
    3. Tesorería sube archivos:
       - POST /facturas/{id}/files/upload (doc_type: PEC)
       - POST /facturas/{id}/files/upload (doc_type: EC)
       - POST /facturas/{id}/files/upload (doc_type: PCE)
    4. Tesorería cierra → POST /facturas/{id}/close-tesoreria (→ FINALIZADA)
    
    **Nota sobre archivos:**
    - Los doc_types PEC, EC, PCE solo aceptan archivos PDF
    - Extensión permitida: .pdf
    - Content-Type: application/pdf
    """
    return await service.close_tesoreria(factura_id)


@router.post(
    "/{factura_id}/devolver-a-responsable",
    response_model=DevolverAResponsableOut,
    status_code=status.HTTP_200_OK
)
async def devolver_a_responsable(
    factura_id: UUID,
    data: DevolverAResponsableIn,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Devuelve una factura de Contabilidad a Responsable.
    
    **Requisitos:**
    - La factura debe estar en estado "Contabilidad" (estado_id = 3)
    - El motivo debe tener al menos 10 caracteres
    
    **Efecto:**
    - Cambia el estado a "Asignada" (estado_id = 2) - vuelve a Responsable
    - Guarda el motivo de devolución
    
    **Uso:**
    - Contabilidad puede rechazar una factura y devolverla al Responsable del área
    - El responsable verá el motivo de devolución y podrá corregir
    """
    return await service.devolver_a_responsable(factura_id, data.motivo)


@router.post(
    "/{factura_id}/devolver-a-facturacion",
    response_model=DevolverAFacturacionOut,
    status_code=status.HTTP_200_OK
)
async def devolver_a_facturacion(
    factura_id: UUID,
    data: DevolverAFacturacionIn,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Devuelve una factura de Responsable a Facturación.
    
    **Requisitos:**
    - La factura debe estar en estado "Asignada" (Responsable, estado_id = 2)
    - El motivo debe tener al menos 10 caracteres
    
    **Efecto:**
    - Cambia el estado a "Recibida" (estado_id = 1) - vuelve a Facturación
    - Asigna la factura al usuario de Facturación (Marlin CQ)
    - Guarda el motivo de devolución
    
    **Uso:**
    - El Responsable puede rechazar una factura y devolverla a Facturación
    - Facturación verá el motivo de devolución y podrá corregir
    - La factura desaparece de la vista del Responsable
    """
    return await service.devolver_a_facturacion(factura_id, data.motivo)


@router.post(
    "/extraer-datos-pdf",
    response_model=ExtraccionFacturaPdfOut,
    summary="Extraer datos de factura pública desde PDF usando IA (Claude Sonnet)",
)
async def extraer_datos_factura_pdf(
    file: UploadFile = File(..., description="PDF de la factura electrónica colombiana"),
):
    """
    Recibe el PDF de una factura electrónica colombiana y usa Claude Sonnet para extraer
    automáticamente: proveedor, número de factura, fecha de emisión, fecha de vencimiento
    y valor total a pagar. Devuelve los campos con nivel de confianza.
    """
    import base64
    import json
    from anthropic import AsyncAnthropic
    from core.config import settings

    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="Servicio de IA no configurado. Contacte al administrador.",
        )

    content_type = file.content_type or ""
    if content_type != "application/pdf":
        raise HTTPException(
            status_code=422,
            detail="Solo se aceptan archivos PDF.",
        )

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="El PDF no puede superar 20 MB.")

    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    prompt = """Analiza este PDF de una factura electrónica colombiana (factura pública emitida a Café Quindío) y extrae los campos solicitados en formato JSON.
Si un campo no está presente o no puedes determinarlo con certeza, usa null.
Devuelve ÚNICAMENTE el objeto JSON, sin texto adicional, sin markdown, sin bloques de código.

CONTEXTO: La factura fue emitida por un PROVEEDOR externo a la empresa Café Quindío (NIT 900273380).
Debes extraer datos del EMISOR/PROVEEDOR (quien cobra), NUNCA de Café Quindío (quien paga).

CAMPOS A EXTRAER:

1. proveedor
   - Razón social completa del EMISOR (encabezado del documento, junto a su NIT).
   - Ejemplos: "CLARO S.A.", "EPM TELECOMUNICACIONES S.A. ESP", "SEGUROS BOLÍVAR S.A."
   - NUNCA uses "Café Quindío", "CAFE QUINDIO" ni variantes.

2. numero_factura
   - Número completo de la factura electrónica, incluyendo prefijo alfanumérico.
   - Puede aparecer como "Factura de Venta No.", "Factura Electrónica No.", "No. de Factura", etc.
   - Ejemplos: "FE-001234", "SETP990012345", "FAC-2025-0089", "FEV-00001".

3. fecha_emision
   - Fecha de expedición/emisión en formato YYYY-MM-DD.
   - Etiquetada como "Fecha de emisión", "Fecha factura", "Fecha de expedición", etc.

4. fecha_vencimiento
   - Fecha límite de pago en formato YYYY-MM-DD.
   - Etiquetada como "Fecha de vencimiento", "Fecha límite de pago", "Vence", etc.
   - Si no aparece explícitamente, usa null.

5. total
   - Valor total a pagar en pesos colombianos (COP), solo dígitos sin puntos ni comas ni símbolo $.
   - Corresponde a "Total a pagar", "Valor total", "Gran total", "Total factura".
   - Si hay descuentos e IVA ya incluidos, toma el monto final neto.
   - Ejemplo: si el PDF dice "$1.250.000" → devuelve "1250000".

6. confianza
   - "alta"  → se detectaron 4 o 5 campos correctamente
   - "media" → se detectaron 2 o 3 campos
   - "baja"  → se detectó 0 o 1 campo

7. campos_detectados
   - Lista con los nombres de los campos que encontraste (excluyendo los que son null).
   - Ejemplo: ["proveedor","numero_factura","fecha_emision","total"]

Respuesta esperada (ejemplo):
{"proveedor":"CLARO S.A.","numero_factura":"FE-2025-001234","fecha_emision":"2025-03-15","fecha_vencimiento":"2025-04-14","total":"3450000","confianza":"alta","campos_detectados":["proveedor","numero_factura","fecha_emision","fecha_vencimiento","total"]}"""

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()
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
            detail="La IA no pudo interpretar el PDF. Verifica que sea una factura electrónica válida.",
        )

    return ExtraccionFacturaPdfOut(
        proveedor=datos.get("proveedor"),
        numero_factura=datos.get("numero_factura"),
        fecha_emision=datos.get("fecha_emision"),
        fecha_vencimiento=datos.get("fecha_vencimiento"),
        total=str(datos["total"]) if datos.get("total") else None,
        confianza=datos.get("confianza", "baja"),
        campos_detectados=datos.get("campos_detectados", []),
    )


# =============================================================================
# APROBACIÓN POR CORREO ELECTRÓNICO
# =============================================================================

# =============================================================================
# INGESTA AUTOMÁTICA XML (N8N → backend)
# =============================================================================

@router.post(
    "/ingesta-xml",
    response_model=IngestaXMLResultOut,
    summary="Ingestar factura electrónica desde XML DIAN (llamado por N8N)",
)
async def ingesta_xml(
    payload: IngestaXMLIn,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    """
    Recibe el XML AttachedDocument de una factura electrónica DIAN enviado por N8N.
    - Parsea el XML y extrae todos los campos.
    - Intenta asignar el área automáticamente por texto (ciudad, descripción).
    - Si no hay match claro, llama a Claude para razonar la asignación.
    - Si Claude tampoco puede determinarlo, la factura queda sin área (buzón).
    - Retorna el resultado para que N8N pueda registrarlo.
    """
    import json
    from sqlalchemy import select, func
    from anthropic import AsyncAnthropic
    from core.config import settings
    from core.xml_parser import parse_xml_dian, FacturaDIAN
    from db.models import Factura, Area, Estado

    # 1. Parsear XML
    try:
        datos: FacturaDIAN = parse_xml_dian(payload.xml_content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"XML inválido: {e}")

    if datos.total is None or datos.total <= 0:
        raise HTTPException(
            status_code=422,
            detail=f"No se pudo extraer el total de la factura '{datos.numero_factura}'.",
        )

    # 2. Verificar duplicado por numero_factura (el proveedor puede venir con nombre
    #    distinto entre el flujo XML y el flujo de correos PDF, por eso no se usa)
    dup = await db.execute(
        select(Factura).where(
            Factura.numero_factura == datos.numero_factura,
        )
    )
    existing = dup.scalar_one_or_none()
    if existing:
        # Si es duplicado de un NIT conocido pero sin área asignada aún,
        # intentar asignar usando la tabla NIT
        if existing.ai_area_confianza is None:
            from core.nit_responsable import get_responsables_por_nit as _grpn
            responsables_dup = _grpn(existing.nit_proveedor or "")
            if responsables_dup:
                areas_dup = (await db.execute(select(Area))).scalars().all()
                area_dup, conf_dup, razon_dup = _resolver_responsables_nit(
                    responsables_dup, areas_dup, datos.ciudad_receptor, datos.direccion_receptor
                )
                existing.area_id = area_dup.id if area_dup else existing.area_id
                existing.ai_area_confianza = conf_dup
                existing.ai_area_razonamiento = razon_dup
                existing.pendiente_confirmacion = conf_dup not in ("alta",)
            else:
                existing.ai_area_confianza = "nula"
                existing.pendiente_confirmacion = True
                existing.ai_area_razonamiento = "NIT no está en tabla de proveedores conocidos."
            await db.commit()
            await db.refresh(existing)

        # Guardar PDF si N8N lo envió y la factura aún no tiene uno
        if payload.pdf_base64:
            await _guardar_pdf_ingesta(
                db, existing.id,
                payload.pdf_base64,
                payload.pdf_filename or f"{existing.numero_factura}.pdf",
            )

        area_nombre = existing.area.nombre if existing.area else None
        return IngestaXMLResultOut(
            factura_id=existing.id,
            numero_factura=existing.numero_factura,
            proveedor=existing.proveedor,
            nit_proveedor=existing.nit_proveedor,
            total=float(existing.total),
            fecha_emision=existing.fecha_emision,
            area_id=existing.area_id,
            area_nombre=area_nombre,
            ai_area_confianza=existing.ai_area_confianza or "nula",
            ai_area_razonamiento=existing.ai_area_razonamiento,
            pendiente_confirmacion=existing.pendiente_confirmacion,
            estado=_estado_label(existing),
            duplicado=True,
        )

    # 3. Cargar todas las áreas activas
    areas_result = await db.execute(select(Area))
    areas = areas_result.scalars().all()

    # 4. Resolver área por tabla de NITs conocidos
    from core.nit_responsable import get_responsables_por_nit

    area_asignada = None
    confianza = "nula"
    razonamiento = None

    responsables_nit = get_responsables_por_nit(datos.nit_proveedor or "")
    if responsables_nit:
        area_asignada, confianza, razonamiento = _resolver_responsables_nit(
            responsables_nit, areas, datos.ciudad_receptor, datos.direccion_receptor
        )
    # NITs no conocidos: confianza permanece "nula", area_id=None.
    # La factura no aparecerá en el buzón XML; se gestionará por Facturación.

    # 6. Determinar estado de confirmación
    pendiente = confianza not in ("alta",)

    # 7. Obtener estado_id RECIBIDA (id=1)
    estado_result = await db.execute(select(Estado).where(Estado.id == 1))
    estado_recibida = estado_result.scalar_one_or_none()
    if not estado_recibida:
        raise HTTPException(status_code=500, detail="Estado RECIBIDA (id=1) no encontrado en BD.")

    # 8. Crear la factura
    nueva = Factura(
        proveedor=datos.proveedor,
        nit_proveedor=datos.nit_proveedor,
        numero_factura=datos.numero_factura,
        fecha_emision=datos.fecha_emision,
        fecha_vencimiento=datos.fecha_vencimiento,
        total=datos.total,
        area_id=area_asignada.id if area_asignada else None,
        estado_id=estado_recibida.id,
        pendiente_confirmacion=pendiente,
        ai_area_confianza=confianza,
        ai_area_razonamiento=razonamiento,
    )
    db.add(nueva)
    await db.commit()
    await db.refresh(nueva)

    # Guardar PDF si N8N lo envió junto al XML
    if payload.pdf_base64:
        await _guardar_pdf_ingesta(
            db, nueva.id,
            payload.pdf_base64,
            payload.pdf_filename or f"{datos.numero_factura}.pdf",
        )

    return IngestaXMLResultOut(
        factura_id=nueva.id,
        numero_factura=nueva.numero_factura,
        proveedor=nueva.proveedor,
        nit_proveedor=nueva.nit_proveedor,
        total=float(nueva.total),
        fecha_emision=nueva.fecha_emision,
        area_id=nueva.area_id,
        area_nombre=area_asignada.nombre if area_asignada else None,
        ai_area_confianza=confianza,
        ai_area_razonamiento=razonamiento,
        pendiente_confirmacion=pendiente,
        estado=_estado_label(nueva),
        duplicado=False,
    )


def _estado_label(f: "Factura") -> str:
    if not f.area_id:
        return "sin_asignar"
    if f.pendiente_confirmacion:
        return "pendiente_confirmacion"
    return "auto_asignada"


# ---------------------------------------------------------------------------
# Helpers para resolución de área basada en tabla NIT
# ---------------------------------------------------------------------------

_KEYWORD_MATCHERS = {
    "cedi":           lambda n: "CEDI" in n,
    "marketing":      lambda n: "MARKETING" in n,
    "mantenimiento":  lambda n: "MANTENIMIENTO" in n,
    "compras":        lambda n: "COMPRA" in n,
    "comercial":      lambda n: "COMERCIAL" in n,
    "restaurante":    lambda n: "RESTAURANTE" in n or "RESTAURANT" in n,
}

_AREAS_GENERICAS = frozenset({
    "FACTURACION", "FACTURACIÓN", "CONTABILIDAD",
    "TESORERIA", "TESORERÍA", "ADMINISTRATIVO",
})


def _find_area_by_keyword(keyword: str, areas: list) -> "Any | None":
    """Busca el primer área cuyo nombre coincide con el keyword dado."""
    check = _KEYWORD_MATCHERS.get(keyword.lower())
    if not check:
        return None
    for a in areas:
        if check(a.nombre.upper()):
            return a
    return None


def _find_tienda_by_location(areas: list, ciudad: "str | None", direccion: "str | None") -> "Any | None":
    """
    Busca un área de tienda cuyo nombre contenga la ciudad/dirección del XML.
    Excluye áreas genéricas (contabilidad, tesorería, cedi, etc.).
    """
    ciudad_up = (ciudad or "").upper().strip()
    dir_up = (direccion or "").upper().strip()

    if not ciudad_up and not dir_up:
        return None

    candidatas = [
        a for a in areas
        if not any(g in a.nombre.upper() for g in _AREAS_GENERICAS)
        and not any(check(a.nombre.upper()) for check in _KEYWORD_MATCHERS.values())
    ]

    if ciudad_up:
        for a in candidatas:
            if ciudad_up in a.nombre.upper():
                return a

    if dir_up:
        palabras = [p for p in dir_up.split() if len(p) > 3]
        for a in candidatas:
            if any(p in a.nombre.upper() for p in palabras):
                return a

    return None


def _resolver_responsables_nit(
    responsables: list,
    areas: list,
    ciudad_receptor: "str | None",
    direccion_receptor: "str | None",
) -> tuple:
    """
    Dado el listado de keywords responsables para un NIT conocido, devuelve
    (area | None, confianza: str, razonamiento: str).

    - 1 keyword → intenta resolver directamente; confianza="alta" si se encuentra.
    - N keywords → intenta el más específico; confianza="media", pendiente=True.
    - "tiendas"  → usa ciudad/dirección del XML para identificar la tienda exacta.
    """
    opciones_str = " o ".join(r.capitalize() for r in responsables)

    if len(responsables) == 1:
        kw = responsables[0]
        if kw == "tiendas":
            tienda = _find_tienda_by_location(areas, ciudad_receptor, direccion_receptor)
            if tienda:
                return (tienda, "alta",
                        f"NIT conocido → Tienda identificada: {tienda.nombre} "
                        f"(ciudad receptor: {ciudad_receptor or 'N/A'}).")
            return (None, "baja",
                    f"NIT conocido → Responsable: Tiendas, pero no se identificó la tienda "
                    f"para la ciudad '{ciudad_receptor or 'N/A'}'. Requiere asignación manual.")
        area = _find_area_by_keyword(kw, areas)
        if area:
            return (area, "alta", f"NIT conocido → Área responsable: {area.nombre}.")
        return (None, "baja",
                f"NIT conocido → Responsable '{kw}', pero no se encontró el área en el sistema.")

    # Múltiples opciones → siempre pendiente
    best_area = None

    # Prioridad: tiendas (más específico cuando hay ciudad)
    if "tiendas" in responsables:
        tienda = _find_tienda_by_location(areas, ciudad_receptor, direccion_receptor)
        if tienda:
            best_area = tienda
            return (best_area, "media",
                    f"NIT conocido → Múltiples responsables ({opciones_str}). "
                    f"Tienda identificada: {tienda.nombre}. Requiere confirmación.")

    # Fallback: primer keyword no-tiendas que exista en el sistema
    for kw in responsables:
        if kw == "tiendas":
            continue
        area = _find_area_by_keyword(kw, areas)
        if area:
            best_area = area
            return (best_area, "media",
                    f"NIT conocido → Múltiples responsables ({opciones_str}). "
                    f"Asignado preliminarmente a {area.nombre}. Requiere confirmación.")

    return (None, "baja",
            f"NIT conocido → Múltiples responsables ({opciones_str}), "
            "ningún área encontrada en el sistema. Requiere asignación manual.")


async def _guardar_pdf_ingesta(
    db: "AsyncSession",
    factura_id: "uuid.UUID",
    pdf_base64: str,
    pdf_filename: str,
) -> None:
    """Guarda el PDF enviado por N8N como FacturaArchivo(doc_type='FACTURA_PDF').
    Si ya existe un PDF para esta factura, no hace nada (idempotente).
    """
    import base64
    import io
    import asyncio
    import uuid
    from datetime import datetime, timezone
    from pathlib import Path
    from sqlalchemy import select
    from db.models import FacturaArchivo
    from core.config import settings

    # Idempotente: si ya existe FACTURA_PDF no crear otro
    existing = await db.execute(
        select(FacturaArchivo).where(
            FacturaArchivo.factura_id == factura_id,
            FacturaArchivo.doc_type == "FACTURA_PDF",
        )
    )
    if existing.scalar_one_or_none():
        return

    try:
        pdf_bytes = base64.b64decode(pdf_base64)
    except Exception:
        return  # base64 inválido, ignorar

    safe_name = pdf_filename if pdf_filename else f"{factura_id}.pdf"
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    new_filename = f"{timestamp}_{safe_name}"

    use_s3 = bool(settings.aws_access_key_id and settings.s3_bucket)

    if use_s3:
        from core.s3_service import s3_service
        s3_key = f"dev/facturas/{factura_id}/FACTURA_PDF/{new_filename}"
        await asyncio.to_thread(
            s3_service.upload_fileobj,
            io.BytesIO(pdf_bytes),
            s3_key,
            "application/pdf",
        )
        archivo = FacturaArchivo(
            factura_id=factura_id,
            doc_type="FACTURA_PDF",
            storage_provider="s3",
            storage_path=s3_key,
            filename=new_filename,
            content_type="application/pdf",
            size_bytes=len(pdf_bytes),
        )
    else:
        base_path = Path("storage/facturas") / str(factura_id) / "FACTURA_PDF"
        base_path.mkdir(parents=True, exist_ok=True)
        file_path = base_path / new_filename
        file_path.write_bytes(pdf_bytes)
        archivo = FacturaArchivo(
            factura_id=factura_id,
            doc_type="FACTURA_PDF",
            storage_provider="local",
            storage_path=str(file_path),
            filename=new_filename,
            content_type="application/pdf",
            size_bytes=len(pdf_bytes),
        )

    db.add(archivo)
    await db.commit()


@router.post(
    "/{factura_id}/confirmar-ingesta",
    summary="Confirmar o reasignar área de factura pendiente de buzón XML",
)
async def confirmar_ingesta(
    factura_id: UUID,
    area_id: UUID = Query(..., description="UUID del área a asignar"),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """
    El radicador confirma (o corrige) el área asignada automáticamente.
    Marca pendiente_confirmacion=False para que la factura fluya normalmente.
    """
    from sqlalchemy import select
    from db.models import Factura, Area

    result = await db.execute(select(Factura).where(Factura.id == factura_id))
    factura = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada.")

    area_result = await db.execute(select(Area).where(Area.id == area_id))
    area = area_result.scalar_one_or_none()
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")

    factura.area_id = area_id
    factura.pendiente_confirmacion = False
    await db.commit()

    return {"factura_id": factura_id, "area_asignada": area.nombre, "confirmada": True}


@router.post(
    "/{factura_id}/enviar-correo-aprobacion",
    summary="Enviar correo de aprobación a un gerente seleccionado",
)
async def enviar_correo_aprobacion(
    factura_id: UUID,
    data: EnviarCorreoAprobacionIn,
    service: FacturaService = Depends(get_factura_service),
    _: dict = Depends(get_current_user),
):
    """
    Genera un token de aprobación (válido 72 h) y envía un correo HTML al gerente
    seleccionado con un botón para aprobar la factura sin necesidad de login.
    """
    return await service.enviar_correo_aprobacion(factura_id, data.aprobador_id, data.comentario)




