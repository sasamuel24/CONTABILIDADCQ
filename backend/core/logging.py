"""
Configuración de logging para la aplicación.
"""
import logging
import sys
from core.config import settings


def setup_logging():
    """Configura el sistema de logging de la aplicación."""
    
    # Configurar formato de logs
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Configurar nivel de log desde configuración
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    
    # Configurar logging básico
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Crear logger para la aplicación
    logger = logging.getLogger("contabilidadcq")
    logger.setLevel(log_level)
    
    return logger


# Logger global
logger = setup_logging()
