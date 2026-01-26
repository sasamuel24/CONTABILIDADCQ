"""
Script para crear la tabla facturas_distribucion_ccco en la base de datos local
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from sqlalchemy import text
from db.session import engine

async def create_table():
    """Crear tabla facturas_distribucion_ccco con todos sus constraints e índices"""
    
    sql_statements = [
        # Crear tabla
        """
        CREATE TABLE IF NOT EXISTS facturas_distribucion_ccco (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            factura_id UUID NOT NULL,
            centro_costo_id UUID NOT NULL,
            centro_operacion_id UUID NOT NULL,
            unidad_negocio_id UUID,
            cuenta_auxiliar_id UUID,
            porcentaje NUMERIC(5, 2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            -- Foreign Keys
            CONSTRAINT fk_factura
                FOREIGN KEY (factura_id) 
                REFERENCES facturas(id) 
                ON DELETE CASCADE,
            
            CONSTRAINT fk_centro_costo
                FOREIGN KEY (centro_costo_id) 
                REFERENCES centros_costo(id) 
                ON DELETE RESTRICT,
            
            CONSTRAINT fk_centro_operacion
                FOREIGN KEY (centro_operacion_id) 
                REFERENCES centros_operacion(id) 
                ON DELETE RESTRICT,
            
            CONSTRAINT fk_unidad_negocio
                FOREIGN KEY (unidad_negocio_id) 
                REFERENCES unidades_negocio(id) 
                ON DELETE RESTRICT,
            
            CONSTRAINT fk_cuenta_auxiliar
                FOREIGN KEY (cuenta_auxiliar_id) 
                REFERENCES cuentas_auxiliares(id) 
                ON DELETE RESTRICT,
            
            -- Check constraint para porcentaje
            CONSTRAINT check_porcentaje_valid
                CHECK (porcentaje > 0 AND porcentaje <= 100)
        );
        """,
        
        # Crear índices
        """
        CREATE INDEX IF NOT EXISTS idx_facturas_dist_factura_id 
            ON facturas_distribucion_ccco(factura_id);
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_facturas_dist_centro_costo 
            ON facturas_distribucion_ccco(centro_costo_id);
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_facturas_dist_centro_operacion 
            ON facturas_distribucion_ccco(centro_operacion_id);
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_facturas_dist_unidad_negocio 
            ON facturas_distribucion_ccco(unidad_negocio_id);
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_facturas_dist_cuenta_auxiliar 
            ON facturas_distribucion_ccco(cuenta_auxiliar_id);
        """
    ]
    
    async with engine.begin() as conn:
        for i, sql in enumerate(sql_statements, 1):
            print(f"Ejecutando statement {i}/{len(sql_statements)}...")
            await conn.execute(text(sql))
            print(f"✓ Statement {i} ejecutado correctamente")
    
    # Verificar que la tabla se creó
    async with engine.begin() as conn:
        result = await conn.execute(text("""
            SELECT tablename 
            FROM pg_tables 
            WHERE tablename = 'facturas_distribucion_ccco'
        """))
        row = result.fetchone()
        
        if row:
            print("\n✅ Tabla 'facturas_distribucion_ccco' creada exitosamente")
            
            # Verificar columnas
            result = await conn.execute(text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'facturas_distribucion_ccco'
                ORDER BY ordinal_position
            """))
            
            print("\nColumnas creadas:")
            for row in result:
                nullable = "NULL" if row[2] == "YES" else "NOT NULL"
                print(f"  - {row[0]}: {row[1]} ({nullable})")
            
            # Verificar índices
            result = await conn.execute(text("""
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'facturas_distribucion_ccco'
            """))
            
            print("\nÍndices creados:")
            for row in result:
                print(f"  - {row[0]}")
        else:
            print("\n❌ Error: La tabla no se creó correctamente")

if __name__ == "__main__":
    print("Creando tabla facturas_distribucion_ccco...\n")
    asyncio.run(create_table())
    print("\n✅ Script completado")
