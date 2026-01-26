from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
from uuid import UUID

from db.session import get_db
from core.auth import get_current_user
from db.models import User
from modules.distribucion_ccco.service import DistribucionCCCOService
from modules.distribucion_ccco.schemas import (
    DistribucionCCCOResponse,
    DistribucionBulkUpdate
)


router = APIRouter()

CurrentUser = Annotated[User, Depends(get_current_user)]
DBSession = Annotated[AsyncSession, Depends(get_db)]


@router.get(
    "/facturas/{factura_id}/distribucion-ccco",
    response_model=list[DistribucionCCCOResponse],
    summary="Obtener distribución CC/CO de una factura"
)
async def get_distribucion_by_factura(
    factura_id: UUID,
    session: DBSession,
    current_user: CurrentUser
):
    """
    Obtener todas las distribuciones CC/CO de una factura.
    Retorna una lista vacía si no tiene distribuciones.
    """
    service = DistribucionCCCOService(session)
    return await service.get_by_factura(factura_id)


@router.put(
    "/facturas/{factura_id}/distribucion-ccco",
    response_model=list[DistribucionCCCOResponse],
    summary="Actualizar distribución CC/CO de una factura"
)
async def update_distribucion(
    factura_id: UUID,
    bulk_update: DistribucionBulkUpdate,
    session: DBSession,
    current_user: CurrentUser
):
    """
    Actualizar todas las distribuciones de una factura.
    
    - Reemplaza todas las distribuciones existentes con las nuevas
    - Valida que los porcentajes sumen 100%
    - Enviar lista vacía para eliminar todas las distribuciones
    
    Ejemplo de payload:
    ```json
    {
        "distribuciones": [
            {
                "centro_costo_id": "uuid",
                "centro_operacion_id": "uuid",
                "unidad_negocio_id": "uuid",
                "cuenta_auxiliar_id": "uuid",
                "porcentaje": 50.0
            },
            {
                "centro_costo_id": "uuid",
                "centro_operacion_id": "uuid",
                "porcentaje": 50.0
            }
        ]
    }
    ```
    """
    service = DistribucionCCCOService(session)
    return await service.update_factura_distribuciones(factura_id, bulk_update)


@router.delete(
    "/facturas/{factura_id}/distribucion-ccco",
    summary="Eliminar todas las distribuciones de una factura"
)
async def delete_all_distribuciones(
    factura_id: UUID,
    session: DBSession,
    current_user: CurrentUser
):
    """
    Eliminar todas las distribuciones CC/CO de una factura.
    """
    service = DistribucionCCCOService(session)
    return await service.delete_all_by_factura(factura_id)
