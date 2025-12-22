"""
Punto de entrada principal de la aplicación FastAPI.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.logging import logger
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
async def health_check():
    """Endpoint de healthcheck para verificar que la API está funcionando."""
    logger.info("Health check solicitado")
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version
    }


@app.on_event("startup")
async def startup_event():
    """Evento ejecutado al iniciar la aplicación."""
    logger.info(f"Iniciando {settings.app_name} v{settings.app_version}")


@app.on_event("shutdown")
async def shutdown_event():
    """Evento ejecutado al detener la aplicación."""
    logger.info(f"Deteniendo {settings.app_name}")
