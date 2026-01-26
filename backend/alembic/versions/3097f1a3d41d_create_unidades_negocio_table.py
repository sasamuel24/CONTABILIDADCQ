"""create_unidades_negocio_table

Revision ID: 3097f1a3d41d
Revises: 890c557f5423
Create Date: 2026-01-26 08:32:11.652199

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '3097f1a3d41d'
down_revision: Union[str, Sequence[str], None] = '890c557f5423'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Crear tabla unidades_negocio
    op.create_table(
        'unidades_negocio',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('codigo', sa.String(10), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=False),
        sa.Column('activa', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('codigo', name='uq_unidad_negocio_codigo')
    )
    
    # Crear índices
    op.create_index('ix_unidades_negocio_codigo', 'unidades_negocio', ['codigo'])
    op.create_index('ix_unidades_negocio_descripcion', 'unidades_negocio', ['descripcion'])


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar índices
    op.drop_index('ix_unidades_negocio_descripcion', 'unidades_negocio')
    op.drop_index('ix_unidades_negocio_codigo', 'unidades_negocio')
    
    # Eliminar tabla
    op.drop_table('unidades_negocio')
