"""add_must_change_password_to_users

Revision ID: cec6c1ea50ab
Revises: 4f0c53a64cc0
Create Date: 2026-02-02 16:45:10.720889

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cec6c1ea50ab'
down_revision: Union[str, Sequence[str], None] = '36421a6bfb57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Agregar columna must_change_password a users
    op.add_column('users', sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar columna must_change_password
    op.drop_column('users', 'must_change_password')
