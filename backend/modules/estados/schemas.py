"""
Esquemas Pydantic para el módulo de estados.
"""
from pydantic import BaseModel


class EstadoResponse(BaseModel):
    """Esquema de respuesta para estados."""
    id: int
    code: str
    label: str
    order: int
    is_final: bool
    is_active: bool
    
    model_config = {"from_attributes": True}
