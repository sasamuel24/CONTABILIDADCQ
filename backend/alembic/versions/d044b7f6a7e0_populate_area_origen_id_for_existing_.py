"""populate_area_origen_id_for_existing_facturas

Revision ID: d044b7f6a7e0
Revises: 84515f34e3c0
Create Date: 2026-01-07 10:10:24.666572

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd044b7f6a7e0'
down_revision: Union[str, Sequence[str], None] = '84515f34e3c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
