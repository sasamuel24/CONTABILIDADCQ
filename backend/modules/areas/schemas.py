"""
Esquemas Pydantic para el módulo de áreas.
"""
from pydantic import BaseModel
from uuid import UUID


class AreaResponse(BaseModel):
    """Esquema de respuesta para áreas."""
    id: UUID
    nombre: str
    
    model_config = {"from_attributes": True}
