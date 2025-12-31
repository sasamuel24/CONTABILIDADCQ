"""
Router de API para roles.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from core.auth import get_current_user
from core.logging import logger
from db.session import get_db
from modules.roles.service import RoleService
from modules.roles.schemas import (
    RoleCreate, RoleUpdate, RoleResponse, RolesListResponse
)


router = APIRouter(
    prefix="/roles",
    tags=["Roles"]
)


def get_role_service(db: AsyncSession = Depends(get_db)) -> RoleService:
    """Dependencia para obtener instancia del servicio."""
    return RoleService(db)


@router.get(
    "/",
    response_model=RolesListResponse,
    summary="Listar todos los roles",
    description="Obtiene la lista completa de roles disponibles en el sistema"
)
async def get_roles(
    is_active: Optional[bool] = Query(None, description="Filtrar por estado activo/inactivo"),
    current_user: dict = Depends(get_current_user),
    service: RoleService = Depends(get_role_service)
):
    """
    Obtiene todos los roles disponibles.
    
    **Requiere autenticación JWT.**
    """
    logger.info(f"Usuario {current_user.get('email')} solicitando lista de roles")
    return await service.get_all_roles(is_active=is_active)


@router.post(
    "/",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear nuevo rol",
    description="Crea un nuevo rol en el sistema"
)
async def create_role(
    role_data: RoleCreate,
    current_user: dict = Depends(get_current_user),
    service: RoleService = Depends(get_role_service)
):
    """
    Crea un nuevo rol.
    
    **Requiere autenticación JWT.**
    
    Args:
        role_data: Datos del rol a crear (code, nombre, descripcion)
    
    Raises:
        400: Si el código de rol ya existe
    """
    logger.info(f"Usuario {current_user.get('email')} creando rol: {role_data.code}")
    return await service.create_role(role_data)


@router.get(
    "/codes",
    response_model=List[str],
    summary="Listar códigos de roles",
    description="Obtiene solo los códigos de los roles activos (útil para selects)"
)
async def get_role_codes(
    current_user: dict = Depends(get_current_user),
    service: RoleService = Depends(get_role_service)
):
    """
    Obtiene solo los códigos de roles activos.
    
    **Requiere autenticación JWT.**
    
    Útil para componentes de selección en frontend.
    """
    logger.info(f"Usuario {current_user.get('email')} solicitando códigos de roles")
    return await service.get_role_codes()


@router.get(
    "/{role_id}",
    response_model=RoleResponse,
    summary="Obtener rol por ID",
    description="Obtiene información detallada de un rol específico"
)
async def get_role(
    role_id: UUID,
    current_user: dict = Depends(get_current_user),
    service: RoleService = Depends(get_role_service)
):
    """
    Obtiene un rol específico por su ID.
    
    **Requiere autenticación JWT.**
    
    Args:
        role_id: UUID del rol
    
    Raises:
        404: Si el rol no existe
    """
    logger.info(f"Usuario {current_user.get('email')} solicitando rol: {role_id}")
    return await service.get_role_by_id(role_id)


@router.patch(
    "/{role_id}",
    response_model=RoleResponse,
    summary="Actualizar rol",
    description="Actualiza los datos de un rol existente"
)
async def update_role(
    role_id: UUID,
    role_data: RoleUpdate,
    current_user: dict = Depends(get_current_user),
    service: RoleService = Depends(get_role_service)
):
    """
    Actualiza un rol existente.
    
    **Requiere autenticación JWT.**
    
    Args:
        role_id: UUID del rol a actualizar
        role_data: Campos a actualizar (nombre, descripcion, is_active)
    
    Raises:
        404: Si el rol no existe
        400: Si no se proporcionan campos para actualizar
    """
    logger.info(f"Usuario {current_user.get('email')} actualizando rol: {role_id}")
    return await service.update_role(role_id, role_data)


@router.delete(
    "/{role_id}",
    summary="Desactivar rol",
    description="Desactiva un rol (soft delete)"
)
async def delete_role(
    role_id: UUID,
    current_user: dict = Depends(get_current_user),
    service: RoleService = Depends(get_role_service)
):
    """
    Desactiva un rol (soft delete).
    
    **Requiere autenticación JWT.**
    
    Args:
        role_id: UUID del rol a desactivar
    
    Raises:
        404: Si el rol no existe
    """
    logger.info(f"Usuario {current_user.get('email')} desactivando rol: {role_id}")
    return await service.delete_role(role_id)

