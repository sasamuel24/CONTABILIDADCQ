"""Agrega tipo_doc, numero_oc y estado_oc a facturas (ingesta N8N)

Revision ID: s3t4u5v6w7x8
Revises: u5v6w7x8y9z0
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = 's3t4u5v6w7x8'
down_revision = 'u5v6w7x8y9z0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('facturas', sa.Column('tipo_doc', sa.Text(), nullable=True))
    op.add_column('facturas', sa.Column('numero_oc', sa.Text(), nullable=True))
    op.add_column('facturas', sa.Column('estado_oc', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('facturas', 'estado_oc')
    op.drop_column('facturas', 'numero_oc')
    op.drop_column('facturas', 'tipo_doc')
