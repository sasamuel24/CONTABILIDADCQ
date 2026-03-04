"""add_gastos_legalizacion_tecnico

Revision ID: e7f8a9b0c1d2
Revises: 462a14cc04de
Create Date: 2026-03-03 00:00:00.000000

Crea las tablas del módulo de legalización de gastos para técnicos de mantenimiento:
  - paquetes_gastos
  - gastos_legalizacion
  - archivos_gasto
  - comentarios_paquete
  - historial_estados_paquete

También inserta el rol 'tecnico' en la tabla roles.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
import uuid


revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, Sequence[str], None] = '462a14cc04de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Crear tablas del módulo de gastos e insertar rol tecnico."""

    # ------------------------------------------------------------------
    # 1. paquetes_gastos
    # ------------------------------------------------------------------
    op.create_table(
        'paquetes_gastos',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('area_id', UUID(as_uuid=True), sa.ForeignKey('areas.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('semana', sa.String(10), nullable=False),
        sa.Column('fecha_inicio', sa.Date, nullable=False),
        sa.Column('fecha_fin', sa.Date, nullable=False),
        sa.Column('estado', sa.String(20), nullable=False, server_default='borrador'),
        sa.Column('monto_total', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('total_documentos', sa.SmallInteger, nullable=False, server_default='0'),
        sa.Column('fecha_envio', TIMESTAMP(timezone=True), nullable=True),
        sa.Column('fecha_aprobacion', TIMESTAMP(timezone=True), nullable=True),
        sa.Column('fecha_pago', TIMESTAMP(timezone=True), nullable=True),
        sa.Column('revisado_por_user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.Column('updated_at', TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.CheckConstraint(
            "estado IN ('borrador','en_revision','devuelto','aprobado','pagado')",
            name='check_estado_paquete_valid'
        ),
        sa.UniqueConstraint('user_id', 'semana', name='uq_paquete_user_semana'),
    )
    op.create_index('idx_paquetes_gastos_user_id', 'paquetes_gastos', ['user_id'])
    op.create_index('idx_paquetes_gastos_estado',  'paquetes_gastos', ['estado'])
    op.create_index('idx_paquetes_gastos_semana',  'paquetes_gastos', ['semana'])

    # ------------------------------------------------------------------
    # 2. gastos_legalizacion
    # ------------------------------------------------------------------
    op.create_table(
        'gastos_legalizacion',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('paquete_id', UUID(as_uuid=True),
                  sa.ForeignKey('paquetes_gastos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('fecha', sa.Date, nullable=False),
        sa.Column('no_identificacion', sa.String(30), nullable=False),
        sa.Column('pagado_a', sa.String(200), nullable=False),
        sa.Column('concepto', sa.String(300), nullable=False),
        sa.Column('no_recibo', sa.String(100), nullable=True),
        sa.Column('centro_costo_id', UUID(as_uuid=True),
                  sa.ForeignKey('centros_costo.id', ondelete='SET NULL'), nullable=True),
        sa.Column('centro_operacion_id', UUID(as_uuid=True),
                  sa.ForeignKey('centros_operacion.id', ondelete='SET NULL'), nullable=True),
        sa.Column('cuenta_auxiliar_id', UUID(as_uuid=True),
                  sa.ForeignKey('cuentas_auxiliares.id', ondelete='SET NULL'), nullable=True),
        sa.Column('valor_pagado', sa.Numeric(14, 2), nullable=False),
        sa.Column('orden', sa.SmallInteger, nullable=False, server_default='0'),
        sa.Column('created_at', TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.Column('updated_at', TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.CheckConstraint('valor_pagado > 0', name='check_valor_gasto_positivo'),
    )
    op.create_index('idx_gastos_legalizacion_paquete', 'gastos_legalizacion', ['paquete_id'])
    op.create_index('idx_gastos_legalizacion_cc',      'gastos_legalizacion', ['centro_costo_id'])
    op.create_index('idx_gastos_legalizacion_co',      'gastos_legalizacion', ['centro_operacion_id'])

    # ------------------------------------------------------------------
    # 3. archivos_gasto
    # ------------------------------------------------------------------
    op.create_table(
        'archivos_gasto',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('paquete_id', UUID(as_uuid=True),
                  sa.ForeignKey('paquetes_gastos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('gasto_id', UUID(as_uuid=True),
                  sa.ForeignKey('gastos_legalizacion.id', ondelete='CASCADE'),
                  nullable=False, unique=True),
        sa.Column('filename', sa.Text, nullable=False),
        sa.Column('s3_key', sa.Text, nullable=False),
        sa.Column('categoria', sa.String(50), nullable=False),
        sa.Column('content_type', sa.Text, nullable=False),
        sa.Column('size_bytes', sa.BigInteger, nullable=False),
        sa.Column('uploaded_by_user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.Column('updated_at', TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.CheckConstraint('size_bytes > 0', name='check_size_archivo_gasto_positivo'),
        sa.CheckConstraint(
            "categoria IN ('Combustible','Hospedaje','Alimentacion','Viaticos / Casetas','Materiales','Otro')",
            name='check_categoria_archivo_gasto_valid'
        ),
    )
    op.create_index('idx_archivos_gasto_paquete', 'archivos_gasto', ['paquete_id'])
    op.create_index('idx_archivos_gasto_gasto',   'archivos_gasto', ['gasto_id'])

    # ------------------------------------------------------------------
    # 4. comentarios_paquete
    # ------------------------------------------------------------------
    op.create_table(
        'comentarios_paquete',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('paquete_id', UUID(as_uuid=True),
                  sa.ForeignKey('paquetes_gastos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('texto', sa.Text, nullable=False),
        sa.Column('tipo', sa.String(20), nullable=False, server_default='observacion'),
        sa.Column('created_at', TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.CheckConstraint(
            "tipo IN ('observacion','devolucion','aprobacion','pago')",
            name='check_tipo_comentario_paquete_valid'
        ),
    )
    op.create_index('idx_comentarios_paquete', 'comentarios_paquete', ['paquete_id'])

    # ------------------------------------------------------------------
    # 5. historial_estados_paquete
    # ------------------------------------------------------------------
    op.create_table(
        'historial_estados_paquete',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('paquete_id', UUID(as_uuid=True),
                  sa.ForeignKey('paquetes_gastos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('estado_anterior', sa.String(20), nullable=True),
        sa.Column('estado_nuevo', sa.String(20), nullable=False),
        sa.Column('created_at', TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
    )
    op.create_index('idx_historial_estados_paquete', 'historial_estados_paquete', ['paquete_id'])

    # ------------------------------------------------------------------
    # 6. Insertar rol 'tecnico'
    # ------------------------------------------------------------------
    op.execute("""
        INSERT INTO roles (id, code, nombre, descripcion, is_active, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'tecnico',
            'Técnico de Mantenimiento',
            'Personal de campo que legaliza gastos semanales en el módulo de legalización.',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (code) DO NOTHING;
    """)


def downgrade() -> None:
    """Eliminar tablas del módulo de gastos y el rol tecnico."""

    op.execute("DELETE FROM roles WHERE code = 'tecnico';")

    op.drop_index('idx_historial_estados_paquete', 'historial_estados_paquete')
    op.drop_table('historial_estados_paquete')

    op.drop_index('idx_comentarios_paquete', 'comentarios_paquete')
    op.drop_table('comentarios_paquete')

    op.drop_index('idx_archivos_gasto_gasto',   'archivos_gasto')
    op.drop_index('idx_archivos_gasto_paquete', 'archivos_gasto')
    op.drop_table('archivos_gasto')

    op.drop_index('idx_gastos_legalizacion_co',      'gastos_legalizacion')
    op.drop_index('idx_gastos_legalizacion_cc',      'gastos_legalizacion')
    op.drop_index('idx_gastos_legalizacion_paquete', 'gastos_legalizacion')
    op.drop_table('gastos_legalizacion')

    op.drop_index('idx_paquetes_gastos_semana',  'paquetes_gastos')
    op.drop_index('idx_paquetes_gastos_estado',  'paquetes_gastos')
    op.drop_index('idx_paquetes_gastos_user_id', 'paquetes_gastos')
    op.drop_table('paquetes_gastos')
