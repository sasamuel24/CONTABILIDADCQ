"""add_motivo_devolucion_to_facturas

Revision ID: 9ebeb25f1c63
Revises: c62fcd3d4260
Create Date: 2026-01-07 09:52:30.467580

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9ebeb25f1c63'
down_revision: Union[str, Sequence[str], None] = 'c62fcd3d4260'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add motivo_devolucion column to facturas table."""
    op.add_column(
        'facturas',
        sa.Column('motivo_devolucion', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema: Remove motivo_devolucion column from facturas table."""
    op.drop_column('facturas', 'motivo_devolucion')
