"""add_carpetas_model_and_factura_fk

Revision ID: 30795df66e40
Revises: edc7a8491bd8
Create Date: 2026-01-23 11:07:23.063238

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '30795df66e40'
down_revision: Union[str, Sequence[str], None] = 'edc7a8491bd8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Verificar si la tabla carpetas existe, si no, crearla
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    if 'carpetas' not in inspector.get_table_names():
        # Crear tabla carpetas
        op.create_table(
            'carpetas',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('nombre', sa.Text(), nullable=False),
            sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('factura_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['factura_id'], ['facturas.id'], name='fk_carpetas_factura_id', ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['parent_id'], ['carpetas.id'], name='fk_carpetas_parent_id', ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Crear índices
        op.create_index('ix_carpetas_nombre', 'carpetas', ['nombre'])
        op.create_index('ix_carpetas_parent_id', 'carpetas', ['parent_id'])
        op.create_index('ix_carpetas_factura_id', 'carpetas', ['factura_id'])
    
    # Verificar si la columna carpeta_id existe en facturas
    facturas_columns = [col['name'] for col in inspector.get_columns('facturas')]
    
    if 'carpeta_id' not in facturas_columns:
        # Agregar columna carpeta_id a facturas
        op.add_column('facturas', sa.Column('carpeta_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_index('ix_facturas_carpeta_id', 'facturas', ['carpeta_id'])
        op.create_foreign_key(
            'fk_facturas_carpeta_id',
            'facturas',
            'carpetas',
            ['carpeta_id'],
            ['id'],
            ondelete='SET NULL'
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar FK y columna carpeta_id de facturas
    op.drop_constraint('fk_facturas_carpeta_id', 'facturas', type_='foreignkey')
    op.drop_index('ix_facturas_carpeta_id', 'facturas')
    op.drop_column('facturas', 'carpeta_id')
    
    # Eliminar índices de carpetas
    op.drop_index('ix_carpetas_factura_id', 'carpetas')
    op.drop_index('ix_carpetas_parent_id', 'carpetas')
    op.drop_index('ix_carpetas_nombre', 'carpetas')
    
    # Eliminar tabla carpetas
    op.drop_table('carpetas')

