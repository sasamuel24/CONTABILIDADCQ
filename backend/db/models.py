"""
Modelos ORM de SQLAlchemy para el sistema CONTABILIDADCQ.
Incluye: Areas, Users, Estados, Facturas y Files.
"""
from sqlalchemy import (
    String, Text, Boolean, Numeric, Date, BigInteger, SmallInteger,
    ForeignKey, Index, UniqueConstraint, CheckConstraint, Enum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from datetime import datetime, date
from typing import Optional, List
import uuid

from db.base import Base, TimestampMixin


class Rol(Base, TimestampMixin):
    """Modelo de roles del sistema."""
    __tablename__ = "roles"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    nombre: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    descripcion: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    
    # Relaciones
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="role",
        lazy="selectin"
    )
    
    def __repr__(self):
        return f"<Rol(code={self.code}, nombre={self.nombre})>"


class Area(Base):
    """Modelo de áreas para asignación de facturas."""
    __tablename__ = "areas"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    nombre: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
        index=True
    )
    
    # Relaciones
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="area",
        lazy="selectin"
    )
    facturas: Mapped[List["Factura"]] = relationship(
        "Factura",
        back_populates="area",
        foreign_keys="Factura.area_id",
        lazy="selectin"
    )
    
    def __repr__(self):
        return f"<Area(id={self.id}, nombre={self.nombre})>"


class User(Base, TimestampMixin):
    """Modelo de usuarios del sistema."""
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
        index=True
    )
    area_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("areas.id", ondelete="SET NULL"),
        nullable=True
    )
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Relación con roles
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relaciones
    area: Mapped[Optional["Area"]] = relationship(
        "Area",
        back_populates="users",
        lazy="selectin"
    )
    role: Mapped["Rol"] = relationship(
        "Rol",
        lazy="selectin"
    )
    facturas_asignadas: Mapped[List["Factura"]] = relationship(
        "Factura",
        back_populates="assigned_user",
        foreign_keys="[Factura.assigned_to_user_id]",
        lazy="selectin"
    )
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'area_manager', 'user')",
            name="check_user_role"
        ),
    )
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"


class Estado(Base):
    """Catálogo de estados para facturas."""
    __tablename__ = "estados"
    
    id: Mapped[int] = mapped_column(
        SmallInteger,
        primary_key=True,
        autoincrement=True
    )
    code: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
        index=True
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relaciones
    facturas: Mapped[List["Factura"]] = relationship(
        "Factura",
        back_populates="estado",
        lazy="selectin"
    )
    
    def __repr__(self):
        return f"<Estado(id={self.id}, code={self.code}, label={self.label})>"


class CentroCosto(Base, TimestampMixin):
    """Modelo de Centros de Costo."""
    __tablename__ = "centros_costo"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
        index=True
    )
    activo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )
    
    # Relaciones
    operaciones: Mapped[List["CentroOperacion"]] = relationship(
        "CentroOperacion",
        back_populates="centro_costo",
        lazy="selectin"
    )
    facturas: Mapped[List["Factura"]] = relationship(
        "Factura",
        back_populates="centro_costo",
        foreign_keys="Factura.centro_costo_id",
        lazy="selectin"
    )
    
    def __repr__(self):
        return f"<CentroCosto(id={self.id}, nombre={self.nombre})>"


class CentroOperacion(Base, TimestampMixin):
    """Modelo de Centros de Operación."""
    __tablename__ = "centros_operacion"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    centro_costo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centros_costo.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    nombre: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True
    )
    activo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )
    
    # Relaciones
    centro_costo: Mapped["CentroCosto"] = relationship(
        "CentroCosto",
        back_populates="operaciones",
        lazy="selectin"
    )
    facturas: Mapped[List["Factura"]] = relationship(
        "Factura",
        back_populates="centro_operacion",
        foreign_keys="Factura.centro_operacion_id",
        lazy="selectin"
    )
    
    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "centro_costo_id",
            "nombre",
            name="uq_centro_operacion_cc_nombre"
        ),
    )
    
    def __repr__(self):
        return f"<CentroOperacion(id={self.id}, nombre={self.nombre})>"


class UnidadNegocio(Base, TimestampMixin):
    """Modelo de Unidades de Negocio."""
    __tablename__ = "unidades_negocio"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    codigo: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        unique=True,
        index=True
    )
    descripcion: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True
    )
    activa: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )
    
    # Relaciones
    facturas: Mapped[List["Factura"]] = relationship(
        "Factura",
        back_populates="unidad_negocio",
        foreign_keys="Factura.unidad_negocio_id",
        lazy="selectin"
    )
    
    def __repr__(self):
        return f"<UnidadNegocio(codigo={self.codigo}, descripcion={self.descripcion})>"


class CuentaAuxiliar(Base, TimestampMixin):
    """Modelo de Cuentas Auxiliares contables."""
    __tablename__ = "cuentas_auxiliares"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    codigo: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        unique=True,
        index=True
    )
    descripcion: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True
    )
    activa: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )
    
    # Relaciones
    facturas: Mapped[List["Factura"]] = relationship(
        "Factura",
        back_populates="cuenta_auxiliar",
        foreign_keys="Factura.cuenta_auxiliar_id",
        lazy="selectin"
    )
    
    def __repr__(self):
        return f"<CuentaAuxiliar(codigo={self.codigo}, descripcion={self.descripcion})>"


class Carpeta(Base, TimestampMixin):
    """Modelo de carpetas para organizar facturas."""
    __tablename__ = "carpetas"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True
    )
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("carpetas.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    factura_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("facturas.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    # Relaciones
    parent: Mapped[Optional["Carpeta"]] = relationship(
        "Carpeta",
        remote_side="Carpeta.id",
        back_populates="children",
        lazy="selectin"
    )
    children: Mapped[List["Carpeta"]] = relationship(
        "Carpeta",
        back_populates="parent",
        lazy="selectin",
        cascade="all, delete-orphan"
    )
    factura: Mapped[Optional["Factura"]] = relationship(
        "Factura",
        foreign_keys=[factura_id],
        lazy="selectin"
    )
    facturas: Mapped[List["Factura"]] = relationship(
        "Factura",
        foreign_keys="Factura.carpeta_id",
        lazy="selectin",
        viewonly=True
    )
    
    def __repr__(self):
        return f"<Carpeta(id={self.id}, nombre={self.nombre})>"


class Factura(Base, TimestampMixin):
    """Modelo de facturas del sistema."""
    __tablename__ = "facturas"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    proveedor: Mapped[str] = mapped_column(Text, nullable=False)
    numero_factura: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_emision: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    area_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("areas.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    area_origen_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("areas.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    carpeta_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("carpetas.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    unidad_negocio_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("unidades_negocio.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    total: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )
    estado_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("estados.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    assigned_to_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    assigned_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True
    )
    centro_costo_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centros_costo.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    centro_operacion_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centros_operacion.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    requiere_entrada_inventarios: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false"
    )
    destino_inventarios: Mapped[Optional[str]] = mapped_column(
        Enum('TIENDA', 'ALMACEN', name='destino_inventarios_enum'),
        nullable=True
    )
    presenta_novedad: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false"
    )
    tiene_anticipo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false"
    )
    porcentaje_anticipo: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True
    )
    intervalo_entrega_contabilidad: Mapped[str] = mapped_column(
        Enum('1_SEMANA', '2_SEMANAS', '3_SEMANAS', '1_MES', name='intervalo_entrega_enum'),
        nullable=False,
        server_default="'1_SEMANA'"
    )
    es_gasto_adm: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false"
    )
    motivo_devolucion: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    cuenta_auxiliar_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cuentas_auxiliares.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    
    # Relaciones
    area: Mapped["Area"] = relationship(
        "Area",
        foreign_keys=[area_id],
        back_populates="facturas",
        lazy="selectin"
    )
    area_origen: Mapped[Optional["Area"]] = relationship(
        "Area",
        foreign_keys=[area_origen_id],
        lazy="selectin"
    )
    estado: Mapped["Estado"] = relationship(
        "Estado",
        back_populates="facturas",
        lazy="selectin"
    )
    assigned_user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="facturas_asignadas",
        foreign_keys=[assigned_to_user_id],
        lazy="selectin"
    )
    files: Mapped[List["File"]] = relationship(
        "File",
        back_populates="factura",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    asignaciones: Mapped[List["FacturaAsignacion"]] = relationship(
        "FacturaAsignacion",
        back_populates="factura",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    centro_costo: Mapped[Optional["CentroCosto"]] = relationship(
        "CentroCosto",
        back_populates="facturas",
        foreign_keys=[centro_costo_id],
        lazy="selectin"
    )
    centro_operacion: Mapped[Optional["CentroOperacion"]] = relationship(
        "CentroOperacion",
        back_populates="facturas",
        foreign_keys=[centro_operacion_id],
        lazy="selectin"
    )
    inventario_codigos: Mapped[List["FacturaInventarioCodigo"]] = relationship(
        "FacturaInventarioCodigo",
        back_populates="factura",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    distribucion_ccco: Mapped[List["FacturaDistribucionCCCO"]] = relationship(
        "FacturaDistribucionCCCO",
        back_populates="factura",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    carpeta: Mapped[Optional["Carpeta"]] = relationship(
        "Carpeta",
        foreign_keys=[carpeta_id],
        lazy="selectin"
    )
    unidad_negocio: Mapped[Optional["UnidadNegocio"]] = relationship(
        "UnidadNegocio",
        foreign_keys=[unidad_negocio_id],
        lazy="selectin"
    )
    cuenta_auxiliar: Mapped[Optional["CuentaAuxiliar"]] = relationship(
        "CuentaAuxiliar",
        foreign_keys=[cuenta_auxiliar_id],
        lazy="selectin"
    )
    
    # Constraints e índices
    __table_args__ = (
        UniqueConstraint(
            "proveedor",
            "numero_factura",
            name="uq_factura_proveedor_numero"
        ),
        Index("ix_facturas_estado_area", "estado_id", "area_id"),
        CheckConstraint("total > 0", name="check_factura_total_positive"),
        CheckConstraint(
            "requiere_entrada_inventarios = false OR destino_inventarios IS NOT NULL",
            name="check_destino_inventarios_required"
        ),
        CheckConstraint(
            "tiene_anticipo = (porcentaje_anticipo IS NOT NULL)",
            name="check_anticipo_porcentaje_required"
        ),
        CheckConstraint(
            "porcentaje_anticipo IS NULL OR (porcentaje_anticipo >= 0 AND porcentaje_anticipo <= 100)",
            name="check_porcentaje_anticipo_range"
        ),
    )
    
    def __repr__(self):
        return f"<Factura(id={self.id}, numero={self.numero_factura}, proveedor={self.proveedor})>"


class File(Base, TimestampMixin):
    """Modelo de archivos asociados a facturas."""
    __tablename__ = "files"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    factura_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("facturas.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    doc_type: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        index=True
    )
    storage_provider: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="local"
    )
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    uploaded_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    
    # Relaciones
    factura: Mapped["Factura"] = relationship(
        "Factura",
        back_populates="files",
        lazy="selectin"
    )
    uploaded_by: Mapped[Optional["User"]] = relationship(
        "User",
        lazy="selectin"
    )
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "storage_provider IN ('local', 's3', 'drive')",
            name="check_file_storage_provider"
        ),
        CheckConstraint("size_bytes > 0", name="check_file_size_positive"),
        CheckConstraint(
            "doc_type IN ('OC','OS','OCT','ECT','OCC','EDO','FCP','FPC','EGRESO','SOPORTE_PAGO','FACTURA_PDF','APROBACION_GERENCIA','PEC','EC','PCE','PED')",
            name="check_file_doc_type"
        ),
    )
    
    def __repr__(self):
        return f"<File(id={self.id}, filename={self.filename}, factura_id={self.factura_id})>"


class FacturaAsignacion(Base):
    """Modelo de asignaciones de facturas a responsables."""
    __tablename__ = "factura_asignaciones"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    factura_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("facturas.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    area_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("areas.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    responsable_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        default=datetime.utcnow,
        nullable=False
    )
    
    # Relaciones
    factura: Mapped["Factura"] = relationship(
        "Factura",
        back_populates="asignaciones",
        lazy="selectin"
    )
    area: Mapped["Area"] = relationship(
        "Area",
        lazy="selectin"
    )
    responsable: Mapped["User"] = relationship(
        "User",
        lazy="selectin"
    )
    
    def __repr__(self):
        return f"<FacturaAsignacion(id={self.id}, factura_id={self.factura_id}, responsable_user_id={self.responsable_user_id})>"


class FacturaInventarioCodigo(Base):
    """Modelo para códigos de inventario asociados a facturas."""
    __tablename__ = "factura_inventario_codigos"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    factura_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("facturas.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    codigo: Mapped[str] = mapped_column(
        Enum('OCT', 'ECT', 'FPC', 'OCC', 'EDO', 'NP', name='codigo_inventario_enum'),
        nullable=False
    )
    valor: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=datetime.utcnow,
        nullable=False
    )
    
    # Relaciones
    factura: Mapped["Factura"] = relationship(
        "Factura",
        back_populates="inventario_codigos",
        lazy="selectin"
    )
    
    # Constraints e índices
    __table_args__ = (
        UniqueConstraint(
            "factura_id",
            "codigo",
            name="uq_factura_inventario_codigo"
        ),
    )
    
    def __repr__(self):
        return f"<FacturaInventarioCodigo(id={self.id}, factura_id={self.factura_id}, codigo={self.codigo})>"


class FacturaDistribucionCCCO(Base, TimestampMixin):
    """
    Modelo para distribución de facturas entre múltiples CC/CO/UN/CA con porcentajes.
    Permite dividir una factura en múltiples combinaciones de clasificación contable.
    """
    __tablename__ = "facturas_distribucion_ccco"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    factura_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("facturas.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    centro_costo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centros_costo.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    centro_operacion_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centros_operacion.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    unidad_negocio_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("unidades_negocio.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    cuenta_auxiliar_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cuentas_auxiliares.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    porcentaje: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=False
    )
    
    # Relaciones
    factura: Mapped["Factura"] = relationship(
        "Factura",
        back_populates="distribucion_ccco",
        lazy="selectin"
    )
    centro_costo: Mapped["CentroCosto"] = relationship(
        "CentroCosto",
        lazy="selectin"
    )
    centro_operacion: Mapped["CentroOperacion"] = relationship(
        "CentroOperacion",
        lazy="selectin"
    )
    unidad_negocio: Mapped[Optional["UnidadNegocio"]] = relationship(
        "UnidadNegocio",
        lazy="selectin"
    )
    cuenta_auxiliar: Mapped[Optional["CuentaAuxiliar"]] = relationship(
        "CuentaAuxiliar",
        lazy="selectin"
    )
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "porcentaje > 0 AND porcentaje <= 100",
            name="check_porcentaje_valid"
        ),
    )
    
    def __repr__(self):
        return f"<FacturaDistribucionCCCO(id={self.id}, factura_id={self.factura_id}, porcentaje={self.porcentaje})>"
