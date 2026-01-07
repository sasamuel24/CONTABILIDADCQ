"""populate_area_origen_id_for_existing_facturas

Revision ID: 39ef7f0e297b
Revises: d044b7f6a7e0
Create Date: 2026-01-07 10:10:33.943037

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39ef7f0e297b'
down_revision: Union[str, Sequence[str], None] = 'd044b7f6a7e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Poblar area_origen_id para facturas existentes.
    Para facturas que están en Contabilidad, buscar en factura_asignaciones.
    Para las demás, usar area_id actual.
    """
    from sqlalchemy import text
    
    connection = op.get_bind()
    
    # Primero: Para facturas que NO están en Contabilidad, usar area_id actual
    connection.execute(text("""
        UPDATE facturas
        SET area_origen_id = area_id
        WHERE area_origen_id IS NULL
        AND area_id NOT IN (
            SELECT id FROM areas WHERE nombre ILIKE '%contabilidad%'
        )
    """))
    
    # Segundo: Para facturas en Contabilidad, buscar última asignación previa
    connection.execute(text("""
        UPDATE facturas f
        SET area_origen_id = (
            SELECT fa.area_id
            FROM factura_asignaciones fa
            WHERE fa.factura_id = f.id
            AND fa.area_id NOT IN (
                SELECT id FROM areas WHERE nombre ILIKE '%contabilidad%'
            )
            ORDER BY fa.created_at DESC
            LIMIT 1
        )
        WHERE f.area_origen_id IS NULL
        AND f.area_id IN (
            SELECT id FROM areas WHERE nombre ILIKE '%contabilidad%'
        )
        AND EXISTS (
            SELECT 1 FROM factura_asignaciones fa2
            WHERE fa2.factura_id = f.id
        )
    """))
    
    # Tercero: Para facturas en Contabilidad SIN historial de asignaciones,
    # intentar inferir desde el área actual si es posible
    # (Fallback: dejarlas NULL y se manejarán manualmente)


def downgrade() -> None:
    """Downgrade: Limpiar area_origen_id (opcional)."""
    pass

