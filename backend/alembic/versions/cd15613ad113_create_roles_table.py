"""create_roles_table

Revision ID: cd15613ad113
Revises: f0bc2aa0072c
Create Date: 2025-12-30 08:00:50.222833

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid


# revision identifiers, used by Alembic.
revision: str = 'cd15613ad113'
down_revision: Union[str, Sequence[str], None] = 'f0bc2aa0072c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Crear tabla roles
    op.create_table(
        'roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('code', sa.String(50), nullable=False, unique=True, index=True),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()'))
    )
    
    # 2. Insertar roles por defecto
    roles_table = sa.table(
        'roles',
        sa.column('id', postgresql.UUID(as_uuid=True)),
        sa.column('code', sa.String),
        sa.column('nombre', sa.String),
        sa.column('descripcion', sa.Text),
        sa.column('is_active', sa.Boolean)
    )
    
    admin_id = uuid.uuid4()
    responsable_id = uuid.uuid4()
    contabilidad_id = uuid.uuid4()
    tesoreria_id = uuid.uuid4()
    
    op.bulk_insert(roles_table, [
        {
            'id': admin_id,
            'code': 'admin',
            'nombre': 'Administrador',
            'descripcion': 'Acceso completo al sistema, puede gestionar usuarios, áreas y todas las funcionalidades',
            'is_active': True
        },
        {
            'id': responsable_id,
            'code': 'responsable',
            'nombre': 'Responsable de Área',
            'descripcion': 'Puede ver y gestionar facturas asignadas a su área',
            'is_active': True
        },
        {
            'id': contabilidad_id,
            'code': 'contabilidad',
            'nombre': 'Contabilidad',
            'descripcion': 'Acceso a módulos de contabilidad y revisión de facturas',
            'is_active': True
        },
        {
            'id': tesoreria_id,
            'code': 'tesoreria',
            'nombre': 'Tesorería',
            'descripcion': 'Acceso a módulos de tesorería y gestión de pagos',
            'is_active': True
        }
    ])
    
    # 3. Agregar columna role_id a users (permitir NULL temporalmente)
    op.add_column('users', sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # 4. Migrar datos existentes: mapear role (texto) a role_id (UUID)
    connection = op.get_bind()
    
    # Obtener los IDs de los roles
    roles = connection.execute(sa.text("SELECT id, code FROM roles")).fetchall()
    role_map = {code: str(id) for id, code in roles}
    
    # Actualizar usuarios existentes
    connection.execute(
        sa.text(f"""
            UPDATE users 
            SET role_id = CASE 
                WHEN role = 'admin' THEN '{role_map.get('admin', admin_id)}'::uuid
                WHEN role = 'responsable' THEN '{role_map.get('responsable', responsable_id)}'::uuid
                WHEN role = 'contabilidad' THEN '{role_map.get('contabilidad', contabilidad_id)}'::uuid
                WHEN role = 'tesoreria' THEN '{role_map.get('tesoreria', tesoreria_id)}'::uuid
                ELSE '{role_map.get('admin', admin_id)}'::uuid
            END
            WHERE role_id IS NULL
        """)
    )
    
    # 5. Hacer role_id NOT NULL y agregar FK
    op.alter_column('users', 'role_id', nullable=False)
    op.create_index('ix_users_role_id', 'users', ['role_id'])
    op.create_foreign_key(
        'fk_users_role_id_roles',
        'users', 'roles',
        ['role_id'], ['id'],
        ondelete='RESTRICT'
    )
    
    # 6. Eliminar la columna antigua 'role' (texto)
    op.drop_column('users', 'role')


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Agregar columna role (texto) de vuelta
    op.add_column('users', sa.Column('role', sa.Text(), nullable=True))
    
    # 2. Migrar role_id de vuelta a role (texto)
    connection = op.get_bind()
    connection.execute(
        sa.text("""
            UPDATE users u
            SET role = r.code
            FROM roles r
            WHERE u.role_id = r.id
        """)
    )
    
    # 3. Hacer role NOT NULL con default 'user'
    op.alter_column('users', 'role', nullable=False, server_default='user')
    
    # 4. Eliminar FK e índice
    op.drop_constraint('fk_users_role_id_roles', 'users', type_='foreignkey')
    op.drop_index('ix_users_role_id', 'users')
    
    # 5. Eliminar columna role_id
    op.drop_column('users', 'role_id')
    
    # 6. Eliminar tabla roles
    op.drop_table('roles')
