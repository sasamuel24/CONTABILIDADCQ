"""rename_estado_cerrada_to_pagada

Revision ID: z9x8w7v6u5t4
Revises: b1c2d3e4f5a6
Create Date: 2026-04-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'z9x8w7v6u5t4'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE estados SET code = 'pagada', label = 'Pagada' WHERE code = 'cerrada'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE estados SET code = 'cerrada', label = 'Cerrada' WHERE code = 'pagada'"
    )
