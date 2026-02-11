"""add_archivo_egreso_to_carpetas_tesoreria

Revision ID: 462a14cc04de
Revises: a1b2c3d4e5f6
Create Date: 2026-02-11 13:36:57.513686

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '462a14cc04de'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TABLE carpetas_tesoreria ADD COLUMN archivo_egreso_url TEXT NULL")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE carpetas_tesoreria DROP COLUMN archivo_egreso_url")
