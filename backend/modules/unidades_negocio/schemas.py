"""
Esquemas Pydantic para el módulo de unidades de negocio.
"""
from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime


class UnidadNegocioBase(BaseModel):
    """Esquema base para unidades de negocio."""
    codigo: str
    descripcion: str
    activa: bool = True


class UnidadNegocioCreate(BaseModel):
    """Esquema para crear una unidad de negocio nueva."""
    codigo: str
    descripcion: str
    activa: bool = True


class UnidadNegocioUpdate(BaseModel):
    """Esquema para actualizar una unidad de negocio existente."""
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    activa: Optional[bool] = None


class UnidadNegocioResponse(BaseModel):
    """Esquema de respuesta para unidades de negocio."""
    id: UUID
    codigo: str
    descripcion: str
    activa: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class UnidadNegocioList(BaseModel):
    """Esquema simplificado para listados."""
    id: UUID
    codigo: str
    descripcion: str
    activa: bool
    
    model_config = {"from_attributes": True}
