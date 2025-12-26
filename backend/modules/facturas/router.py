"""
Router de FastAPI para el módulo de facturas.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from db.session import get_db
from modules.facturas.repository import FacturaRepository
from modules.facturas.service import FacturaService
from modules.facturas.schemas import (
    FacturaCreate,
    FacturaResponse,
    FacturasPaginatedResponse,
    EstadoUpdateRequest,
    EstadoUpdateResponse
)
from core.auth import require_api_key


router = APIRouter(prefix="/facturas", tags=["Facturas"])


def get_factura_service(db: AsyncSession = Depends(get_db)) -> FacturaService:
    """Dependency para obtener el servicio de facturas."""
    repository = FacturaRepository(db)
    return FacturaService(repository)


@router.get("/", response_model=FacturasPaginatedResponse)
async def list_facturas(
    skip: int = 0,
    limit: int = 100,
    area_id: Optional[UUID] = Query(None, description="Filtrar por ID de área"),
    service: FacturaService = Depends(get_factura_service)
):
    """Lista todas las facturas con paginación y filtros opcionales."""
    return await service.list_facturas(skip=skip, limit=limit, area_id=area_id)


@router.get("/{factura_id}", response_model=FacturaResponse)
async def get_factura(
    factura_id: UUID,
    service: FacturaService = Depends(get_factura_service)
):
    """Obtiene una factura por ID."""
    return await service.get_factura(factura_id)


@router.get("/by-number/{numero_factura}", response_model=FacturaResponse)
async def get_factura_by_numero(
    numero_factura: str,
    service: FacturaService = Depends(get_factura_service)
):
    """Obtiene una factura por número de factura."""
    return await service.get_factura_by_numero(numero_factura)


@router.post(
    "/",
    response_model=FacturaResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)]
)
async def create_factura(
    factura: FacturaCreate,
    service: FacturaService = Depends(get_factura_service)
):
    """
    Crea una nueva factura.
    
    **Requiere API Key:** Header `x-api-key` con la clave válida.
    """
    return await service.create_factura(factura)


@router.patch("/{factura_id}/estado", response_model=EstadoUpdateResponse)
async def update_factura_estado(
    factura_id: UUID,
    request: EstadoUpdateRequest,
    service: FacturaService = Depends(get_factura_service)
):
    """Actualiza el estado de una factura."""
    return await service.update_estado(factura_id, request.estado_id)
