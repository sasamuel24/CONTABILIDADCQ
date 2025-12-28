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


class Area(Base):
    """Modelo de áreas para asignación de facturas."""
    __tablename__ = "areas"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
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
    role: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="user"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relaciones
    area: Mapped[Optional["Area"]] = relationship(
        "Area",
        back_populates="users",
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
    
    # Relaciones
    area: Mapped["Area"] = relationship(
        "Area",
        back_populates="facturas",
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
            "doc_type IN ('OC','OS','OCT','ECT','OCC','EDO','FCP','FPC','EGRESO','SOPORTE_PAGO','FACTURA_PDF')",
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
        Enum('OCT', 'ECT', 'FPC', 'OCC', 'EDO', name='codigo_inventario_enum'),
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
