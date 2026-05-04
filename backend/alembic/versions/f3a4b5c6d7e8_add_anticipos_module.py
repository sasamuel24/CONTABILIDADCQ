"""add anticipos module

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-04-29 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'f3a4b5c6d7e8'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'anticipos',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('folio', sa.String(30), nullable=False, unique=True),
        sa.Column('created_by_user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('assigned_to_user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('monto', sa.Numeric(14, 2), nullable=False),
        sa.Column('descripcion', sa.Text, nullable=True),
        sa.Column('estado', sa.String(20), nullable=False, server_default='activo'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint('monto > 0', name='check_anticipo_monto_positivo'),
        sa.CheckConstraint("estado IN ('activo', 'cerrado')", name='check_estado_anticipo_valid'),
    )
    op.create_index('ix_anticipos_assigned_to_user_id', 'anticipos', ['assigned_to_user_id'])
    op.create_index('ix_anticipos_created_by_user_id', 'anticipos', ['created_by_user_id'])
    op.create_index('ix_anticipos_estado', 'anticipos', ['estado'])

    op.add_column('paquetes_gastos',
        sa.Column('anticipo_id', UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_paquetes_gastos_anticipo_id',
        'paquetes_gastos', 'anticipos',
        ['anticipo_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_paquetes_gastos_anticipo_id', 'paquetes_gastos', ['anticipo_id'])


def downgrade() -> None:
    op.drop_index('ix_paquetes_gastos_anticipo_id', table_name='paquetes_gastos')
    op.drop_constraint('fk_paquetes_gastos_anticipo_id', 'paquetes_gastos', type_='foreignkey')
    op.drop_column('paquetes_gastos', 'anticipo_id')

    op.drop_index('ix_anticipos_estado', table_name='anticipos')
    op.drop_index('ix_anticipos_created_by_user_id', table_name='anticipos')
    op.drop_index('ix_anticipos_assigned_to_user_id', table_name='anticipos')
    op.drop_table('anticipos')
