"""
Script para corregir los content_types de archivos existentes en la base de datos.
"""
import asyncio
import sys
from pathlib import Path
import mimetypes

# Agregar el directorio raíz al PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, update
from db.session import AsyncSessionLocal
from db.models import File
from core.logging import logger


def detect_content_type(filename: str) -> str:
    """
    Detecta el content_type basado en la extensión del archivo.
    """
    if not mimetypes.inited:
        mimetypes.init()
    
    content_type, _ = mimetypes.guess_type(filename)
    
    if not content_type:
        ext = Path(filename).suffix.lower()
        manual_map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.pdf': 'application/pdf',
            '.webp': 'image/webp'
        }
        content_type = manual_map.get(ext, 'application/octet-stream')
    
    return content_type


async def fix_content_types():
    """
    Corrige los content_types de todos los archivos en la base de datos
    basándose en la extensión del archivo.
    """
    async with AsyncSessionLocal() as session:
        # Obtener todos los archivos
        result = await session.execute(select(File))
        files = result.scalars().all()
        
        updated_count = 0
        error_count = 0
        
        for file in files:
            try:
                # Detectar el content_type correcto basado en el filename
                detected_content_type = detect_content_type(file.filename)
                
                # Si el content_type actual es diferente al detectado, actualizarlo
                if file.content_type != detected_content_type:
                    logger.info(
                        f"Actualizando archivo {file.id} ({file.filename}): "
                        f"{file.content_type} -> {detected_content_type}"
                    )
                    
                    file.content_type = detected_content_type
                    updated_count += 1
                
            except Exception as e:
                logger.error(f"Error procesando archivo {file.id}: {e}")
                error_count += 1
        
        # Guardar los cambios
        if updated_count > 0:
            await session.commit()
            logger.info(f"✅ Actualizados {updated_count} archivos")
        else:
            logger.info("No se encontraron archivos para actualizar")
        
        if error_count > 0:
            logger.warning(f"⚠️  {error_count} archivos con errores")
        
        return updated_count, error_count


async def main():
    """Función principal."""
    logger.info("Iniciando corrección de content_types...")
    
    try:
        updated, errors = await fix_content_types()
        
        print(f"\n{'='*60}")
        print(f"Resumen:")
        print(f"  - Archivos actualizados: {updated}")
        print(f"  - Errores: {errors}")
        print(f"{'='*60}\n")
        
    except Exception as e:
        logger.error(f"Error ejecutando script: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
