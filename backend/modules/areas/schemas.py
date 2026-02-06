"""
Esquemas Pydantic para el módulo de áreas.
"""
from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class AreaResponse(BaseModel):
    """Esquema de respuesta para áreas."""
    id: UUID
    code: str
    nombre: str
    
    model_config = {"from_attributes": True}


class AreaCreate(BaseModel):
    """Esquema para crear un área nueva."""
    code: str
    nombre: str


class AreaUpdate(BaseModel):
    """Esquema para actualizar un área. Campos opcionales."""
    code: Optional[str] = None
    nombre: Optional[str] = None

    model_config = {"from_attributes": True}
