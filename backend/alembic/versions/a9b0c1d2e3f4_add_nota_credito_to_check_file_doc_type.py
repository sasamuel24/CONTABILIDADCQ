"""add NOTA_CREDITO to check_file_doc_type constraint

Revision ID: a9b0c1d2e3f4
Revises: f8b9c0d1e2f3
Create Date: 2026-05-13 18:20:00.000000

"""
from alembic import op

revision = 'a9b0c1d2e3f4'
down_revision = 'f8b9c0d1e2f3'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('check_file_doc_type', 'files', type_='check')
    op.create_check_constraint(
        'check_file_doc_type',
        'files',
        "doc_type = ANY (ARRAY['OC','OS','OCT','ECT','OCC','EDO','FCP','FPC','EGRESO',"
        "'SOPORTE_PAGO','FACTURA_PDF','APROBACION_GERENCIA','PEC','EC','PCE','PED',"
        "'SOPORTE_INVENTARIO','NOTA_CREDITO'])"
    )


def downgrade():
    op.drop_constraint('check_file_doc_type', 'files', type_='check')
    op.create_check_constraint(
        'check_file_doc_type',
        'files',
        "doc_type = ANY (ARRAY['OC','OS','OCT','ECT','OCC','EDO','FCP','FPC','EGRESO',"
        "'SOPORTE_PAGO','FACTURA_PDF','APROBACION_GERENCIA','PEC','EC','PCE','PED'])"
    )
