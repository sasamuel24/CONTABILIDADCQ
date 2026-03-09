"""add aprobacion_gerencia to paquetes_gastos

Revision ID: f9a3c2e1b8d7
Revises: e7f8a9b0c1d2
Create Date: 2026-03-04 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f9a3c2e1b8d7'
down_revision = 'e7f8a9b0c1d2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'paquetes_gastos',
        sa.Column('aprobacion_gerencia_s3_key', sa.Text(), nullable=True)
    )
    op.add_column(
        'paquetes_gastos',
        sa.Column('aprobacion_gerencia_filename', sa.String(255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('paquetes_gastos', 'aprobacion_gerencia_filename')
    op.drop_column('paquetes_gastos', 'aprobacion_gerencia_s3_key')
