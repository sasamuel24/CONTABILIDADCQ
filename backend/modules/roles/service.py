"""
Servicio de lógica de negocio para roles.
"""
from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from core.logging import logger
from modules.roles.repository import RoleRepository
from modules.roles.schemas import (
    RoleCreate, RoleUpdate, RoleResponse, RolesListResponse
)


class RoleService:
    """Servicio para gestión de roles."""
    
    def __init__(self, db: AsyncSession):
        self.repository = RoleRepository(db)
    
    async def get_all_roles(self, is_active: Optional[bool] = None) -> RolesListResponse:
        """
        Obtiene todos los roles disponibles en el sistema.
        
        Args:
            is_active: Filtrar por estado activo/inactivo
            
        Returns:
            RolesListResponse con la lista de roles
        """
        logger.info(f"Obteniendo lista de roles (is_active={is_active})")
        
        roles = await self.repository.get_all(is_active=is_active)
        
        return RolesListResponse(
            roles=[RoleResponse.model_validate(role) for role in roles],
            total=len(roles)
        )
    
    async def get_role_by_id(self, role_id: UUID) -> RoleResponse:
        """
        Obtiene un rol por ID.
        
        Args:
            role_id: UUID del rol
            
        Returns:
            RoleResponse con los datos del rol
            
        Raises:
            HTTPException 404: Si el rol no existe
        """
        logger.info(f"Obteniendo rol ID: {role_id}")
        
        role = await self.repository.get_by_id(role_id)
        
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rol con ID {role_id} no encontrado"
            )
        
        return RoleResponse.model_validate(role)
    
    async def get_role_by_code(self, code: str) -> Optional[RoleResponse]:
        """
        Obtiene un rol por código.
        
        Args:
            code: Código del rol a buscar
            
        Returns:
            RoleResponse si existe, None si no se encuentra
        """
        logger.info(f"Buscando rol con código: {code}")
        
        role = await self.repository.get_by_code(code)
        
        if not role:
            logger.warning(f"Rol no encontrado: {code}")
            return None
        
        return RoleResponse.model_validate(role)
    
    async def create_role(self, role_data: RoleCreate) -> RoleResponse:
        """
        Crea un nuevo rol.
        
        Args:
            role_data: Datos del rol a crear
            
        Returns:
            RoleResponse con el rol creado
            
        Raises:
            HTTPException 400: Si el código ya existe
        """
        logger.info(f"Creando nuevo rol: {role_data.code}")
        
        # Verificar si el código ya existe
        existing = await self.repository.get_by_code(role_data.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un rol con el código '{role_data.code}'"
            )
        
        # Crear rol
        role_dict = role_data.model_dump()
        role = await self.repository.create(role_dict)
        
        logger.info(f"Rol creado exitosamente: {role.id}")
        return RoleResponse.model_validate(role)
    
    async def update_role(self, role_id: UUID, role_data: RoleUpdate) -> RoleResponse:
        """
        Actualiza un rol existente.
        
        Args:
            role_id: UUID del rol
            role_data: Datos a actualizar
            
        Returns:
            RoleResponse con el rol actualizado
            
        Raises:
            HTTPException 404: Si el rol no existe
        """
        logger.info(f"Actualizando rol ID: {role_id}")
        
        # Verificar que existe
        existing = await self.repository.get_by_id(role_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rol con ID {role_id} no encontrado"
            )
        
        # Actualizar solo campos proporcionados
        update_data = role_data.model_dump(exclude_unset=True)
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se proporcionaron campos para actualizar"
            )
        
        role = await self.repository.update(role_id, update_data)
        
        logger.info(f"Rol actualizado exitosamente: {role_id}")
        return RoleResponse.model_validate(role)
    
    async def delete_role(self, role_id: UUID) -> dict:
        """
        Desactiva un rol (soft delete).
        
        Args:
            role_id: UUID del rol
            
        Returns:
            Mensaje de confirmación
            
        Raises:
            HTTPException 404: Si el rol no existe
        """
        logger.info(f"Desactivando rol ID: {role_id}")
        
        success = await self.repository.delete(role_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rol con ID {role_id} no encontrado"
            )
        
        logger.info(f"Rol desactivado exitosamente: {role_id}")
        return {"message": "Rol desactivado exitosamente"}
    
    async def validate_role(self, code: str) -> bool:
        """
        Valida si un código de rol existe y está activo.
        
        Args:
            code: Código del rol a validar
            
        Returns:
            True si el rol existe y está activo, False en caso contrario
        """
        role = await self.repository.get_by_code(code)
        return role is not None and role.is_active
    
    async def get_role_codes(self) -> List[str]:
        """
        Obtiene solo los códigos de los roles activos.
        
        Returns:
            Lista de códigos de roles
        """
        roles = await self.repository.get_all(is_active=True)
        return [role.code for role in roles]

