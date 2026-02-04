"""
Router para el módulo de comentarios de facturas.
"""
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Annotated

from db.session import get_db
from core.auth import get_current_user

from modules.comentarios.service import ComentarioService
from modules.comentarios.schemas import (
    ComentarioCreate,
    ComentarioUpdate,
    ComentarioOut,
    ComentarioListResponse
)

router = APIRouter()


@router.get(
    "/facturas/{factura_id}/comentarios",
    response_model=ComentarioListResponse,
    summary="Obtener comentarios de una factura",
    description="Obtiene todos los comentarios de una factura específica con trazabilidad completa."
)
async def get_comentarios(
    factura_id: UUID,
    skip: int = Query(0, ge=0, description="Número de registros a omitir"),
    limit: int = Query(100, ge=1, le=500, description="Número máximo de registros a retornar"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene todos los comentarios de una factura con información del usuario que comentó.
    """
    service = ComentarioService(db)
    comentarios, total = await service.get_comentarios_by_factura(factura_id, skip, limit)
    return ComentarioListResponse(comentarios=comentarios, total=total)


@router.post(
    "/facturas/{factura_id}/comentarios",
    response_model=ComentarioOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear comentario",
    description="Crea un nuevo comentario en una factura."
)
async def create_comentario(
    factura_id: UUID,
    comentario_data: ComentarioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Crea un nuevo comentario en una factura.
    El usuario que crea el comentario queda registrado para trazabilidad.
    """
    service = ComentarioService(db)
    user_id = UUID(current_user["user_id"])
    return await service.create_comentario(factura_id, user_id, comentario_data)


@router.put(
    "/comentarios/{comentario_id}",
    response_model=ComentarioOut,
    summary="Actualizar comentario",
    description="Actualiza el contenido de un comentario existente."
)
async def update_comentario(
    comentario_id: UUID,
    comentario_data: ComentarioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Actualiza el contenido de un comentario.
    Solo el usuario que creó el comentario puede editarlo.
    """
    service = ComentarioService(db)
    user_id = UUID(current_user["user_id"])
    return await service.update_comentario(comentario_id, user_id, comentario_data)


@router.delete(
    "/comentarios/{comentario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar comentario",
    description="Elimina un comentario existente."
)
async def delete_comentario(
    comentario_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Elimina un comentario.
    Solo el usuario que creó el comentario puede eliminarlo.
    """
    service = ComentarioService(db)
    user_id = UUID(current_user["user_id"])
    await service.delete_comentario(comentario_id, user_id)
    return None
