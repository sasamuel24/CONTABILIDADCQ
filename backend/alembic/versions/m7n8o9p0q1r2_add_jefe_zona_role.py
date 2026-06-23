"""add jefe_zona role

Crea el rol `jefe_zona`: perfil de monitoreo (solo lectura) que visualiza las
facturas represadas (estado 'asignada') de TODAS las tiendas (areas.es_tienda).
No procesa facturas; solo consulta el dashboard de represadas.

Revision ID: m7n8o9p0q1r2
Revises: k5f6a7b8c9d0
Create Date: 2026-06-23

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'm7n8o9p0q1r2'
down_revision: Union[str, Sequence[str], None] = 'k5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# UUID fijo del rol jefe_zona (idempotencia entre entornos)
ROLE_JEFE_ZONA_ID = 'd2b9f4a1-7c3e-4a6b-8f1d-2e5c9a0b3d4f'


def upgrade() -> None:
    op.execute(f"""
        INSERT INTO roles (id, code, nombre, descripcion, is_active, created_at, updated_at)
        VALUES (
            '{ROLE_JEFE_ZONA_ID}',
            'jefe_zona',
            'Jefe de Zona',
            'Monitoreo (solo lectura) de las facturas represadas en estado Asignada de todas las tiendas.',
            true,
            now(),
            now()
        )
        ON CONFLICT (code) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM roles WHERE code = 'jefe_zona'")
