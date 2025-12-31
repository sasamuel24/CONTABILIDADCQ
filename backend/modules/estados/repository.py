"""
Repositorio para operaciones de estados.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from db.models import Estado


class EstadoRepository:
    """Repositorio para gestionar operaciones de estados."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(self) -> List[Estado]:
        """Obtiene todos los estados activos ordenados."""
        result = await self.db.execute(
            select(Estado).where(Estado.is_active == True).order_by(Estado.order)
        )
        return result.scalars().all()
    
    async def get_by_code(self, code: str) -> Optional[Estado]:
        """Busca un estado por su código."""
        result = await self.db.execute(
            select(Estado).where(Estado.code == code)
        )
        return result.scalar_one_or_none()
    
    async def create(self, estado_data: dict) -> Estado:
        """Crea un nuevo estado."""
        estado = Estado(**estado_data)
        self.db.add(estado)
        await self.db.commit()
        await self.db.refresh(estado)
        return estado
