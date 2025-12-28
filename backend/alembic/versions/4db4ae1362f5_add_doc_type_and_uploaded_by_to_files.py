"""add_doc_type_and_uploaded_by_to_files

Revision ID: 4db4ae1362f5
Revises: 96b88b39d57e
Create Date: 2025-12-26 11:38:25.743646

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4db4ae1362f5'
down_revision: Union[str, Sequence[str], None] = '96b88b39d57e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Agregar campo doc_type (nullable inicialmente para datos existentes)
    op.add_column('files', sa.Column('doc_type', sa.Text(), nullable=True))
    
    # Agregar campo uploaded_by_user_id (nullable, FK a users)
    op.add_column('files', sa.Column('uploaded_by_user_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_files_uploaded_by_user_id',
        'files', 'users',
        ['uploaded_by_user_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Crear índice para doc_type
    op.create_index(op.f('ix_files_doc_type'), 'files', ['doc_type'], unique=False)
    
    # Agregar constraint para doc_type permitidos
    op.create_check_constraint(
        'check_file_doc_type',
        'files',
        "doc_type IN ('OC','OS','OCT','ECT','OCC','EDO','FCP','FPC','EGRESO','SOPORTE_PAGO','FACTURA_PDF')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('check_file_doc_type', 'files', type_='check')
    op.drop_index(op.f('ix_files_doc_type'), table_name='files')
    op.drop_constraint('fk_files_uploaded_by_user_id', 'files', type_='foreignkey')
    op.drop_column('files', 'uploaded_by_user_id')
    op.drop_column('files', 'doc_type')
