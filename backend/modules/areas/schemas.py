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
    # Marca el área como tienda: alimenta la bandeja multi-tienda del rol
    # responsable_tiendas (filtro solo_tiendas sobre Area.es_tienda).
    es_tienda: bool = False

    model_config = {"from_attributes": True}


class AreaCreate(BaseModel):
    """Esquema para crear un área nueva."""
    code: str
    nombre: str
    es_tienda: bool = False


class AreaUpdate(BaseModel):
    """Esquema para actualizar un área. Campos opcionales."""
    code: Optional[str] = None
    nombre: Optional[str] = None
    es_tienda: Optional[bool] = None

    model_config = {"from_attributes": True}
