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
        """Obtiene métricas de facturas con una sola query de agregación condicional."""
        result = await self.db.execute(
            select(
                func.count(Factura.id).label('total'),
                func.count(Factura.id).filter(Estado.code != 'recibida').label('asignadas'),
                func.count(Factura.id).filter(Estado.code == 'pagada').label('cerradas'),
                func.count(Factura.id).filter(Estado.code == 'recibida').label('pendientes'),
            )
            .join(Estado, Factura.estado_id == Estado.id)
        )
        row = result.one()
        return {
            "recibidas": row.total or 0,
            "asignadas": row.asignadas or 0,
            "cerradas": row.cerradas or 0,
            "pendientes": row.pendientes or 0,
        }
    
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
