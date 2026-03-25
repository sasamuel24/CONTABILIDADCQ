"""add doc_contable to paquetes_gastos and cm_pdf to gastos_legalizacion

Revision ID: f1a2b3c4d5e6
Revises: e0f1a2b3c4d5
Create Date: 2026-03-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = 'e0f1a2b3c4d5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # paquetes_gastos — documento contable general
    op.execute("""
        ALTER TABLE paquetes_gastos ADD COLUMN IF NOT EXISTS doc_contable_s3_key TEXT;
    """)
    op.execute("""
        ALTER TABLE paquetes_gastos ADD COLUMN IF NOT EXISTS doc_contable_filename VARCHAR(255);
    """)

    # gastos_legalizacion — CM PDF por gasto
    op.execute("""
        ALTER TABLE gastos_legalizacion ADD COLUMN IF NOT EXISTS cm_pdf_s3_key TEXT;
    """)
    op.execute("""
        ALTER TABLE gastos_legalizacion ADD COLUMN IF NOT EXISTS cm_pdf_filename VARCHAR(255);
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE gastos_legalizacion DROP COLUMN IF EXISTS cm_pdf_filename;")
    op.execute("ALTER TABLE gastos_legalizacion DROP COLUMN IF EXISTS cm_pdf_s3_key;")
    op.execute("ALTER TABLE paquetes_gastos DROP COLUMN IF EXISTS doc_contable_filename;")
    op.execute("ALTER TABLE paquetes_gastos DROP COLUMN IF EXISTS doc_contable_s3_key;")
