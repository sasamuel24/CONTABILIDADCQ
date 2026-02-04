"""
Esquemas Pydantic para el módulo de comentarios de facturas.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class ComentarioBase(BaseModel):
    """Esquema base para comentarios."""
    contenido: str = Field(..., min_length=1, max_length=5000, description="Contenido del comentario")


class ComentarioCreate(ComentarioBase):
    """Esquema para crear un comentario."""
    pass


class ComentarioUpdate(BaseModel):
    """Esquema para actualizar un comentario."""
    contenido: str = Field(..., min_length=1, max_length=5000, description="Contenido actualizado del comentario")


class UserInfo(BaseModel):
    """Información del usuario que creó el comentario."""
    id: UUID
    email: str
    nombre: str
    
    model_config = {"from_attributes": True}


class ComentarioOut(BaseModel):
    """Esquema de salida para comentarios."""
    id: UUID
    factura_id: UUID
    user_id: UUID
    user: UserInfo
    contenido: str
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class ComentarioListResponse(BaseModel):
    """Respuesta con lista de comentarios."""
    comentarios: list[ComentarioOut]
    total: int
