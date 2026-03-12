"""paquete folio y eliminar unique constraint user_semana

Revision ID: a1b2c3d4e5f7
Revises: f9a3c2e1b8d7
Create Date: 2026-03-11 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f7'
down_revision = 'd2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Eliminar el UniqueConstraint de user_id + semana
    op.drop_constraint('uq_paquete_user_semana', 'paquetes_gastos', type_='unique')

    # 2. Agregar columna folio (nullable inicialmente para no romper registros existentes)
    op.add_column(
        'paquetes_gastos',
        sa.Column('folio', sa.String(30), nullable=True)
    )

    # 3. Generar folios para registros existentes usando una secuencia por año
    op.execute("""
        WITH ranked AS (
            SELECT
                id,
                EXTRACT(YEAR FROM created_at)::int AS yr,
                ROW_NUMBER() OVER (
                    PARTITION BY EXTRACT(YEAR FROM created_at)::int
                    ORDER BY created_at ASC
                ) AS rn
            FROM paquetes_gastos
            WHERE folio IS NULL
        )
        UPDATE paquetes_gastos p
        SET folio = 'PKG-' || r.yr || '-' || LPAD(r.rn::text, 5, '0')
        FROM ranked r
        WHERE p.id = r.id
    """)

    # 4. Hacer folio NOT NULL y agregar unique constraint + index
    op.alter_column('paquetes_gastos', 'folio', nullable=False)
    op.create_unique_constraint('uq_paquete_folio', 'paquetes_gastos', ['folio'])
    op.create_index('ix_paquetes_gastos_folio', 'paquetes_gastos', ['folio'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_paquetes_gastos_folio', table_name='paquetes_gastos')
    op.drop_constraint('uq_paquete_folio', 'paquetes_gastos', type_='unique')
    op.drop_column('paquetes_gastos', 'folio')
    op.create_unique_constraint('uq_paquete_user_semana', 'paquetes_gastos', ['user_id', 'semana'])
