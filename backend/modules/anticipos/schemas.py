"""Esquemas Pydantic para el módulo de anticipos."""
from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional, List


class UserBrief(BaseModel):
    id: UUID
    nombre: str
    email: str
    model_config = {"from_attributes": True}


class PaqueteBrief(BaseModel):
    id: UUID
    folio: Optional[str] = None
    semana: str
    estado: str
    monto_total: Decimal
    monto_a_pagar: Optional[Decimal] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class AnticipioCreate(BaseModel):
    assigned_to_user_id: UUID
    monto: Decimal = Field(..., gt=0)
    descripcion: Optional[str] = Field(None, max_length=500)
    semana: str = Field(..., pattern=r"^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$",
                        description="Semana ISO del paquete inicial, ej: 2026-W09")


class AnticipioOut(BaseModel):
    id: UUID
    folio: str
    creado_por: UserBrief
    asignado_a: UserBrief
    monto: Decimal
    descripcion: Optional[str] = None
    estado: str
    paquetes: List[PaqueteBrief] = []
    monto_legalizado: Decimal = Decimal("0")
    diferencia: Decimal = Decimal("0")
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AnticipioListItem(BaseModel):
    id: UUID
    folio: str
    asignado_a: UserBrief
    monto: Decimal
    descripcion: Optional[str] = None
    estado: str
    total_paquetes: int = 0
    monto_legalizado: Decimal = Decimal("0")
    diferencia: Decimal = Decimal("0")
    created_at: datetime
    model_config = {"from_attributes": True}


class AnticipioListResponse(BaseModel):
    anticipos: List[AnticipioListItem]
    total: int
