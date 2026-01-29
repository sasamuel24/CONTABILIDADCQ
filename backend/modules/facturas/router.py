"""
Router de FastAPI para el módulo de facturas.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
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
    AsignarCarpetaResponse
)
from core.auth import require_api_key


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
    estado: Optional[str] = Query(None, description="Filtrar por estado de la factura"),
    service: FacturaService = Depends(get_factura_service)
):
    """Lista todas las facturas con paginación y filtros opcionales."""
    return await service.list_facturas(skip=skip, limit=limit, area_id=area_id, estado=estado)


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


