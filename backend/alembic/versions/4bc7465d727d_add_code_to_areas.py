"""add_code_to_areas

Revision ID: 4bc7465d727d
Revises: cd15613ad113
Create Date: 2025-12-30 08:15:39.564857

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4bc7465d727d'
down_revision: Union[str, Sequence[str], None] = 'cd15613ad113'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Agregar columna code (permitir NULL temporalmente)
    op.add_column('areas', sa.Column('code', sa.String(50), nullable=True))
    
    # 2. Asignar códigos basados en nombres existentes
    connection = op.get_bind()
    connection.execute(
        sa.text("""
            UPDATE areas 
            SET code = CASE 
                WHEN LOWER(nombre) LIKE '%facturaci%' OR LOWER(nombre) LIKE '%fact%' THEN 'fact'
                WHEN LOWER(nombre) LIKE '%responsable%' OR LOWER(nombre) LIKE '%resp%' THEN 'responsable'
                WHEN LOWER(nombre) LIKE '%contabilidad%' OR LOWER(nombre) LIKE '%cont%' THEN 'cont'
                WHEN LOWER(nombre) LIKE '%tesorer%' OR LOWER(nombre) LIKE '%tes%' THEN 'tes'
                ELSE LOWER(SUBSTRING(nombre, 1, 10))
            END
            WHERE code IS NULL
        """)
    )
    
    # 3. Hacer code NOT NULL y UNIQUE
    op.alter_column('areas', 'code', nullable=False)
    op.create_unique_constraint('uq_areas_code', 'areas', ['code'])
    op.create_index('ix_areas_code', 'areas', ['code'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_areas_code', 'areas')
    op.drop_constraint('uq_areas_code', 'areas', type_='unique')
    op.drop_column('areas', 'code')
