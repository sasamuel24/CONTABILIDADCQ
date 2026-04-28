"""merge heads

Revision ID: 46acdb560886
Revises: 5ae7a5edf0c8, b1c2d3e4f5a6
Create Date: 2026-04-01 20:01:33.811238

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '46acdb560886'
down_revision: Union[str, Sequence[str], None] = ('5ae7a5edf0c8', 'b1c2d3e4f5a6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
