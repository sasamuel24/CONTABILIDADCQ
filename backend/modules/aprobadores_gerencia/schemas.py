from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional
from datetime import datetime


class AprobadorGerenciaCreate(BaseModel):
    nombre: str
    cargo: str
    email: EmailStr
    categoria: str = "general"  # 'general' | 'comercial'


class AprobadorGerenciaUpdate(BaseModel):
    nombre: Optional[str] = None
    cargo: Optional[str] = None
    email: Optional[EmailStr] = None
    categoria: Optional[str] = None


class AprobadorGerenciaOut(BaseModel):
    id: UUID
    nombre: str
    cargo: str
    email: str
    is_active: bool
    categoria: str
    created_at: datetime

    model_config = {"from_attributes": True}
