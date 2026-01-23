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
    # Hacer la columna created_by nullable
    op.alter_column('carpetas', 'created_by',
                    existing_type=postgresql.UUID(),
                    nullable=True)
    
    # Verificar y crear foreign key si no existe
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    fks = [fk['name'] for fk in inspector.get_foreign_keys('carpetas')]
    
    if 'fk_carpetas_created_by' not in fks:
        op.create_foreign_key(
            'fk_carpetas_created_by',
            'carpetas',
            'users',
            ['created_by'],
            ['id'],
            ondelete='SET NULL'
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_carpetas_created_by', 'carpetas')
    op.drop_constraint('fk_carpetas_created_by', 'carpetas', type_='foreignkey')
    op.alter_column('carpetas', 'created_by',
                    existing_type=postgresql.UUID(),
                    nullable=False)
