"""add_factura_id_to_carpetas

Revision ID: 27cc487e5dd2
Revises: 30795df66e40
Create Date: 2026-01-23 11:12:07.082304

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '27cc487e5dd2'
down_revision: Union[str, Sequence[str], None] = '30795df66e40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Verificar si la columna factura_id ya existe
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    carpetas_columns = [col['name'] for col in inspector.get_columns('carpetas')]
    
    if 'factura_id' not in carpetas_columns:
        # Agregar columna factura_id a carpetas
        op.add_column('carpetas', sa.Column('factura_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_index('ix_carpetas_factura_id', 'carpetas', ['factura_id'])
        op.create_foreign_key(
            'fk_carpetas_factura_id',
            'carpetas',
            'facturas',
            ['factura_id'],
            ['id'],
            ondelete='CASCADE'
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar FK, índice y columna factura_id de carpetas
    op.drop_constraint('fk_carpetas_factura_id', 'carpetas', type_='foreignkey')
    op.drop_index('ix_carpetas_factura_id', 'carpetas')
    op.drop_column('carpetas', 'factura_id')
