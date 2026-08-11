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


class DistribucionOCItem(BaseModel):
    """Línea de distribución CC/CO enviada por N8N desde la orden de compra.

    Los códigos vienen como texto y se resuelven contra los catálogos.
    Se acepta `porcentaje` directo o `valor` en pesos (se convierte a % del total
    de la distribución).
    """
    c_costo: str = Field(..., description="Código o nombre del centro de costo")
    c_operacion: str = Field(..., description="Código o nombre del centro de operación")
    unidad_negocio: Optional[str] = Field(None, description="Código o descripción de la unidad de negocio")
    porcentaje: Optional[float] = Field(None, gt=0, le=100, description="Porcentaje de la línea (0-100)")
    valor: Optional[float] = Field(None, gt=0, description="Valor en pesos de la línea (alternativa a porcentaje)")

    @field_validator('c_costo', 'c_operacion', 'unidad_negocio', mode='before')
    @classmethod
    def n8n_empty_to_none_dist(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v == "" or v.lower() in ("null", "undefined", "nan"):
                return None
        return v

    @field_validator('porcentaje', 'valor', mode='before')
    @classmethod
    def n8n_num_empty_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip().replace(",", ".")
            if v == "" or v.lower() in ("null", "undefined", "nan"):
                return None
        return v


class FacturaCreate(BaseModel):
    """Esquema para crear una factura."""
    proveedor: str = Field(..., description="Nombre del proveedor")
    numero_factura: str = Field(..., description="Número de factura")
    fecha_emision: Optional[date] = Field(None, description="Fecha de emisión")
    fecha_vencimiento: Optional[date] = Field(None, description="Fecha de vencimiento")

    @field_validator('fecha_emision', 'fecha_vencimiento', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == "" or v == "0001-01-01":
            return None
        return v
    total: float = Field(..., gt=0, description="Monto total de la factura")
    area_id: UUID = Field(
        default=UUID("498e9fdb-25f5-42f9-beb8-92564ab6bdf4"),
        description="ID del área asignada (por defecto: Radicación)"
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
    xml_content: Optional[str] = Field(None, description="XML AttachedDocument DIAN para asignación automática de área por IA")
    nit: Optional[str] = Field(None, description="NIT del proveedor (enviado por N8N, se guarda como nit_proveedor)")
    tipo_doc: Optional[str] = Field(None, description="Tipo de documento (enviado por N8N)")
    numero_oc: Optional[str] = Field(None, description="Número de orden de compra (enviado por N8N)")
    estado_oc: Optional[str] = Field(None, description="Estado de la orden de compra (enviado por N8N)")
    c_costo: Optional[str] = Field(None, description="Código o nombre del centro de costo (N8N); se resuelve a centro_costo_id")
    c_operacion: Optional[str] = Field(None, description="Código o nombre del centro de operación (N8N); se resuelve a centro_operacion_id")
    unidad_negocio: Optional[str] = Field(None, description="Código o descripción de la unidad de negocio (N8N); se resuelve a unidad_negocio_id")
    distribucion: Optional[List[DistribucionOCItem]] = Field(
        None, description="Distribución CC/CO de la orden de compra (N8N); crea las filas en facturas_distribucion_ccco"
    )

    @field_validator(
        'nit', 'tipo_doc', 'numero_oc', 'estado_oc',
        'c_costo', 'c_operacion', 'unidad_negocio',
        mode='before'
    )
    @classmethod
    def n8n_empty_to_none(cls, v):
        """N8N envía '' , 'null' o 'undefined' cuando la expresión no tiene valor,
        y códigos numéricos como número (5103) en vez de texto."""
        if isinstance(v, bool):
            return v
        if isinstance(v, (int, float)):
            return str(v)
        if isinstance(v, str):
            v = v.strip()
            if v == "" or v.lower() in ("null", "undefined", "nan"):
                return None
        return v

    @field_validator('distribucion', mode='before')
    @classmethod
    def parse_distribucion_json(cls, v):
        """N8N puede enviar la distribución como string JSON; parsearla."""
        if isinstance(v, str):
            v = v.strip()
            if v == "" or v.lower() in ("null", "undefined"):
                return None
            import json
            try:
                return json.loads(v)
            except ValueError:
                return None
        return v


class FacturaUpdate(BaseModel):
    """Esquema para actualizar una factura."""
    area_id: Optional[UUID] = None
    estado_id: Optional[int] = None
    assigned_to_user_id: Optional[UUID] = None
    centro_costo_id: Optional[UUID] = None
    centro_operacion_id: Optional[UUID] = None
    es_gasto_adm: Optional[bool] = None
    es_activo_fijo: Optional[bool] = None
    unidad_negocio_id: Optional[UUID] = None
    cuenta_auxiliar_id: Optional[UUID] = None
    fecha_envio_contabilidad: Optional[datetime] = None


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


class AsignarCarpetaTesoreriaMasivoRequest(BaseModel):
    """Request para archivar VARIAS facturas en una carpeta de tesorería.

    Reemplaza el patrón de una petición por factura: el frontend disparaba N
    requests en paralelo y con lotes grandes una parte se perdía antes de llegar
    al servidor, dejando el archivado a medias sin decir cuáles habían fallado.
    """
    carpeta_id: UUID = Field(..., description="ID de la carpeta de tesorería destino")
    factura_ids: List[UUID] = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="IDs de las facturas a archivar",
    )


class FacturaNoArchivadaOut(BaseModel):
    """Factura que no se pudo archivar, con el motivo."""
    factura_id: UUID
    motivo: str


class AsignarCarpetaTesoreriaMasivoResponse(BaseModel):
    """Resultado del archivado masivo."""
    carpeta_id: UUID
    carpeta_nombre: str
    solicitadas: int
    archivadas: int
    no_archivadas: List[FacturaNoArchivadaOut] = []


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


class FacturaBandejaItem(BaseModel):
    """Esquema mínimo para la bandeja de Tesorería (explorador de carpetas).

    Solo las columnas que la lista realmente muestra/filtra. Se arma con UN SELECT
    plano (sin selectin ni construir el FacturaListItem completo de 60 campos), lo
    que evita el cuello de botella de ese listado con limit=0. El detalle completo
    se trae aparte al hacer click en una factura.
    """
    id: UUID
    numero_factura: str
    proveedor: str
    total: float
    estado: str = ''
    area: str = ''
    fecha_emision: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    carpeta_id: Optional[UUID] = None
    # Fecha en que Tesorería cerró/pagó la factura: la bandeja la muestra como columna.
    fecha_cierre: Optional[datetime] = None

    model_config = {"from_attributes": True}


class FacturaListItem(BaseModel):
    """Esquema resumido para listado de facturas."""
    id: UUID
    proveedor: str
    numero_factura: str
    fecha_emision: Optional[date]
    fecha_vencimiento: Optional[date]
    area: str
    area_id: Optional[UUID] = None
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
    es_activo_fijo: bool = False
    motivo_devolucion: Optional[str] = None
    devuelta_por_nombre: Optional[str] = None
    # Rechazo vigente desde el correo de aprobación (distinto de la devolución
    # de Contabilidad): el responsable debe verlo en la bandeja y en el detalle.
    fecha_rechazo_email: Optional[datetime] = None
    rechazado_por_nombre: Optional[str] = None
    motivo_rechazo_email: Optional[str] = None
    tipo_rechazo_email: Optional[str] = None
    files: List[FileMiniOut] = []
    carpeta_id: Optional[UUID] = None
    carpeta: Optional[CarpetaEnFactura] = None
    carpeta_tesoreria_id: Optional[UUID] = None
    carpeta_tesoreria: Optional[CarpetaEnFactura] = None
    unidad_negocio_id: Optional[UUID] = None
    unidad_negocio: Optional[str] = None
    cuenta_auxiliar_id: Optional[UUID] = None
    cuenta_auxiliar: Optional[str] = None
    fecha_envio_gerencia: Optional[datetime] = None
    fecha_aprobacion_email: Optional[datetime] = None
    aprobado_por_nombre: Optional[str] = None
    aprobado_por_email: Optional[str] = None
    # Aprobación dual
    fecha_envio_aprobacion_ops: Optional[datetime] = None
    fecha_aprobacion_ops: Optional[datetime] = None
    aprobado_ops_nombre: Optional[str] = None
    aprobado_ops_email: Optional[str] = None
    aprobacion_ops_aprobador_id: Optional[UUID] = None
    fecha_envio_aprobacion_calidad: Optional[datetime] = None
    fecha_aprobacion_calidad: Optional[datetime] = None
    aprobado_calidad_nombre: Optional[str] = None
    aprobado_calidad_email: Optional[str] = None
    aprobacion_calidad_aprobador_id: Optional[UUID] = None
    fecha_envio_contabilidad: Optional[datetime] = None
    fecha_envio_tesoreria: Optional[datetime] = None
    fecha_cierre: Optional[datetime] = None
    # Ingesta XML automática
    nit_proveedor: Optional[str] = None
    pendiente_confirmacion: bool = False
    ai_area_confianza: Optional[str] = None
    ai_area_razonamiento: Optional[str] = None
    # Orden de compra (ingesta N8N) y auto-ruteo a Contabilidad
    tipo_doc: Optional[str] = None
    numero_oc: Optional[str] = None
    estado_oc: Optional[str] = None
    enrutada_automaticamente: bool = False

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
    unidad_negocio_id: Optional[UUID] = None
    unidad_negocio: Optional[str] = None
    tipo_doc: Optional[str] = None
    numero_oc: Optional[str] = None
    estado_oc: Optional[str] = None
    enrutada_automaticamente: bool = False
    created_at: datetime
    updated_at: datetime
    motivo_devolucion: Optional[str] = None
    devuelta_por_nombre: Optional[str] = None
    carpeta_id: Optional[UUID] = None
    carpeta: Optional[CarpetaEnFactura] = None
    fecha_envio_gerencia: Optional[datetime] = None
    fecha_aprobacion_email: Optional[datetime] = None
    aprobado_por_nombre: Optional[str] = None
    aprobado_por_email: Optional[str] = None
    # Aprobación dual
    fecha_envio_aprobacion_ops: Optional[datetime] = None
    fecha_aprobacion_ops: Optional[datetime] = None
    aprobado_ops_nombre: Optional[str] = None
    aprobado_ops_email: Optional[str] = None
    aprobacion_ops_aprobador_id: Optional[UUID] = None
    fecha_envio_aprobacion_calidad: Optional[datetime] = None
    fecha_aprobacion_calidad: Optional[datetime] = None
    aprobado_calidad_nombre: Optional[str] = None
    aprobado_calidad_email: Optional[str] = None
    aprobacion_calidad_aprobador_id: Optional[UUID] = None

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
        allowed = {'OCT', 'ECT', 'FPC', 'OCC', 'EDO', 'NP', 'NSC', 'DCC', 'ECD'}
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
    # Opcional: en el camino de inventarios no se exige intervalo de entrega
    intervalo_entrega_contabilidad: Optional[str] = None

    # Gasto Administrativo
    es_gasto_adm: bool = False
    es_activo_fijo: bool = False
    
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


# ========== Schemas de Devolución a Radicación ==========

class DevolverAFacturacionIn(BaseModel):
    """Esquema para devolver una factura de Responsable a Radicación."""
    motivo: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Motivo de la devolución (mínimo 10 caracteres)"
    )
    
    model_config = {"extra": "forbid"}


class DevolverAFacturacionOut(BaseModel):
    """Esquema de respuesta para devolución a radicación."""
    factura_id: UUID
    estado_actual: str
    motivo_devolucion: str
    usuario_facturacion: str
    
    model_config = {"from_attributes": True}


# ========== Schema extracción IA desde PDF ==========

class ExtraccionFacturaPdfOut(BaseModel):
    """Respuesta del endpoint de extracción de datos de factura desde PDF con IA."""
    proveedor: Optional[str] = None
    numero_factura: Optional[str] = None
    fecha_emision: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    total: Optional[str] = None
    confianza: str = "baja"
    campos_detectados: List[str] = []


# ========== Schemas aprobación por correo electrónico ==========

class EnviarCorreoAprobacionIn(BaseModel):
    """Payload para enviar correo de aprobación a un gerente."""
    aprobador_id: UUID = Field(..., description="ID del aprobador seleccionado de la tabla aprobadores_gerencia")
    comentario: Optional[str] = Field(None, description="Comentario de trazabilidad visible en el correo al gerente")


class AprobacionEmailOut(BaseModel):
    """Respuesta del endpoint de aprobación por token."""
    factura_id: UUID
    numero_factura: str
    proveedor: str
    total: float
    aprobado_por_nombre: str
    aprobado_por_email: str
    fecha_aprobacion_email: datetime

    model_config = {"from_attributes": True}


class RechazoEmailIn(BaseModel):
    """Rechazo de una factura desde el correo de aprobación."""
    token: str = Field(..., description="Token de aprobación recibido en el correo")
    motivo: str = Field(
        ...,
        min_length=5,
        description="Por qué se rechaza. Lo escribe el aprobador y queda visible en DocuFlow.",
    )


class RechazoEmailOut(BaseModel):
    """Respuesta del endpoint de rechazo por token."""
    factura_id: UUID
    numero_factura: str
    proveedor: str
    total: float
    rechazado_por_nombre: str
    rechazado_por_email: str
    fecha_rechazo_email: datetime
    motivo_rechazo: str
    # None = Gerencia; 'OPS' / 'CALIDAD' = aprobación dual.
    tipo_aprobacion: Optional[str] = None

    model_config = {"from_attributes": True}


class FacturaAprobacionEstadoOut(BaseModel):
    """Estado de aprobación por email de una factura (para el frontend del Responsable)."""
    fecha_envio_gerencia: Optional[datetime] = None
    fecha_aprobacion_email: Optional[datetime] = None
    aprobado_por_nombre: Optional[str] = None
    aprobado_por_email: Optional[str] = None
    fecha_rechazo_email: Optional[datetime] = None
    rechazado_por_nombre: Optional[str] = None
    motivo_rechazo_email: Optional[str] = None
    tipo_rechazo_email: Optional[str] = None

    model_config = {"from_attributes": True}


# ========== Schemas ingesta automática XML ==========

class IngestaXMLIn(BaseModel):
    """Payload que envía N8N con el contenido del XML DIAN."""
    xml_content: str = Field(..., description="Contenido completo del XML AttachedDocument")
    pdf_base64: Optional[str] = Field(None, description="PDF de la factura codificado en base64 (enviado por N8N junto al XML)")
    pdf_filename: Optional[str] = Field(None, description="Nombre del archivo PDF")
    nit: Optional[str] = Field(None, description="NIT del proveedor enviado explícitamente por N8N (complementa o reemplaza el extraído del XML)")


class IngestaXMLResultOut(BaseModel):
    """Resultado del procesamiento de un XML de factura electrónica."""
    factura_id: UUID
    numero_factura: str
    proveedor: str
    nit_proveedor: Optional[str] = None
    total: Optional[float] = None
    fecha_emision: Optional[date] = None
    area_id: Optional[UUID] = None
    area_nombre: Optional[str] = None
    ai_area_confianza: str          # alta | media | baja | nula
    ai_area_razonamiento: Optional[str] = None
    pendiente_confirmacion: bool
    estado: str                     # auto_asignada | pendiente_confirmacion | sin_asignar
    duplicado: bool = False


# ========== Schemas Historial de Factura (vista Director) ==========

class HistorialEventoOut(BaseModel):
    """Evento dentro del historial de una factura."""
    fecha: Optional[datetime] = None
    tipo: str = Field(..., description="Tipo de evento: recibida | asignacion | aprobacion_email | envio_contabilidad | envio_tesoreria | cierre | devolucion")
    titulo: str
    descripcion: Optional[str] = None
    area_nombre: Optional[str] = None
    area_id: Optional[UUID] = None
    responsable_nombre: Optional[str] = None
    responsable_email: Optional[str] = None

    model_config = {"from_attributes": True}


class HistorialFacturaOut(BaseModel):
    """Historial completo de una factura para vista de Dirección."""
    factura_id: UUID
    numero_factura: str
    estado_actual: str
    area_actual: Optional[str] = None
    area_actual_id: Optional[UUID] = None
    eventos: List[HistorialEventoOut] = []
