"""
Esquemas Pydantic para el módulo de facturas.
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime, date
from typing import Optional, Literal, List
from uuid import UUID
import re
from enum import Enum
from modules.files.schemas import FileMiniOut


class FacturaBase(BaseModel):
    """Esquema base para facturas."""
    proveedor: str = Field(..., description="Nombre del proveedor")
    numero_factura: str = Field(..., description="Número de factura")
    fecha_emision: Optional[date] = Field(None, description="Fecha de emisión")
    fecha_vencimiento: Optional[date] = Field(None, description="Fecha de vencimiento")
    area_id: UUID = Field(..., description="ID del área asignada")
    total: float = Field(..., gt=0, description="Monto total de la factura")
    estado_id: int = Field(..., description="ID del estado")
    centro_costo_id: Optional[UUID] = Field(None, description="ID del centro de costo")
    centro_operacion_id: Optional[UUID] = Field(None, description="ID del centro de operación")


class FacturaCreate(BaseModel):
    """Esquema para crear una factura."""
    proveedor: str = Field(..., description="Nombre del proveedor")
    numero_factura: str = Field(..., description="Número de factura")
    fecha_emision: Optional[date] = Field(None, description="Fecha de emisión")
    fecha_vencimiento: Optional[date] = Field(None, description="Fecha de vencimiento")
    total: float = Field(..., gt=0, description="Monto total de la factura")
    area_id: UUID = Field(
        default=UUID("498e9fdb-25f5-42f9-beb8-92564ab6bdf4"),
        description="ID del área asignada (por defecto: Facturación)"
    )
    estado_id: int = Field(
        default=1,
        description="ID del estado (por defecto: 1 - Recibida)"
    )
    centro_costo_id: Optional[UUID] = Field(None, description="ID del centro de costo")
    centro_operacion_id: Optional[UUID] = Field(None, description="ID del centro de operación")
    es_gasto_adm: bool = Field(
        default=False,
        description="Indica si es un gasto administrativo (omite validación de OC y APROBACIÓN)"
    )
    unidad_negocio_id: Optional[UUID] = Field(None, description="ID de la unidad de negocio")
    cuenta_auxiliar_id: Optional[UUID] = Field(None, description="ID de la cuenta auxiliar")


class FacturaUpdate(BaseModel):
    """Esquema para actualizar una factura."""
    area_id: Optional[UUID] = None
    estado_id: Optional[int] = None
    assigned_to_user_id: Optional[UUID] = None
    centro_costo_id: Optional[UUID] = None
    centro_operacion_id: Optional[UUID] = None
    es_gasto_adm: Optional[bool] = None
    unidad_negocio_id: Optional[UUID] = None
    cuenta_auxiliar_id: Optional[UUID] = None


class AsignarCarpetaRequest(BaseModel):
    """Request para asignar factura a carpeta."""
    carpeta_id: UUID = Field(..., description="ID de la carpeta donde se asignará la factura")


class AsignarCarpetaResponse(BaseModel):
    """Response de asignación de carpeta."""
    id: UUID
    numero_factura: str
    carpeta_id: UUID
    carpeta_nombre: str
    updated_at: datetime


class AsignarCarpetaTesoreriaRequest(BaseModel):
    """Request para asignar factura a carpeta de tesorería."""
    carpeta_id: UUID = Field(..., description="ID de la carpeta de tesorería donde se asignará la factura")


class AsignarCarpetaTesoreriaResponse(BaseModel):
    """Response de asignación de carpeta de tesorería."""
    id: UUID
    numero_factura: str
    carpeta_id: UUID
    carpeta_nombre: str
    updated_at: datetime


class EstadoUpdateRequest(BaseModel):
    """Request para actualizar estado de factura."""
    estado_id: int = Field(..., description="ID del nuevo estado")


class EstadoUpdateResponse(BaseModel):
    """Response de actualización de estado."""
    id: UUID
    estado: str
    updated_at: datetime


class CarpetaEnFactura(BaseModel):
    """Esquema de carpeta en factura."""
    id: UUID
    nombre: str
    parent_id: Optional[UUID] = None
    
    model_config = {"from_attributes": True}


class FacturaListItem(BaseModel):
    """Esquema resumido para listado de facturas."""
    id: UUID
    proveedor: str
    numero_factura: str
    fecha_emision: Optional[date]
    fecha_vencimiento: Optional[date]
    area: str
    area_origen_id: Optional[UUID] = None
    total: float
    estado: str
    centro_costo: Optional[str] = None
    centro_operacion: Optional[str] = None
    centro_costo_id: Optional[UUID] = None
    centro_operacion_id: Optional[UUID] = None
    requiere_entrada_inventarios: bool = False
    destino_inventarios: Optional[str] = None
    presenta_novedad: bool = False
    inventarios_codigos: List['InventarioCodigoOut'] = []
    tiene_anticipo: bool = False
    porcentaje_anticipo: Optional[float] = None
    intervalo_entrega_contabilidad: Optional[str] = None
    es_gasto_adm: bool = False
    motivo_devolucion: Optional[str] = None
    files: List[FileMiniOut] = []
    carpeta_id: Optional[UUID] = None
    carpeta: Optional[CarpetaEnFactura] = None
    carpeta_tesoreria_id: Optional[UUID] = None
    carpeta_tesoreria: Optional[CarpetaEnFactura] = None
    unidad_negocio_id: Optional[UUID] = None
    unidad_negocio: Optional[str] = None
    cuenta_auxiliar_id: Optional[UUID] = None
    cuenta_auxiliar: Optional[str] = None
    
    model_config = {"from_attributes": True}


class FacturaResponse(FacturaBase):
    """Esquema de respuesta detallada para facturas."""
    id: UUID
    area: str
    estado: str
    assigned_to_user_id: Optional[UUID]
    assigned_at: Optional[datetime]
    centro_costo: Optional[str] = None
    centro_operacion: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    motivo_devolucion: Optional[str] = None
    carpeta_id: Optional[UUID] = None
    carpeta: Optional[CarpetaEnFactura] = None
    
    model_config = {"from_attributes": True}


class FacturasPaginatedResponse(BaseModel):
    """Respuesta paginada de facturas."""
    items: list[FacturaListItem]
    total: int
    page: int
    per_page: int


# ========== Schemas de Inventarios ==========

class InventarioCodigoIn(BaseModel):
    """Esquema para un código de inventario en el payload."""
    codigo: str = Field(..., description="Código de inventario (OCT, ECT, FPC, OCC, EDO, NP)")
    valor: str = Field(..., description="Valor alfanumérico del código")
    
    @field_validator('codigo')
    @classmethod
    def validate_codigo(cls, v: str) -> str:
        """Valida que el código sea uno de los permitidos."""
        allowed = {'OCT', 'ECT', 'FPC', 'OCC', 'EDO', 'NP'}
        if v.upper() not in allowed:
            raise ValueError(f"Código '{v}' no permitido. Debe ser uno de: {allowed}")
        return v.upper()
    
    @field_validator('valor')
    @classmethod
    def validate_valor(cls, v: str) -> str:
        """Valida que el valor no esté vacío y contenga solo caracteres permitidos."""
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("El valor no puede estar vacío")
        # Permitir alfanuméricos, espacios y guiones
        if not re.match(r'^[a-zA-Z0-9\s\-]+$', v_stripped):
            raise ValueError("El valor solo puede contener letras, números, espacios y guiones")
        return v_stripped


class InventariosPatchIn(BaseModel):
    """Esquema para actualizar inventarios de una factura."""
    requiere_entrada_inventarios: bool = Field(
        ..., 
        description="Indica si la factura requiere entrada a inventarios"
    )
    destino_inventarios: Optional[Literal["TIENDA", "ALMACEN"]] = Field(
        None,
        description="Destino de inventarios (obligatorio si requiere_entrada_inventarios=true)"
    )
    presenta_novedad: Optional[bool] = Field(
        None,
        description="Indica si presenta novedad (obligatorio si requiere_entrada_inventarios=true)"
    )
    codigos: Optional[list[InventarioCodigoIn]] = Field(
        None,
        description="Lista de códigos de inventario (obligatorio si requiere_entrada_inventarios=true)"
    )


class InventarioCodigoOut(BaseModel):
    """Esquema de respuesta para un código de inventario."""
    codigo: str
    valor: str
    created_at: datetime
    
    model_config = {"from_attributes": True}


class InventariosOut(BaseModel):
    """Esquema de respuesta para inventarios de una factura."""
    factura_id: UUID
    requiere_entrada_inventarios: bool
    destino_inventarios: Optional[str]
    codigos: list[InventarioCodigoOut]
    
    model_config = {"from_attributes": True}


# ========== Schemas de Anticipo ==========

class IntervaloEntregaEnum(str, Enum):
    """Enum para intervalo de entrega a contabilidad."""
    UNA_SEMANA = "1_SEMANA"
    DOS_SEMANAS = "2_SEMANAS"
    TRES_SEMANAS = "3_SEMANAS"
    UN_MES = "1_MES"


class AnticipoUpdateIn(BaseModel):
    """Esquema para actualizar campos de anticipo de una factura."""
    tiene_anticipo: bool = Field(
        ...,
        description="Indica si la factura tiene anticipo"
    )
    porcentaje_anticipo: Optional[float] = Field(
        None,
        ge=0,
        le=100,
        description="Porcentaje de anticipo (0-100). Obligatorio si tiene_anticipo=true"
    )
    intervalo_entrega_contabilidad: IntervaloEntregaEnum = Field(
        ...,
        description="Intervalo de entrega a contabilidad (1_SEMANA, 2_SEMANAS, 3_SEMANAS, 1_MES)"
    )
    
    model_config = {"extra": "forbid"}
    
    @model_validator(mode='after')
    def validate_anticipo_porcentaje(self):
        """
        Valida el constraint: tiene_anticipo = (porcentaje_anticipo IS NOT NULL)
        - Si tiene_anticipo=true  → porcentaje_anticipo NO puede ser None
        - Si tiene_anticipo=false → porcentaje_anticipo DEBE ser None
        """
        tiene = self.tiene_anticipo
        porcentaje = self.porcentaje_anticipo
        
        # Constraint: tiene_anticipo = (porcentaje_anticipo IS NOT NULL)
        if tiene and porcentaje is None:
            raise ValueError(
                "Si tiene_anticipo es true, porcentaje_anticipo no puede ser null"
            )
        
        if not tiene and porcentaje is not None:
            raise ValueError(
                "Si tiene_anticipo es false, porcentaje_anticipo debe ser null"
            )
        
        return self


class AnticipoOut(BaseModel):
    """Esquema de respuesta para campos de anticipo."""
    factura_id: UUID
    tiene_anticipo: bool
    porcentaje_anticipo: Optional[float]
    intervalo_entrega_contabilidad: str
    
    model_config = {"from_attributes": True}


# ========== Schemas de Submit Responsable ==========

class SubmitErrorDetail(BaseModel):
    """Detalle de errores en validación de submit."""
    message: str
    missing_fields: Optional[list[str]] = []
    missing_codes: Optional[list[str]] = []
    extra_codes: Optional[list[str]] = []
    missing_files: Optional[list[str]] = []


class SubmitResponsableOut(BaseModel):
    """Esquema de respuesta exitosa para submit_responsable."""
    factura_id: UUID
    area_id: UUID
    area_actual: str
    estado_id: int
    estado_actual: str
    
    # Datos principales de factura
    proveedor: str
    numero_factura: str
    fecha_emision: Optional[date]
    fecha_vencimiento: Optional[date]
    total: float
    
    # Centro de Costo y Operación
    centro_costo_id: Optional[UUID]
    centro_operacion_id: Optional[UUID]
    
    # Inventarios
    requiere_entrada_inventarios: bool
    destino_inventarios: Optional[str]
    presenta_novedad: bool
    inventario_codigos: list[InventarioCodigoOut]
    
    # Anticipo
    tiene_anticipo: bool
    porcentaje_anticipo: Optional[float]
    intervalo_entrega_contabilidad: str
    
    # Gasto Administrativo
    es_gasto_adm: bool
    
    # Archivos (opcional)
    files: Optional[list[dict]] = []
    
    model_config = {"from_attributes": True}


# ========== Schemas de Centros (CC/CO) ==========

class CentrosPatchIn(BaseModel):
    """Esquema para asignar Centro de Costo y Centro de Operación a una factura."""
    centro_costo_id: UUID = Field(
        ...,
        description="ID del Centro de Costo"
    )
    centro_operacion_id: UUID = Field(
        ...,
        description="ID del Centro de Operación (debe pertenecer al Centro de Costo)"
    )
    
    model_config = {"extra": "forbid"}


class CentrosOut(BaseModel):
    """Esquema de respuesta para asignación de Centros."""
    factura_id: UUID
    centro_costo_id: UUID
    centro_operacion_id: UUID
    
    model_config = {"from_attributes": True}


# ========== Schemas de Devolución a Responsable ==========

class DevolverAResponsableIn(BaseModel):
    """Esquema para devolver una factura de Contabilidad a Responsable."""
    motivo: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Motivo de la devolución (mínimo 10 caracteres)"
    )
    
    model_config = {"extra": "forbid"}


class DevolverAResponsableOut(BaseModel):
    """Esquema de respuesta para devolución a responsable."""
    factura_id: UUID
    estado_actual: str
    motivo_devolucion: str
    
    model_config = {"from_attributes": True}


# ========== Schemas de Devolución a Facturación ==========

class DevolverAFacturacionIn(BaseModel):
    """Esquema para devolver una factura de Responsable a Facturación."""
    motivo: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Motivo de la devolución (mínimo 10 caracteres)"
    )
    
    model_config = {"extra": "forbid"}


class DevolverAFacturacionOut(BaseModel):
    """Esquema de respuesta para devolución a facturación."""
    factura_id: UUID
    estado_actual: str
    motivo_devolucion: str
    usuario_facturacion: str
    
    model_config = {"from_attributes": True}
