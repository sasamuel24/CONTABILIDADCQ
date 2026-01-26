"""add_unidad_negocio_id_to_facturas

Revision ID: 36421a6bfb57
Revises: 3097f1a3d41d
Create Date: 2026-01-26 09:23:26.257501

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '36421a6bfb57'
down_revision: Union[str, Sequence[str], None] = '3097f1a3d41d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Agregar columna unidad_negocio_id a facturas
    op.add_column('facturas', 
        sa.Column('unidad_negocio_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    
    # Crear índice
    op.create_index('ix_facturas_unidad_negocio_id', 'facturas', ['unidad_negocio_id'])
    
    # Crear foreign key
    op.create_foreign_key(
        'fk_facturas_unidad_negocio_id',
        'facturas',
        'unidades_negocio',
        ['unidad_negocio_id'],
        ['id'],
        ondelete='RESTRICT'
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar foreign key
    op.drop_constraint('fk_facturas_unidad_negocio_id', 'facturas', type_='foreignkey')
    
    # Eliminar índice
    op.drop_index('ix_facturas_unidad_negocio_id', 'facturas')
    
    # Eliminar columna
    op.drop_column('facturas', 'unidad_negocio_id')
