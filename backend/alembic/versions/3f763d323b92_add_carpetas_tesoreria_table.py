"""add_carpetas_tesoreria_table

Revision ID: 3f763d323b92
Revises: 5538a10e5277
Create Date: 2026-02-04 10:34:05.147813

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f763d323b92'
down_revision: Union[str, Sequence[str], None] = '5538a10e5277'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Crear tabla carpetas_tesoreria
    op.create_table(
        'carpetas_tesoreria',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('nombre', sa.Text(), nullable=False),
        sa.Column('parent_id', sa.UUID(), nullable=True),
        sa.Column('factura_id', sa.UUID(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['factura_id'], ['facturas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['carpetas_tesoreria.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Crear índices
    op.create_index('ix_carpetas_tesoreria_nombre', 'carpetas_tesoreria', ['nombre'])
    op.create_index('ix_carpetas_tesoreria_parent_id', 'carpetas_tesoreria', ['parent_id'])
    op.create_index('ix_carpetas_tesoreria_factura_id', 'carpetas_tesoreria', ['factura_id'])
    op.create_index('ix_carpetas_tesoreria_created_by', 'carpetas_tesoreria', ['created_by'])
    
    # Agregar columna carpeta_tesoreria_id a facturas si no existe
    op.add_column('facturas', sa.Column('carpeta_tesoreria_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_facturas_carpeta_tesoreria_id', 'facturas', 'carpetas_tesoreria', ['carpeta_tesoreria_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_facturas_carpeta_tesoreria_id', 'facturas', ['carpeta_tesoreria_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar índice y columna de facturas
    op.drop_index('ix_facturas_carpeta_tesoreria_id', 'facturas')
    op.drop_constraint('fk_facturas_carpeta_tesoreria_id', 'facturas', type_='foreignkey')
    op.drop_column('facturas', 'carpeta_tesoreria_id')
    
    # Eliminar índices
    op.drop_index('ix_carpetas_tesoreria_created_by', 'carpetas_tesoreria')
    op.drop_index('ix_carpetas_tesoreria_factura_id', 'carpetas_tesoreria')
    op.drop_index('ix_carpetas_tesoreria_parent_id', 'carpetas_tesoreria')
    op.drop_index('ix_carpetas_tesoreria_nombre', 'carpetas_tesoreria')
    
    # Eliminar tabla
    op.drop_table('carpetas_tesoreria')
