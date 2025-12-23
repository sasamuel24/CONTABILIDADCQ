"""
Router de FastAPI para el módulo de files.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from db.session import get_db
from modules.files.repository import FileRepository
from modules.files.service import FileService
from modules.files.schemas import FileResponse


router = APIRouter(tags=["Files"])


def get_file_service(db: AsyncSession = Depends(get_db)) -> FileService:
    """Dependency para obtener el servicio de files."""
    repository = FileRepository(db)
    return FileService(repository)


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
