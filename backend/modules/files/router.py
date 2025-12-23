"""
Router de FastAPI para el módulo de files.
"""
from fastapi import APIRouter, Depends, Body, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from db.session import get_db
from modules.files.repository import FileRepository
from modules.files.service import FileService
from modules.files.schemas import FileResponse, FileCreateRequest
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
    Registra metadata de un archivo PDF asociado a una factura.
    
    **Requiere API Key:** Header `x-api-key` con la clave válida.
    
    **Propósito:** Crear registro en tabla files sin upload binario (usado por n8n).
    
    **Validaciones:**
    - Verifica API Key (401 si inválida)
    - Verifica que la factura existe (404 si no)
    - Valida schema del body (422 si es inválido - automático por Pydantic)
    
    **Flujo con n8n:**
    1. n8n crea factura en POST /facturas
    2. n8n registra archivo en POST /facturas/{factura_id}/files
    
    - **factura_id**: ID de la factura (desde URL)
    - **file_data**: Metadata del archivo (body JSON)
    """
    logger.info(f"Registrando archivo para factura {factura_id}")
    
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
    logger.info(f"Factura {factura_id} validada exitosamente, creando registro de archivo")
    
    # Operación: Crear registro en tabla files con metadata
    # Datos necesarios: factura_id, file_data (5 campos validados por Pydantic)
    result = await service.register_file_metadata(factura_id, file_data)
    
    # ✅ Validación: Registro creado exitosamente con todos los campos en orden correcto
    logger.info(f"Archivo {result.id} registrado exitosamente para factura {factura_id}")
    
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
    service: FileService = Depends(get_file_service)
):
    """Lista todos los archivos asociados a una factura."""
    return await service.get_files_by_factura(factura_id)


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
