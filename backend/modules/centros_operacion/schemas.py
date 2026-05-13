"""
Esquemas Pydantic para el módulo de centros de operación.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Optional


class CentroOperacionBase(BaseModel):
    """Schema base para Centro de Operación."""
    codigo: str = Field(..., min_length=1, max_length=10, description="Código del centro de operación")
    nombre: str = Field(..., min_length=1, max_length=255, description="Nombre del centro de operación")
    activo: bool = Field(default=True, description="Indica si el centro de operación está activo")


class CentroOperacionCreate(CentroOperacionBase):
    """Schema para crear un centro de operación."""
    pass


class CentroOperacionUpdate(BaseModel):
    """Schema para actualizar un centro de operación."""
    codigo: Optional[str] = Field(None, min_length=1, max_length=10)
    nombre: Optional[str] = Field(None, min_length=1, max_length=255)
    activo: Optional[bool] = None


class CentroOperacionResponse(CentroOperacionBase):
    """Schema de respuesta para centro de operación."""
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
