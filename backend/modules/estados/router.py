"""
Router de FastAPI para el módulo de estados.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from db.session import get_db
from modules.estados.repository import EstadoRepository
from modules.estados.service import EstadoService
from modules.estados.schemas import EstadoResponse


router = APIRouter(prefix="/estados", tags=["Estados"])


def get_estado_service(db: AsyncSession = Depends(get_db)) -> EstadoService:
    """Dependency para obtener el servicio de estados."""
    repository = EstadoRepository(db)
    return EstadoService(repository)


@router.get("/", response_model=List[EstadoResponse])
async def list_estados(service: EstadoService = Depends(get_estado_service)):
    """Lista todos los estados disponibles para facturas."""
    return await service.list_estados()
