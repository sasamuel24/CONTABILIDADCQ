"""add areas.es_tienda flag, seed tiendas, and responsable_tiendas role

Revision ID: k5f6a7b8c9d0
Revises: j4e5f6a7b8c9
Create Date: 2026-06-22 16:00:00.000000

Integración "Responsable de Tiendas": un perfil que gestiona OCT/ECT/FPC y envía
a Contabilidad las facturas de TODAS las tiendas (bandeja multi-tienda).

- Agrega `areas.es_tienda` (bool) para identificar de forma explícita y robusta
  qué áreas son tiendas (incluye outliers que no empiezan por "Tienda" y excluye
  el paraguas de canal 'b2c').
- Crea el rol `responsable_tiendas`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'j4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# UUID fijo del nuevo rol (determinista; evita depender de extensiones).
ROLE_TIENDAS_ID = 'f1104d9d-322f-4c1e-9386-ce33d4245b0d'

# Predicado que identifica las áreas de tienda (verificado contra BD: 64 áreas).
# Incluye outliers sin "Tienda" en el nombre y excluye el paraguas de canal 'b2c'.
_TIENDA_PREDICATE = """
    (
        nombre ILIKE 'Tienda %'
        OR nombre ILIKE 'Tienda  %'
        OR code   ILIKE 'Tiendas Caf%'
        OR code IN ('Marriot', 'Resposable Icesi Cali', 'Responsable Mall Plaza BGTA')
    )
    AND code <> 'b2c'
"""


def upgrade() -> None:
    # 1. Columna es_tienda (default false; server_default para no romper filas existentes)
    op.add_column(
        'areas',
        sa.Column('es_tienda', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # 2. Marcar las áreas de tienda
    op.execute(f"UPDATE areas SET es_tienda = true WHERE {_TIENDA_PREDICATE}")

    # 3. Crear el rol responsable_tiendas (idempotente)
    op.execute(f"""
        INSERT INTO roles (id, code, nombre, descripcion, is_active, created_at, updated_at)
        SELECT '{ROLE_TIENDAS_ID}', 'responsable_tiendas', 'Responsable de Tiendas',
               'Gestiona OCT/ECT/FPC y envía a Contabilidad las facturas de TODAS las tiendas',
               true, now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'responsable_tiendas')
    """)


def downgrade() -> None:
    op.execute("DELETE FROM roles WHERE code = 'responsable_tiendas'")
    op.drop_column('areas', 'es_tienda')
