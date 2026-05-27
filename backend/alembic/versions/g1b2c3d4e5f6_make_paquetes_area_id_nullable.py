"""make paquetes_gastos area_id nullable for tarjeta_cq flow

Revision ID: g1b2c3d4e5f6
Revises: f0a1b2c3d4e5
Branch Labels: None
Depends On: None

"""
from alembic import op
import sqlalchemy as sa

revision = 'g1b2c3d4e5f6'
down_revision = 'f0a1b2c3d4e5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('paquetes_gastos', 'area_id', nullable=True)


def downgrade() -> None:
    # Antes de revertir, asegurarse de que no haya NULLs
    op.execute("UPDATE paquetes_gastos SET area_id = (SELECT id FROM areas LIMIT 1) WHERE area_id IS NULL")
    op.alter_column('paquetes_gastos', 'area_id', nullable=False)
