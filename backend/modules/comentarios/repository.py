"""
Repositorio para operaciones de base de datos del módulo comentarios.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional, List, Tuple
from uuid import UUID
from datetime import datetime
from db.models import ComentarioFactura


class ComentarioRepository:
    """Repositorio para gestionar operaciones de comentarios en base de datos."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_factura(self, factura_id: UUID, skip: int = 0, limit: int = 100) -> Tuple[List[ComentarioFactura], int]:
        """Obtiene todos los comentarios de una factura con paginación."""
        # Query para comentarios con eager loading del usuario
        query = select(ComentarioFactura).options(
            selectinload(ComentarioFactura.user)
        ).where(
            ComentarioFactura.factura_id == factura_id
        ).order_by(
            ComentarioFactura.created_at.desc()
        )
        
        # Contar total
        count_query = select(func.count(ComentarioFactura.id)).where(
            ComentarioFactura.factura_id == factura_id
        )
        count_result = await self.db.execute(count_query)
        total = count_result.scalar()
        
        # Obtener comentarios paginados
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        comentarios = result.scalars().all()
        
        return list(comentarios), total
    
    async def get_by_id(self, comentario_id: UUID) -> Optional[ComentarioFactura]:
        """Obtiene un comentario por ID."""
        result = await self.db.execute(
            select(ComentarioFactura).options(
                selectinload(ComentarioFactura.user)
            ).where(ComentarioFactura.id == comentario_id)
        )
        return result.scalar_one_or_none()
    
    async def create(self, factura_id: UUID, user_id: UUID, contenido: str) -> ComentarioFactura:
        """Crea un nuevo comentario."""
        comentario = ComentarioFactura(
            factura_id=factura_id,
            user_id=user_id,
            contenido=contenido
        )
        self.db.add(comentario)
        await self.db.flush()
        await self.db.refresh(comentario)
        return comentario
    
    async def update(self, comentario_id: UUID, contenido: str) -> Optional[ComentarioFactura]:
        """Actualiza el contenido de un comentario."""
        comentario = await self.get_by_id(comentario_id)
        if comentario:
            comentario.contenido = contenido
            comentario.updated_at = datetime.utcnow()
            await self.db.flush()
            await self.db.refresh(comentario)
        return comentario
    
    async def delete(self, comentario_id: UUID) -> bool:
        """Elimina un comentario."""
        comentario = await self.get_by_id(comentario_id)
        if comentario:
            await self.db.delete(comentario)
            await self.db.flush()
            return True
        return False
