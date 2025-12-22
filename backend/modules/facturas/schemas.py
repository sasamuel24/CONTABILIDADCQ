"""
Esquemas Pydantic para el módulo de facturas.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class FacturaBase(BaseModel):
    """Esquema base para facturas."""
    numero_factura: str = Field(..., description="Número de factura")
    proveedor: str = Field(..., description="Nombre del proveedor")
    monto: float = Field(..., gt=0, description="Monto de la factura")
    fecha_emision: datetime = Field(..., description="Fecha de emisión")
    area_id: Optional[int] = Field(None, description="ID del área asignada")
    estado: str = Field(default="pendiente", description="Estado de la factura")


class FacturaCreate(FacturaBase):
    """Esquema para crear una factura."""
    pass


class FacturaUpdate(BaseModel):
    """Esquema para actualizar una factura."""
    area_id: Optional[int] = None
    estado: Optional[str] = None


class FacturaResponse(FacturaBase):
    """Esquema de respuesta para facturas."""
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}
