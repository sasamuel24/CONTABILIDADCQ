"""
Esquemas Pydantic para el módulo de carpetas de tesorería.
"""
from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from datetime import datetime


class CarpetaTesoreriaBase(BaseModel):
    """Esquema base para carpetas de tesorería."""
    nombre: str
    parent_id: Optional[UUID] = None


class CarpetaTesoreriaCreate(BaseModel):
    """Esquema para crear una carpeta de tesorería nueva."""
    nombre: str
    parent_id: Optional[UUID] = None


class CarpetaTesoreriaUpdate(BaseModel):
    """Esquema para actualizar una carpeta de tesorería existente."""
    nombre: Optional[str] = None
    parent_id: Optional[UUID] = None
    factura_id: Optional[UUID] = None


class CarpetaTesoreriaSimple(BaseModel):
    """Esquema simple sin relaciones anidadas."""
    id: UUID
    nombre: str
    parent_id: Optional[UUID] = None
    factura_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class FacturaEnCarpetaTesoreria(BaseModel):
    """Esquema simple de factura en carpeta de tesorería."""
    id: UUID
    numero_factura: str
    proveedor: str
    total: float
    carpeta_nombre: Optional[str] = None
    
    model_config = {"from_attributes": True}


class CarpetaTesoreriaResponse(BaseModel):
    """Esquema de respuesta para carpetas de tesorería con relaciones."""
    id: UUID
    nombre: str
    parent_id: Optional[UUID] = None
    factura_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    parent: Optional["CarpetaTesoreriaSimple"] = None
    children: List["CarpetaTesoreriaResponse"] = []
    facturas: List[FacturaEnCarpetaTesoreria] = []
    
    model_config = {"from_attributes": True}


class CarpetaTesoreriaWithChildren(BaseModel):
    """Esquema de respuesta para carpetas de tesorería con hijos anidados."""
    id: UUID
    nombre: str
    parent_id: Optional[UUID] = None
    factura_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    children: List["CarpetaTesoreriaWithChildren"] = []
    facturas: List[FacturaEnCarpetaTesoreria] = []
    
    model_config = {"from_attributes": True}
