"""rename area Facturación -> Radicación (solo nombre, conserva code 'fact')

Revision ID: j4e5f6a7b8c9
Revises: i3d4e5f6a7b8
Create Date: 2026-06-15 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'i3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE areas SET nombre = 'Radicación' WHERE code = 'fact'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE areas SET nombre = 'Facturación' WHERE code = 'fact'"
    )
