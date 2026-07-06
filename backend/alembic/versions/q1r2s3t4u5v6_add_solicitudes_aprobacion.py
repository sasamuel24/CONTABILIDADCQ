"""add solicitudes_aprobacion (multi-gerente) y solicitud_id en gastos

Revision ID: q1r2s3t4u5v6
Revises: p0q1r2s3t4u5
Branch Labels: None
Depends On: None

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'q1r2s3t4u5v6'
down_revision = 'p0q1r2s3t4u5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Solicitudes parciales de aprobación: subset de gastos -> un aprobador con su token
    op.create_table(
        'solicitudes_aprobacion',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('paquete_id', UUID(as_uuid=True),
                  sa.ForeignKey('paquetes_gastos.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('aprobador_id', UUID(as_uuid=True),
                  sa.ForeignKey('aprobadores_gerencia.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('token', sa.String(length=128), nullable=False, unique=True, index=True),
        sa.Column('estado', sa.String(length=20), nullable=False, server_default='pendiente'),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('fecha_respuesta', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('usado_por_ip', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.CheckConstraint("estado IN ('pendiente','aprobada','anulada')",
                           name='check_solicitud_estado_valid'),
    )

    # 2) Gasto asignado a una solicitud parcial
    op.add_column(
        'gastos_legalizacion',
        sa.Column('solicitud_id', UUID(as_uuid=True),
                  sa.ForeignKey('solicitudes_aprobacion.id', ondelete='SET NULL'), nullable=True)
    )
    op.create_index('ix_gastos_legalizacion_solicitud_id', 'gastos_legalizacion', ['solicitud_id'])


def downgrade() -> None:
    op.drop_index('ix_gastos_legalizacion_solicitud_id', table_name='gastos_legalizacion')
    op.drop_column('gastos_legalizacion', 'solicitud_id')
    op.drop_table('solicitudes_aprobacion')
