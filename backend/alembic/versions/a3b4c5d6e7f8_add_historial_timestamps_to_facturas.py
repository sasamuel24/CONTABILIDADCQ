"""add historial timestamps to facturas

Revision ID: a3b4c5d6e7f8
Revises: f3a4b5c6d7e8
Create Date: 2026-05-12 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TIMESTAMP

revision = 'a3b4c5d6e7f8'
down_revision = 'f3a4b5c6d7e8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('facturas', sa.Column(
        'fecha_envio_contabilidad',
        TIMESTAMP(timezone=True),
        nullable=True
    ))
    op.add_column('facturas', sa.Column(
        'fecha_envio_tesoreria',
        TIMESTAMP(timezone=True),
        nullable=True
    ))
    op.add_column('facturas', sa.Column(
        'fecha_cierre',
        TIMESTAMP(timezone=True),
        nullable=True
    ))


def downgrade():
    op.drop_column('facturas', 'fecha_cierre')
    op.drop_column('facturas', 'fecha_envio_tesoreria')
    op.drop_column('facturas', 'fecha_envio_contabilidad')
