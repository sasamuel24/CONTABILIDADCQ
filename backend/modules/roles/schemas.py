"""
Schemas de Pydantic para roles.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class RoleBase(BaseModel):
    """Schema base de rol."""
    code: str = Field(..., min_length=2, max_length=50, description="Código único del rol")
    nombre: str = Field(..., min_length=3, max_length=100, description="Nombre descriptivo del rol")
    descripcion: Optional[str] = Field(None, description="Descripción del rol")


class RoleCreate(RoleBase):
    """Schema para crear un rol."""
    pass


class RoleUpdate(BaseModel):
    """Schema para actualizar un rol."""
    nombre: Optional[str] = Field(None, min_length=3, max_length=100)
    descripcion: Optional[str] = None
    is_active: Optional[bool] = None


class RoleResponse(RoleBase):
    """Schema de respuesta de rol."""
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class RolesListResponse(BaseModel):
    """Schema de respuesta con lista de roles."""
    roles: List[RoleResponse] = Field(..., description="Lista de roles disponibles")
    total: int = Field(..., description="Total de roles")

