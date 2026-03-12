"""Esquemas Pydantic para el módulo de gastos / legalización."""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from typing import Optional, List


# ---------------------------------------------------------------------------
# Shared small schemas
# ---------------------------------------------------------------------------

class UserBrief(BaseModel):
    id: UUID
    nombre: str
    email: str
    model_config = {"from_attributes": True}


class AreaBrief(BaseModel):
    id: UUID
    nombre: str
    model_config = {"from_attributes": True}


class CentroCostoBrief(BaseModel):
    id: UUID
    nombre: str
    model_config = {"from_attributes": True}


class CentroOperacionBrief(BaseModel):
    id: UUID
    nombre: str
    model_config = {"from_attributes": True}


class CuentaAuxiliarBrief(BaseModel):
    id: UUID
    codigo: str
    descripcion: str
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# ArchivoGasto
# ---------------------------------------------------------------------------

class ArchivoGastoOut(BaseModel):
    id: UUID
    gasto_id: UUID
    paquete_id: UUID
    filename: str
    s3_key: str
    categoria: str
    content_type: str
    size_bytes: int
    download_url: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# GastoLegalizacion
# ---------------------------------------------------------------------------

class GastoCreate(BaseModel):
    fecha: date
    no_identificacion: str = Field(..., max_length=30)
    pagado_a: str = Field(..., max_length=200)
    concepto: str = Field(..., max_length=300)
    no_recibo: Optional[str] = Field(None, max_length=100)
    centro_costo_id: Optional[UUID] = None
    centro_operacion_id: Optional[UUID] = None
    cuenta_auxiliar_id: Optional[UUID] = None
    valor_pagado: Decimal = Field(..., gt=0)
    orden: int = Field(0, ge=0)


class GastoUpdate(BaseModel):
    fecha: Optional[date] = None
    no_identificacion: Optional[str] = Field(None, max_length=30)
    pagado_a: Optional[str] = Field(None, max_length=200)
    concepto: Optional[str] = Field(None, max_length=300)
    no_recibo: Optional[str] = Field(None, max_length=100)
    centro_costo_id: Optional[UUID] = None
    centro_operacion_id: Optional[UUID] = None
    cuenta_auxiliar_id: Optional[UUID] = None
    valor_pagado: Optional[Decimal] = Field(None, gt=0)
    orden: Optional[int] = Field(None, ge=0)


class GastoOut(BaseModel):
    id: UUID
    paquete_id: UUID
    fecha: date
    no_identificacion: str
    pagado_a: str
    concepto: str
    no_recibo: Optional[str]
    centro_costo_id: Optional[UUID]
    centro_operacion_id: Optional[UUID]
    cuenta_auxiliar_id: Optional[UUID]
    centro_costo: Optional[CentroCostoBrief]
    centro_operacion: Optional[CentroOperacionBrief]
    cuenta_auxiliar: Optional[CuentaAuxiliarBrief]
    valor_pagado: Decimal
    orden: int
    estado_gasto: str = "pendiente"
    motivo_devolucion_gasto: Optional[str] = None
    archivos: List[ArchivoGastoOut] = []
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class GastoDevolverRequest(BaseModel):
    motivo: str


# ---------------------------------------------------------------------------
# ComentarioPaquete
# ---------------------------------------------------------------------------

class ComentarioPaqueteOut(BaseModel):
    id: UUID
    paquete_id: UUID
    user: Optional[UserBrief]
    texto: str
    tipo: str
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# HistorialEstadoPaquete
# ---------------------------------------------------------------------------

class HistorialEstadoOut(BaseModel):
    id: UUID
    estado_anterior: Optional[str]
    estado_nuevo: str
    user: Optional[UserBrief]
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# PaqueteGasto
# ---------------------------------------------------------------------------

ESTADOS_VALIDOS = {"borrador", "en_revision", "devuelto", "aprobado", "en_tesoreria", "pagado"}


class PaqueteCreate(BaseModel):
    semana: str = Field(..., pattern=r"^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$",
                        description="Semana ISO, ej: 2026-W09")


class PaqueteDevolver(BaseModel):
    motivo: str = Field(..., min_length=5, max_length=2000)


class PaqueteOut(BaseModel):
    id: UUID
    folio: Optional[str] = None
    semana: str
    fecha_inicio: date
    fecha_fin: date
    estado: str
    monto_total: Decimal
    monto_a_pagar: Optional[Decimal] = None
    total_documentos: int
    fecha_envio: Optional[datetime]
    fecha_aprobacion: Optional[datetime]
    fecha_pago: Optional[datetime]
    tecnico: UserBrief
    area: AreaBrief
    revisado_por: Optional[UserBrief]
    gastos: List[GastoOut] = []
    comentarios: List[ComentarioPaqueteOut] = []
    historial_estados: List[HistorialEstadoOut] = []
    created_at: datetime
    updated_at: datetime
    aprobacion_gerencia_filename: Optional[str] = None
    aprobacion_gerencia_s3_key: Optional[str] = None
    model_config = {"from_attributes": True}


class PaqueteListItem(BaseModel):
    id: UUID
    folio: Optional[str] = None
    semana: str
    fecha_inicio: date
    fecha_fin: date
    estado: str
    monto_total: Decimal
    total_documentos: int
    fecha_envio: Optional[datetime]
    comentario_devolucion: Optional[str] = None
    tiene_gastos_devueltos: bool = False
    tecnico: Optional[UserBrief] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class PaqueteListResponse(BaseModel):
    paquetes: List[PaqueteListItem]
    total: int
