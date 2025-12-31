"""add_pec_ec_pce_to_doc_type_check

Revision ID: f0bc2aa0072c
Revises: 782ec018a4d8
Create Date: 2025-12-29 07:50:23.817056

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0bc2aa0072c'
down_revision: Union[str, Sequence[str], None] = '782ec018a4d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop old constraint
    op.drop_constraint('check_file_doc_type', 'files', type_='check')
    
    # Create new constraint with PEC, EC, PCE added
    op.create_check_constraint(
        'check_file_doc_type',
        'files',
        "doc_type IN ('OC','OS','OCT','ECT','OCC','EDO','FCP','FPC','EGRESO','SOPORTE_PAGO','FACTURA_PDF','APROBACION_GERENCIA','PEC','EC','PCE')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop new constraint
    op.drop_constraint('check_file_doc_type', 'files', type_='check')
    
    # Restore old constraint without PEC, EC, PCE
    op.create_check_constraint(
        'check_file_doc_type',
        'files',
        "doc_type IN ('OC','OS','OCT','ECT','OCC','EDO','FCP','FPC','EGRESO','SOPORTE_PAGO','FACTURA_PDF','APROBACION_GERENCIA')"
    )
