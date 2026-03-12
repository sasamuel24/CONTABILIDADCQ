"""crear tabla tokens_aprobacion_paquetes y actualizar check tipo comentario

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-03-11 10:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = 'b2c3d4e5f6a8'
down_revision = 'a1b2c3d4e5f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Crear tabla de tokens de aprobación
    op.create_table(
        'tokens_aprobacion_paquetes',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('paquete_id', PG_UUID(as_uuid=True),
                  sa.ForeignKey('paquetes_gastos.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('token', sa.String(128), nullable=False, unique=True),
        sa.Column('usado', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('usado_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('usado_por_ip', sa.String(45), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_tokens_aprobacion_token', 'tokens_aprobacion_paquetes', ['token'], unique=True)
    op.create_index('ix_tokens_aprobacion_paquete_id', 'tokens_aprobacion_paquetes', ['paquete_id'])

    # 2. Actualizar check constraint de tipo en comentarios_paquete para incluir 'devolucion_gasto'
    op.drop_constraint('check_tipo_comentario_paquete_valid', 'comentarios_paquete', type_='check')
    op.create_check_constraint(
        'check_tipo_comentario_paquete_valid',
        'comentarios_paquete',
        "tipo IN ('observacion','devolucion','aprobacion','pago','envio_tesoreria','devolucion_gasto')"
    )


def downgrade() -> None:
    # Revertir check constraint
    op.drop_constraint('check_tipo_comentario_paquete_valid', 'comentarios_paquete', type_='check')
    op.create_check_constraint(
        'check_tipo_comentario_paquete_valid',
        'comentarios_paquete',
        "tipo IN ('observacion','devolucion','aprobacion','pago','envio_tesoreria')"
    )

    # Eliminar tabla de tokens
    op.drop_index('ix_tokens_aprobacion_paquete_id', table_name='tokens_aprobacion_paquetes')
    op.drop_index('ix_tokens_aprobacion_token', table_name='tokens_aprobacion_paquetes')
    op.drop_table('tokens_aprobacion_paquetes')
