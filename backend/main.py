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

# Importar routers de todos los módulos
from modules.auth.router import router as auth_router
from modules.dashboard.router import router as dashboard_router
from modules.areas.router import router as areas_router
from modules.estados.router import router as estados_router
from modules.facturas.router import router as facturas_router
from modules.files.router import router as files_router
from modules.asignaciones.router import router as asignaciones_router
from modules.centros_costo.router import router as centros_costo_router
from modules.centros_operacion.router import router as centros_operacion_router
from modules.users.router import router as users_router
from modules.roles.router import router as roles_router


# Crear instancia de FastAPI
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    description="API para gestión de facturas - Sistema CONTABILIDADCQ"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers bajo /api/v1
app.include_router(auth_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(areas_router, prefix="/api/v1")
app.include_router(estados_router, prefix="/api/v1")
app.include_router(facturas_router, prefix="/api/v1")
app.include_router(files_router, prefix="/api/v1")
app.include_router(asignaciones_router, prefix="/api/v1")
app.include_router(centros_costo_router, prefix="/api/v1")
app.include_router(centros_operacion_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(roles_router, prefix="/api/v1")


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
