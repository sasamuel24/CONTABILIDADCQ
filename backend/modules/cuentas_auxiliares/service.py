"""
Lógica de negocio para cuentas auxiliares.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from fastapi import HTTPException, status

from .repository import CuentaAuxiliarRepository
from .schemas import (
    CuentaAuxiliarCreate,
    CuentaAuxiliarUpdate,
    CuentaAuxiliarResponse,
    CuentaAuxiliarList
)


class CuentaAuxiliarService:
    """Servicio para gestionar cuentas auxiliares."""
    
    def __init__(self, db: AsyncSession):
        self.repository = CuentaAuxiliarRepository(db)
    
    async def get_all(self, activas_only: bool = False) -> List[CuentaAuxiliarList]:
        """Obtiene todas las cuentas auxiliares."""
        cuentas = await self.repository.get_all(activas_only=activas_only)
        return [CuentaAuxiliarList.model_validate(c) for c in cuentas]
    
    async def get_by_id(self, cuenta_id: UUID) -> CuentaAuxiliarResponse:
        """Obtiene una cuenta auxiliar por su ID."""
        cuenta = await self.repository.get_by_id(cuenta_id)
        if not cuenta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta auxiliar no encontrada"
            )
        return CuentaAuxiliarResponse.model_validate(cuenta)
    
    async def create(self, cuenta_data: CuentaAuxiliarCreate) -> CuentaAuxiliarResponse:
        """Crea una nueva cuenta auxiliar."""
        # Verificar que el código no exista
        existing = await self.repository.get_by_codigo(cuenta_data.codigo)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe una cuenta auxiliar con el código '{cuenta_data.codigo}'"
            )
        
        cuenta = await self.repository.create(cuenta_data.model_dump())
        return CuentaAuxiliarResponse.model_validate(cuenta)
    
    async def update(
        self,
        cuenta_id: UUID,
        cuenta_data: CuentaAuxiliarUpdate
    ) -> CuentaAuxiliarResponse:
        """Actualiza una cuenta auxiliar existente."""
        # Si se actualiza el código, verificar que no exista
        if cuenta_data.codigo:
            existing = await self.repository.get_by_codigo(cuenta_data.codigo)
            if existing and existing.id != cuenta_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe una cuenta auxiliar con el código '{cuenta_data.codigo}'"
                )
        
        cuenta = await self.repository.update(
            cuenta_id,
            cuenta_data.model_dump(exclude_unset=True)
        )
        
        if not cuenta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta auxiliar no encontrada"
            )
        
        return CuentaAuxiliarResponse.model_validate(cuenta)
    
    async def delete(self, cuenta_id: UUID) -> None:
        """Elimina una cuenta auxiliar."""
        success = await self.repository.delete(cuenta_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta auxiliar no encontrada"
            )
