"""
Router de FastAPI para el módulo de files.
"""
from fastapi import APIRouter, Depends, Body, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import Response, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from db.session import get_db
from modules.files.repository import FileRepository
from modules.files.service import FileService
from modules.files.schemas import FileResponse, FileCreateRequest, FileUploadResponse, ErrorResponse
from modules.facturas.repository import FacturaRepository
from core.logging import logger
from core.auth import require_api_key


router = APIRouter(tags=["Files"])


def get_file_service(db: AsyncSession = Depends(get_db)) -> FileService:
    """Dependency para obtener el servicio de files."""
    repository = FileRepository(db)
    return FileService(repository)


@router.post(
    "/facturas/{factura_id}/files",
    response_model=FileResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
    responses={
        401: {"description": "API Key inválida o faltante"},
        404: {"description": "Factura no encontrada"},
        422: {"description": "Datos de entrada inválidos"}
    }
)
async def register_file_metadata(
    factura_id: UUID,
    file_data: FileCreateRequest = Body(...),
    service: FileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db)
):
    """
    Registra metadata de un archivo PDF asociado a una factura con doc_type="FACTURA_PDF".
    
    **Requiere API Key:** Header `x-api-key` con la clave válida.
    
    **Propósito:** Crear registro en tabla files sin upload binario (usado por n8n).
    
    **IMPORTANTE:** Este endpoint asigna automáticamente `doc_type="FACTURA_PDF"` a todos 
    los archivos registrados, permitiendo filtrarlos posteriormente.
    
    **Validaciones:**
    - Verifica API Key (401 si inválida)
    - Verifica que la factura existe (404 si no)
    - Valida schema del body (422 si es inválido - automático por Pydantic)
    - Asigna automáticamente doc_type="FACTURA_PDF"
    
    **Flujo con n8n:**
    1. n8n crea factura en POST /facturas
    2. n8n registra archivo en POST /facturas/{factura_id}/files
    
    - **factura_id**: ID de la factura (desde URL)
    - **file_data**: Metadata del archivo (body JSON)
    - **doc_type**: Se establece automáticamente como "FACTURA_PDF"
    """
    logger.info(f"Registrando archivo para factura {factura_id} con doc_type=FACTURA_PDF")
    
    # Operación: Verificar que la factura existe en BD
    # Datos necesarios: factura_id desde URL
    factura_repo = FacturaRepository(db)
    factura = await factura_repo.get_by_id(factura_id)
    
    if not factura:
        logger.warning(f"Factura {factura_id} no encontrada")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Factura con ID {factura_id} no encontrada"
        )
    
    # ✅ Validación: Factura existe, proceder a crear registro de archivo
    logger.info(f"Factura {factura_id} validada exitosamente, creando registro de archivo con doc_type=FACTURA_PDF")
    
    # Operación: Crear registro en tabla files con metadata y doc_type="FACTURA_PDF"
    # Datos necesarios: factura_id, file_data (5 campos validados por Pydantic), doc_type="FACTURA_PDF"
    result = await service.register_file_metadata(factura_id, file_data, doc_type="FACTURA_PDF")
    
    # ✅ Validación: Registro creado exitosamente con todos los campos en orden correcto
    logger.info(f"Archivo {result.id} registrado exitosamente para factura {factura_id} con doc_type=FACTURA_PDF")
    
    return result


@router.get("/facturas/{factura_id}/files/pdf")
async def download_factura_pdf(
    factura_id: UUID,
    service: FileService = Depends(get_file_service)
):
    """Descarga el PDF asociado a una factura."""
    content, content_type, filename = await service.get_pdf_by_factura(factura_id)
    
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/facturas/{factura_id}/files", response_model=List[FileResponse])
async def list_factura_files(
    factura_id: UUID,
    doc_type: Optional[str] = Query(None, description="Filtrar por tipo de documento (OC, OS, OCT, etc.)"),
    service: FileService = Depends(get_file_service)
):
    """Lista todos los archivos asociados a una factura, opcionalmente filtrados por doc_type."""
    return await service.get_files_by_factura(factura_id, doc_type)


@router.post(
    "/facturas/{factura_id}/files/upload",
    response_model=FileUploadResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {
            "model": ErrorResponse,
            "description": "Bad Request - Validación fallida"
        },
        404: {
            "description": "Factura no encontrada"
        },
        409: {
            "model": ErrorResponse,
            "description": "Conflict - Archivo duplicado"
        },
        500: {
            "model": ErrorResponse,
            "description": "Internal Server Error"
        }
    }
)
async def upload_factura_file(
    factura_id: UUID,
    doc_type: str = Form(..., description="Tipo de documento (OC, OS, OCT, etc.)"),
    file: UploadFile = File(..., description="Archivo PDF a subir"),
    service: FileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint de subida de archivos real para facturas.
    
    Recibe un archivo PDF mediante multipart/form-data y lo almacena en el sistema local.
    
    **Validaciones:**
    - La factura debe existir previamente
    - doc_type debe estar en lista permitida
    - Solo acepta archivos PDF
    - No permite duplicados (mismo factura_id + doc_type)
    
    **Almacenamiento:**
    - Ruta: storage/facturas/{factura_id}/{doc_type}/{timestamp}_{filename}
    - Registra metadata en tabla files
    
    **Parámetros:**
    - factura_id: UUID de la factura (URL)
    - doc_type: Tipo de documento (form-data)
    - file: Archivo PDF (form-data)
    
    **Respuestas:**
    - 201: Archivo subido exitosamente
    - 400: Validación fallida (doc_type inválido, archivo no PDF, etc.)
    - 404: Factura no encontrada
    - 409: Ya existe archivo con ese doc_type para esta factura
    - 500: Error interno al guardar
    """
    logger.info(f"Upload request para factura {factura_id}, doc_type: {doc_type}")
    
    # Verificar que la factura existe
    factura_repo = FacturaRepository(db)
    factura = await factura_repo.get_by_id(factura_id)
    
    if not factura:
        logger.warning(f"Factura {factura_id} no encontrada")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Factura con ID {factura_id} no encontrada"
        )
    
    # ✅ Validación: Factura existe, proceder con upload
    logger.info(f"Factura {factura_id} validada exitosamente")
    
    try:
        # Procesar upload (incluye todas las validaciones restantes)
        result = await service.upload_file(
            factura_id=factura_id,
            doc_type=doc_type,
            file=file,
            uploaded_by_user_id=None  # TODO: Obtener de autenticación si existe
        )
        
        # ✅ Validación: Archivo guardado y registrado exitosamente
        logger.info(f"Upload completado exitosamente: file_id={result.file_id}")
        
        return result
        
    except HTTPException as e:
        # Re-lanzar HTTPExceptions con formato correcto
        if e.status_code in [400, 409, 500]:
            return JSONResponse(
                status_code=e.status_code,
                content=e.detail
            )
        raise


@router.get("/files/{file_id}")
async def download_file(
    file_id: UUID,
    service: FileService = Depends(get_file_service)
):
    """Descarga un archivo específico por su ID."""
    content, content_type, filename = await service.get_file_content(file_id)
    
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
