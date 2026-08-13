"""
Schemas Pydantic del módulo de causación Siesa FSP.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Mapeo por proveedor
# =============================================================================

class RetencionConfigIn(BaseModel):
    llave_retencion: str = Field(..., min_length=4, max_length=4)
    tasa: Decimal = Field(..., gt=0)
    clase_imp_base: str = Field("2", max_length=3)
    base_minima: Decimal = Field(Decimal("0"), ge=0)
    descripcion: Optional[str] = None


class RetencionConfigOut(RetencionConfigIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class ConfigProveedorIn(BaseModel):
    """Upsert del mapeo de datos de decisión de un proveedor (por NIT sin DV)."""
    sucursal: str = "001"
    tipo_proveedor: Optional[str] = Field(None, max_length=3)
    id_motivo: Optional[str] = Field(None, max_length=2)
    centro_costo_siesa: Optional[str] = Field(None, max_length=10)
    codigo_servicio: Optional[str] = Field(None, max_length=30)
    cond_pago: Optional[str] = Field(None, max_length=3)
    llave_impuesto: Optional[str] = Field(None, min_length=4, max_length=4)
    tasa_impuesto: Optional[Decimal] = None
    notas: Optional[str] = None
    retenciones: list[RetencionConfigIn] = []


class ConfigProveedorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    nit: str
    sucursal: str
    tipo_proveedor: Optional[str] = None
    id_motivo: Optional[str] = None
    centro_costo_siesa: Optional[str] = None
    codigo_servicio: Optional[str] = None
    cond_pago: Optional[str] = None
    llave_impuesto: Optional[str] = None
    tasa_impuesto: Optional[Decimal] = None
    notas: Optional[str] = None
    retenciones: list[RetencionConfigOut] = []


# =============================================================================
# Causación
# =============================================================================

class RenglonIn(BaseModel):
    codigo_servicio: str
    valor_bruto: Decimal = Field(..., gt=0)
    centro_costo: str
    motivo: str = Field(..., max_length=2)
    llave_impuesto: Optional[str] = None
    tasa_iva: Optional[Decimal] = None
    valor_iva: Decimal = Decimal("0")
    notas: str = ""
    detalle: str = ""


class RetencionIn(BaseModel):
    llave: str = Field(..., min_length=4, max_length=4)
    tasa: Decimal = Field(..., gt=0)
    clase_imp_base: str = "2"
    base_minima: Decimal = Decimal("0")


class CausarIn(BaseModel):
    """
    Datos de decisión confirmados por el usuario en el modal (precargados
    del mapeo por proveedor, ajustables antes de enviar).
    """
    sucursal_proveedor: str = "001"
    tipo_proveedor: str
    cond_pago: str
    prefijo_docto_proveedor: str
    numero_docto_proveedor: str
    fecha_emision: Optional[date] = None   # default: la de la factura
    notas: str = ""
    renglones: list[RenglonIn]
    # Retenciones según la parametrización de Café Quindío como agente
    # retenedor (precargadas del mapeo) — NUNCA copiadas a ciegas del XML.
    retenciones: list[RetencionIn] = []
    # Híbrido: persistir estos valores como default del proveedor
    guardar_como_default: bool = False


class CausacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    factura_id: UUID
    amarre: str
    estado: str
    numero_fsp: Optional[str] = None
    fecha_causacion: Optional[datetime] = None
    ambiente: str
    created_at: datetime


class CausarOut(BaseModel):
    causacion: CausacionOut
    mensaje: str


class VerificarOut(BaseModel):
    causacion: CausacionOut
    mensaje: str


# =============================================================================
# Preparación (prefill del modal)
# =============================================================================

class CuadreOut(BaseModel):
    cuadra: bool
    base_total: Decimal
    iva_total: Decimal
    retenciones_total: Decimal
    bruto: Decimal
    neto: Decimal
    total_factura: Decimal
    diferencia_bruto: Decimal
    diferencia_neto: Decimal


class RetencionXMLOut(BaseModel):
    """Retención declarada por el emisor en el XML — SOLO informativa."""
    esquema_id: Optional[str] = None
    esquema_nombre: Optional[str] = None
    porcentaje: Optional[float] = None
    base: Optional[float] = None
    valor: Optional[float] = None


class PrepararOut(BaseModel):
    factura_id: UUID
    proveedor: str
    nit_proveedor: Optional[str] = None
    nit_normalizado: Optional[str] = None
    numero_factura: str
    fecha_emision: Optional[date] = None
    total: Decimal
    base_gravable: Optional[Decimal] = None
    valor_iva: Optional[Decimal] = None
    # Informativas (del XML del emisor), para que Contabilidad compare
    retenciones_xml: list[RetencionXMLOut] = []
    # Prefill armado con factura + mapeo del proveedor (editable en el modal)
    prefill: Optional[CausarIn] = None
    config_proveedor: Optional[ConfigProveedorOut] = None
    problemas: list[str] = []
    cuadre: Optional[CuadreOut] = None
    causaciones: list[CausacionOut] = []
    puede_causar: bool = False
    habilitado: bool = False


class MaestrosOut(BaseModel):
    motivos: dict[str, str]
    centros_costo: dict[str, str]
    tipos_proveedor: dict[str, str]
    condiciones_pago: dict[str, int]
