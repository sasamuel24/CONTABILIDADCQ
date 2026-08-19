"""Agrega el estado 'corregido' a gastos_legalizacion.estado_gasto.

Un gasto devuelto por Radicación NO se reintegra al paquete: se legaliza en un
paquete nuevo. "Marcar como corregido" pasa el gasto de 'devuelto' a
'corregido' — sigue excluido del monto a pagar, pero deja de generar alerta.

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-08-19
"""
from alembic import op

revision = "f5a6b7c8d9e0"
down_revision = "e4f5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE gastos_legalizacion DROP CONSTRAINT IF EXISTS check_estado_gasto_valid;"
    )
    op.execute(
        """
        ALTER TABLE gastos_legalizacion
        ADD CONSTRAINT check_estado_gasto_valid
        CHECK (estado_gasto IN ('pendiente','devuelto','aceptado','corregido'));
        """
    )


def downgrade() -> None:
    # Los gastos 'corregido' vuelven a 'devuelto' para no violar el CHECK viejo.
    op.execute(
        "UPDATE gastos_legalizacion SET estado_gasto='devuelto' WHERE estado_gasto='corregido';"
    )
    op.execute(
        "ALTER TABLE gastos_legalizacion DROP CONSTRAINT IF EXISTS check_estado_gasto_valid;"
    )
    op.execute(
        """
        ALTER TABLE gastos_legalizacion
        ADD CONSTRAINT check_estado_gasto_valid
        CHECK (estado_gasto IN ('pendiente','devuelto','aceptado'));
        """
    )
