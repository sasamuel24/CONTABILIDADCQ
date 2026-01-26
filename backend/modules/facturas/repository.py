"""
Repositorio para operaciones de base de datos del módulo facturas.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional, List, Tuple
from uuid import UUID
from db.models import Factura, Area, Estado
from datetime import datetime


class FacturaRepository:
    """Repositorio para gestionar operaciones de facturas en base de datos."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(self, skip: int = 0, limit: int = 100, area_id: Optional[UUID] = None, estado: Optional[str] = None) -> Tuple[List[Factura], int]:
        """Obtiene todas las facturas con paginación y filtros opcionales."""
        # Construir query base con eager loading de files e inventario_codigos
        query = select(Factura).options(
            selectinload(Factura.files),
            selectinload(Factura.inventario_codigos),
            selectinload(Factura.unidad_negocio),
            selectinload(Factura.cuenta_auxiliar)
        )
        count_query = select(func.count(Factura.id))
        
        # Aplicar filtro por area_id si se proporciona
        if area_id:
            query = query.where(Factura.area_id == area_id)
            count_query = count_query.where(Factura.area_id == area_id)
        
        # Aplicar filtro por estado si se proporciona
        if estado:
            # Join con la tabla Estado para filtrar por label
            query = query.join(Estado, Factura.estado_id == Estado.id).where(Estado.label == estado)
            count_query = count_query.join(Estado, Factura.estado_id == Estado.id).where(Estado.label == estado)
        
        # Contar total
        count_result = await self.db.execute(count_query)
        total = count_result.scalar()
        
        # Obtener facturas
        query = query.order_by(Factura.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        facturas = result.scalars().all()
        
        return facturas, total
    
    async def get_by_id(self, factura_id: UUID) -> Optional[Factura]:
        """Obtiene una factura por ID."""
        result = await self.db.execute(
            select(Factura).where(Factura.id == factura_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_numero(self, numero_factura: str) -> Optional[Factura]:
        """Obtiene una factura por número."""
        result = await self.db.execute(
            select(Factura).where(Factura.numero_factura == numero_factura)
        )
        return result.scalar_one_or_none()
    
    async def create(self, factura_data: dict) -> Factura:
        """Crea una nueva factura."""
        factura = Factura(**factura_data)
        self.db.add(factura)
        await self.db.flush()
        await self.db.refresh(factura)
        return factura
    
    async def update_estado(self, factura_id: UUID, estado_id: int) -> Optional[Factura]:
        """Actualiza el estado de una factura."""
        factura = await self.get_by_id(factura_id)
        if factura:
            factura.estado_id = estado_id
            factura.updated_at = datetime.utcnow()
            await self.db.flush()
            await self.db.refresh(factura)
        return factura
    
    async def update(self, factura_id: UUID, factura_data: dict) -> Optional[Factura]:
        """Actualiza una factura completa."""
        factura = await self.get_by_id(factura_id)
        if factura:
            for key, value in factura_data.items():
                if hasattr(factura, key):
                    setattr(factura, key, value)
            factura.updated_at = datetime.utcnow()
            await self.db.flush()
            await self.db.refresh(factura)
        return factura
