"""
Esquemas Pydantic para el módulo de cuentas auxiliares.
"""
from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime


class CuentaAuxiliarBase(BaseModel):
    """Esquema base para cuentas auxiliares."""
    codigo: str
    descripcion: str
    activa: bool = True


class CuentaAuxiliarCreate(BaseModel):
    """Esquema para crear una cuenta auxiliar nueva."""
    codigo: str
    descripcion: str
    activa: bool = True


class CuentaAuxiliarUpdate(BaseModel):
    """Esquema para actualizar una cuenta auxiliar existente."""
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    activa: Optional[bool] = None


class CuentaAuxiliarResponse(BaseModel):
    """Esquema de respuesta para cuentas auxiliares."""
    id: UUID
    codigo: str
    descripcion: str
    activa: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class CuentaAuxiliarList(BaseModel):
    """Esquema simplificado para listados."""
    id: UUID
    codigo: str
    descripcion: str
    activa: bool
    
    model_config = {"from_attributes": True}
