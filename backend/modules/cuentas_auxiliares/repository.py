"""
Repositorio para operaciones de cuentas auxiliares.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from db.models import CuentaAuxiliar


class CuentaAuxiliarRepository:
    """Repositorio para gestionar operaciones de cuentas auxiliares."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(self, activas_only: bool = False) -> List[CuentaAuxiliar]:
        """Obtiene todas las cuentas auxiliares."""
        query = select(CuentaAuxiliar).order_by(CuentaAuxiliar.codigo)
        
        if activas_only:
            query = query.where(CuentaAuxiliar.activa == True)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_by_id(self, cuenta_id: UUID) -> Optional[CuentaAuxiliar]:
        """Obtiene una cuenta auxiliar por su ID."""
        result = await self.db.execute(
            select(CuentaAuxiliar).where(CuentaAuxiliar.id == cuenta_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_codigo(self, codigo: str) -> Optional[CuentaAuxiliar]:
        """Obtiene una cuenta auxiliar por su código."""
        result = await self.db.execute(
            select(CuentaAuxiliar).where(CuentaAuxiliar.codigo == codigo)
        )
        return result.scalar_one_or_none()
    
    async def create(self, cuenta_data: dict) -> CuentaAuxiliar:
        """Crea una nueva cuenta auxiliar."""
        cuenta = CuentaAuxiliar(**cuenta_data)
        self.db.add(cuenta)
        await self.db.flush()
        await self.db.refresh(cuenta)
        return cuenta
    
    async def update(self, cuenta_id: UUID, cuenta_data: dict) -> Optional[CuentaAuxiliar]:
        """Actualiza una cuenta auxiliar existente."""
        cuenta = await self.get_by_id(cuenta_id)
        if not cuenta:
            return None
        
        for key, value in cuenta_data.items():
            if value is not None:
                setattr(cuenta, key, value)
        
        await self.db.flush()
        await self.db.refresh(cuenta)
        return cuenta
    
    async def delete(self, cuenta_id: UUID) -> bool:
        """Elimina una cuenta auxiliar."""
        cuenta = await self.get_by_id(cuenta_id)
        if not cuenta:
            return False
        
        await self.db.delete(cuenta)
        await self.db.flush()
        return True
