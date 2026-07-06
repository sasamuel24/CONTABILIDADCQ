"""add observaciones a gastos_legalizacion

Revision ID: o9p0q1r2s3t4
Revises: n8o9p0q1r2s3
Branch Labels: None
Depends On: None

"""
from alembic import op
import sqlalchemy as sa

revision = 'o9p0q1r2s3t4'
down_revision = 'n8o9p0q1r2s3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Observaciones opcionales por gasto (usado por el flujo tarjeta comercial)
    op.add_column(
        'gastos_legalizacion',
        sa.Column('observaciones', sa.String(length=500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('gastos_legalizacion', 'observaciones')
