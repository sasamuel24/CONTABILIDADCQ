"""
Router de FastAPI para el módulo de áreas.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from db.session import get_db
from modules.areas.repository import AreaRepository
from modules.areas.service import AreaService
from modules.areas.schemas import AreaResponse, AreaCreate


router = APIRouter(prefix="/areas", tags=["Áreas"])


def get_area_service(db: AsyncSession = Depends(get_db)) -> AreaService:
    """Dependency para obtener el servicio de áreas."""
    repository = AreaRepository(db)
    return AreaService(repository)


@router.get("/", response_model=List[AreaResponse])
async def list_areas(service: AreaService = Depends(get_area_service)):
    """Lista todas las áreas disponibles."""
    return await service.list_areas()


@router.post("/", response_model=AreaResponse, status_code=201)
async def create_area(
    area_data: AreaCreate,
    service: AreaService = Depends(get_area_service)
):
    """
    Crea una nueva área.
    
    - **nombre**: Nombre único del área (ej: "Mantenimiento", "Arquitectura")
    
    Retorna el área creada con su ID generado.
    
    **Errores**:
    - 400: El área ya existe
    - 422: Validación fallida (nombre vacío o inválido)
    """
    return await service.create_area(area_data)


@router.delete("/{area_id}", status_code=204)
async def delete_area(
    area_id: UUID,
    service: AreaService = Depends(get_area_service)
):
    """
    Elimina un área por su ID.
    
    - **area_id**: ID del área a eliminar
    
    **Errores**:
    - 404: Área no encontrada
    - 409: El área tiene registros asociados y no puede ser eliminada
    """
    await service.delete_area(area_id)
    return None
