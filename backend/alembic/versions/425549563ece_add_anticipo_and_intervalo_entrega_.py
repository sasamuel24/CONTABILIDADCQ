"""add_anticipo_and_intervalo_entrega_fields

Revision ID: 425549563ece
Revises: 2d774660028a
Create Date: 2025-12-28 08:31:24.419535

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '425549563ece'
down_revision: Union[str, Sequence[str], None] = '2d774660028a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Crear ENUM type para intervalo_entrega_contabilidad usando DO block
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE intervalo_entrega_enum AS ENUM (
                '1_SEMANA',
                '2_SEMANAS',
                '3_SEMANAS',
                '1_MES'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # 2. Agregar columnas a la tabla facturas usando SQL directo
    op.execute("""
        ALTER TABLE facturas 
        ADD COLUMN tiene_anticipo BOOLEAN NOT NULL DEFAULT false
    """)
    
    op.execute("""
        ALTER TABLE facturas 
        ADD COLUMN porcentaje_anticipo NUMERIC(5,2) NULL
    """)
    
    op.execute("""
        ALTER TABLE facturas 
        ADD COLUMN intervalo_entrega_contabilidad intervalo_entrega_enum NOT NULL DEFAULT '1_SEMANA'
    """)
    
    # 3. Agregar CHECK constraints
    # Constraint 1: tiene_anticipo debe coincidir con si porcentaje_anticipo es NULL o no
    op.execute("""
        ALTER TABLE facturas 
        ADD CONSTRAINT check_anticipo_porcentaje_required
        CHECK (tiene_anticipo = (porcentaje_anticipo IS NOT NULL))
    """)
    
    # Constraint 2: porcentaje_anticipo debe estar entre 0 y 100 si no es NULL
    op.execute("""
        ALTER TABLE facturas 
        ADD CONSTRAINT check_porcentaje_anticipo_range
        CHECK (porcentaje_anticipo IS NULL OR (porcentaje_anticipo >= 0 AND porcentaje_anticipo <= 100))
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Eliminar CHECK constraints
    op.execute("ALTER TABLE facturas DROP CONSTRAINT IF EXISTS check_porcentaje_anticipo_range")
    op.execute("ALTER TABLE facturas DROP CONSTRAINT IF EXISTS check_anticipo_porcentaje_required")
    
    # 2. Eliminar columnas
    op.execute("ALTER TABLE facturas DROP COLUMN IF EXISTS intervalo_entrega_contabilidad")
    op.execute("ALTER TABLE facturas DROP COLUMN IF EXISTS porcentaje_anticipo")
    op.execute("ALTER TABLE facturas DROP COLUMN IF EXISTS tiene_anticipo")
    
    # 3. Eliminar ENUM type
    op.execute("DROP TYPE IF EXISTS intervalo_entrega_enum")
