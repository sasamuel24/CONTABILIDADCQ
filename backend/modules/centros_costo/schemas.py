"""
Esquemas Pydantic para el módulo de centros de costo.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Optional


class CentroCostoBase(BaseModel):
    codigo: str = Field(..., min_length=1, max_length=10)
    nombre: str = Field(..., min_length=1, max_length=255)
    activo: bool = Field(default=True)


class CentroCostoCreate(CentroCostoBase):
    pass


class CentroCostoUpdate(BaseModel):
    codigo: Optional[str] = Field(None, min_length=1, max_length=10)
    nombre: Optional[str] = Field(None, min_length=1, max_length=255)
    activo: Optional[bool] = None


class CentroCostoResponse(CentroCostoBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
