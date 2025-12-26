"""
Router para asignaciones de facturas.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from db.session import get_db
from core.auth import require_api_key
from modules.asignaciones.service import AsignacionService
from modules.asignaciones.schemas import AsignacionCreateRequest, AsignacionResponse


router = APIRouter(prefix="/facturas", tags=["Asignaciones"])


@router.post(
    "/{factura_id}/asignaciones",
    response_model=AsignacionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear asignación de factura",
    dependencies=[Depends(require_api_key)]
)
async def crear_asignacion(
    factura_id: UUID,
    data: AsignacionCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Crea una nueva asignación de factura a un responsable.
    
    **Validaciones:**
    - La factura existe
    - El área existe
    - El usuario existe
    - El usuario pertenece al área especificada
    - La factura está en estado 'Recibida'
    - No existe una asignación duplicada
    
    **Acciones:**
    - Crea registro en factura_asignaciones
    - Actualiza area_id, assigned_to_user_id, assigned_at en facturas
    - Cambia estado de la factura a 'Asignada'
    
    **Requiere:**
    - Header: x-api-key
    """
    service = AsignacionService(db)
    return await service.crear_asignacion(factura_id, data)
