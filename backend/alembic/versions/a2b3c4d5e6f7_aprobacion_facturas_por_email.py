"""aprobacion_facturas_por_email

Revision ID: a2b3c4d5e6f7
Revises: z9x8w7v6u5t4
Create Date: 2026-04-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = 'z9x8w7v6u5t4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tabla aprobadores_gerencia
    op.create_table(
        'aprobadores_gerencia',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('nombre', sa.String(150), nullable=False),
        sa.Column('cargo', sa.String(150), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.UniqueConstraint('email', name='uq_aprobadores_gerencia_email'),
    )
    op.create_index('ix_aprobadores_gerencia_email', 'aprobadores_gerencia', ['email'])

    # Tabla tokens_aprobacion_facturas
    op.create_table(
        'tokens_aprobacion_facturas',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('factura_id', UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.String(128), nullable=False),
        sa.Column('aprobador_email', sa.String(255), nullable=False),
        sa.Column('aprobador_nombre', sa.String(150), nullable=False),
        sa.Column('usado', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('usado_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('usado_por_ip', sa.String(45), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['factura_id'], ['facturas.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('token', name='uq_token_aprobacion_facturas_token'),
    )
    op.create_index('ix_tokens_aprobacion_facturas_factura_id',
                    'tokens_aprobacion_facturas', ['factura_id'])
    op.create_index('ix_tokens_aprobacion_facturas_token',
                    'tokens_aprobacion_facturas', ['token'])

    # Columnas nuevas en facturas
    op.add_column('facturas',
        sa.Column('fecha_envio_gerencia', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('facturas',
        sa.Column('fecha_aprobacion_email', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('facturas',
        sa.Column('aprobado_por_nombre', sa.Text(), nullable=True))
    op.add_column('facturas',
        sa.Column('aprobado_por_email', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('facturas', 'aprobado_por_email')
    op.drop_column('facturas', 'aprobado_por_nombre')
    op.drop_column('facturas', 'fecha_aprobacion_email')
    op.drop_column('facturas', 'fecha_envio_gerencia')

    op.drop_index('ix_tokens_aprobacion_facturas_token', table_name='tokens_aprobacion_facturas')
    op.drop_index('ix_tokens_aprobacion_facturas_factura_id', table_name='tokens_aprobacion_facturas')
    op.drop_table('tokens_aprobacion_facturas')

    op.drop_index('ix_aprobadores_gerencia_email', table_name='aprobadores_gerencia')
    op.drop_table('aprobadores_gerencia')
