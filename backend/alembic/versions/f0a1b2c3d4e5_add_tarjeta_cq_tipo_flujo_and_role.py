"""add tarjeta_cq to tipo_flujo constraint and new role

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
Branch Labels: None
Depends On: None

"""
from alembic import op
import sqlalchemy as sa

revision = 'f0a1b2c3d4e5'
down_revision = 'e9f0a1b2c3d4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ampliar constraint de tipo_flujo para incluir tarjeta_cq
    op.drop_constraint('check_tipo_flujo_valid', 'paquetes_gastos', type_='check')
    op.create_check_constraint(
        'check_tipo_flujo_valid',
        'paquetes_gastos',
        "tipo_flujo IN ('mantenimiento', 'general', 'tarjeta_cq')"
    )

    # Insertar el nuevo rol tarjeta_cq si no existe
    op.execute("""
        INSERT INTO roles (id, code, nombre, descripcion, is_active, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'tarjeta_cq',
            'Responsable Tarjeta CQ',
            'Responsable de gastos con tarjeta anticipo CQ. Crea paquetes, selecciona aprobador de gerencia y gestiona el flujo hacia Facturación y Tesorería.',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (code) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_constraint('check_tipo_flujo_valid', 'paquetes_gastos', type_='check')
    op.create_check_constraint(
        'check_tipo_flujo_valid',
        'paquetes_gastos',
        "tipo_flujo IN ('mantenimiento', 'general')"
    )
    op.execute("DELETE FROM roles WHERE code = 'tarjeta_cq'")
