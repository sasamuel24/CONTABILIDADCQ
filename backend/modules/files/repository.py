"""
Repositorio para operaciones de files.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from db.models import File


class FileRepository:
    """Repositorio para gestionar operaciones de archivos."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, file_id: UUID) -> Optional[File]:
        """Obtiene un archivo por ID."""
        result = await self.db.execute(
            select(File).where(File.id == file_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_factura(self, factura_id: UUID) -> List[File]:
        """Obtiene todos los archivos de una factura."""
        result = await self.db.execute(
            select(File).where(File.factura_id == factura_id).order_by(File.created_at.desc())
        )
        return result.scalars().all()
    
    async def get_pdf_by_factura(self, factura_id: UUID) -> Optional[File]:
        """Obtiene el primer PDF de una factura."""
        result = await self.db.execute(
            select(File)
            .where(
                File.factura_id == factura_id,
                File.content_type == "application/pdf"
            )
            .order_by(File.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
