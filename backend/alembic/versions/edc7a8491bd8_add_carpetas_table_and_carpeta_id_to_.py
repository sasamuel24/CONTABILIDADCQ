"""add_carpetas_table_and_carpeta_id_to_facturas

Revision ID: edc7a8491bd8
Revises: 39ef7f0e297b
Create Date: 2026-01-22 16:34:36.161510

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'edc7a8491bd8'
down_revision: Union[str, Sequence[str], None] = '39ef7f0e297b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
