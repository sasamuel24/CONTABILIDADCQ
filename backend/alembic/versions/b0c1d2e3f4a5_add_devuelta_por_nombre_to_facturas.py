"""add devuelta_por_nombre to facturas

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
Branch Labels: None
Depends On: None

"""
from alembic import op
import sqlalchemy as sa

revision = 'b0c1d2e3f4a5'
down_revision = 'a9b0c1d2e3f4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('facturas', sa.Column('devuelta_por_nombre', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('facturas', 'devuelta_por_nombre')
