"""add_carpetas_tesoreria_table

Revision ID: 6b1dabb62dae
Revises: 5538a10e5277
Create Date: 2026-02-04 15:33:40.494924

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6b1dabb62dae'
down_revision: Union[str, Sequence[str], None] = '5538a10e5277'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
