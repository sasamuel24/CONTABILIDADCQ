"""
Servicio para lógica de negocio del dashboard.
"""
from modules.dashboard.repository import DashboardRepository
from modules.dashboard.schemas import FacturasMetricsResponse, AsignacionRecienteResponse
from typing import List
from core.logging import logger


class DashboardService:
    """Servicio que contiene la lógica de negocio del dashboard."""
    
    def __init__(self, repository: DashboardRepository):
        self.repository = repository
    
    async def get_facturas_metrics(self) -> FacturasMetricsResponse:
        """Obtiene métricas de facturas."""
        logger.info("Obteniendo métricas de facturas")
        metrics = await self.repository.get_facturas_metrics()
        return FacturasMetricsResponse(**metrics)
    
    async def get_recientes_asignadas(self) -> List[AsignacionRecienteResponse]:
        """Obtiene facturas recientemente asignadas."""
        logger.info("Obteniendo asignaciones recientes")
        asignaciones = await self.repository.get_recientes_asignadas()
        return [AsignacionRecienteResponse(**a) for a in asignaciones]
