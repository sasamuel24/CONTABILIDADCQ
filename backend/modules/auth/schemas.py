"""
Esquemas Pydantic para el módulo de autenticación.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID


class LoginRequest(BaseModel):
    """Esquema para login."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Respuesta de tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Esquema para refresh token."""
    refresh_token: str


class RefreshResponse(BaseModel):
    """Respuesta de refresh (puede incluir nuevo refresh_token)."""
    access_token: str
    refresh_token: Optional[str] = None


class LogoutRequest(BaseModel):
    """Esquema para logout."""
    refresh_token: str


class AreaInfo(BaseModel):
    """Información básica de área."""
    id: UUID
    code: str
    nombre: str
    
    model_config = {"from_attributes": True}


class UserMeResponse(BaseModel):
    """Respuesta de información del usuario autenticado."""
    id: UUID
    nombre: str
    email: str
    role: str
    must_change_password: bool
    area: Optional[AreaInfo] = None
    
    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    """Request para cambiar contraseña."""
    current_password: str
    new_password: str
