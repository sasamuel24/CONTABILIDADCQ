"""
Servicio para lógica de negocio de files.
"""
from modules.files.repository import FileRepository
from modules.files.schemas import FileResponse
from typing import List
from core.logging import logger
from fastapi import HTTPException, status
from uuid import UUID
from pathlib import Path


class FileService:
    """Servicio que contiene la lógica de negocio de archivos."""
    
    def __init__(self, repository: FileRepository):
        self.repository = repository
    
    async def get_file_by_id(self, file_id: UUID) -> FileResponse:
        """Obtiene información de un archivo por ID."""
        logger.info(f"Obteniendo archivo con ID: {file_id}")
        file = await self.repository.get_by_id(file_id)
        
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Archivo con ID {file_id} no encontrado"
            )
        
        return FileResponse(
            id=file.id,
            factura_id=file.factura_id,
            storage_provider=file.storage_provider,
            storage_path=file.storage_path,
            filename=file.filename,
            content_type=file.content_type,
            size_bytes=file.size_bytes,
            uploaded_at=file.created_at
        )
    
    async def get_file_content(self, file_id: UUID) -> tuple[bytes, str, str]:
        """Obtiene el contenido de un archivo para descarga."""
        file = await self.repository.get_by_id(file_id)
        
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Archivo con ID {file_id} no encontrado"
            )
        
        # Leer archivo desde storage local
        if file.storage_provider == "local":
            file_path = Path(file.storage_path)
            if not file_path.exists():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Archivo físico no encontrado en storage"
                )
            
            content = file_path.read_bytes()
            return content, file.content_type, file.filename
        
        # TODO: Implementar para S3 y Google Drive
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Storage provider '{file.storage_provider}' no implementado"
        )
    
    async def get_files_by_factura(self, factura_id: UUID) -> List[FileResponse]:
        """Obtiene todos los archivos de una factura."""
        logger.info(f"Obteniendo archivos de factura: {factura_id}")
        files = await self.repository.get_by_factura(factura_id)
        
        return [FileResponse(
            id=f.id,
            factura_id=f.factura_id,
            storage_provider=f.storage_provider,
            storage_path=f.storage_path,
            filename=f.filename,
            content_type=f.content_type,
            size_bytes=f.size_bytes,
            uploaded_at=f.created_at
        ) for f in files]
    
    async def get_pdf_by_factura(self, factura_id: UUID) -> tuple[bytes, str, str]:
        """Obtiene el PDF de una factura."""
        logger.info(f"Obteniendo PDF de factura: {factura_id}")
        file = await self.repository.get_pdf_by_factura(factura_id)
        
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No existe PDF asociado a esta factura"
            )
        
        return await self.get_file_content(file.id)
