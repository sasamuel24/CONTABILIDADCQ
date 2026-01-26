"""create_facturas_distribucion_ccco_table

Revision ID: 4f0c53a64cc0
Revises: 77b1106498dc
Create Date: 2026-01-26 11:33:26.050789

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f0c53a64cc0'
down_revision: Union[str, Sequence[str], None] = '77b1106498dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
