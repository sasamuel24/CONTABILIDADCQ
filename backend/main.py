"""
Punto de entrada principal de la aplicación FastAPI.
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.config import settings
from core.logging import logger
from db.session import get_db
from modules.facturas.router import router as facturas_router
from modules.catalogos.areas import router as areas_router
from modules.catalogos.estados import router as estados_router


# Crear instancia de FastAPI
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(facturas_router, prefix="/api/v1")
app.include_router(areas_router, prefix="/api/v1")
app.include_router(estados_router, prefix="/api/v1")


@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Endpoint de healthcheck que verifica API y conexión a base de datos."""
    logger.info("Health check solicitado")
    
    # Info básica de la API
    health_status = {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
        "database": {}
    }
    
    # Verificar conexión a BD
    try:
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        
        version_result = await db.execute(text("SELECT version()"))
        db_version = version_result.scalar()
        
        health_status["database"] = {
            "status": "connected",
            "type": "PostgreSQL",
            "version": db_version.split(",")[0] if db_version else "unknown"
        }
        logger.info("Conexión a base de datos verificada exitosamente")
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["database"] = {
            "status": "disconnected",
            "error": str(e)
        }
        logger.error(f"Error al conectar con la base de datos: {str(e)}")
    
    return health_status


@app.on_event("startup")
async def startup_event():
    """Evento ejecutado al iniciar la aplicación."""
    logger.info(f"Iniciando {settings.app_name} v{settings.app_version}")


@app.on_event("shutdown")
async def shutdown_event():
    """Evento ejecutado al detener la aplicación."""
    logger.info(f"Deteniendo {settings.app_name}")
