"""causación Siesa FSP — fase 1: enriquecimiento de facturas y tablas de mapeo

Revision ID: c2d3e4f5a6b7
Revises: b1d2e3f4a5c6
Create Date: 2026-08-12 10:00:00.000000

Fase 1 del módulo de causación automática de Facturas de Servicios (FSP) en
Siesa UNOEE vía Connekta. Esta migración NO activa ninguna integración: solo
prepara datos y catálogos.

1. `facturas`: columnas nullable `base_gravable`, `valor_iva` y
   `retenciones_xml` (JSONB). Se llenan desde el XML DIAN con extracción
   defensiva — facturas existentes o sin XML quedan en NULL y nada falla.
   `retenciones_xml` es INFORMATIVO: las retenciones que aplica Café Quindío
   como agente retenedor salen de su propia parametrización
   (siesa_proveedor_config), no de lo que declare el emisor en el XML.

2. `siesa_proveedor_config` + `siesa_proveedor_retenciones`: mapeo por
   proveedor (NIT sin DV) de los datos de decisión del payload FSP
   (tipo proveedor, motivo, ccosto Siesa, código de servicio, condición de
   pago, llave de impuesto y N retenciones).

3. `siesa_causaciones`: registro de cada intento de causación (payload y
   respuesta en JSONB, amarre enviado, número FSP real recuperado por
   consulta). Única defensa contra la doble causación: el POST a Connekta no
   es idempotente y el éxito no devuelve el consecutivo asignado.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, Sequence[str], None] = 'b1d2e3f4a5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enriquecimiento de facturas (nullable: nunca rompe el flujo vivo)
    op.add_column('facturas', sa.Column('base_gravable', sa.Numeric(14, 2), nullable=True))
    op.add_column('facturas', sa.Column('valor_iva', sa.Numeric(14, 2), nullable=True))
    op.add_column('facturas', sa.Column('retenciones_xml', postgresql.JSONB(), nullable=True))

    # 2. Mapeo por proveedor
    op.create_table(
        'siesa_proveedor_config',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('nit', sa.Text(), nullable=False),
        sa.Column('sucursal', sa.String(10), nullable=False, server_default='001'),
        sa.Column('tipo_proveedor', sa.String(3), nullable=True),
        sa.Column('id_motivo', sa.String(2), nullable=True),
        sa.Column('centro_costo_siesa', sa.String(10), nullable=True),
        sa.Column('codigo_servicio', sa.String(30), nullable=True),
        sa.Column('cond_pago', sa.String(3), nullable=True),
        sa.Column('llave_impuesto', sa.String(4), nullable=True),
        sa.Column('tasa_impuesto', sa.Numeric(7, 4), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('nit', name='uq_siesa_proveedor_config_nit'),
    )
    op.create_index('ix_siesa_proveedor_config_nit', 'siesa_proveedor_config', ['nit'])

    op.create_table(
        'siesa_proveedor_retenciones',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('config_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('siesa_proveedor_config.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('llave_retencion', sa.String(4), nullable=False),
        sa.Column('tasa', sa.Numeric(7, 4), nullable=False),
        sa.Column('clase_imp_base', sa.String(3), nullable=False, server_default='2'),
        sa.Column('base_minima', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_siesa_proveedor_retenciones_config_id',
                    'siesa_proveedor_retenciones', ['config_id'])

    # 3. Registro de causaciones
    op.create_table(
        'siesa_causaciones',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('factura_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('facturas.id', ondelete='RESTRICT'),
                  nullable=False),
        sa.Column('amarre', sa.String(20), nullable=False),
        sa.Column('estado', sa.String(20), nullable=False, server_default='borrador'),
        sa.Column('payload_enviado', postgresql.JSONB(), nullable=True),
        sa.Column('respuesta', postgresql.JSONB(), nullable=True),
        sa.Column('numero_fsp', sa.Text(), nullable=True),
        sa.Column('fecha_causacion', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('ambiente', sa.String(10), nullable=False, server_default='qa'),
        sa.Column('creado_por_user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_siesa_causaciones_factura_id', 'siesa_causaciones', ['factura_id'])
    op.create_index('ix_siesa_causaciones_amarre', 'siesa_causaciones', ['amarre'])
    op.create_index('ix_siesa_causaciones_estado', 'siesa_causaciones', ['estado'])


def downgrade() -> None:
    op.drop_table('siesa_causaciones')
    op.drop_table('siesa_proveedor_retenciones')
    op.drop_table('siesa_proveedor_config')
    op.drop_column('facturas', 'retenciones_xml')
    op.drop_column('facturas', 'valor_iva')
    op.drop_column('facturas', 'base_gravable')
