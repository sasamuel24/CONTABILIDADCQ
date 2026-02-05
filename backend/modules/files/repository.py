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
    
    async def create(self, file_data: dict) -> File:
        """
        Crea un nuevo archivo en la base de datos.
        
        Args:
            file_data: Diccionario con los datos del archivo
            
        Returns:
            File: El archivo creado
        """
        file = File(**file_data)
        self.db.add(file)
        await self.db.flush()
        await self.db.refresh(file)
        return file
    
    async def get_by_id(self, file_id: UUID) -> Optional[File]:
        """Obtiene un archivo por ID."""
        result = await self.db.execute(
            select(File).where(File.id == file_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_factura(self, factura_id: UUID, doc_type: Optional[str] = None) -> List[File]:
        """Obtiene todos los archivos de una factura, opcionalmente filtrados por doc_type."""
        query = select(File).where(File.factura_id == factura_id)
        
        if doc_type:
            query = query.where(File.doc_type == doc_type)
        
        query = query.order_by(File.created_at.desc())
        result = await self.db.execute(query)
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
    
    async def get_by_factura_and_doc_type(
        self, 
        factura_id: UUID, 
        doc_type: str
    ) -> Optional[File]:
        """Verifica si ya existe un archivo con el mismo factura_id y doc_type."""
        result = await self.db.execute(
            select(File).where(
                File.factura_id == factura_id,
                File.doc_type == doc_type
            )
        )
        return result.scalar_one_or_none()
    
    async def delete(self, file_id: UUID) -> None:
        """
        Elimina un archivo de la base de datos.
        
        Args:
            file_id: UUID del archivo a eliminar
        """
        file = await self.get_by_id(file_id)
        if file:
            await self.db.delete(file)
            await self.db.flush()
