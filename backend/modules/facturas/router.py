"""
Router de FastAPI para el módulo de facturas.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from db.session import get_db
from modules.facturas.repository import FacturaRepository
from modules.facturas.service import FacturaService
from modules.facturas.schemas import FacturaCreate, FacturaUpdate, FacturaResponse


router = APIRouter(prefix="/facturas", tags=["Facturas"])


def get_factura_service(db: AsyncSession = Depends(get_db)) -> FacturaService:
    """Dependency para obtener el servicio de facturas."""
    repository = FacturaRepository(db)
    return FacturaService(repository)


@router.get("/", response_model=List[FacturaResponse])
async def list_facturas(
    skip: int = 0,
    limit: int = 100,
    service: FacturaService = Depends(get_factura_service)
):
    """Lista todas las facturas con paginación."""
    return await service.list_facturas(skip=skip, limit=limit)


@router.get("/{factura_id}", response_model=FacturaResponse)
async def get_factura(
    factura_id: int,
    service: FacturaService = Depends(get_factura_service)
):
    """Obtiene una factura por ID."""
    try:
        return await service.get_factura(factura_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/", response_model=FacturaResponse, status_code=status.HTTP_201_CREATED)
async def create_factura(
    factura: FacturaCreate,
    service: FacturaService = Depends(get_factura_service)
):
    """Crea una nueva factura."""
    return await service.create_factura(factura)


@router.patch("/{factura_id}", response_model=FacturaResponse)
async def update_factura(
    factura_id: int,
    factura: FacturaUpdate,
    service: FacturaService = Depends(get_factura_service)
):
    """Actualiza una factura existente (estado, área asignada)."""
    try:
        return await service.update_factura(factura_id, factura)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
