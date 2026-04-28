"""merge_carpetas_tesoreria_with_existing

Revision ID: 90459e54bb49
Revises: 3f763d323b92, 6b1dabb62dae
Create Date: 2026-02-04 16:19:45.532511

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '90459e54bb49'
down_revision: Union[str, Sequence[str], None] = ('3f763d323b92', '6b1dabb62dae')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
