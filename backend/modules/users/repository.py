"""
Repositorio para operaciones de usuarios en la base de datos.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Tuple
from uuid import UUID
from db.models import User, Area
from core.logging import logger


class UserRepository:
    """Repositorio para gestionar operaciones CRUD de usuarios."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(
        self, 
        skip: int = 0, 
        limit: int = 100,
        area_id: Optional[UUID] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Tuple[List[User], int]:
        """Obtiene todos los usuarios con paginación y filtros."""
        query = select(User).options(selectinload(User.area))
        
        # Aplicar filtros
        if area_id:
            query = query.where(User.area_id == area_id)
        if role:
            query = query.where(User.role == role)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        
        # Contar total
        count_query = select(func.count()).select_from(User)
        if area_id:
            count_query = count_query.where(User.area_id == area_id)
        if role:
            count_query = count_query.where(User.role == role)
        if is_active is not None:
            count_query = count_query.where(User.is_active == is_active)
        
        result_count = await self.db.execute(count_query)
        total = result_count.scalar() or 0
        
        # Obtener usuarios paginados
        query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
        result = await self.db.execute(query)
        users = result.scalars().all()
        
        return users, total
    
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        """Obtiene un usuario por ID."""
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.area))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Obtiene un usuario por email."""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def create(self, user_data: dict) -> User:
        """Crea un nuevo usuario."""
        user = User(**user_data)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        
        # Cargar relación de área
        await self.db.refresh(user, ["area"])
        return user
    
    async def update(self, user_id: UUID, user_data: dict) -> Optional[User]:
        """Actualiza un usuario."""
        user = await self.get_by_id(user_id)
        if not user:
            return None
        
        for key, value in user_data.items():
            if value is not None:
                setattr(user, key, value)
        
        await self.db.commit()
        await self.db.refresh(user)
        await self.db.refresh(user, ["area"])
        return user
    
    async def delete(self, user_id: UUID) -> bool:
        """Elimina un usuario (soft delete)."""
        user = await self.get_by_id(user_id)
        if not user:
            return False
        
        user.is_active = False
        await self.db.commit()
        return True
    
    async def hard_delete(self, user_id: UUID) -> bool:
        """Elimina un usuario permanentemente."""
        user = await self.get_by_id(user_id)
        if not user:
            return False
        
        await self.db.delete(user)
        await self.db.commit()
        return True
