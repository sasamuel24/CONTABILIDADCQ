"""add comerciales_hijos y comercial_hijo_id en paquetes

Revision ID: p0q1r2s3t4u5
Revises: o9p0q1r2s3t4
Branch Labels: None
Depends On: None

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'p0q1r2s3t4u5'
down_revision = 'o9p0q1r2s3t4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Catálogo de hijos comerciales (vendedores sin login a cargo de un comercial padre)
    op.create_table(
        'comerciales_hijos',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('padre_user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('nombre', sa.String(length=200), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
    )

    # 2) Paquete legalizado a nombre de un hijo comercial (opcional)
    op.add_column(
        'paquetes_gastos',
        sa.Column('comercial_hijo_id', UUID(as_uuid=True),
                  sa.ForeignKey('comerciales_hijos.id', ondelete='SET NULL'), nullable=True)
    )
    op.create_index('ix_paquetes_gastos_comercial_hijo_id', 'paquetes_gastos', ['comercial_hijo_id'])


def downgrade() -> None:
    op.drop_index('ix_paquetes_gastos_comercial_hijo_id', table_name='paquetes_gastos')
    op.drop_column('paquetes_gastos', 'comercial_hijo_id')
    op.drop_table('comerciales_hijos')
