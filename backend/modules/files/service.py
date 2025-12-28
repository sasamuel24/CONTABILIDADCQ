"""
Servicio para lógica de negocio de files.
"""
from modules.files.repository import FileRepository
from modules.files.schemas import FileResponse, FileCreateRequest, FileUploadResponse
from typing import List, Optional
from core.logging import logger
from fastapi import HTTPException, status, UploadFile
from uuid import UUID
from pathlib import Path
import re
from datetime import datetime, timezone
import os


class FileService:
    """Servicio que contiene la lógica de negocio de archivos."""
    
    ALLOWED_DOC_TYPES = {
        "OC", "OS", "OCT", "ECT", "OCC", "EDO", 
        "FCP", "FPC", "EGRESO", "SOPORTE_PAGO", "FACTURA_PDF"
    }
    
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
                doc_type=db_file.doc_type,
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
            doc_type=file.doc_type,
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
    
    async def get_files_by_factura(self, factura_id: UUID, doc_type: Optional[str] = None) -> List[FileResponse]:
        """Obtiene todos los archivos de una factura, opcionalmente filtrados por doc_type."""
        logger.info(f"Obteniendo archivos de factura: {factura_id}, doc_type: {doc_type}")
        files = await self.repository.get_by_factura(factura_id, doc_type)
        
        return [FileResponse(
            id=f.id,
            factura_id=f.factura_id,
            doc_type=f.doc_type,
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
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitiza el nombre del archivo removiendo caracteres no válidos."""
        # Remover caracteres especiales, mantener solo alfanuméricos, guiones y puntos
        sanitized = re.sub(r'[^\w\-\.]', '_', filename)
        # Remover múltiples guiones bajos consecutivos
        sanitized = re.sub(r'_+', '_', sanitized)
        return sanitized
    
    async def upload_file(
        self,
        factura_id: UUID,
        doc_type: str,
        file: UploadFile,
        uploaded_by_user_id: Optional[UUID] = None
    ) -> FileUploadResponse:
        """
        Maneja el upload físico de un archivo PDF y registra su metadata.
        
        Validaciones:
        - doc_type debe estar en ALLOWED_DOC_TYPES
        - content_type debe ser application/pdf
        - No debe existir duplicado (mismo factura_id y doc_type)
        """
        logger.info(f"Iniciando upload de archivo para factura {factura_id}, doc_type: {doc_type}")
        
        # Validación 1: doc_type permitido
        if doc_type not in self.ALLOWED_DOC_TYPES:
            logger.warning(f"doc_type inválido: {doc_type}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "bad_request", "message": "doc_type debe ser uno de los permitidos"}
            )
        
        # Validación 2: tipo de archivo PDF
        if file.content_type != "application/pdf":
            logger.warning(f"Tipo de archivo inválido: {file.content_type}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "bad_request", "message": "Solo se permiten archivos PDF"}
            )
        
        # Validación 3: extensión .pdf
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            logger.warning(f"Extensión de archivo inválida: {file.filename}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "bad_request", "message": "El archivo debe tener extensión .pdf"}
            )
        
        # Validación 4: verificar duplicado
        existing_file = await self.repository.get_by_factura_and_doc_type(
            factura_id, doc_type
        )
        if existing_file:
            logger.warning(f"Archivo duplicado: factura_id={factura_id}, doc_type={doc_type}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "file_already_exists",
                    "message": "Ya existe un archivo PDF para este factura_id y doc_type"
                }
            )
        
        try:
            # Crear estructura de carpetas
            base_path = Path("storage/facturas") / str(factura_id) / doc_type
            base_path.mkdir(parents=True, exist_ok=True)
            
            # Generar nombre de archivo con timestamp
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
            sanitized_filename = self._sanitize_filename(file.filename)
            new_filename = f"{timestamp}_{sanitized_filename}"
            file_path = base_path / new_filename
            
            # Guardar archivo
            content = await file.read()
            file_path.write_bytes(content)
            
            # ✅ Validación: Archivo guardado exitosamente
            if not file_path.exists():
                raise Exception("Error al verificar archivo guardado")
            
            logger.info(f"Archivo guardado exitosamente en: {file_path}")
            
            # Registrar en base de datos
            file_data = {
                "factura_id": factura_id,
                "doc_type": doc_type,
                "storage_provider": "local",
                "storage_path": str(file_path),
                "filename": new_filename,
                "content_type": "application/pdf",
                "size_bytes": len(content),
                "uploaded_by_user_id": uploaded_by_user_id
            }
            
            db_file = await self.repository.create(file_data)
            
            # ✅ Validación: Registro creado exitosamente
            logger.info(f"Archivo registrado en BD con ID: {db_file.id}")
            
            # Construir respuesta
            response_data = {
                "file_id": db_file.id,
                "factura_id": db_file.factura_id,
                "doc_type": db_file.doc_type,
                "filename": db_file.filename,
                "content_type": db_file.content_type,
                "size_bytes": db_file.size_bytes,
                "storage_provider": db_file.storage_provider,
                "storage_path": db_file.storage_path,
                "created_at": db_file.created_at
            }
            
            # Solo incluir uploaded_by_user_id si está presente
            if uploaded_by_user_id:
                response_data["uploaded_by_user_id"] = uploaded_by_user_id
            
            return FileUploadResponse(**response_data)
            
        except HTTPException:
            # Re-lanzar HTTPExceptions tal cual
            raise
        except Exception as e:
            logger.error(f"Error guardando archivo: {e}")
            # Intentar limpiar archivo si se guardó
            if 'file_path' in locals() and file_path.exists():
                try:
                    file_path.unlink()
                except Exception as cleanup_error:
                    logger.error(f"Error limpiando archivo: {cleanup_error}")
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "internal_error", "message": "Error al guardar el archivo"}
            )
