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
            
            result_files = await session.execute(text("SELECT COUNT(*) FROM files WHERE factura_id IS NOT NULL"))
            count_files = result_files.scalar()
            
            result_asignaciones = await session.execute(text("SELECT COUNT(*) FROM factura_asignaciones"))
            count_asignaciones = result_asignaciones.scalar()
            
            result_codigos = await session.execute(text("SELECT COUNT(*) FROM inventarios_codigos"))
            count_codigos = result_codigos.scalar()
            
            print(f"  - Facturas: {count_facturas}")
            print(f"  - Archivos adjuntos: {count_files}")
            print(f"  - Asignaciones: {count_asignaciones}")
            print(f"  - Códigos de inventario: {count_codigos}")
            
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
            
            # 1. Códigos de inventarios
            await session.execute(text("DELETE FROM inventarios_codigos"))
            print("  ✓ Códigos de inventario eliminados")
            
            # 2. Asignaciones de facturas
            await session.execute(text("DELETE FROM factura_asignaciones"))
            print("  ✓ Asignaciones eliminadas")
            
            # 3. Archivos asociados a facturas
            await session.execute(text("DELETE FROM files WHERE factura_id IS NOT NULL"))
            print("  ✓ Archivos eliminados")
            
            # 4. Facturas
            await session.execute(text("DELETE FROM facturas"))
            print("  ✓ Facturas eliminadas")
            
            # Commit de los cambios
            await session.commit()
            
            # Verificar eliminación
            result_check = await session.execute(text("SELECT COUNT(*) FROM facturas"))
            count_check = result_check.scalar()
            
            if count_check == 0:
                print(f"\n✅ Limpieza completada exitosamente.")
                print(f"   - {count_facturas} facturas eliminadas")
                print(f"   - {count_files} archivos eliminados")
                print(f"   - {count_asignaciones} asignaciones eliminadas")
                print(f"   - {count_codigos} códigos eliminados")
            else:
                print(f"\n⚠️  Advertencia: Aún quedan {count_check} facturas en la base de datos.")
                
    except Exception as e:
        logger.error(f"Error al limpiar facturas: {e}")
        print(f"\n❌ Error: {e}")
        raise


async def clean_all_data():
    """Eliminar TODOS los datos (facturas, áreas, usuarios, etc.) - ¡PELIGROSO!"""
    
    print("⚠️⚠️⚠️  ADVERTENCIA MÁXIMA  ⚠️⚠️⚠️")
    print("Este script eliminará TODOS los datos de TODAS las tablas.")
    print("Incluyendo: facturas, archivos, usuarios, áreas, estados, centros, roles, etc.")
    print("Esta acción NO se puede deshacer y dejará la base de datos casi vacía.")
    
    confirmacion = input("\n¿REALMENTE quieres hacer esto? Escribe 'ELIMINAR TODO': ")
    
    if confirmacion != "ELIMINAR TODO":
        print("❌ Operación cancelada.")
        return
    
    try:
        async with AsyncSessionLocal() as session:
            print("\n🗑️  Eliminando TODOS los datos...")
            
            # Orden de eliminación respetando foreign keys
            tables = [
                "inventarios_codigos",
                "factura_asignaciones",
                "files",
                "facturas",
                "centros_operacion",
                "centros_costo",
                "users",
                "roles",
                # No eliminar áreas ni estados (datos maestros)
            ]
            
            for table in tables:
                await session.execute(text(f"DELETE FROM {table}"))
                print(f"  ✓ Tabla {table} limpiada")
            
            await session.commit()
            print("\n✅ Limpieza total completada.")
            
    except Exception as e:
        logger.error(f"Error al limpiar datos: {e}")
        print(f"\n❌ Error: {e}")
        raise


def main():
    """Función principal."""
    import sys
    
    print("═" * 70)
    print("🧹 SCRIPT DE LIMPIEZA DE BASE DE DATOS")
    print("═" * 70)
    print("\nOpciones:")
    print("1. Limpiar solo facturas y datos relacionados (RECOMENDADO)")
    print("2. Limpiar TODOS los datos (¡PELIGROSO!)")
    print("0. Cancelar")
    
    opcion = input("\nSelecciona una opción (0-2): ")
    
    if opcion == "1":
        asyncio.run(clean_facturas())
    elif opcion == "2":
        asyncio.run(clean_all_data())
    elif opcion == "0":
        print("❌ Operación cancelada.")
    else:
        print("❌ Opción inválida.")


if __name__ == "__main__":
    main()
