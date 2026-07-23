"""Agrega enrutada_automaticamente a facturas (auto-ruteo OC a Contabilidad)

Revision ID: t4u5v6w7x8y9
Revises: s3t4u5v6w7x8
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = 't4u5v6w7x8y9'
down_revision = 's3t4u5v6w7x8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'facturas',
        sa.Column('enrutada_automaticamente', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('facturas', 'enrutada_automaticamente')
