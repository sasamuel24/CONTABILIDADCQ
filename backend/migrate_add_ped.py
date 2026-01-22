"""
Script para agregar PED al constraint de doc_type en la tabla files.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


async def migrate_local():
    """Migrar base de datos local."""
    print("🔄 Migrando base de datos LOCAL...")
    engine = create_async_engine(
        'postgresql+asyncpg://postgres:Samuel22.@localhost:5432/contabilidadcq'
    )
    
    try:
        async with engine.begin() as conn:
            # Eliminar constraint anterior
            await conn.execute(text(
                'ALTER TABLE files DROP CONSTRAINT IF EXISTS check_file_doc_type'
            ))
            
            # Crear nuevo constraint con PED
            await conn.execute(text(
                """ALTER TABLE files ADD CONSTRAINT check_file_doc_type 
                CHECK (doc_type IN ('OC','OS','OCT','ECT','OCC','EDO','FCP','FPC',
                'EGRESO','SOPORTE_PAGO','FACTURA_PDF','APROBACION_GERENCIA',
                'PEC','EC','PCE','PED'))"""
            ))
            
        print("✅ Migración ejecutada exitosamente en base de datos LOCAL")
    except Exception as e:
        print(f"❌ Error en migración LOCAL: {e}")
    finally:
        await engine.dispose()


async def migrate_rds(password: str):
    """Migrar base de datos RDS."""
    print("\n🔄 Migrando base de datos RDS...")
    engine = create_async_engine(
        f'postgresql+asyncpg://postgres:{password}@database-1.chgqoo4oaal4.us-east-2.rds.amazonaws.com:5432/contabilidadcq'
    )
    
    try:
        async with engine.begin() as conn:
            # Eliminar constraint anterior
            await conn.execute(text(
                'ALTER TABLE files DROP CONSTRAINT IF EXISTS check_file_doc_type'
            ))
            
            # Crear nuevo constraint con PED
            await conn.execute(text(
                """ALTER TABLE files ADD CONSTRAINT check_file_doc_type 
                CHECK (doc_type IN ('OC','OS','OCT','ECT','OCC','EDO','FCP','FPC',
                'EGRESO','SOPORTE_PAGO','FACTURA_PDF','APROBACION_GERENCIA',
                'PEC','EC','PCE','PED'))"""
            ))
            
        print("✅ Migración ejecutada exitosamente en base de datos RDS")
    except Exception as e:
        print(f"❌ Error en migración RDS: {e}")
    finally:
        await engine.dispose()


async def main():
    # Migrar base de datos local
    await migrate_local()
    
    # Migrar base de datos RDS (necesita password)
    print("\n" + "="*60)
    rds_password = input("Ingrese la contraseña de RDS (Enter para omitir): ").strip()
    
    if rds_password:
        await migrate_rds(rds_password)
    else:
        print("⏭️  Migración RDS omitida (no se proporcionó contraseña)")


if __name__ == "__main__":
    asyncio.run(main())
