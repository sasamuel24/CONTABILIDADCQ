"""refactor anticipos nuevo flujo aprobacion

Revision ID: e9f0a1b2c3d4
Revises: b0c1d2e3f4a5
Branch Labels: None
Depends On: None

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'e9f0a1b2c3d4'
down_revision = 'b0c1d2e3f4a5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Eliminar constraint de estados anterior
    op.drop_constraint('check_estado_anticipo_valid', 'anticipos', type_='check')

    # 2. Migrar datos existentes: activo → desembolsado (ya tenían paquete creado)
    op.execute("UPDATE anticipos SET estado = 'desembolsado' WHERE estado = 'activo'")

    # 3. Agregar nuevas columnas
    op.add_column('anticipos', sa.Column(
        'aprobador_id', UUID(as_uuid=True),
        sa.ForeignKey('aprobadores_gerencia.id', ondelete='SET NULL'),
        nullable=True
    ))
    op.add_column('anticipos', sa.Column(
        'fecha_aprobacion', sa.TIMESTAMP(timezone=True), nullable=True
    ))
    op.add_column('anticipos', sa.Column(
        'aprobado_por_nombre', sa.String(150), nullable=True
    ))
    op.add_column('anticipos', sa.Column(
        'aprobado_por_email', sa.String(255), nullable=True
    ))
    op.add_column('anticipos', sa.Column(
        'motivo_rechazo', sa.Text, nullable=True
    ))
    op.add_column('anticipos', sa.Column(
        'fecha_desembolso', sa.TIMESTAMP(timezone=True), nullable=True
    ))
    op.add_column('anticipos', sa.Column(
        'desembolsado_por_user_id', UUID(as_uuid=True),
        sa.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True
    ))

    # 4. Nuevo constraint de estados
    op.create_check_constraint(
        'check_estado_anticipo_valid',
        'anticipos',
        "estado IN ('pendiente','aprobado','rechazado','desembolsado','cerrado')"
    )

    op.create_index('ix_anticipos_aprobador_id', 'anticipos', ['aprobador_id'])

    # 5. Tabla de tokens de aprobación de anticipo
    op.create_table(
        'tokens_aprobacion_anticipo',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('anticipo_id', UUID(as_uuid=True),
                  sa.ForeignKey('anticipos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(128), nullable=False, unique=True),
        sa.Column('aprobador_email', sa.String(255), nullable=False),
        sa.Column('aprobador_nombre', sa.String(150), nullable=False),
        sa.Column('usado', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('usado_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True),
                  server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_tokens_aprobacion_anticipo_anticipo_id',
                    'tokens_aprobacion_anticipo', ['anticipo_id'])
    op.create_index('ix_tokens_aprobacion_anticipo_token',
                    'tokens_aprobacion_anticipo', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_tokens_aprobacion_anticipo_token',
                  table_name='tokens_aprobacion_anticipo')
    op.drop_index('ix_tokens_aprobacion_anticipo_anticipo_id',
                  table_name='tokens_aprobacion_anticipo')
    op.drop_table('tokens_aprobacion_anticipo')

    op.drop_index('ix_anticipos_aprobador_id', table_name='anticipos')
    op.drop_constraint('check_estado_anticipo_valid', 'anticipos', type_='check')
    op.drop_column('anticipos', 'desembolsado_por_user_id')
    op.drop_column('anticipos', 'fecha_desembolso')
    op.drop_column('anticipos', 'motivo_rechazo')
    op.drop_column('anticipos', 'aprobado_por_email')
    op.drop_column('anticipos', 'aprobado_por_nombre')
    op.drop_column('anticipos', 'fecha_aprobacion')
    op.drop_column('anticipos', 'aprobador_id')

    op.execute("UPDATE anticipos SET estado = 'activo' WHERE estado = 'desembolsado'")
    op.create_check_constraint(
        'check_estado_anticipo_valid', 'anticipos',
        "estado IN ('activo', 'cerrado')"
    )
