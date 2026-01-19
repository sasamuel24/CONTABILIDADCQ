"""
Script para limpiar datos de facturas de la base de datos.
Uso: python scripts/clean_facturas.py
"""
import sys
import os
from pathlib import Path

# Agregar el directorio raíz al path para importar módulos
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from sqlalchemy import text
from db.session import AsyncSessionLocal
from core.logging import logger


async def clean_facturas():
    """Eliminar todas las facturas y datos relacionados."""
    
    # Confirmar acción
    print("⚠️  ADVERTENCIA: Este script eliminará TODAS las facturas y datos relacionados.")
    print("Esta acción NO se puede deshacer.")
    confirmacion = input("\n¿Estás seguro? Escribe 'SI ELIMINAR' para continuar: ")
    
    if confirmacion != "SI ELIMINAR":
        print("❌ Operación cancelada.")
        return
    
    try:
        async with AsyncSessionLocal() as session:
            # Contar registros antes de eliminar
            print("\n📊 Contando registros actuales...")
            
            result_facturas = await session.execute(text("SELECT COUNT(*) FROM facturas"))
            count_facturas = result_facturas.scalar()
            
            print(f"  - Facturas: {count_facturas}")
            
            if count_facturas == 0:
                print("\n✅ No hay facturas para eliminar.")
                return
            
            # Última confirmación
            confirmacion_final = input(f"\n⚠️  Se eliminarán {count_facturas} facturas. ¿Continuar? (s/n): ")
            if confirmacion_final.lower() != 's':
                print("❌ Operación cancelada.")
                return
            
            # Eliminar en orden (respetando foreign keys)
            print("\n🗑️  Eliminando datos...")
            
            # Eliminar archivos asociados a facturas (si existe la tabla)
            try:
                await session.execute(text("DELETE FROM files WHERE factura_id IS NOT NULL"))
                await session.commit()
                print("  ✓ Archivos eliminados")
            except Exception as e:
                await session.rollback()
                print(f"  ⊘ Archivos: {str(e)[:50]}")
            
            # Eliminar facturas
            await session.execute(text("DELETE FROM facturas"))
            await session.commit()
            print("  ✓ Facturas eliminadas")
            
            # Verificar eliminación
            result_check = await session.execute(text("SELECT COUNT(*) FROM facturas"))
            count_check = result_check.scalar()
            
            if count_check == 0:
                print(f"\n✅ Limpieza completada exitosamente.")
                print(f"   - {count_facturas} facturas eliminadas")
            else:
                print(f"\n⚠️  Advertencia: Aún quedan {count_check} facturas en la base de datos.")
                
    except Exception as e:
        logger.error(f"Error al limpiar facturas: {e}")
        print(f"\n❌ Error: {e}")
        raise


def main():
    """Función principal."""
    print("═" * 70)
    print("🧹 SCRIPT DE LIMPIEZA DE FACTURAS")
    print("═" * 70)
    asyncio.run(clean_facturas())


if __name__ == "__main__":
    main()
