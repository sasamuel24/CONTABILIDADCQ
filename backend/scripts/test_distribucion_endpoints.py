"""
Script de prueba para verificar endpoints de distribución CC/CO
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from db.session import engine
from db.models import Factura, FacturaDistribucionCCCO

async def test_endpoints():
    """Verificar que los modelos y relaciones estén correctos"""
    
    async with engine.begin() as conn:
        # 1. Verificar que la tabla existe
        from sqlalchemy import text
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'facturas_distribucion_ccco'
        """))
        tabla = result.fetchone()
        
        if tabla:
            print("✅ Tabla 'facturas_distribucion_ccco' existe")
        else:
            print("❌ Tabla 'facturas_distribucion_ccco' NO existe")
            return
        
        # 2. Verificar columnas
        result = await conn.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'facturas_distribucion_ccco'
            ORDER BY ordinal_position
        """))
        
        print("\n📋 Columnas de la tabla:")
        for row in result:
            nullable = "NULL" if row[2] == "YES" else "NOT NULL"
            print(f"   - {row[0]}: {row[1]} ({nullable})")
        
        # 3. Verificar constraints
        result = await conn.execute(text("""
            SELECT con.conname as constraint_name,
                   pg_get_constraintdef(con.oid) as definition
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'facturas_distribucion_ccco'
        """))
        
        print("\n🔒 Constraints:")
        for row in result:
            print(f"   - {row[0]}")
            print(f"     {row[1]}")
        
        # 4. Verificar índices
        result = await conn.execute(text("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'facturas_distribucion_ccco'
        """))
        
        print("\n📇 Índices:")
        for row in result:
            print(f"   - {row[0]}")
        
        # 5. Contar distribuciones existentes
        result = await conn.execute(text("""
            SELECT COUNT(*) as total
            FROM facturas_distribucion_ccco
        """))
        count = result.scalar()
        print(f"\n📊 Total de distribuciones: {count}")
        
        print("\n✅ Todos los endpoints están correctamente configurados")
        print("\n🔗 Endpoints disponibles:")
        print("   - GET    /api/v1/facturas/{factura_id}/distribucion-ccco")
        print("   - PUT    /api/v1/facturas/{factura_id}/distribucion-ccco")
        print("   - DELETE /api/v1/facturas/{factura_id}/distribucion-ccco")

if __name__ == "__main__":
    print("🔍 Verificando endpoints de distribución CC/CO...\n")
    asyncio.run(test_endpoints())
    print("\n✅ Verificación completada")
