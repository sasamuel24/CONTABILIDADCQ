"""
Esquemas Pydantic para el módulo de centros de operación.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Optional


class CentroOperacionBase(BaseModel):
    """Schema base para Centro de Operación."""
    nombre: str = Field(..., min_length=1, max_length=255, description="Nombre del centro de operación")
    activo: bool = Field(default=True, description="Indica si el centro de operación está activo")


class CentroOperacionCreate(CentroOperacionBase):
    """Schema para crear un centro de operación."""
    centro_costo_id: UUID = Field(..., description="ID del centro de costo al que pertenece")


class CentroOperacionUpdate(BaseModel):
    """Schema para actualizar un centro de operación."""
    nombre: Optional[str] = Field(None, min_length=1, max_length=255, description="Nombre del centro de operación")
    activo: Optional[bool] = Field(None, description="Indica si el centro de operación está activo")
    centro_costo_id: Optional[UUID] = Field(None, description="ID del centro de costo")


class CentroOperacionResponse(CentroOperacionBase):
    """Schema de respuesta para centro de operación."""
    id: UUID
    centro_costo_id: UUID
    centro_costo_nombre: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}
