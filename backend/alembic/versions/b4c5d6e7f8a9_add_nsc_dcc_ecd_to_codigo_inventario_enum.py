"""add NSC DCC ECD to codigo_inventario_enum

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-05-12 16:00:00.000000

"""
from alembic import op

revision = 'b4c5d6e7f8a9'
down_revision = 'a3b4c5d6e7f8'
branch_labels = None
depends_on = None


def upgrade():
    # PostgreSQL no permite ALTER TYPE ENUM directamente dentro de una transacción
    # con tablas que ya usan el tipo, así que usamos el truco de recrear.
    op.execute("ALTER TYPE codigo_inventario_enum ADD VALUE IF NOT EXISTS 'NSC'")
    op.execute("ALTER TYPE codigo_inventario_enum ADD VALUE IF NOT EXISTS 'DCC'")
    op.execute("ALTER TYPE codigo_inventario_enum ADD VALUE IF NOT EXISTS 'ECD'")


def downgrade():
    # PostgreSQL no permite eliminar valores de un ENUM.
    # El downgrade no hace nada; los valores quedan en el enum pero no se usan.
    pass
