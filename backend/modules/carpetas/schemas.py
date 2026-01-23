"""
Esquemas Pydantic para el módulo de carpetas.
"""
from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from datetime import datetime


class CarpetaBase(BaseModel):
    """Esquema base para carpetas."""
    nombre: str
    parent_id: Optional[UUID] = None


class CarpetaCreate(BaseModel):
    """Esquema para crear una carpeta nueva."""
    nombre: str
    parent_id: Optional[UUID] = None


class CarpetaUpdate(BaseModel):
    """Esquema para actualizar una carpeta existente."""
    nombre: Optional[str] = None
    parent_id: Optional[UUID] = None
    factura_id: Optional[UUID] = None


class CarpetaSimple(BaseModel):
    """Esquema simple sin relaciones anidadas."""
    id: UUID
    nombre: str
    parent_id: Optional[UUID] = None
    factura_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class FacturaEnCarpeta(BaseModel):
    """Esquema simple de factura en carpeta."""
    id: UUID
    numero_factura: str
    proveedor: str
    total: float
    carpeta_nombre: Optional[str] = None
    
    model_config = {"from_attributes": True}


class CarpetaResponse(BaseModel):
    """Esquema de respuesta para carpetas con relaciones."""
    id: UUID
    nombre: str
    parent_id: Optional[UUID] = None
    factura_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    parent: Optional["CarpetaSimple"] = None
    children: List["CarpetaResponse"] = []
    facturas: List[FacturaEnCarpeta] = []
    
    model_config = {"from_attributes": True}


class CarpetaWithChildren(BaseModel):
    """Esquema de respuesta para carpetas con hijos anidados."""
    id: UUID
    nombre: str
    parent_id: Optional[UUID] = None
    factura_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    children: List["CarpetaWithChildren"] = []
    facturas: List[FacturaEnCarpeta] = []
    
    model_config = {"from_attributes": True}
