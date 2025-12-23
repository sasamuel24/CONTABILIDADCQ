"""
Router de FastAPI para el módulo de áreas.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from db.session import get_db
from modules.areas.repository import AreaRepository
from modules.areas.service import AreaService
from modules.areas.schemas import AreaResponse


router = APIRouter(prefix="/areas", tags=["Áreas"])


def get_area_service(db: AsyncSession = Depends(get_db)) -> AreaService:
    """Dependency para obtener el servicio de áreas."""
    repository = AreaRepository(db)
    return AreaService(repository)


@router.get("/", response_model=List[AreaResponse])
async def list_areas(service: AreaService = Depends(get_area_service)):
    """Lista todas las áreas disponibles."""
    return await service.list_areas()
