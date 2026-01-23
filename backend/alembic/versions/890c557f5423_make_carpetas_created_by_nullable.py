"""make_carpetas_created_by_nullable

Revision ID: 890c557f5423
Revises: 27cc487e5dd2
Create Date: 2026-01-23 11:27:25.933227

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '890c557f5423'
down_revision: Union[str, Sequence[str], None] = '27cc487e5dd2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Esta migración ya no es necesaria porque created_by se crea nullable
    # en la migración 30795df66e40
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
