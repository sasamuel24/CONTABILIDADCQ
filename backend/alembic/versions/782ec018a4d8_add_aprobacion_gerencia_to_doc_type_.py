"""add_aprobacion_gerencia_to_doc_type_check

Revision ID: 782ec018a4d8
Revises: 9b88d470067b
Create Date: 2025-12-28 21:05:16.994517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '782ec018a4d8'
down_revision: Union[str, Sequence[str], None] = '9b88d470067b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop old constraint
    op.drop_constraint('check_file_doc_type', 'files', type_='check')
    
    # Create new constraint with APROBACION_GERENCIA added
    op.create_check_constraint(
        'check_file_doc_type',
        'files',
        "doc_type IN ('OC','OS','OCT','ECT','OCC','EDO','FCP','FPC','EGRESO','SOPORTE_PAGO','FACTURA_PDF','APROBACION_GERENCIA')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop new constraint
    op.drop_constraint('check_file_doc_type', 'files', type_='check')
    
    # Restore old constraint without APROBACION_GERENCIA
    op.create_check_constraint(
        'check_file_doc_type',
        'files',
        "doc_type IN ('OC','OS','OCT','ECT','OCC','EDO','FCP','FPC','EGRESO','SOPORTE_PAGO','FACTURA_PDF')"
    )
