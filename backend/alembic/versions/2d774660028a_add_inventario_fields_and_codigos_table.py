"""add_inventario_fields_and_codigos_table

Revision ID: 2d774660028a
Revises: 4d2d3e92e5b0
Create Date: 2025-12-27 18:24:55.668007

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '2d774660028a'
down_revision: Union[str, Sequence[str], None] = '4d2d3e92e5b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Crear ENUM para destino_inventarios (con verificación)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE destino_inventarios_enum AS ENUM ('TIENDA', 'ALMACEN');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # 2. Agregar campos a la tabla facturas
    op.add_column('facturas', sa.Column('requiere_entrada_inventarios', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    # Usar SQL directo para agregar columna con ENUM existente
    op.execute("ALTER TABLE facturas ADD COLUMN destino_inventarios destino_inventarios_enum")
    
    # 3. Agregar CHECK constraint: si requiere_entrada_inventarios=true, destino_inventarios no puede ser NULL
    op.create_check_constraint(
        'check_destino_inventarios_required',
        'facturas',
        'requiere_entrada_inventarios = false OR destino_inventarios IS NOT NULL'
    )
    
    # 4. Crear ENUM para codigo en factura_inventario_codigos (con verificación)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE codigo_inventario_enum AS ENUM ('OCT', 'ECT', 'FPC', 'OCC', 'EDO');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # 5. Crear tabla factura_inventario_codigos usando SQL directo
    op.execute("""
        CREATE TABLE factura_inventario_codigos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
            codigo codigo_inventario_enum NOT NULL,
            valor TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT uq_factura_inventario_codigo UNIQUE (factura_id, codigo)
        )
    """)
    
    # 6. Crear índice en factura_id
    op.create_index('ix_factura_inventario_codigos_factura_id', 'factura_inventario_codigos', ['factura_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Eliminar índice
    op.drop_index('ix_factura_inventario_codigos_factura_id', table_name='factura_inventario_codigos')
    
    # 2. Eliminar tabla factura_inventario_codigos
    op.drop_table('factura_inventario_codigos')
    
    # 3. Eliminar ENUM codigo_inventario_enum
    op.execute("DROP TYPE IF EXISTS codigo_inventario_enum")
    
    # 4. Eliminar CHECK constraint
    op.drop_constraint('check_destino_inventarios_required', 'facturas', type_='check')
    
    # 5. Eliminar columnas de facturas
    op.drop_column('facturas', 'destino_inventarios')
    op.drop_column('facturas', 'requiere_entrada_inventarios')
    
    # 6. Eliminar ENUM destino_inventarios_enum
    op.execute("DROP TYPE IF EXISTS destino_inventarios_enum")

