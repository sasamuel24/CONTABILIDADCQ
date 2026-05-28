"""add unidad_negocio_id to users and seed unidades_negocio from CSV

Revision ID: h2c3d4e5f6a7
Revises: g1b2c3d4e5f6
Branch Labels: None
Depends On: None

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

revision = 'h2c3d4e5f6a7'
down_revision = 'g1b2c3d4e5f6'
branch_labels = None
depends_on = None

# CSV data zero-padded to 3 digits
UN_SEED = [
    ("001", "CAFÉ CONSUMO"),
    ("002", "CAFÉ GOURMET"),
    ("003", "CAFE ESPECIAL DE ORIGEN"),
    ("004", "CAFE INSTANTANEO"),
    ("005", "GALLETAS CAFECITAS"),
    ("006", "MERENGUES"),
    ("007", "AREQUIPE"),
    ("008", "MERMELADA"),
    ("009", "CHOCOFFES"),
    ("010", "GALLETAS DE AVENA"),
    ("011", "PASTELERIA"),
    ("012", "SOUVENIRS"),
    ("013", "TIENDAS DE CAFE"),
    ("014", "RESTAURANTE"),
    ("015", "EXPORTACIONES"),
    ("016", "MAQUILA BRITT"),
    ("017", "CAFÉ ORGÁNICO"),
    ("018", "ESCUELA DE CAFE"),
    ("019", "VENTAS NACIONALES"),
    ("020", "CAFE COSECHA ESPECIAL"),
    ("021", "CAPSULAS DE CAFE"),
    ("022", "MAQUILA PRICE SMART"),
    ("023", "MAQUINAS"),
    ("024", "TIENDA VIRTUAL"),
    ("025", "DULCES CARAMELO"),
    ("026", "FINCA SAN PEDRO"),
    ("027", "CAFÉ PACAMARA"),
    ("028", "CONSTRUCCION FABRICA"),
    ("029", "CAFE SUBASTADO"),
    ("030", "CAFE PROCESOS"),
    ("031", "CAFE VARIETALES"),
    ("032", "MAQUILA PEÑON"),
    ("033", "AUDITORIA INTERNA"),
    ("034", "MAQUILA CAPSULAS"),
    ("035", "BARRANQUERO"),
    ("036", "TIENDA ARABIA"),
    ("037", "CAFE VERDE"),
    ("038", "CAFÉ DESCAFEINADO"),
    ("039", "PRESIDENCIA"),
    ("040", "G.GENERAL"),
    ("041", "G.ADMINISTRATIVA"),
    ("042", "G.FINANCIERA"),
    ("043", "G.MERCADEO"),
    ("044", "G.INNOVACION"),
    ("045", "G.OPERATIVA"),
    ("046", "CONSTRUCCION CEDI FASE 2"),
    ("047", "CALIDAD CAFE"),
    ("048", "G.EXPANSION"),
    ("049", "LOGISTICA"),
    ("050", "MANTENIMIENTO"),
    ("051", "TIC"),
    ("052", "GESTION HUMANA"),
    ("053", "CONTROL CALIDAD"),
    ("054", "BIENESTAR"),
    ("055", "SIG"),
    ("056", "CAFÉ BLEND TRADICION"),
    ("057", "ARQUITECTURA"),
    ("058", "COMPRAS"),
    ("099", "GENERAL"),
]


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Seed unidades_negocio (INSERT ... ON CONFLICT DO NOTHING para idempotencia)
    for codigo, descripcion in UN_SEED:
        conn.execute(
            sa.text(
                "INSERT INTO unidades_negocio (id, codigo, descripcion, activa) "
                "VALUES (:id, :codigo, :descripcion, true) "
                "ON CONFLICT (codigo) DO NOTHING"
            ),
            {"id": str(uuid.uuid4()), "codigo": codigo, "descripcion": descripcion},
        )

    # 2. Agregar columna unidad_negocio_id a users
    op.add_column(
        "users",
        sa.Column(
            "unidad_negocio_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("unidades_negocio.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_users_unidad_negocio_id", "users", ["unidad_negocio_id"])


def downgrade() -> None:
    op.drop_index("ix_users_unidad_negocio_id", "users")
    op.drop_column("users", "unidad_negocio_id")
