"""merge_heads

Revision ID: 10e909a98fc1
Revises: 4f0c53a64cc0, cec6c1ea50ab
Create Date: 2026-02-02 18:32:04.014651

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '10e909a98fc1'
down_revision: Union[str, Sequence[str], None] = ('4f0c53a64cc0', 'cec6c1ea50ab')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
