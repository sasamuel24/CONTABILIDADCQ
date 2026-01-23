"""
Router de FastAPI para el módulo de carpetas.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from db.session import get_db
from modules.carpetas.repository import CarpetaRepository
from modules.carpetas.service import CarpetaService
from modules.carpetas.schemas import (
    CarpetaResponse,
    CarpetaCreate,
    CarpetaUpdate,
    CarpetaWithChildren,
    CarpetaSimple
)


router = APIRouter(prefix="/carpetas", tags=["Carpetas"])


def get_carpeta_service(db: AsyncSession = Depends(get_db)) -> CarpetaService:
    """Dependency para obtener el servicio de carpetas."""
    repository = CarpetaRepository(db)
    return CarpetaService(repository)


@router.get("/", response_model=List[CarpetaResponse])
async def list_carpetas(service: CarpetaService = Depends(get_carpeta_service)):
    """
    Lista solo las carpetas raíz con su jerarquía completa anidada.
    
    Retorna una estructura jerárquica de carpetas comenzando desde las carpetas raíz.
    Cada carpeta raíz incluye todas sus subcarpetas anidadas.
    """
    return await service.list_root_folders()


@router.get("/root", response_model=List[CarpetaWithChildren])
async def list_root_folders(service: CarpetaService = Depends(get_carpeta_service)):
    """
    Lista las carpetas raíz con sus subcarpetas.
    
    Retorna una estructura jerárquica de carpetas comenzando desde las carpetas raíz.
    """
    return await service.list_root_folders()


@router.get("/{carpeta_id}", response_model=CarpetaWithChildren)
async def get_carpeta(
    carpeta_id: UUID,
    service: CarpetaService = Depends(get_carpeta_service)
):
    """
    Obtiene una carpeta específica por su ID con sus subcarpetas.
    
    - **carpeta_id**: ID único de la carpeta
    
    **Errores**:
    - 404: Carpeta no encontrada
    """
    return await service.get_carpeta_with_children(carpeta_id)


@router.get("/parent/{parent_id}", response_model=List[CarpetaResponse])
async def get_carpetas_by_parent(
    parent_id: UUID,
    service: CarpetaService = Depends(get_carpeta_service)
):
    """
    Obtiene las subcarpetas de una carpeta específica.
    
    - **parent_id**: ID de la carpeta padre
    """
    return await service.get_carpetas_by_parent(parent_id)


@router.get("/factura/{factura_id}", response_model=List[CarpetaResponse])
async def get_carpetas_by_factura(
    factura_id: UUID,
    service: CarpetaService = Depends(get_carpeta_service)
):
    """
    Obtiene las carpetas asociadas a una factura específica.
    
    - **factura_id**: ID de la factura
    """
    return await service.get_carpetas_by_factura(factura_id)


@router.post("/", response_model=CarpetaResponse, status_code=status.HTTP_201_CREATED)
async def create_carpeta(
    carpeta_data: CarpetaCreate,
    service: CarpetaService = Depends(get_carpeta_service)
):
    """
    Crea una nueva carpeta.
    
    - **nombre**: Nombre de la carpeta (requerido)
    - **parent_id**: ID de la carpeta padre (opcional, null para carpetas raíz)
    - **factura_id**: ID de la factura asociada (opcional)
    
    Retorna la carpeta creada con su ID generado.
    
    **Errores**:
    - 404: Carpeta padre no encontrada
    - 422: Validación fallida
    """
    return await service.create_carpeta(carpeta_data)


@router.put("/{carpeta_id}", response_model=CarpetaResponse)
async def update_carpeta(
    carpeta_id: UUID,
    carpeta_data: CarpetaUpdate,
    service: CarpetaService = Depends(get_carpeta_service)
):
    """
    Actualiza una carpeta existente.
    
    - **carpeta_id**: ID de la carpeta a actualizar
    - **nombre**: Nuevo nombre de la carpeta (opcional)
    - **parent_id**: Nuevo ID de la carpeta padre (opcional)
    - **factura_id**: Nuevo ID de la factura asociada (opcional)
    
    **Errores**:
    - 400: Una carpeta no puede ser su propio padre
    - 404: Carpeta no encontrada
    - 422: Validación fallida
    """
    return await service.update_carpeta(carpeta_id, carpeta_data)


@router.delete("/{carpeta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_carpeta(
    carpeta_id: UUID,
    service: CarpetaService = Depends(get_carpeta_service)
):
    """
    Elimina una carpeta por su ID.
    
    - **carpeta_id**: ID de la carpeta a eliminar
    
    NOTA: Si la carpeta tiene subcarpetas, también se eliminarán (CASCADE).
    
    **Errores**:
    - 404: Carpeta no encontrada
    """
    await service.delete_carpeta(carpeta_id)
