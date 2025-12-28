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
    AnticipoOut
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
    service: FacturaService = Depends(get_factura_service)
):
    """Lista todas las facturas con paginación y filtros opcionales."""
    return await service.list_facturas(skip=skip, limit=limit, area_id=area_id)


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
