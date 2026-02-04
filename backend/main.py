"""
Punto de entrada principal de la aplicación FastAPI.
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.openapi.utils import get_openapi
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
from modules.carpetas.router import router as carpetas_router
from modules.carpetas_tesoreria.router import router as carpetas_tesoreria_router
from modules.unidades_negocio.router import router as unidades_negocio_router
from modules.cuentas_auxiliares.router import router as cuentas_auxiliares_router
from modules.distribucion_ccco.router import router as distribucion_ccco_router
from modules.comentarios.router import router as comentarios_router


# Crear instancia de FastAPI
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    description="API para gestión de facturas - Sistema CONTABILIDADCQ",
    docs_url=None,  # Deshabilitamos los docs por defecto
    redoc_url=None,  # Deshabilitamos redoc por defecto
    openapi_url=None  # Deshabilitamos openapi por defecto
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
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
app.include_router(carpetas_router, prefix="/api/v1")
app.include_router(carpetas_tesoreria_router, prefix="/api/v1")
app.include_router(unidades_negocio_router, prefix="/api/v1")
app.include_router(cuentas_auxiliares_router, prefix="/api/v1")
app.include_router(distribucion_ccco_router, prefix="/api/v1")
app.include_router(comentarios_router, prefix="/api/v1")


# Endpoints personalizados para documentación con CORS habilitado
@app.get("/api/v1/openapi.json", include_in_schema=False)
async def get_open_api_endpoint():
    """Endpoint personalizado para OpenAPI schema con CORS."""
    return get_openapi(
        title=settings.app_name,
        version=settings.app_version,
        description="API para gestión de facturas - Sistema CONTABILIDADCQ",
        routes=app.routes,
    )


@app.get("/api/v1/docs", include_in_schema=False)
async def get_documentation():
    """Endpoint personalizado para Swagger UI con CORS."""
    return get_swagger_ui_html(
        openapi_url="/api/v1/openapi.json",
        title=f"{settings.app_name} - Documentación",
    )


@app.get("/api/v1/redoc", include_in_schema=False)
async def get_redoc_documentation():
    """Endpoint personalizado para ReDoc con CORS."""
    return get_redoc_html(
        openapi_url="/api/v1/openapi.json",
        title=f"{settings.app_name} - Documentación",
    )


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
