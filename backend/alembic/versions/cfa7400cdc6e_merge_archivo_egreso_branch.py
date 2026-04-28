"""merge_archivo_egreso_branch

Revision ID: cfa7400cdc6e
Revises: 462a14cc04de, b6ba5322ad79
Create Date: 2026-02-11 20:20:15.372659

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cfa7400cdc6e'
down_revision: Union[str, Sequence[str], None] = ('462a14cc04de', 'b6ba5322ad79')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
