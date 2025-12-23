"""
Router de FastAPI para el módulo de dashboard.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from db.session import get_db
from modules.dashboard.repository import DashboardRepository
from modules.dashboard.service import DashboardService
from modules.dashboard.schemas import FacturasMetricsResponse, AsignacionRecienteResponse


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def get_dashboard_service(db: AsyncSession = Depends(get_db)) -> DashboardService:
    """Dependency para obtener el servicio de dashboard."""
    repository = DashboardRepository(db)
    return DashboardService(repository)


@router.get("/facturas/metrics", response_model=FacturasMetricsResponse)
async def get_facturas_metrics(
    service: DashboardService = Depends(get_dashboard_service)
):
    """Obtiene métricas de facturas por estado."""
    return await service.get_facturas_metrics()


@router.get("/areas/recientes-asignadas", response_model=List[AsignacionRecienteResponse])
async def get_recientes_asignadas(
    service: DashboardService = Depends(get_dashboard_service)
):
    """Obtiene facturas recientemente asignadas por área."""
    return await service.get_recientes_asignadas()
