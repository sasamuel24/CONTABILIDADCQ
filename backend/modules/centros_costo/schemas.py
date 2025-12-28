"""
Esquemas Pydantic para el módulo de centros de costo.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Optional


class CentroCostoBase(BaseModel):
    """Schema base para Centro de Costo."""
    nombre: str = Field(..., min_length=1, max_length=255, description="Nombre del centro de costo")
    activo: bool = Field(default=True, description="Indica si el centro de costo está activo")


class CentroCostoCreate(CentroCostoBase):
    """Schema para crear un centro de costo."""
    pass


class CentroCostoUpdate(BaseModel):
    """Schema para actualizar un centro de costo."""
    nombre: Optional[str] = Field(None, min_length=1, max_length=255, description="Nombre del centro de costo")
    activo: Optional[bool] = Field(None, description="Indica si el centro de costo está activo")


class CentroCostoResponse(CentroCostoBase):
    """Schema de respuesta para centro de costo."""
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}
