"""marca como tienda las areas de tienda creadas despues de k5f6a7b8c9d0

Revision ID: w7x8y9z0a1b2
Revises: v6w7x8y9z0a1
Create Date: 2026-07-28 10:00:00.000000

La migración k5f6a7b8c9d0 sembró `areas.es_tienda` con un predicado por nombre
("Tienda %") / code ("Tiendas Caf%"). Las tiendas creadas a mano después de esa
fecha no encajan en el patrón y quedaron con es_tienda=false, por lo que sus
facturas eran invisibles para el rol `responsable_tiendas` (la bandeja filtra
por `Area.es_tienda`, ver modules/facturas/repository.py::get_all).

Caso reportado: CAFE QUINDIO FONTANAR (2 facturas represadas en "Asignada a
responsable" que no aparecían en la bandeja de tiendas@cafequindio.com.co).

NO se toca el code 'b2c' ("Tiendas Café Quindío"): es el paraguas de canal, no
una tienda física, y k5f6a7b8c9d0 lo excluye a propósito.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'w7x8y9z0a1b2'
down_revision: Union[str, Sequence[str], None] = 'v6w7x8y9z0a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Áreas de tienda que quedaron sin marcar (verificado contra Aurora, 28-jul-2026).
_CODES_TIENDA = (
    'FONTANAR',      # CAFE QUINDIO FONTANAR
    'T94',           # CAFE QUINDIO EXPRESS PASEO VILLA DEL RIO
    'Tienda NQS',    # Responsable Tienda Mall Plaza NQS
    'Bocagrande',    # Tiendas Café Quindío Plaza Bocagrande
)


def _codes_sql() -> str:
    return ", ".join(f"'{c}'" for c in _CODES_TIENDA)


def upgrade() -> None:
    op.execute(f"UPDATE areas SET es_tienda = true WHERE code IN ({_codes_sql()})")


def downgrade() -> None:
    op.execute(f"UPDATE areas SET es_tienda = false WHERE code IN ({_codes_sql()})")
