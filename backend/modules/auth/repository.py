"""
Repositorio para operaciones de autenticación.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from db.models import User
from uuid import UUID


class AuthRepository:
    """Repositorio para gestionar operaciones de autenticación."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Obtiene usuario por email."""
        result = await self.db.execute(
            select(User).where(User.email == email, User.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Obtiene usuario por ID."""
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def update_password(self, user_id: UUID, new_password_hash: str, must_change: bool = False) -> None:
        """Actualiza la contraseña del usuario."""
        user = await self.get_user_by_id(user_id)
        if user:
            user.password_hash = new_password_hash
            user.must_change_password = must_change
            await self.db.commit()
