"""add_area_origen_id_to_facturas

Revision ID: 84515f34e3c0
Revises: 9ebeb25f1c63
Create Date: 2026-01-07 10:07:19.587598

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '84515f34e3c0'
down_revision: Union[str, Sequence[str], None] = '9ebeb25f1c63'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add area_origen_id to facturas table."""
    # Agregar columna area_origen_id
    op.add_column(
        'facturas',
        sa.Column(
            'area_origen_id',
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True
        )
    )
    
    # Agregar foreign key constraint
    op.create_foreign_key(
        'fk_facturas_area_origen',
        'facturas',
        'areas',
        ['area_origen_id'],
        ['id'],
        ondelete='RESTRICT'
    )
    
    # Crear índice para mejorar performance
    op.create_index(
        'ix_facturas_area_origen_id',
        'facturas',
        ['area_origen_id']
    )


def downgrade() -> None:
    """Downgrade schema: Remove area_origen_id from facturas table."""
    op.drop_index('ix_facturas_area_origen_id', table_name='facturas')
    op.drop_constraint('fk_facturas_area_origen', 'facturas', type_='foreignkey')
    op.drop_column('facturas', 'area_origen_id')
