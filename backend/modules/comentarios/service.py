"""
Lógica de negocio para el módulo de comentarios.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Tuple, List
from fastapi import HTTPException, status

from modules.comentarios.repository import ComentarioRepository
from modules.comentarios.schemas import ComentarioCreate, ComentarioUpdate, ComentarioOut
from modules.facturas.repository import FacturaRepository
from db.models import ComentarioFactura


class ComentarioService:
    """Servicio para gestionar la lógica de negocio de comentarios."""
    
    def __init__(self, db: AsyncSession):
        self.repo = ComentarioRepository(db)
        self.factura_repo = FacturaRepository(db)
        self.db = db
    
    async def get_comentarios_by_factura(
        self, 
        factura_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> Tuple[List[ComentarioOut], int]:
        """Obtiene todos los comentarios de una factura."""
        # Verificar que la factura existe
        factura = await self.factura_repo.get_by_id(factura_id)
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        comentarios, total = await self.repo.get_by_factura(factura_id, skip, limit)
        comentarios_out = [ComentarioOut.model_validate(c) for c in comentarios]
        return comentarios_out, total
    
    async def create_comentario(
        self, 
        factura_id: UUID, 
        user_id: UUID,
        comentario_data: ComentarioCreate
    ) -> ComentarioOut:
        """Crea un nuevo comentario en una factura."""
        # Verificar que la factura existe
        factura = await self.factura_repo.get_by_id(factura_id)
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        comentario = await self.repo.create(
            factura_id=factura_id,
            user_id=user_id,
            contenido=comentario_data.contenido
        )
        await self.db.commit()
        await self.db.refresh(comentario)
        
        return ComentarioOut.model_validate(comentario)
    
    async def update_comentario(
        self,
        comentario_id: UUID,
        user_id: UUID,
        comentario_data: ComentarioUpdate
    ) -> ComentarioOut:
        """Actualiza un comentario existente."""
        comentario = await self.repo.get_by_id(comentario_id)
        
        if not comentario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comentario con ID {comentario_id} no encontrado"
            )
        
        # Verificar que el usuario sea el propietario del comentario
        if comentario.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para editar este comentario"
            )
        
        comentario = await self.repo.update(comentario_id, comentario_data.contenido)
        await self.db.commit()
        await self.db.refresh(comentario)
        
        return ComentarioOut.model_validate(comentario)
    
    async def delete_comentario(self, comentario_id: UUID, user_id: UUID) -> None:
        """Elimina un comentario."""
        comentario = await self.repo.get_by_id(comentario_id)
        
        if not comentario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comentario con ID {comentario_id} no encontrado"
            )
        
        # Verificar que el usuario sea el propietario del comentario
        if comentario.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para eliminar este comentario"
            )
        
        await self.repo.delete(comentario_id)
        await self.db.commit()
