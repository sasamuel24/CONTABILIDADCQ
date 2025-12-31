"""
Esquemas Pydantic para el módulo de estados.
"""
from pydantic import BaseModel, Field
from typing import Optional


class EstadoCreate(BaseModel):
    """Esquema para crear un nuevo estado."""
    code: str = Field(..., min_length=1, max_length=50, description="Código único del estado")
    label: str = Field(..., min_length=1, max_length=100, description="Etiqueta descriptiva del estado")
    order: int = Field(..., ge=1, description="Orden de visualización")
    is_final: bool = Field(default=False, description="Si es un estado final")
    is_active: bool = Field(default=True, description="Si el estado está activo")


class EstadoResponse(BaseModel):
    """Esquema de respuesta para estados."""
    id: int
    code: str
    label: str
    order: int
    is_final: bool
    is_active: bool
    
    model_config = {"from_attributes": True}
