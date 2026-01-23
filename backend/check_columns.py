"""Script para verificar columnas en las tablas."""
import asyncio
from sqlalchemy import text, inspect
from db.session import engine


async def check_columns():
    async with engine.connect() as conn:
        # Verificar columnas de facturas
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='facturas' AND column_name='carpeta_id'
        """))
        facturas_carpeta = result.fetchone()
        
        # Verificar columnas de carpetas
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='carpetas' AND column_name='factura_id'
        """))
        carpetas_factura = result.fetchone()
        
        print("=" * 60)
        print("VERIFICACIÓN DE RELACIONES")
        print("=" * 60)
        print(f"✓ facturas.carpeta_id existe: {bool(facturas_carpeta)}")
        print(f"✓ carpetas.factura_id existe: {bool(carpetas_factura)}")
        print("=" * 60)
        
        if facturas_carpeta:
            print("\n✅ Relación facturas -> carpetas: EXISTE")
        else:
            print("\n❌ Relación facturas -> carpetas: NO EXISTE")
            
        if carpetas_factura:
            print("✅ Relación carpetas -> facturas: EXISTE")
        else:
            print("❌ Relación carpetas -> facturas: NO EXISTE")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(check_columns())
