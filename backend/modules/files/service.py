"""
Servicio para lógica de negocio de files.
"""
from modules.files.repository import FileRepository
from modules.files.schemas import FileResponse, FileCreateRequest
from typing import List
from core.logging import logger
from fastapi import HTTPException, status
from uuid import UUID
from pathlib import Path


class FileService:
    """Servicio que contiene la lógica de negocio de archivos."""
    
    def __init__(self, repository: FileRepository):
        self.repository = repository
    
    async def register_file_metadata(
        self, 
        factura_id: UUID, 
        file_data: FileCreateRequest
    ) -> FileResponse:
        """
        Registra metadata de un archivo sin realizar upload físico.
        
        Propósito: Crear registro en tabla files asociado a una factura existente.
        Datos necesarios: factura_id (validado previamente), file_data con los 5 campos.
        """
        logger.info(f"Registrando metadata de archivo para factura {factura_id}: {file_data.filename}")
        
        try:
            # Operación: Crear registro en BD con metadata del archivo
            db_file_data = {
                "factura_id": factura_id,
                "storage_provider": file_data.storage_provider,
                "storage_path": file_data.storage_path,
                "filename": file_data.filename,
                "content_type": file_data.content_type,
                "size_bytes": file_data.size_bytes
            }
            
            db_file = await self.repository.create(db_file_data)
            
            # ✅ Validación: Registro creado exitosamente con ID generado
            logger.info(f"Metadata de archivo registrada exitosamente: {db_file.id}")
            
            # Retornar con uploaded_at mapeado desde created_at
            return FileResponse(
                id=db_file.id,
                factura_id=db_file.factura_id,
                storage_provider=db_file.storage_provider,
                storage_path=db_file.storage_path,
                filename=db_file.filename,
                content_type=db_file.content_type,
                size_bytes=db_file.size_bytes,
                uploaded_at=db_file.created_at
            )
            
        except Exception as e:
            logger.error(f"Error registrando metadata de archivo: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al registrar el archivo"
            )
    
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
