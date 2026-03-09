"""archivos_gasto: drop unique constraint on gasto_id

Revision ID: b3d4e5f6a7b8
Revises: f9a3c2e1b8d7
Create Date: 2026-03-04 11:00:00.000000

"""
from alembic import op

revision = 'b3d4e5f6a7b8'
down_revision = 'f9a3c2e1b8d7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('archivos_gasto_gasto_id_key', 'archivos_gasto', type_='unique')


def downgrade() -> None:
    op.create_unique_constraint('archivos_gasto_gasto_id_key', 'archivos_gasto', ['gasto_id'])
