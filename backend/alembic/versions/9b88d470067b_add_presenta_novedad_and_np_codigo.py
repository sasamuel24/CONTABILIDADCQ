"""add_presenta_novedad_and_np_codigo

Revision ID: 9b88d470067b
Revises: 425549563ece
Create Date: 2025-12-28 10:21:48.140631

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b88d470067b'
down_revision: Union[str, Sequence[str], None] = '425549563ece'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Agrega el campo presenta_novedad a facturas y el valor 'NP' al ENUM codigo_inventario_enum.
    """
    # 1. Agregar columna presenta_novedad a tabla facturas
    op.execute("""
        ALTER TABLE facturas 
        ADD COLUMN presenta_novedad BOOLEAN NOT NULL DEFAULT false;
    """)
    
    # 2. Agregar valor 'NP' al ENUM codigo_inventario_enum
    # En PostgreSQL, ALTER TYPE ... ADD VALUE no se puede hacer dentro de un bloque de transacción
    # pero Alembic maneja esto correctamente con op.execute
    op.execute("""
        ALTER TYPE codigo_inventario_enum ADD VALUE IF NOT EXISTS 'NP';
    """)


def downgrade() -> None:
    """
    Remueve el campo presenta_novedad de facturas.
    
    NOTA: PostgreSQL no permite eliminar valores de un ENUM directamente.
    Si necesitas eliminar 'NP' del ENUM, deberás:
    1. Crear un nuevo ENUM sin 'NP'
    2. Convertir todas las columnas que usan el ENUM viejo al nuevo
    3. Eliminar el ENUM viejo
    4. Renombrar el nuevo ENUM
    
    Por simplicidad y seguridad, este downgrade solo elimina la columna presenta_novedad
    y deja el ENUM con 'NP' (no afecta funcionalidad si no se usa).
    """
    # Eliminar columna presenta_novedad
    op.execute("""
        ALTER TABLE facturas 
        DROP COLUMN presenta_novedad;
    """)
    
    # NOTA: No eliminamos 'NP' del ENUM por limitaciones de PostgreSQL
    # El valor quedará en el ENUM pero no se usará
