"""merge_fecha_vencimiento_20260211

Revision ID: b6ba5322ad79
Revises: 90459e54bb49, a1b2c3d4e5f6
Create Date: 2026-02-11 13:54:40.443319

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6ba5322ad79'
down_revision: Union[str, Sequence[str], None] = ('90459e54bb49', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
