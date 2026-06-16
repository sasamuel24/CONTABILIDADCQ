"""rename estado recibida label a 'Recibida por radicación'

Revision ID: i3d4e5f6a7b8
Revises: h2c3d4e5f6a7
Create Date: 2026-06-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'h2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE estados SET label = 'Recibida por radicación' WHERE code = 'recibida'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE estados SET label = 'Recibida por facturación' WHERE code = 'recibida'"
    )
