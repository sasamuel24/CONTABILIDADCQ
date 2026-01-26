"""
Script para poblar la tabla cuentas_auxiliares desde el archivo Cuentax.txt
Ejecutar: python scripts/populate_cuentas_from_file.py
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.session import AsyncSessionLocal
from db.models import CuentaAuxiliar


async def populate_cuentas():
    """Pobla la tabla cuentas_auxiliares con los datos del archivo Cuentax.txt."""
    
    # Leer el archivo
    script_dir = os.path.dirname(__file__)
    file_path = os.path.join(script_dir, 'Cuentax.txt')
    
    print(f"Leyendo archivo: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"❌ Error: El archivo {file_path} no existe")
        return
    
    cuentas_data = []
    
    # Intentar diferentes encodings
    encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
    lines = None
    
    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                lines = f.readlines()
                print(f"✅ Archivo leído con encoding: {encoding}")
                break
        except UnicodeDecodeError:
            continue
    
    if lines is None:
        print("❌ Error: No se pudo leer el archivo con ningún encoding")
        return
    
    # Saltar la primera línea (encabezado: Código\tDescripción)
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        
        # Separar por tabulador
        parts = line.split('\t')
        if len(parts) >= 2:
            codigo = parts[0].strip()
            descripcion = parts[1].strip()
            cuentas_data.append((codigo, descripcion))
    print(f"Encontradas {len(cuentas_data)} cuentas en el archivo")
    
    async with AsyncSessionLocal() as session:
        try:
            # Verificar cuántas cuentas ya existen
            result = await session.execute(select(CuentaAuxiliar))
            existing_count = len(result.scalars().all())
            
            if existing_count > 0:
                print(f"⚠️  Ya existen {existing_count} cuentas en la base de datos")
                respuesta = input("¿Deseas continuar y agregar las nuevas? (s/n): ")
                if respuesta.lower() != 's':
                    print("Operación cancelada")
                    return
            
            print(f"Insertando {len(cuentas_data)} cuentas auxiliares...")
            
            inserted = 0
            skipped = 0
            
            for codigo, descripcion in cuentas_data:
                # Verificar si ya existe
                result = await session.execute(
                    select(CuentaAuxiliar).where(CuentaAuxiliar.codigo == codigo)
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    skipped += 1
                    continue
                
                cuenta = CuentaAuxiliar(
                    codigo=codigo,
                    descripcion=descripcion,
                    activa=True
                )
                session.add(cuenta)
                inserted += 1
                
                # Commit cada 100 registros para evitar problemas de memoria
                if inserted % 100 == 0:
                    await session.commit()
                    print(f"  Insertadas {inserted} cuentas...")
            
            # Commit final
            await session.commit()
            
            print("=" * 60)
            print(f"✅ Proceso completado exitosamente")
            print(f"   - Cuentas insertadas: {inserted}")
            print(f"   - Cuentas omitidas (ya existían): {skipped}")
            print(f"   - Total en archivo: {len(cuentas_data)}")
            print("=" * 60)
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error al insertar cuentas: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    print("=" * 60)
    print("Script de población de Cuentas Auxiliares")
    print("=" * 60)
    
    asyncio.run(populate_cuentas())
