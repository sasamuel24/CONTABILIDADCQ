"""merge heads

Revision ID: 5ae7a5edf0c8
Revises: cfa7400cdc6e, f1a2b3c4d5e6
Create Date: 2026-03-25 20:43:52.745567

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5ae7a5edf0c8'
down_revision: Union[str, Sequence[str], None] = ('cfa7400cdc6e', 'f1a2b3c4d5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
