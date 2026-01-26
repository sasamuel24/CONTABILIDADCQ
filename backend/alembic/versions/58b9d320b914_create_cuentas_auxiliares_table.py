"""create_cuentas_auxiliares_table

Revision ID: 58b9d320b914
Revises: 36421a6bfb57
Create Date: 2026-01-26 09:55:38.799307

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58b9d320b914'
down_revision: Union[str, Sequence[str], None] = '36421a6bfb57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create cuentas_auxiliares table
    op.create_table(
        'cuentas_auxiliares',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('codigo', sa.String(length=20), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=False),
        sa.Column('activa', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('codigo', name='uq_cuenta_auxiliar_codigo')
    )
    
    # Create indexes
    op.create_index('ix_cuentas_auxiliares_codigo', 'cuentas_auxiliares', ['codigo'])
    op.create_index('ix_cuentas_auxiliares_descripcion', 'cuentas_auxiliares', ['descripcion'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_cuentas_auxiliares_descripcion', table_name='cuentas_auxiliares')
    op.drop_index('ix_cuentas_auxiliares_codigo', table_name='cuentas_auxiliares')
    op.drop_table('cuentas_auxiliares')
