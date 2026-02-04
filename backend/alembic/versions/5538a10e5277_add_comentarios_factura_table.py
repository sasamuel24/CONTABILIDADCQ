"""add_comentarios_factura_table

Revision ID: 5538a10e5277
Revises: 10e909a98fc1
Create Date: 2026-02-04 09:27:17.637368

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP


# revision identifiers, used by Alembic.
revision: str = '5538a10e5277'
down_revision: Union[str, Sequence[str], None] = '10e909a98fc1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Crear tabla comentarios_factura
    op.create_table(
        'comentarios_factura',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('factura_id', UUID(as_uuid=True), sa.ForeignKey('facturas.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=False, index=True),
        sa.Column('contenido', sa.Text(), nullable=False),
        sa.Column('created_at', TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', TIMESTAMP(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    
    # Crear índice para ordenar por fecha de creación
    op.create_index(
        'ix_comentarios_factura_created_at',
        'comentarios_factura',
        ['created_at']
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar índice
    op.drop_index('ix_comentarios_factura_created_at', table_name='comentarios_factura')
    
    # Eliminar tabla
    op.drop_table('comentarios_factura')
