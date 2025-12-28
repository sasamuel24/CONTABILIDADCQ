"""
Esquemas Pydantic para el módulo de facturas.
"""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from typing import Optional, Literal
from uuid import UUID
import re


class FacturaBase(BaseModel):
    """Esquema base para facturas."""
    proveedor: str = Field(..., description="Nombre del proveedor")
    numero_factura: str = Field(..., description="Número de factura")
    fecha_emision: Optional[date] = Field(None, description="Fecha de emisión")
    area_id: UUID = Field(..., description="ID del área asignada")
    total: float = Field(..., gt=0, description="Monto total de la factura")
    estado_id: int = Field(..., description="ID del estado")
    centro_costo_id: Optional[UUID] = Field(None, description="ID del centro de costo")
    centro_operacion_id: Optional[UUID] = Field(None, description="ID del centro de operación")


class FacturaCreate(BaseModel):
    """Esquema para crear una factura."""
    proveedor: str = Field(..., description="Nombre del proveedor")
    numero_factura: str = Field(..., description="Número de factura")
    fecha_emision: Optional[date] = Field(None, description="Fecha de emisión")
    total: float = Field(..., gt=0, description="Monto total de la factura")
    area_id: UUID = Field(
        default=UUID("498e9fdb-25f5-42f9-beb8-92564ab6bdf4"),
        description="ID del área asignada (por defecto: Facturación)"
    )
    estado_id: int = Field(
        default=1,
        description="ID del estado (por defecto: 1 - Recibida)"
    )
    centro_costo_id: Optional[UUID] = Field(None, description="ID del centro de costo")
    centro_operacion_id: Optional[UUID] = Field(None, description="ID del centro de operación")


class FacturaUpdate(BaseModel):
    """Esquema para actualizar una factura."""
    area_id: Optional[UUID] = None
    estado_id: Optional[int] = None
    assigned_to_user_id: Optional[UUID] = None
    centro_costo_id: Optional[UUID] = None
    centro_operacion_id: Optional[UUID] = None


class EstadoUpdateRequest(BaseModel):
    """Request para actualizar estado de factura."""
    estado_id: int = Field(..., description="ID del nuevo estado")


class EstadoUpdateResponse(BaseModel):
    """Response de actualización de estado."""
    id: UUID
    estado: str
    updated_at: datetime


class FacturaListItem(BaseModel):
    """Esquema resumido para listado de facturas."""
    id: UUID
    proveedor: str
    numero_factura: str
    fecha_emision: Optional[date]
    area: str
    total: float
    estado: str
    centro_costo: Optional[str] = None
    centro_operacion: Optional[str] = None
    
    model_config = {"from_attributes": True}


class FacturaResponse(FacturaBase):
    """Esquema de respuesta detallada para facturas."""
    id: UUID
    area: str
    estado: str
    assigned_to_user_id: Optional[UUID]
    assigned_at: Optional[datetime]
    centro_costo: Optional[str] = None
    centro_operacion: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class FacturasPaginatedResponse(BaseModel):
    """Respuesta paginada de facturas."""
    items: list[FacturaListItem]
    total: int
    page: int
    per_page: int


# ========== Schemas de Inventarios ==========

class InventarioCodigoIn(BaseModel):
    """Esquema para un código de inventario en el payload."""
    codigo: str = Field(..., description="Código de inventario (OCT, ECT, FPC, OCC, EDO)")
    valor: str = Field(..., description="Valor alfanumérico del código")
    
    @field_validator('codigo')
    @classmethod
    def validate_codigo(cls, v: str) -> str:
        """Valida que el código sea uno de los permitidos."""
        allowed = {'OCT', 'ECT', 'FPC', 'OCC', 'EDO'}
        if v.upper() not in allowed:
            raise ValueError(f"Código '{v}' no permitido. Debe ser uno de: {allowed}")
        return v.upper()
    
    @field_validator('valor')
    @classmethod
    def validate_valor(cls, v: str) -> str:
        """Valida que el valor no esté vacío y contenga solo caracteres permitidos."""
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("El valor no puede estar vacío")
        # Permitir alfanuméricos, espacios y guiones
        if not re.match(r'^[a-zA-Z0-9\s\-]+$', v_stripped):
            raise ValueError("El valor solo puede contener letras, números, espacios y guiones")
        return v_stripped


class InventariosPatchIn(BaseModel):
    """Esquema para actualizar inventarios de una factura."""
    requiere_entrada_inventarios: bool = Field(
        ..., 
        description="Indica si la factura requiere entrada a inventarios"
    )
    destino_inventarios: Optional[Literal["TIENDA", "ALMACEN"]] = Field(
        None,
        description="Destino de inventarios (obligatorio si requiere_entrada_inventarios=true)"
    )
    codigos: Optional[list[InventarioCodigoIn]] = Field(
        None,
        description="Lista de códigos de inventario (obligatorio si requiere_entrada_inventarios=true)"
    )


class InventarioCodigoOut(BaseModel):
    """Esquema de respuesta para un código de inventario."""
    codigo: str
    valor: str
    created_at: datetime
    
    model_config = {"from_attributes": True}


class InventariosOut(BaseModel):
    """Esquema de respuesta para inventarios de una factura."""
    factura_id: UUID
    requiere_entrada_inventarios: bool
    destino_inventarios: Optional[str]
    codigos: list[InventarioCodigoOut]
    
    model_config = {"from_attributes": True}
