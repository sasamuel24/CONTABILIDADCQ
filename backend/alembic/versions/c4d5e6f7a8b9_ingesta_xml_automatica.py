"""ingesta_xml_automatica

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-04-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # area_id pasa a ser nullable para soportar facturas "sin asignar"
    op.alter_column('facturas', 'area_id', nullable=True)

    # NIT del proveedor extraído del XML
    op.add_column('facturas',
        sa.Column('nit_proveedor', sa.Text(), nullable=True))

    # Campos de ingesta automática IA
    op.add_column('facturas',
        sa.Column('pendiente_confirmacion', sa.Boolean(),
                  nullable=False, server_default='false'))
    op.add_column('facturas',
        sa.Column('ai_area_confianza', sa.Text(), nullable=True))
    op.add_column('facturas',
        sa.Column('ai_area_razonamiento', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('facturas', 'ai_area_razonamiento')
    op.drop_column('facturas', 'ai_area_confianza')
    op.drop_column('facturas', 'pendiente_confirmacion')
    op.drop_column('facturas', 'nit_proveedor')
    op.alter_column('facturas', 'area_id', nullable=False)
