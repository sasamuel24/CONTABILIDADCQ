"""add_fecha_vencimiento_to_facturas

Revision ID: a1b2c3d4e5f6
Revises: 3f763d323b92
Create Date: 2026-02-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '3f763d323b92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add fecha_vencimiento column to facturas table."""
    op.execute("""
        ALTER TABLE facturas 
        ADD COLUMN fecha_vencimiento DATE NULL
    """)


def downgrade() -> None:
    """Downgrade schema: Remove fecha_vencimiento column from facturas table."""
    op.execute("""
        ALTER TABLE facturas 
        DROP COLUMN fecha_vencimiento
    """)
