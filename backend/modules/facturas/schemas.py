"""
Esquemas Pydantic para el módulo de facturas.
"""
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional
from uuid import UUID


class FacturaBase(BaseModel):
    """Esquema base para facturas."""
    proveedor: str = Field(..., description="Nombre del proveedor")
    numero_factura: str = Field(..., description="Número de factura")
    fecha_emision: Optional[date] = Field(None, description="Fecha de emisión")
    area_id: UUID = Field(..., description="ID del área asignada")
    total: float = Field(..., gt=0, description="Monto total de la factura")
    estado_id: int = Field(..., description="ID del estado")


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


class FacturaUpdate(BaseModel):
    """Esquema para actualizar una factura."""
    area_id: Optional[UUID] = None
    estado_id: Optional[int] = None
    assigned_to_user_id: Optional[UUID] = None


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
    
    model_config = {"from_attributes": True}


class FacturaResponse(FacturaBase):
    """Esquema de respuesta detallada para facturas."""
    id: UUID
    area: str
    estado: str
    assigned_to_user_id: Optional[UUID]
    assigned_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class FacturasPaginatedResponse(BaseModel):
    """Respuesta paginada de facturas."""
    items: list[FacturaListItem]
    total: int
    page: int
    per_page: int
