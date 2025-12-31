"""
Router de FastAPI para el módulo de usuarios.
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID

from db.session import get_db
from modules.users.repository import UserRepository
from modules.users.service import UserService
from modules.users.schemas import (
    UserCreate,
    UserUpdate,
    UserPasswordUpdate,
    UserListItem,
    UserDetail,
    UsersPaginatedResponse
)
from core.auth import get_current_user


router = APIRouter(prefix="/users", tags=["Users"])


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    """Dependency para obtener el servicio de usuarios."""
    repository = UserRepository(db)
    return UserService(repository)


@router.get("/", response_model=UsersPaginatedResponse)
async def list_users(
    skip: int = Query(0, ge=0, description="Número de registros a saltar"),
    limit: int = Query(100, ge=1, le=1000, description="Número de registros a retornar"),
    area_id: Optional[UUID] = Query(None, description="Filtrar por área"),
    role: Optional[str] = Query(None, description="Filtrar por rol"),
    is_active: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    service: UserService = Depends(get_user_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Lista todos los usuarios con paginación y filtros.
    
    **Filtros disponibles:**
    - `area_id`: Filtrar por área específica
    - `role`: Filtrar por rol (admin, responsable, contabilidad, tesoreria)
    - `is_active`: Filtrar por estado activo (true/false)
    
    **Paginación:**
    - `skip`: Número de registros a saltar (default: 0)
    - `limit`: Número de registros a retornar (default: 100, max: 1000)
    """
    return await service.list_users(
        skip=skip,
        limit=limit,
        area_id=area_id,
        role=role,
        is_active=is_active
    )


@router.get("/{user_id}", response_model=UserDetail)
async def get_user(
    user_id: UUID,
    service: UserService = Depends(get_user_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene un usuario por ID.
    
    Retorna información detallada del usuario incluyendo:
    - Datos personales
    - Rol y área asignada
    - Estado activo/inactivo
    - Fechas de creación y actualización
    """
    return await service.get_user(user_id)


@router.post("/", response_model=UserDetail, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    service: UserService = Depends(get_user_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Crea un nuevo usuario.
    
    **Roles válidos:**
    - `admin`: Administrador del sistema
    - `responsable`: Responsable de área
    - `contabilidad`: Usuario de contabilidad
    - `tesoreria`: Usuario de tesorería
    
    **Validaciones:**
    - Email único en el sistema
    - Contraseña mínima de 6 caracteres
    - Rol debe ser uno de los válidos
    """
    return await service.create_user(user_data)


@router.patch("/{user_id}", response_model=UserDetail)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    service: UserService = Depends(get_user_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Actualiza un usuario existente.
    
    Solo se actualizan los campos enviados en el body.
    Los campos no enviados permanecen sin cambios.
    
    **Validaciones:**
    - Email único si se modifica
    - Rol válido si se modifica
    """
    return await service.update_user(user_id, user_data)


@router.put("/{user_id}/password")
async def update_password(
    user_id: UUID,
    password_data: UserPasswordUpdate,
    service: UserService = Depends(get_user_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Actualiza la contraseña de un usuario.
    
    **Requiere:**
    - Contraseña actual correcta
    - Nueva contraseña con mínimo 6 caracteres
    """
    return await service.update_password(user_id, password_data)


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    service: UserService = Depends(get_user_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Desactiva un usuario (soft delete).
    
    El usuario no se elimina de la base de datos,
    solo se marca como inactivo (is_active=false).
    """
    return await service.delete_user(user_id)


@router.delete("/{user_id}/hard")
async def hard_delete_user(
    user_id: UUID,
    service: UserService = Depends(get_user_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Elimina permanentemente un usuario de la base de datos.
    
    **⚠️ CUIDADO:** Esta acción es irreversible.
    El usuario y todas sus referencias serán eliminados.
    """
    return await service.hard_delete_user(user_id)
