"""add valor_sin_impuestos and vsi_fuente to gastos_legalizacion

Revision ID: r2s3t4u5v6w7
Revises: q1r2s3t4u5v6
Create Date: 2026-07-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'r2s3t4u5v6w7'
down_revision = 'q1r2s3t4u5v6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Valor del gasto antes de impuestos (base sin IVA/impoconsumo).
    # NULL = aún no validado/calculado. Facturación lo llena vía IA o manualmente.
    op.execute("""
        ALTER TABLE gastos_legalizacion
        ADD COLUMN IF NOT EXISTS valor_sin_impuestos NUMERIC(14, 2);
    """)
    # Origen del valor: 'ia' (extraído del soporte), 'manual' (digitado por
    # Facturación) o 'sin_desglose' (el soporte no discrimina impuestos → igual al total).
    op.execute("""
        ALTER TABLE gastos_legalizacion
        ADD COLUMN IF NOT EXISTS vsi_fuente VARCHAR(20);
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE gastos_legalizacion DROP COLUMN IF EXISTS vsi_fuente;")
    op.execute("ALTER TABLE gastos_legalizacion DROP COLUMN IF EXISTS valor_sin_impuestos;")
