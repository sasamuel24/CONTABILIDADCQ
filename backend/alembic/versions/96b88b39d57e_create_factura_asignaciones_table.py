"""create_factura_asignaciones_table

Revision ID: 96b88b39d57e
Revises: 54350e564c80
Create Date: 2025-12-26 10:36:16.721820

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '96b88b39d57e'
down_revision: Union[str, Sequence[str], None] = '54350e564c80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'factura_asignaciones',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('factura_id', sa.UUID(), nullable=False),
        sa.Column('area_id', sa.UUID(), nullable=False),
        sa.Column('responsable_user_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['factura_id'], ['facturas.id'], ),
        sa.ForeignKeyConstraint(['area_id'], ['areas.id'], ),
        sa.ForeignKeyConstraint(['responsable_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_factura_asignaciones_factura_id'), 'factura_asignaciones', ['factura_id'], unique=False)
    op.create_index(op.f('ix_factura_asignaciones_area_id'), 'factura_asignaciones', ['area_id'], unique=False)
    op.create_index(op.f('ix_factura_asignaciones_responsable_user_id'), 'factura_asignaciones', ['responsable_user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_factura_asignaciones_responsable_user_id'), table_name='factura_asignaciones')
    op.drop_index(op.f('ix_factura_asignaciones_area_id'), table_name='factura_asignaciones')
    op.drop_index(op.f('ix_factura_asignaciones_factura_id'), table_name='factura_asignaciones')
    op.drop_table('factura_asignaciones')
