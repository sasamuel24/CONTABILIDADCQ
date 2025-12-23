"""
Esquemas Pydantic para el módulo de dashboard.
"""
from pydantic import BaseModel
from datetime import datetime


class FacturasMetricsResponse(BaseModel):
    """Métricas de facturas por estado."""
    recibidas: int
    asignadas: int
    cerradas: int
    pendientes: int


class AsignacionRecienteResponse(BaseModel):
    """Asignación reciente de factura."""
    numero_factura: str
    proveedor: str
    area: str
    quien_la_tiene: str
    fecha_asignacion: datetime
    estado: str
