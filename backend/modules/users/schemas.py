"""
Esquemas Pydantic para el módulo de usuarios.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    """Esquema base de usuario."""
    nombre: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    role: str = Field(..., description="Rol del usuario: admin, responsable, contabilidad, tesoreria")
    area_id: Optional[UUID] = Field(None, description="ID del área asignada")


class UserCreate(UserBase):
    """Esquema para crear usuario."""
    password: str = Field(..., min_length=6, description="Contraseña del usuario")


class UserUpdate(BaseModel):
    """Esquema para actualizar usuario."""
    nombre: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    area_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class UserPasswordUpdate(BaseModel):
    """Esquema para actualizar contraseña."""
    current_password: str = Field(..., description="Contraseña actual")
    new_password: str = Field(..., min_length=6, description="Nueva contraseña")


class UserListItem(BaseModel):
    """Esquema para listar usuarios."""
    id: UUID
    nombre: str
    email: str
    role: str
    area: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}


class UserDetail(BaseModel):
    """Esquema detallado de usuario."""
    id: UUID
    nombre: str
    email: str
    role: str
    area_id: Optional[UUID] = None
    area: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = {"from_attributes": True}


class UsersPaginatedResponse(BaseModel):
    """Respuesta paginada de usuarios."""
    items: list[UserListItem]
    total: int
    page: int
    per_page: int
