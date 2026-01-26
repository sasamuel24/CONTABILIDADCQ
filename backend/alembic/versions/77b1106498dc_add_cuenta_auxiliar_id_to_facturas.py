"""add_cuenta_auxiliar_id_to_facturas

Revision ID: 77b1106498dc
Revises: 58b9d320b914
Create Date: 2026-01-26 09:56:00.639172

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '77b1106498dc'
down_revision: Union[str, Sequence[str], None] = '58b9d320b914'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add cuenta_auxiliar_id column to facturas table
    op.add_column(
        'facturas',
        sa.Column('cuenta_auxiliar_id', sa.UUID(), nullable=True)
    )
    
    # Create index
    op.create_index(
        'ix_facturas_cuenta_auxiliar_id',
        'facturas',
        ['cuenta_auxiliar_id']
    )
    
    # Create foreign key constraint
    op.create_foreign_key(
        'fk_facturas_cuenta_auxiliar_id',
        'facturas',
        'cuentas_auxiliares',
        ['cuenta_auxiliar_id'],
        ['id'],
        ondelete='RESTRICT'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_facturas_cuenta_auxiliar_id', 'facturas', type_='foreignkey')
    op.drop_index('ix_facturas_cuenta_auxiliar_id', table_name='facturas')
    op.drop_column('facturas', 'cuenta_auxiliar_id')
