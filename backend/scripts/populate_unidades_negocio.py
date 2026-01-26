"""
Script para poblar la tabla unidades_negocio con datos iniciales.
Uso: python scripts/populate_unidades_negocio.py
"""
import sys
import os
from pathlib import Path

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Cargar variables de entorno
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

import asyncio
import uuid
from sqlalchemy import text
from db.session import AsyncSessionLocal
from core.logging import logger


UNIDADES_NEGOCIO = [
    ("01", "CAFÉ CONSUMO"),
    ("02", "CAFÉ GOURMET"),
    ("03", "CAFE ESPECIAL DE ORIGEN"),
    ("04", "CAFE INSTANTANEO"),
    ("05", "GALLETAS CAFECITAS"),
    ("06", "MERENGUES"),
    ("07", "AREQUIPE"),
    ("08", "MERMELADA"),
    ("09", "CHOCOFFES"),
    ("10", "GALLETAS DE AVENA"),
    ("11", "PASTELERIA"),
    ("12", "SOUVENIRS"),
    ("13", "TIENDAS DE CAFE"),
    ("14", "RESTAURANTE"),
    ("15", "EXPORTACIONES"),
    ("16", "MAQUILA BRITT"),
    ("17", "CAFÉ ORGÁNICO"),
    ("18", "ESCUELA DE CAFE"),
    ("19", "VENTAS NACIONALES"),
    ("20", "CAFE COSECHA ESPECIAL"),
    ("21", "CAPSULAS DE CAFE"),
    ("22", "MAQUILA PRICE SMART"),
    ("23", "MAQUINAS"),
    ("24", "TIENDA VIRTUAL"),
    ("25", "DULCES CARAMELO"),
    ("26", "FINCA SAN PEDRO"),
    ("27", "CAFÉ PACAMARA"),
    ("28", "CONSTRUCCION FABRICA"),
    ("29", "CAFE SUBASTADO"),
    ("30", "CAFE PROCESOS"),
    ("31", "CAFE VARIETALES"),
    ("32", "MAQUILA PEÑON"),
    ("33", "AUDITORIA INTERNA"),
    ("34", "MAQUILA CAPSULAS"),
    ("35", "BARRANQUERO"),
    ("36", "TIENDA ARABIA"),
    ("37", "CAFE VERDE"),
    ("38", "CAFÉ DESCAFEINADO"),
    ("39", "PRESIDENCIA"),
    ("40", "G.GENERAL"),
    ("41", "G.ADMINISTRATIVA"),
    ("42", "G.FINANCIERA"),
    ("43", "G.MERCADEO"),
    ("44", "G.INNOVACION"),
    ("45", "G.OPERATIVA"),
    ("46", "CONSTRUCCION CEDI FASE 2"),
    ("47", "CALIDAD CAFE"),
    ("48", "G.EXPANSION"),
    ("49", "LOGISTICA"),
    ("50", "MANTENIMIENTO"),
    ("51", "TIC"),
    ("52", "GESTION HUMANA"),
    ("53", "CONTROL CALIDAD"),
    ("54", "BIENESTAR"),
    ("55", "SIG"),
    ("56", "CAFÉ BLEND TRADICION"),
    ("57", "ARQUITECTURA"),
    ("58", "COMPRAS"),
    ("99", "GENERAL"),
]


async def populate_unidades():
    """Poblar la tabla unidades_negocio con datos iniciales."""
    
    try:
        async with AsyncSessionLocal() as session:
            # Verificar si ya existen datos
            result = await session.execute(text("SELECT COUNT(*) FROM unidades_negocio"))
            count = result.scalar()
            
            if count > 0:
                print(f"⚠️  Ya existen {count} unidades de negocio en la base de datos.")
                confirmacion = input("¿Desea eliminar y recrear los datos? (s/n): ")
                if confirmacion.lower() != 's':
                    print("❌ Operación cancelada.")
                    return
                
                # Eliminar datos existentes
                await session.execute(text("DELETE FROM unidades_negocio"))
                print("✓ Datos existentes eliminados")
            
            # Insertar nuevos datos
            print(f"\n📊 Insertando {len(UNIDADES_NEGOCIO)} unidades de negocio...")
            
            for codigo, descripcion in UNIDADES_NEGOCIO:
                await session.execute(
                    text("""
                        INSERT INTO unidades_negocio (id, codigo, descripcion, activa, created_at, updated_at)
                        VALUES (:id, :codigo, :descripcion, true, now(), now())
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "codigo": codigo,
                        "descripcion": descripcion
                    }
                )
            
            # Commit
            await session.commit()
            
            # Verificar inserción
            result = await session.execute(text("SELECT COUNT(*) FROM unidades_negocio"))
            final_count = result.scalar()
            
            print(f"\n✅ Proceso completado exitosamente!")
            print(f"   Total de unidades de negocio: {final_count}")
            
            # Mostrar algunas unidades
            result = await session.execute(
                text("SELECT codigo, descripcion FROM unidades_negocio ORDER BY codigo LIMIT 5")
            )
            print("\n📋 Primeras 5 unidades de negocio:")
            for row in result.fetchall():
                print(f"   {row[0]} - {row[1]}")
            
    except Exception as e:
        logger.error(f"Error al poblar unidades de negocio: {e}")
        print(f"\n❌ Error: {e}")
        raise


def main():
    """Función principal."""
    print("=" * 70)
    print("POBLACIÓN DE TABLA UNIDADES DE NEGOCIO")
    print("=" * 70)
    print()
    
    asyncio.run(populate_unidades())


if __name__ == "__main__":
    main()
