"""
Catálogo de áreas para asignación de facturas.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List


router = APIRouter(prefix="/areas", tags=["Catálogos"])


class Area(BaseModel):
    """Modelo de área."""
    id: int
    nombre: str
    descripcion: str


# Datos de catálogo en memoria (reemplazar con BD en producción)
AREAS_CATALOGO = [
    Area(id=1, nombre="Mantenimiento", descripcion="Área de mantenimiento general"),
    Area(id=2, nombre="Arquitectura", descripcion="Área de proyectos arquitectónicos"),
    Area(id=3, nombre="Administración", descripcion="Área administrativa"),
    Area(id=4, nombre="Operaciones", descripcion="Área de operaciones"),
]


@router.get("/", response_model=List[Area])
async def get_areas():
    """Obtiene el catálogo de áreas disponibles."""
    return AREAS_CATALOGO


@router.get("/{area_id}", response_model=Area)
async def get_area(area_id: int):
    """Obtiene un área específica por ID."""
    area = next((a for a in AREAS_CATALOGO if a.id == area_id), None)
    if not area:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Área no encontrada")
    return area
