"""add valor_iva y valor_impoconsumo a gastos_legalizacion

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-08-18

Desglose de impuestos por gasto para el archivo plano contable: el IVA se
exporta como fila aparte en la cuenta 2408 según tarifa (24080401 = 5%,
24080403 = 19%); el impoconsumo/ICUI se contabiliza en la misma cuenta del
gasto que lo origina, por lo que la fila del gasto sale por
valor_pagado - valor_iva.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, Sequence[str], None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE gastos_legalizacion
        ADD COLUMN IF NOT EXISTS valor_iva NUMERIC(14, 2),
        ADD COLUMN IF NOT EXISTS valor_impoconsumo NUMERIC(14, 2)
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE gastos_legalizacion
        DROP COLUMN IF EXISTS valor_iva,
        DROP COLUMN IF EXISTS valor_impoconsumo
    """)
