"""
Repositorio para operaciones del dashboard.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict
from db.models import Factura, Area, User, Estado


class DashboardRepository:
    """Repositorio para gestionar operaciones del dashboard."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_facturas_metrics(self) -> Dict[str, int]:
        """Obtiene métricas de facturas por estado."""
        # Obtener códigos de estados
        result_estados = await self.db.execute(select(Estado))
        estados = {e.code: e.id for e in result_estados.scalars().all()}
        
        # Contar facturas por estado
        metrics = {
            "recibidas": 0,
            "asignadas": 0,
            "cerradas": 0,
            "pendientes": 0
        }
        
        # Recibidas (estado: recibida)
        if "recibida" in estados:
            result = await self.db.execute(
                select(func.count(Factura.id)).where(Factura.estado_id == estados["recibida"])
            )
            metrics["recibidas"] = result.scalar() or 0
        
        # Asignadas (estado: asignada)
        if "asignada" in estados:
            result = await self.db.execute(
                select(func.count(Factura.id)).where(Factura.estado_id == estados["asignada"])
            )
            metrics["asignadas"] = result.scalar() or 0
        
        # Cerradas (estado: cerrada)
        if "cerrada" in estados:
            result = await self.db.execute(
                select(func.count(Factura.id)).where(Factura.estado_id == estados["cerrada"])
            )
            metrics["cerradas"] = result.scalar() or 0
        
        # Pendientes (estado: pendiente)
        if "pendiente" in estados:
            result = await self.db.execute(
                select(func.count(Factura.id)).where(Factura.estado_id == estados["pendiente"])
            )
            metrics["pendientes"] = result.scalar() or 0
        
        return metrics
    
    async def get_recientes_asignadas(self, limit: int = 10) -> List[Dict]:
        """Obtiene facturas recientemente asignadas."""
        result = await self.db.execute(
            select(
                Factura,
                Area.nombre.label("area_nombre"),
                User.nombre.label("user_nombre"),
                Estado.label.label("estado_label")
            )
            .join(Area, Factura.area_id == Area.id)
            .join(Estado, Factura.estado_id == Estado.id)
            .outerjoin(User, Factura.assigned_to_user_id == User.id)
            .where(Factura.assigned_at.isnot(None))
            .order_by(Factura.assigned_at.desc())
            .limit(limit)
        )
        
        asignaciones = []
        for row in result.all():
            factura, area_nombre, user_nombre, estado_label = row
            asignaciones.append({
                "numero_factura": factura.numero_factura,
                "proveedor": factura.proveedor,
                "area": area_nombre,
                "quien_la_tiene": user_nombre or "Sin asignar",
                "fecha_asignacion": factura.assigned_at,
                "estado": estado_label
            })
        
        return asignaciones
