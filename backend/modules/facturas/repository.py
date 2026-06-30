"""
Repositorio para operaciones de base de datos del módulo facturas.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload, noload
from typing import Optional, List, Tuple, Dict
from uuid import UUID
from db.models import Factura, Area, Estado
from datetime import datetime


class FacturaRepository:
    """Repositorio para gestionar operaciones de facturas en base de datos."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(self, skip: int = 0, limit: int = 0, area_id: Optional[UUID] = None, area_origen_id: Optional[UUID] = None, estado: Optional[str] = None, search: Optional[str] = None, only_in_carpeta: bool = False, solo_tiendas: bool = False, estado_code: Optional[str] = None) -> Tuple[List[Factura], int]:
        """Obtiene todas las facturas con paginación y filtros opcionales.

        Optimización: el modelo Factura define 16 relaciones con lazy="selectin",
        por lo que TODAS se cargan en cada factura aunque el listado no las use.
        Aquí solo cargamos lo que el mapeo de FacturaListItem realmente necesita y
        anulamos (noload) las relaciones pesadas no usadas en el listado. Esto elimina
        las queries de asignaciones, comentarios, tokens y distribución (≈40% del
        tiempo de BD según pg_stat_statements) que antes se ejecutaban sin necesidad.
        """
        opciones = [
            selectinload(Factura.inventario_codigos),
            selectinload(Factura.unidad_negocio),
            selectinload(Factura.cuenta_auxiliar),
            # carpeta/carpeta_tesoreria solo aportan id/nombre/parent_id al listado.
            # noload('*') evita que cada Carpeta (lazy="selectin" en parent/children/
            # facturas) arrastre todas SUS facturas y subcarpetas en cascada, y que
            # cada una de esas facturas re-dispare sus 16 relaciones selectin.
            selectinload(Factura.carpeta).noload("*"),
            selectinload(Factura.carpeta_tesoreria).noload("*"),
            # Relaciones NO usadas en el listado -> no cargarlas (anulan el selectin del modelo)
            noload(Factura.asignaciones),
            noload(Factura.comentarios),
            noload(Factura.tokens_aprobacion),
            noload(Factura.distribucion_ccco),
            noload(Factura.area_origen),
            noload(Factura.assigned_user),
        ]
        if only_in_carpeta:
            # Bandeja de Tesorería (único caller de only_in_carpeta): la lista NO muestra
            # archivos ni nombres de centro, y el detalle los re-obtiene por id. Anular
            # 'files' (el selectin más pesado y el grueso del payload) + los centros
            # recorta drásticamente la respuesta. Se mantienen inventario_codigos,
            # unidad_negocio y cuenta_auxiliar porque el detalle SÍ los lee del item.
            opciones += [
                noload(Factura.files),
                noload(Factura.centro_costo),
                noload(Factura.centro_operacion),
            ]
        else:
            opciones.append(selectinload(Factura.files))

        query = select(Factura).options(*opciones)
        count_query = select(func.count(Factura.id))

        if area_id:
            query = query.where(Factura.area_id == area_id)
            count_query = count_query.where(Factura.area_id == area_id)

        # Bandeja multi-tienda: facturas de TODAS las áreas marcadas como tienda.
        # Usado por el rol responsable_tiendas (subquery sobre areas.es_tienda).
        if solo_tiendas:
            tiendas_subq = select(Area.id).where(Area.es_tienda.is_(True))
            query = query.where(Factura.area_id.in_(tiendas_subq))
            count_query = count_query.where(Factura.area_id.in_(tiendas_subq))

        if area_origen_id:
            query = query.where(Factura.area_origen_id == area_origen_id)
            count_query = count_query.where(Factura.area_origen_id == area_origen_id)

        if estado:
            query = query.join(Estado, Factura.estado_id == Estado.id).where(Estado.label == estado)
            count_query = count_query.join(Estado, Factura.estado_id == Estado.id).where(Estado.label == estado)

        # Filtro por CÓDIGO de estado (estable, no depende del label que puede tener
        # acentos/espacios). Usado por la vista de represadas del jefe de zona.
        if estado_code:
            query = query.join(Estado, Factura.estado_id == Estado.id).where(Estado.code == estado_code)
            count_query = count_query.join(Estado, Factura.estado_id == Estado.id).where(Estado.code == estado_code)

        if search:
            pattern = f"%{search}%"
            search_filter = or_(
                Factura.numero_factura.ilike(pattern),
                Factura.proveedor.ilike(pattern)
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        if only_in_carpeta:
            query = query.where(Factura.carpeta_id.isnot(None))
            count_query = count_query.where(Factura.carpeta_id.isnot(None))

        count_result = await self.db.execute(count_query)
        total = count_result.scalar()

        query = query.order_by(Factura.created_at.desc()).offset(skip)
        if limit > 0:
            query = query.limit(limit)
        result = await self.db.execute(query)
        facturas = result.scalars().all()

        return facturas, total

    async def get_counts_by_area(self) -> List[Dict]:
        """Cuenta facturas agrupadas por área en una sola query."""
        result = await self.db.execute(
            select(Area.id, Area.nombre, func.count(Factura.id).label('count'))
            .outerjoin(Factura, Factura.area_id == Area.id)
            .group_by(Area.id, Area.nombre)
            .order_by(Area.nombre)
        )
        return [{'area_id': str(row.id), 'nombre': row.nombre, 'count': row.count} for row in result.all()]
    
    async def get_represadas_tiendas(self) -> Dict:
        """Resumen de facturas represadas por tienda.

        Una factura está "represada" cuando sigue en estado 'asignada' (asignada al
        responsable y aún no enviada a Contabilidad). Solo se consideran las áreas
        marcadas como tienda (areas.es_tienda). Se agrupa por área en una sola query.

        El INNER JOIN hace que solo aparezcan tiendas que TIENEN represadas (las que
        están al día no ensucian el reporte).
        """
        result = await self.db.execute(
            select(
                Area.id,
                Area.nombre,
                func.count(Factura.id).label('count'),
                func.coalesce(func.sum(Factura.total), 0).label('monto'),
                func.min(Factura.created_at).label('mas_antigua'),
            )
            .select_from(Area)
            .join(Factura, Factura.area_id == Area.id)
            .join(Estado, Factura.estado_id == Estado.id)
            .where(Area.es_tienda.is_(True))
            .where(Estado.code == 'asignada')
            .group_by(Area.id, Area.nombre)
            .order_by(func.count(Factura.id).desc())
        )

        areas: List[Dict] = []
        total = 0
        monto_total = 0.0
        for row in result.all():
            monto = float(row.monto or 0)
            total += row.count
            monto_total += monto
            areas.append({
                'area_id': str(row.id),
                'nombre': row.nombre,
                'count': row.count,
                'monto': monto,
                'mas_antigua': row.mas_antigua.isoformat() if row.mas_antigua else None,
            })

        return {
            'total_represadas': total,
            'monto_total': monto_total,
            'tiendas_con_represadas': len(areas),
            'areas': areas,
        }

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
            # Estado 5 = Pagada (final) — registrar fecha de cierre
            if estado_id == 5:
                factura.fecha_cierre = datetime.utcnow()
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

    async def delete(self, factura: Factura) -> None:
        """Elimina una factura y sus registros relacionados (cascade)."""
        await self.db.delete(factura)
        await self.db.flush()
