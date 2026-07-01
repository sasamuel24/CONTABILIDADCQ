"""add tarjeta_comercial flujo, en_validacion estado, aprobador categoria and rol comercial

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
Branch Labels: None
Depends On: None

"""
from alembic import op
import sqlalchemy as sa

revision = 'n8o9p0q1r2s3'
down_revision = 'm7n8o9p0q1r2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Ampliar constraint de estado para incluir 'en_validacion' (paso del validador comercial)
    op.drop_constraint('check_estado_paquete_valid', 'paquetes_gastos', type_='check')
    op.create_check_constraint(
        'check_estado_paquete_valid',
        'paquetes_gastos',
        "estado IN ('borrador','en_validacion','en_revision','devuelto','aprobado','en_tesoreria','pagado')"
    )

    # 2) Ampliar constraint de tipo_flujo para incluir 'tarjeta_comercial'
    op.drop_constraint('check_tipo_flujo_valid', 'paquetes_gastos', type_='check')
    op.create_check_constraint(
        'check_tipo_flujo_valid',
        'paquetes_gastos',
        "tipo_flujo IN ('mantenimiento','general','tarjeta_cq','tarjeta_comercial')"
    )

    # 3) Categoría de aprobador de gerencia (general | comercial) para listas separadas
    op.add_column(
        'aprobadores_gerencia',
        sa.Column('categoria', sa.String(length=20), nullable=False, server_default='general')
    )
    op.create_check_constraint(
        'check_aprobador_categoria_valid',
        'aprobadores_gerencia',
        "categoria IN ('general','comercial')"
    )

    # 4) Nuevo rol 'comercial' (creador de paquetes con tarjeta comercial)
    op.execute("""
        INSERT INTO roles (id, code, nombre, descripcion, is_active, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'comercial',
            'Responsable Tarjeta Comercial',
            'Gestiona gastos con tarjeta comercial. Crea paquetes, selecciona aprobador de gerencia comercial y administra el flujo Validador -> Gerente -> Radicacion -> Tesoreria.',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (code) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM roles WHERE code = 'comercial'")

    op.drop_constraint('check_aprobador_categoria_valid', 'aprobadores_gerencia', type_='check')
    op.drop_column('aprobadores_gerencia', 'categoria')

    op.drop_constraint('check_tipo_flujo_valid', 'paquetes_gastos', type_='check')
    op.create_check_constraint(
        'check_tipo_flujo_valid',
        'paquetes_gastos',
        "tipo_flujo IN ('mantenimiento','general','tarjeta_cq')"
    )

    op.drop_constraint('check_estado_paquete_valid', 'paquetes_gastos', type_='check')
    op.create_check_constraint(
        'check_estado_paquete_valid',
        'paquetes_gastos',
        "estado IN ('borrador','en_revision','devuelto','aprobado','en_tesoreria','pagado')"
    )
