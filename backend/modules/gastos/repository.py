"""Repositorio para operaciones de base de datos del módulo gastos."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete, extract
from sqlalchemy.orm import selectinload
from typing import Optional, List, Tuple
from uuid import UUID
from datetime import datetime

from db.models import (
    PaqueteGasto, GastoLegalizacion, ArchivoGasto,
    ComentarioPaquete, HistorialEstadoPaquete, TokenAprobacionPaquete
)


class PaqueteRepository:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, paquete_id: UUID) -> Optional[PaqueteGasto]:
        result = await self.db.execute(
            select(PaqueteGasto)
            .options(
                selectinload(PaqueteGasto.tecnico),
                selectinload(PaqueteGasto.area),
                selectinload(PaqueteGasto.revisado_por),
                selectinload(PaqueteGasto.gastos).selectinload(GastoLegalizacion.archivos),
                selectinload(PaqueteGasto.gastos).selectinload(GastoLegalizacion.centro_costo),
                selectinload(PaqueteGasto.gastos).selectinload(GastoLegalizacion.centro_operacion),
                selectinload(PaqueteGasto.gastos).selectinload(GastoLegalizacion.cuenta_auxiliar),
                selectinload(PaqueteGasto.comentarios).selectinload(ComentarioPaquete.user),
                selectinload(PaqueteGasto.historial_estados).selectinload(HistorialEstadoPaquete.user),
            )
            .where(PaqueteGasto.id == paquete_id)
        )
        return result.scalar_one_or_none()

    async def list_by_user(
        self, user_id: UUID, skip: int = 0, limit: int = 50
    ) -> Tuple[List[PaqueteGasto], int]:
        count_q = select(func.count(PaqueteGasto.id)).where(PaqueteGasto.user_id == user_id)
        count_result = await self.db.execute(count_q)
        total = count_result.scalar()

        q = (
            select(PaqueteGasto)
            .options(
                selectinload(PaqueteGasto.tecnico),
                selectinload(PaqueteGasto.area),
                selectinload(PaqueteGasto.comentarios).selectinload(ComentarioPaquete.user),
            )
            .where(PaqueteGasto.user_id == user_id)
            .order_by(PaqueteGasto.created_at.desc())
            .offset(skip).limit(limit)
        )
        result = await self.db.execute(q)
        return list(result.scalars().all()), total

    async def list_all(
        self, skip: int = 0, limit: int = 100,
        estado: Optional[str] = None
    ) -> Tuple[List[PaqueteGasto], int]:
        filters = []
        if estado:
            filters.append(PaqueteGasto.estado == estado)

        count_q = select(func.count(PaqueteGasto.id))
        if filters:
            count_q = count_q.where(*filters)
        total = (await self.db.execute(count_q)).scalar()

        q = (
            select(PaqueteGasto)
            .options(
                selectinload(PaqueteGasto.tecnico),
                selectinload(PaqueteGasto.area),
                selectinload(PaqueteGasto.comentarios).selectinload(ComentarioPaquete.user),
            )
            .order_by(PaqueteGasto.created_at.desc())
            .offset(skip).limit(limit)
        )
        if filters:
            q = q.where(*filters)
        result = await self.db.execute(q)
        return list(result.scalars().all()), total

    async def create(self, paquete: PaqueteGasto) -> PaqueteGasto:
        self.db.add(paquete)
        await self.db.flush()
        await self.db.refresh(paquete)
        return paquete

    async def save(self, paquete: PaqueteGasto) -> PaqueteGasto:
        await self.db.flush()
        await self.db.refresh(paquete)
        return paquete

    async def count_paquetes_by_year(self, year: int) -> int:
        """Cuenta paquetes cuyo folio corresponde al año dado para generar el siguiente número."""
        result = await self.db.execute(
            select(func.count(PaqueteGasto.id)).where(
                PaqueteGasto.folio.like(f"PKG-{year}-%")
            )
        )
        return result.scalar() or 0

    async def recalculate_totals(self, paquete_id: UUID) -> None:
        """Actualiza monto_total y total_documentos sumando los gastos."""
        monto_q = select(func.coalesce(func.sum(GastoLegalizacion.valor_pagado), 0)).where(
            GastoLegalizacion.paquete_id == paquete_id
        )
        monto = (await self.db.execute(monto_q)).scalar()

        docs_q = select(func.count(ArchivoGasto.id)).where(
            ArchivoGasto.paquete_id == paquete_id
        )
        docs = (await self.db.execute(docs_q)).scalar()

        await self.db.execute(
            update(PaqueteGasto)
            .where(PaqueteGasto.id == paquete_id)
            .values(monto_total=monto, total_documentos=docs)
        )


class GastoRepository:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, gasto_id: UUID) -> Optional[GastoLegalizacion]:
        result = await self.db.execute(
            select(GastoLegalizacion)
            .options(
                selectinload(GastoLegalizacion.archivos),
                selectinload(GastoLegalizacion.centro_costo),
                selectinload(GastoLegalizacion.centro_operacion),
                selectinload(GastoLegalizacion.cuenta_auxiliar),
            )
            .where(GastoLegalizacion.id == gasto_id)
        )
        return result.scalar_one_or_none()

    async def create(self, gasto: GastoLegalizacion) -> GastoLegalizacion:
        self.db.add(gasto)
        await self.db.flush()
        await self.db.refresh(gasto)
        return gasto

    async def save(self, gasto: GastoLegalizacion) -> GastoLegalizacion:
        await self.db.flush()
        await self.db.refresh(gasto)
        return gasto

    async def delete(self, gasto: GastoLegalizacion) -> None:
        await self.db.delete(gasto)
        await self.db.flush()


class ArchivoGastoRepository:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_gasto(self, gasto_id: UUID) -> Optional[ArchivoGasto]:
        result = await self.db.execute(
            select(ArchivoGasto).where(ArchivoGasto.gasto_id == gasto_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, archivo_id: UUID) -> Optional[ArchivoGasto]:
        result = await self.db.execute(
            select(ArchivoGasto).where(ArchivoGasto.id == archivo_id)
        )
        return result.scalar_one_or_none()

    async def create(self, archivo: ArchivoGasto) -> ArchivoGasto:
        self.db.add(archivo)
        await self.db.flush()
        await self.db.refresh(archivo)
        return archivo

    async def delete(self, archivo: ArchivoGasto) -> None:
        await self.db.delete(archivo)
        await self.db.flush()


class ComentarioPaqueteRepository:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, comentario: ComentarioPaquete) -> ComentarioPaquete:
        self.db.add(comentario)
        await self.db.flush()
        await self.db.refresh(comentario)
        return comentario


class HistorialRepository:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, historial: HistorialEstadoPaquete) -> HistorialEstadoPaquete:
        self.db.add(historial)
        await self.db.flush()
        await self.db.refresh(historial)
        return historial
