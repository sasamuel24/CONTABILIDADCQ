"""add_es_gasto_adm_to_facturas

Revision ID: c62fcd3d4260
Revises: 4bc7465d727d
Create Date: 2026-01-07 09:19:28.079047

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c62fcd3d4260'
down_revision: Union[str, Sequence[str], None] = '4bc7465d727d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add es_gasto_adm column to facturas table."""
    op.add_column(
        'facturas',
        sa.Column(
            'es_gasto_adm',
            sa.Boolean(),
            nullable=False,
            server_default='false'
        )
    )


def downgrade() -> None:
    """Downgrade schema: Remove es_gasto_adm column from facturas table."""
    op.drop_column('facturas', 'es_gasto_adm')
