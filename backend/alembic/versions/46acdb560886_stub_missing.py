"""stub_migration_produccion

Revision ID: 46acdb560886
Revises: z9x8w7v6u5t4
Create Date: 2026-04-26 00:00:00.000000

Stub para revisión que existía en producción pero cuyo archivo se perdió localmente.
No contiene cambios de esquema.
"""
from typing import Sequence, Union

revision: str = '46acdb560886'
down_revision: Union[str, Sequence[str], None] = 'z9x8w7v6u5t4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
