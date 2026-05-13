"""add dual approval fields to facturas and tipo_aprobacion to tokens

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-05-12 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP

revision = 'c5d6e7f8a9b0'
down_revision = 'b4c5d6e7f8a9'
branch_labels = None
depends_on = None


def upgrade():
    # Campos aprobación dual en facturas
    for col in [
        'aprobacion_ops_aprobador_id',
        'aprobacion_calidad_aprobador_id',
    ]:
        op.add_column('facturas', sa.Column(
            col,
            UUID(as_uuid=True),
            sa.ForeignKey('aprobadores_gerencia.id', ondelete='SET NULL'),
            nullable=True
        ))

    for col in [
        'fecha_envio_aprobacion_ops',
        'fecha_aprobacion_ops',
        'fecha_envio_aprobacion_calidad',
        'fecha_aprobacion_calidad',
    ]:
        op.add_column('facturas', sa.Column(col, TIMESTAMP(timezone=True), nullable=True))

    for col in [
        'aprobado_ops_nombre',
        'aprobado_ops_email',
        'aprobado_calidad_nombre',
        'aprobado_calidad_email',
    ]:
        op.add_column('facturas', sa.Column(col, sa.Text(), nullable=True))

    # tipo_aprobacion en tokens
    op.add_column('tokens_aprobacion_facturas', sa.Column(
        'tipo_aprobacion', sa.String(20), nullable=True
    ))


def downgrade():
    op.drop_column('tokens_aprobacion_facturas', 'tipo_aprobacion')
    for col in ['aprobado_calidad_email', 'aprobado_calidad_nombre',
                'aprobado_ops_email', 'aprobado_ops_nombre',
                'fecha_aprobacion_calidad', 'fecha_envio_aprobacion_calidad',
                'fecha_aprobacion_ops', 'fecha_envio_aprobacion_ops',
                'aprobacion_calidad_aprobador_id', 'aprobacion_ops_aprobador_id']:
        op.drop_column('facturas', col)
