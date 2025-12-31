"""
Script para actualizar códigos de áreas manualmente.
Ejecutar: python -m scripts.update_area_codes
"""
import asyncio
from sqlalchemy import text
from db.session import AsyncSessionLocal


async def update_area_codes():
    """Actualiza los códigos de las áreas basándose en sus nombres."""
    
    # Mapeo específico por nombre exacto
    area_code_mapping = {
        'Facturación': 'fact',
        'Arquitectura': 'arq',
        'Contabilidad': 'cont',
        'Tesoreria': 'tes',
        'Administración': 'admin',
        'Mantenimiento': 'mant',
        'Operaciones': 'oper',
        'Marlin': 'marlin',
    }
    
    async with AsyncSessionLocal() as session:
        # Obtener todas las áreas
        result = await session.execute(text("SELECT id, nombre, code FROM areas"))
        areas = result.fetchall()
        
        print(f"\nÁreas encontradas: {len(areas)}")
        print("-" * 80)
        
        for area_id, nombre, current_code in areas:
            # Buscar el código correcto en el mapeo
            new_code = area_code_mapping.get(nombre)
            
            if not new_code:
                # Si no está en el mapeo, usar las primeras 4 letras
                new_code = nombre[:4].lower().replace(' ', '')
            
            if current_code != new_code:
                print(f"Actualizando: {nombre}")
                print(f"  ID: {area_id}")
                print(f"  Code actual: {current_code}")
                print(f"  Code nuevo: {new_code}")
                
                await session.execute(
                    text("UPDATE areas SET code = :code WHERE id = :id"),
                    {"code": new_code, "id": area_id}
                )
            else:
                print(f"OK: {nombre} (code={current_code})")
        
        await session.commit()
        print("\n✓ Códigos de áreas actualizados exitosamente")


if __name__ == "__main__":
    asyncio.run(update_area_codes())
