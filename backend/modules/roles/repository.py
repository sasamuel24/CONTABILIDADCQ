"""
Repository para operaciones de base de datos de roles.
"""
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.models import Rol
from core.logging import logger


class RoleRepository:
    """Repository para operaciones CRUD de roles."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(self, is_active: Optional[bool] = None) -> List[Rol]:
        """
        Obtiene todos los roles.
        
        Args:
            is_active: Filtrar por estado activo/inactivo
        """
        query = select(Rol)
        
        if is_active is not None:
            query = query.where(Rol.is_active == is_active)
        
        query = query.order_by(Rol.nombre)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_by_id(self, role_id: UUID) -> Optional[Rol]:
        """Obtiene un rol por ID."""
        result = await self.db.execute(
            select(Rol).where(Rol.id == role_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_code(self, code: str) -> Optional[Rol]:
        """Obtiene un rol por código."""
        result = await self.db.execute(
            select(Rol).where(Rol.code == code)
        )
        return result.scalar_one_or_none()
    
    async def create(self, role_data: dict) -> Rol:
        """
        Crea un nuevo rol.
        
        Args:
            role_data: Diccionario con los datos del rol
        """
        role = Rol(**role_data)
        self.db.add(role)
        await self.db.commit()
        await self.db.refresh(role)
        return role
    
    async def update(self, role_id: UUID, update_data: dict) -> Optional[Rol]:
        """
        Actualiza un rol existente.
        
        Args:
            role_id: UUID del rol
            update_data: Diccionario con campos a actualizar
        """
        role = await self.get_by_id(role_id)
        
        if not role:
            return None
        
        for key, value in update_data.items():
            if hasattr(role, key):
                setattr(role, key, value)
        
        await self.db.commit()
        await self.db.refresh(role)
        return role
    
    async def delete(self, role_id: UUID) -> bool:
        """
        Soft delete: desactiva un rol.
        
        Args:
            role_id: UUID del rol
        """
        role = await self.get_by_id(role_id)
        
        if not role:
            return False
        
        role.is_active = False
        await self.db.commit()
        return True
    
    async def count(self) -> int:
        """Cuenta el total de roles."""
        result = await self.db.execute(
            select(func.count()).select_from(Rol)
        )
        return result.scalar_one()
