"""create_facturas_distribucion_ccco_table

Revision ID: 4f0c53a64cc0
Revises: 77b1106498dc
Create Date: 2026-01-26 11:33:26.050789

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f0c53a64cc0'
down_revision: Union[str, Sequence[str], None] = '77b1106498dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Crear tabla facturas_distribucion_ccco
    op.execute("""
        CREATE TABLE facturas_distribucion_ccco (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            factura_id UUID NOT NULL,
            centro_costo_id UUID NOT NULL,
            centro_operacion_id UUID NOT NULL,
            unidad_negocio_id UUID,
            cuenta_auxiliar_id UUID,
            porcentaje NUMERIC(5, 2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            CONSTRAINT fk_factura_distribucion
                FOREIGN KEY (factura_id) 
                REFERENCES facturas(id) 
                ON DELETE CASCADE,
            
            CONSTRAINT fk_distribucion_centro_costo
                FOREIGN KEY (centro_costo_id) 
                REFERENCES centros_costo(id) 
                ON DELETE RESTRICT,
            
            CONSTRAINT fk_distribucion_centro_operacion
                FOREIGN KEY (centro_operacion_id) 
                REFERENCES centros_operacion(id) 
                ON DELETE RESTRICT,
            
            CONSTRAINT fk_distribucion_unidad_negocio
                FOREIGN KEY (unidad_negocio_id) 
                REFERENCES unidades_negocio(id) 
                ON DELETE RESTRICT,
            
            CONSTRAINT fk_distribucion_cuenta_auxiliar
                FOREIGN KEY (cuenta_auxiliar_id) 
                REFERENCES cuentas_auxiliares(id) 
                ON DELETE RESTRICT,
            
            CONSTRAINT check_porcentaje_valid
                CHECK (porcentaje > 0 AND porcentaje <= 100)
        )
    """)
    
    # Crear índices
    op.create_index('idx_facturas_dist_factura_id', 'facturas_distribucion_ccco', ['factura_id'])
    op.create_index('idx_facturas_dist_centro_costo', 'facturas_distribucion_ccco', ['centro_costo_id'])
    op.create_index('idx_facturas_dist_centro_operacion', 'facturas_distribucion_ccco', ['centro_operacion_id'])
    op.create_index('idx_facturas_dist_unidad_negocio', 'facturas_distribucion_ccco', ['unidad_negocio_id'])
    op.create_index('idx_facturas_dist_cuenta_auxiliar', 'facturas_distribucion_ccco', ['cuenta_auxiliar_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('facturas_distribucion_ccco')
