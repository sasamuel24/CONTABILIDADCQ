"""
Router para endpoints de carpetas de tesorería.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from db.session import get_db
from core.auth import get_current_user
from .service import CarpetaTesoreriaService
from .schemas import (
    CarpetaTesoreriaCreate,
    CarpetaTesoreriaUpdate,
    CarpetaTesoreriaResponse,
    CarpetaTesoreriaWithChildren,
    FacturaEnCarpetaTesoreria
)

router = APIRouter(prefix="/carpetas-tesoreria", tags=["carpetas_tesoreria"])


@router.get("/", response_model=List[CarpetaTesoreriaWithChildren])
async def get_carpetas(
    parent_id: Optional[UUID] = Query(None, description="ID de la carpeta padre"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Obtiene todas las carpetas de tesorería, opcionalmente filtradas por parent_id."""
    service = CarpetaTesoreriaService(db)
    return await service.get_all_carpetas(parent_id=parent_id)


@router.get("/search", response_model=List[CarpetaTesoreriaResponse])
async def search_carpetas(
    q: str = Query(..., min_length=1, description="Término de búsqueda"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Busca carpetas de tesorería por nombre."""
    service = CarpetaTesoreriaService(db)
    return await service.search_carpetas(q)


@router.get("/{carpeta_id}", response_model=CarpetaTesoreriaResponse)
async def get_carpeta(
    carpeta_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Obtiene una carpeta de tesorería por ID."""
    service = CarpetaTesoreriaService(db)
    carpeta = await service.get_carpeta(carpeta_id)
    if not carpeta:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada")
    return carpeta


@router.post("/", response_model=CarpetaTesoreriaResponse, status_code=201)
async def create_carpeta(
    data: CarpetaTesoreriaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Crea una nueva carpeta de tesorería."""
    service = CarpetaTesoreriaService(db)
    try:
        return await service.create_carpeta(data, created_by=UUID(current_user["user_id"]))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{carpeta_id}", response_model=CarpetaTesoreriaResponse)
async def update_carpeta(
    carpeta_id: UUID,
    data: CarpetaTesoreriaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Actualiza una carpeta de tesorería existente."""
    service = CarpetaTesoreriaService(db)
    try:
        carpeta = await service.update_carpeta(carpeta_id, data)
        if not carpeta:
            raise HTTPException(status_code=404, detail="Carpeta no encontrada")
        return carpeta
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{carpeta_id}", status_code=204)
async def delete_carpeta(
    carpeta_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Elimina una carpeta de tesorería y sus hijos en cascada."""
    service = CarpetaTesoreriaService(db)
    success = await service.delete_carpeta(carpeta_id)
    if not success:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada")


@router.get("/{carpeta_id}/facturas", response_model=List[FacturaEnCarpetaTesoreria])
async def get_facturas_by_carpeta(
    carpeta_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Obtiene todas las facturas asignadas a una carpeta de tesorería."""
    service = CarpetaTesoreriaService(db)
    return await service.get_facturas_by_carpeta(carpeta_id)


@router.post("/facturas/{factura_id}/asignar")
async def asignar_factura_a_carpeta(
    factura_id: UUID,
    carpeta_id: Optional[UUID] = Query(None, description="ID de la carpeta o null para desasignar"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Asigna o desasigna una factura a una carpeta de tesorería."""
    service = CarpetaTesoreriaService(db)
    try:
        result = await service.asignar_factura(factura_id, carpeta_id)
        if not result:
            raise HTTPException(status_code=404, detail="Factura no encontrada")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
