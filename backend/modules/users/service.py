"""
Servicio para lógica de negocio de usuarios.
"""
from modules.users.repository import UserRepository
from modules.users.schemas import (
    UserCreate, 
    UserUpdate, 
    UserPasswordUpdate,
    UserListItem, 
    UserDetail,
    UsersPaginatedResponse
)
from typing import List, Optional
from core.logging import logger
from core.security import hash_password, verify_password
from fastapi import HTTPException, status
from uuid import UUID


class UserService:
    """Servicio que contiene la lógica de negocio de usuarios."""
    
    def __init__(self, repository: UserRepository):
        self.repository = repository
    
    async def list_users(
        self,
        skip: int = 0,
        limit: int = 100,
        area_id: Optional[UUID] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> UsersPaginatedResponse:
        """Lista todos los usuarios con paginación."""
        logger.info(f"Listando usuarios: skip={skip}, limit={limit}, area_id={area_id}, role={role}")
        
        users, total = await self.repository.get_all(
            skip=skip, 
            limit=limit, 
            area_id=area_id,
            role=role,
            is_active=is_active
        )
        
        items = [
            UserListItem(
                id=u.id,
                nombre=u.nombre,
                email=u.email,
                role=u.role.code,
                area=u.area.nombre if u.area else None,
                is_active=u.is_active,
                created_at=u.created_at
            )
            for u in users
        ]
        
        page = (skip // limit) + 1 if limit > 0 else 1
        
        return UsersPaginatedResponse(
            items=items,
            total=total,
            page=page,
            per_page=limit
        )
    
    async def get_user(self, user_id: UUID) -> UserDetail:
        """Obtiene un usuario por ID."""
        logger.info(f"Obteniendo usuario ID: {user_id}")
        user = await self.repository.get_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario con ID {user_id} no encontrado"
            )
        
        return UserDetail(
            id=user.id,
            nombre=user.nombre,
            email=user.email,
            role=user.role.code,
            area_id=user.area_id,
            area=user.area.nombre if user.area else None,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
    
    async def create_user(self, user_data: UserCreate) -> UserDetail:
        """Crea un nuevo usuario."""
        logger.info(f"Creando usuario: {user_data.email}")
        
        # Obtener role_id desde el código
        from modules.roles.repository import RoleRepository
        role_repo = RoleRepository(self.repository.db)
        role = await role_repo.get_by_code(user_data.role)
        
        if not role or not role.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rol '{user_data.role}' no encontrado o inactivo"
            )
        
        # Verificar si el email ya existe
        existing_user = await self.repository.get_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El email ya está registrado"
            )
        
        # Hash de la contraseña
        hashed_password = hash_password(user_data.password)
        
        # Crear usuario
        user_dict = user_data.model_dump(exclude={"password", "role"})
        user_dict["password_hash"] = hashed_password
        user_dict["role_id"] = role.id
        
        user = await self.repository.create(user_dict)
        
        logger.info(f"Usuario creado exitosamente: {user.id}")
        return await self.get_user(user.id)
    
    async def update_user(self, user_id: UUID, user_data: UserUpdate) -> UserDetail:
        """Actualiza un usuario."""
        logger.info(f"Actualizando usuario ID: {user_id}")
        
        user = await self.repository.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario con ID {user_id} no encontrado"
            )
        
        update_dict = user_data.model_dump(exclude_unset=True, exclude={"role"})
        
        # Validar y convertir rol si se está actualizando
        if user_data.role:
            from modules.roles.repository import RoleRepository
            role_repo = RoleRepository(self.repository.db)
            role = await role_repo.get_by_code(user_data.role)
            
            if not role or not role.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Rol '{user_data.role}' no encontrado o inactivo"
                )
            
            update_dict["role_id"] = role.id
        
        # Verificar email duplicado
        if user_data.email and user_data.email != user.email:
            existing_user = await self.repository.get_by_email(user_data.email)
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El email ya está registrado"
                )
        
        updated_user = await self.repository.update(user_id, update_dict)
        
        logger.info(f"Usuario actualizado exitosamente: {user_id}")
        return await self.get_user(user_id)
    
    async def update_password(self, user_id: UUID, password_data: UserPasswordUpdate) -> dict:
        """Actualiza la contraseña de un usuario."""
        logger.info(f"Actualizando contraseña del usuario ID: {user_id}")
        
        user = await self.repository.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario con ID {user_id} no encontrado"
            )
        
        # Verificar contraseña actual
        if not verify_password(password_data.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contraseña actual incorrecta"
            )
        
        # Hash nueva contraseña
        new_hashed_password = hash_password(password_data.new_password)
        
        await self.repository.update(user_id, {"password_hash": new_hashed_password})
        
        logger.info(f"Contraseña actualizada exitosamente: {user_id}")
        return {"message": "Contraseña actualizada exitosamente"}
    
    async def delete_user(self, user_id: UUID) -> dict:
        """Desactiva un usuario (soft delete)."""
        logger.info(f"Desactivando usuario ID: {user_id}")
        
        success = await self.repository.delete(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario con ID {user_id} no encontrado"
            )
        
        logger.info(f"Usuario desactivado exitosamente: {user_id}")
        return {"message": "Usuario desactivado exitosamente"}
    
    async def hard_delete_user(self, user_id: UUID) -> dict:
        """Elimina permanentemente un usuario."""
        logger.info(f"Eliminando permanentemente usuario ID: {user_id}")
        
        success = await self.repository.hard_delete(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario con ID {user_id} no encontrado"
            )
        
        logger.info(f"Usuario eliminado permanentemente: {user_id}")
        return {"message": "Usuario eliminado permanentemente"}
