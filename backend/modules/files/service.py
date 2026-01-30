"""
Servicio para lógica de negocio de files.
"""
from modules.files.repository import FileRepository
from modules.files.schemas import FileResponse, FileCreateRequest, FileUploadResponse
from typing import List, Optional
from core.logging import logger
from core.config import settings
from fastapi import HTTPException, status, UploadFile
from uuid import UUID
from pathlib import Path
from datetime import datetime, timezone
import mimetypes
import re
import os


class FileService:
    """Servicio que contiene la lógica de negocio de archivos."""
    
    ALLOWED_DOC_TYPES = {
        "OC", "OS", "OCT", "ECT", "OCC", "EDO", 
        "FCP", "FPC", "EGRESO", "SOPORTE_PAGO", "FACTURA_PDF",
        "APROBACION_GERENCIA", "PEC", "EC", "PCE", "PED"
    }
    
    # Content types permitidos por doc_type
    ALLOWED_CONTENT_TYPES = {
        "APROBACION_GERENCIA": {
            "application/pdf", "image/jpeg", "image/png", "image/webp"
        },
        # Todos los demás solo aceptan PDF
        "default": {"application/pdf"}
    }
    
    # Extensiones permitidas por doc_type
    ALLOWED_EXTENSIONS = {
        "APROBACION_GERENCIA": {".pdf", ".jpg", ".jpeg", ".png", ".webp"},
        "default": {".pdf"}
    }
    
    def __init__(self, repository: FileRepository):
        self.repository = repository
    
    def _detect_content_type(self, filename: str) -> str:
        """
        Detecta el content_type basado en la extensión del archivo.
        
        Args:
            filename: Nombre del archivo con extensión
            
        Returns:
            str: content_type detectado o 'application/octet-stream' si no se puede detectar
        """
        # Inicializar mimetypes si no está hecho
        if not mimetypes.inited:
            mimetypes.init()
        
        # Obtener el content_type basado en la extensión
        content_type, _ = mimetypes.guess_type(filename)
        
        # Si no se detecta, usar un valor por defecto
        if not content_type:
            # Mapeo manual para extensiones comunes
            ext = Path(filename).suffix.lower()
            manual_map = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.pdf': 'application/pdf',
                '.webp': 'image/webp'
            }
            content_type = manual_map.get(ext, 'application/octet-stream')
        
        return content_type
    
    async def register_file_metadata(
        self, 
        factura_id: UUID, 
        file_data: FileCreateRequest,
        doc_type: str = "FACTURA_PDF"
    ) -> FileResponse:
        """
        Registra metadata de un archivo sin realizar upload físico.
        
        Propósito: Crear registro en tabla files asociado a una factura existente.
        Datos necesarios: factura_id (validado previamente), file_data con los 5 campos, doc_type.
        
        Args:
            factura_id: UUID de la factura a la que se asocia el archivo
            file_data: Metadata del archivo (storage_provider, storage_path, filename, content_type, size_bytes)
            doc_type: Tipo de documento, por defecto "FACTURA_PDF"
        
        Returns:
            FileResponse con todos los datos del archivo registrado
        """
        logger.info(f"Registrando metadata de archivo para factura {factura_id}: {file_data.filename} con doc_type={doc_type}")
        
        try:
            # Operación: Crear registro en BD con metadata del archivo y doc_type
            db_file_data = {
                "factura_id": factura_id,
                "doc_type": doc_type,
                "storage_provider": file_data.storage_provider,
                "storage_path": file_data.storage_path,
                "filename": file_data.filename,
                "content_type": file_data.content_type,
                "size_bytes": file_data.size_bytes
            }
            
            db_file = await self.repository.create(db_file_data)
            
            # ✅ Validación: Registro creado exitosamente con ID generado
            logger.info(f"Metadata de archivo registrada exitosamente: {db_file.id} con doc_type={doc_type}")
            
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
        
        # Descargar desde S3
        if file.storage_provider == "s3":
            try:
                from core.s3_service import s3_service
                logger.info(f"Descargando archivo desde S3: {file.storage_path}")
                content, content_type = s3_service.get_file_with_metadata(file.storage_path)
                return content, content_type, file.filename
            except Exception as e:
                logger.error(f"Error descargando desde S3: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error al descargar el archivo desde S3"
                )
        
        # Otros proveedores no implementados
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Storage provider '{file.storage_provider}' no implementado"
        )
    
    async def get_files_by_factura(self, factura_id: UUID, doc_type: Optional[str] = None) -> List[FileResponse]:
        """
        Obtiene todos los archivos de una factura, opcionalmente filtrados por doc_type.
        Si no encuentra archivos en BD y doc_type='FACTURA_PDF', busca en S3 directamente.
        """
        logger.info(f"Obteniendo archivos de factura: {factura_id}, doc_type: {doc_type}")
        files = await self.repository.get_by_factura(factura_id, doc_type)
        
        # Si no hay archivos en BD y se busca FACTURA_PDF, buscar en S3
        if len(files) == 0 and doc_type == 'FACTURA_PDF':
            use_s3 = bool(settings.aws_access_key_id and settings.s3_bucket)
            
            if use_s3:
                from core.s3_service import s3_service
                
                # Buscar en la ruta dev/facturas/{factura_id}/FACTURA_PDF/
                s3_prefix = f"dev/facturas/{factura_id}/FACTURA_PDF/"
                logger.info(f"Buscando archivos en S3 con prefijo: {s3_prefix}")
                
                try:
                    s3_files = s3_service.list_files_in_prefix(s3_prefix)
                    
                    # Convertir archivos de S3 a FileResponse
                    return [FileResponse(
                        id=UUID('00000000-0000-0000-0000-000000000000'),  # ID temporal
                        factura_id=factura_id,
                        doc_type='FACTURA_PDF',
                        storage_provider='s3',
                        storage_path=f['key'],
                        filename=f['filename'],
                        content_type='application/pdf',
                        size_bytes=f['size_bytes'],
                        uploaded_at=f['last_modified'],
                        download_url=f['download_url']
                    ) for f in s3_files]
                except Exception as e:
                    logger.error(f"Error listando archivos desde S3: {e}")
        
        # Para archivos de BD, generar download_url si son de S3
        result = []
        for f in files:
            download_url = None
            if f.storage_provider == 's3':
                try:
                    from core.s3_service import s3_service
                    download_url = s3_service.presign_get_url(f.storage_path)
                except Exception as e:
                    logger.error(f"Error generando presigned URL: {e}")
            
            result.append(FileResponse(
                id=f.id,
                factura_id=f.factura_id,
                doc_type=f.doc_type,
                storage_provider=f.storage_provider,
                storage_path=f.storage_path,
                filename=f.filename,
                content_type=f.content_type,
                size_bytes=f.size_bytes,
                uploaded_at=f.created_at,
                download_url=download_url
            ))
        
        return result
    
    async def download_from_s3(self, key: str) -> tuple[bytes, str, str]:
        """
        Descarga un archivo directamente desde S3.
        
        Args:
            key: S3 key del archivo
            
        Returns:
            tuple: (contenido_bytes, filename, content_type)
        """
        try:
            from core.s3_service import s3_service
            
            # Extraer filename de la key
            filename = key.split('/')[-1]
            
            logger.info(f"Descargando archivo desde S3: {key}")
            content, content_type = s3_service.get_file_with_metadata(key)
            
            return content, filename, content_type
            
        except Exception as e:
            logger.error(f"Error descargando desde S3: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al descargar el archivo desde S3"
            )
    
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
        
        # Obtener content_types y extensiones permitidas según doc_type
        allowed_content_types = self.ALLOWED_CONTENT_TYPES.get(
            doc_type, 
            self.ALLOWED_CONTENT_TYPES["default"]
        )
        allowed_extensions = self.ALLOWED_EXTENSIONS.get(
            doc_type, 
            self.ALLOWED_EXTENSIONS["default"]
        )
        
        # Validación 2: extensión de archivo (primero)
        if not file.filename:
            logger.warning("Filename no proporcionado")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "bad_request", "message": "Se requiere nombre de archivo"}
            )
        
        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in allowed_extensions:
            logger.warning(f"Extensión de archivo inválida: {file_extension} para doc_type: {doc_type}")
            allowed_ext_str = ", ".join(sorted(allowed_extensions))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "bad_request", 
                    "message": f"Para {doc_type} solo se permiten extensiones: {allowed_ext_str}"
                }
            )
        
        # Detectar content_type automáticamente si el que viene del navegador no es válido
        detected_content_type = self._detect_content_type(file.filename)
        actual_content_type = file.content_type if file.content_type in allowed_content_types else detected_content_type
        
        # Validación 3: tipo de archivo (después de la detección)
        if actual_content_type not in allowed_content_types:
            logger.warning(f"Tipo de archivo inválido: {actual_content_type} (original: {file.content_type}) para doc_type: {doc_type}")
            allowed_types_str = ", ".join(sorted(allowed_content_types))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "bad_request", 
                    "message": f"Para {doc_type} solo se permiten: {allowed_types_str}"
                }
            )
        
        logger.info(f"Content-type detectado: {actual_content_type} (original: {file.content_type})")
        
        # Validación 4: verificar duplicado (EXCEPTO para OC que permite múltiples archivos)
        if doc_type != 'OC':  # Permitir múltiples archivos OC/OS
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
        else:
            logger.info(f"Permitiendo múltiples archivos OC/OS para factura_id={factura_id}")
        
        try:
            # Determinar si usar S3 o storage local
            use_s3 = bool(settings.aws_access_key_id and settings.s3_bucket)
            
            if use_s3:
                # ============ SUBIDA A S3 ============
                from core.s3_service import s3_service
                
                # Generar key de S3
                timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
                sanitized_filename = self._sanitize_filename(file.filename)
                new_filename = f"{timestamp}_{sanitized_filename}"
                s3_key = f"dev/facturas/{factura_id}/{doc_type}/{new_filename}"
                
                # Subir a S3
                logger.info(f"Subiendo archivo a S3: {s3_key}")
                content = await file.read()
                file_bytes_io = __import__('io').BytesIO(content)
                
                s3_metadata = s3_service.upload_fileobj(
                    fileobj=file_bytes_io,
                    key=s3_key,
                    content_type=actual_content_type
                )
                
                # Generar URL prefirmada (válida 10 minutos)
                download_url = s3_service.presign_get_url(s3_key, expires_in=600)
                
                # Registrar en base de datos
                file_data = {
                    "factura_id": factura_id,
                    "doc_type": doc_type,
                    "storage_provider": "s3",
                    "storage_path": s3_key,  # Guardar key de S3
                    "filename": new_filename,
                    "content_type": s3_metadata["content_type"],
                    "size_bytes": s3_metadata["size_bytes"],
                    "uploaded_by_user_id": uploaded_by_user_id
                }
                
                db_file = await self.repository.create(file_data)
                logger.info(f"Archivo S3 registrado en BD con ID: {db_file.id}")
                
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
                    "created_at": db_file.created_at,
                    "download_url": download_url
                }
                
                if uploaded_by_user_id:
                    response_data["uploaded_by_user_id"] = uploaded_by_user_id
                
                return FileUploadResponse(**response_data)
                
            else:
                # ============ SUBIDA LOCAL (FALLBACK) ============
                logger.info("AWS no configurado, usando storage local")
                
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
                    "content_type": actual_content_type,
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
            # Intentar limpiar archivo si se guardó localmente
            if 'file_path' in locals() and file_path.exists():
                try:
                    file_path.unlink()
                except Exception as cleanup_error:
                    logger.error(f"Error limpiando archivo: {cleanup_error}")
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "internal_error", "message": "Error al guardar el archivo"}
            )
