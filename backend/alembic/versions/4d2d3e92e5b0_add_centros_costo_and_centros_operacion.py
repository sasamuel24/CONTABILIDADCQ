"""add_centros_costo_and_centros_operacion

Revision ID: 4d2d3e92e5b0
Revises: 4db4ae1362f5
Create Date: 2025-12-26 14:00:22.790052

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d2d3e92e5b0'
down_revision: Union[str, Sequence[str], None] = '4db4ae1362f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Crear tabla centros_costo
    op.create_table(
        'centros_costo',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('nombre', sa.Text(), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre', name='uq_centro_costo_nombre')
    )
    op.create_index(op.f('ix_centros_costo_nombre'), 'centros_costo', ['nombre'], unique=False)
    
    # Crear tabla centros_operacion
    op.create_table(
        'centros_operacion',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('centro_costo_id', sa.UUID(), nullable=False),
        sa.Column('nombre', sa.Text(), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['centro_costo_id'], ['centros_costo.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('centro_costo_id', 'nombre', name='uq_centro_operacion_cc_nombre')
    )
    op.create_index(op.f('ix_centros_operacion_centro_costo_id'), 'centros_operacion', ['centro_costo_id'], unique=False)
    op.create_index(op.f('ix_centros_operacion_nombre'), 'centros_operacion', ['nombre'], unique=False)
    
    # Agregar columnas a facturas
    op.add_column('facturas', sa.Column('centro_costo_id', sa.UUID(), nullable=True))
    op.add_column('facturas', sa.Column('centro_operacion_id', sa.UUID(), nullable=True))
    
    # Crear foreign keys en facturas
    op.create_foreign_key(
        'fk_facturas_centro_costo_id',
        'facturas', 'centros_costo',
        ['centro_costo_id'], ['id'],
        ondelete='RESTRICT'
    )
    op.create_foreign_key(
        'fk_facturas_centro_operacion_id',
        'facturas', 'centros_operacion',
        ['centro_operacion_id'], ['id'],
        ondelete='RESTRICT'
    )
    
    # Crear índices en facturas
    op.create_index(op.f('ix_facturas_centro_costo_id'), 'facturas', ['centro_costo_id'], unique=False)
    op.create_index(op.f('ix_facturas_centro_operacion_id'), 'facturas', ['centro_operacion_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar índices de facturas
    op.drop_index(op.f('ix_facturas_centro_operacion_id'), table_name='facturas')
    op.drop_index(op.f('ix_facturas_centro_costo_id'), table_name='facturas')
    
    # Eliminar foreign keys de facturas
    op.drop_constraint('fk_facturas_centro_operacion_id', 'facturas', type_='foreignkey')
    op.drop_constraint('fk_facturas_centro_costo_id', 'facturas', type_='foreignkey')
    
    # Eliminar columnas de facturas
    op.drop_column('facturas', 'centro_operacion_id')
    op.drop_column('facturas', 'centro_costo_id')
    
    # Eliminar tabla centros_operacion
    op.drop_index(op.f('ix_centros_operacion_nombre'), table_name='centros_operacion')
    op.drop_index(op.f('ix_centros_operacion_centro_costo_id'), table_name='centros_operacion')
    op.drop_table('centros_operacion')
    
    # Eliminar tabla centros_costo
    op.drop_index(op.f('ix_centros_costo_nombre'), table_name='centros_costo')
    op.drop_table('centros_costo')
