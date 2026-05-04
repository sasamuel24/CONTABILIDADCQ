"""Lógica de negocio para el módulo de anticipos."""
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from typing import Tuple, List, Optional

from db.models import Anticipo, PaqueteGasto, HistorialEstadoPaquete, User
from modules.anticipos.repository import AnticipioRepository
from modules.anticipos.schemas import (
    AnticipioCreate, AnticipioOut, AnticipioListItem, AnticipioListResponse,
    UserBrief, PaqueteBrief,
)
from modules.gastos.service import GastosService
from modules.gastos.schemas import PaqueteCreate
from core.logging import logger


class AnticipioService:

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AnticipioRepository(db)

    async def crear(self, created_by_user_id: UUID, data: AnticipioCreate) -> AnticipioOut:
        # Buscar el usuario asignado para obtener su área
        assigned_user = await self.db.get(User, data.assigned_to_user_id)
        if not assigned_user or not assigned_user.is_active:
            raise HTTPException(status_code=400, detail="Usuario asignado no encontrado o inactivo.")
        if not assigned_user.area_id:
            raise HTTPException(status_code=400, detail="El usuario asignado no tiene área asignada.")

        # Generar folio: ANT-{AÑO}-{N:05d}
        year = datetime.now(tz=timezone.utc).year
        max_num = await self.repo.max_folio_number_by_year(year)
        folio = f"ANT-{year}-{max_num + 1:05d}"

        anticipo = Anticipo(
            folio=folio,
            created_by_user_id=created_by_user_id,
            assigned_to_user_id=data.assigned_to_user_id,
            monto=data.monto,
            descripcion=data.descripcion,
            estado="activo",
        )
        await self.repo.create(anticipo)

        # Crear el paquete de gastos asociado
        gastos_svc = GastosService(self.db)
        area_code = assigned_user.area.code.lower() if assigned_user.area else ""
        paquete_data = PaqueteCreate(semana=data.semana)
        paquete = await gastos_svc._crear_paquete_para_anticipo(
            user_id=data.assigned_to_user_id,
            area_id=assigned_user.area_id,
            data=paquete_data,
            area_code=area_code,
            anticipo_id=anticipo.id,
        )

        try:
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al crear anticipo: {e}")
            raise HTTPException(status_code=500, detail="Error al crear el anticipo.")

        anticipo_fresh = await self.repo.get_by_id(anticipo.id)
        return self._to_out(anticipo_fresh)

    async def listar(
        self, skip: int, limit: int, estado: Optional[str] = None
    ) -> AnticipioListResponse:
        anticipos, total = await self.repo.list_all(skip, limit, estado)
        for a in anticipos:
            await self._auto_cerrar_si_pagado(a)
        items = [self._to_list_item(a) for a in anticipos]
        return AnticipioListResponse(anticipos=items, total=total)

    async def listar_mis(
        self, user_id: UUID, estado: Optional[str] = None
    ) -> AnticipioListResponse:
        """Retorna los anticipos asignados al usuario indicado."""
        anticipos = await self.repo.list_by_assigned_user(user_id, estado)
        items = [self._to_list_item(a) for a in anticipos]
        return AnticipioListResponse(anticipos=items, total=len(items))

    async def get_by_id(self, anticipo_id: UUID) -> AnticipioOut:
        anticipo = await self.repo.get_by_id(anticipo_id)
        if not anticipo:
            raise HTTPException(status_code=404, detail="Anticipo no encontrado.")
        await self._auto_cerrar_si_pagado(anticipo)
        return self._to_out(anticipo)

    async def cerrar(self, anticipo_id: UUID) -> AnticipioOut:
        anticipo = await self.repo.get_by_id(anticipo_id)
        if not anticipo:
            raise HTTPException(status_code=404, detail="Anticipo no encontrado.")
        if anticipo.estado == "cerrado":
            raise HTTPException(status_code=400, detail="El anticipo ya está cerrado.")
        anticipo.estado = "cerrado"
        await self.repo.save(anticipo)
        await self.db.commit()
        return self._to_out(await self.repo.get_by_id(anticipo_id))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _auto_cerrar_si_pagado(self, anticipo: Anticipo) -> None:
        """Cierra el anticipo automáticamente si todos sus paquetes están pagados."""
        if anticipo.estado != "activo" or not anticipo.paquetes:
            return
        todos_pagados = all(p.estado == "pagado" for p in anticipo.paquetes)
        if todos_pagados:
            anticipo.estado = "cerrado"
            await self.repo.save(anticipo)
            await self.db.commit()
            logger.info(f"Anticipo {anticipo.folio} cerrado automáticamente (todos los paquetes pagados).")

    def _monto_legalizado(self, anticipo: Anticipo) -> Decimal:
        total = Decimal("0")
        for p in anticipo.paquetes:
            if p.estado == "pagado":
                total += Decimal(str(p.monto_a_pagar or p.monto_total or 0))
        return total

    def _to_out(self, anticipo: Anticipo) -> AnticipioOut:
        monto_leg = self._monto_legalizado(anticipo)
        return AnticipioOut(
            id=anticipo.id,
            folio=anticipo.folio,
            creado_por=UserBrief.model_validate(anticipo.creado_por),
            asignado_a=UserBrief.model_validate(anticipo.asignado_a),
            monto=Decimal(str(anticipo.monto)),
            descripcion=anticipo.descripcion,
            estado=anticipo.estado,
            paquetes=[PaqueteBrief.model_validate(p) for p in anticipo.paquetes],
            monto_legalizado=monto_leg,
            diferencia=Decimal(str(anticipo.monto)) - monto_leg,
            created_at=anticipo.created_at,
            updated_at=anticipo.updated_at,
        )

    def _to_list_item(self, anticipo: Anticipo) -> AnticipioListItem:
        monto_leg = self._monto_legalizado(anticipo)
        return AnticipioListItem(
            id=anticipo.id,
            folio=anticipo.folio,
            asignado_a=UserBrief.model_validate(anticipo.asignado_a),
            monto=Decimal(str(anticipo.monto)),
            descripcion=anticipo.descripcion,
            estado=anticipo.estado,
            total_paquetes=len(anticipo.paquetes),
            monto_legalizado=monto_leg,
            diferencia=Decimal(str(anticipo.monto)) - monto_leg,
            created_at=anticipo.created_at,
        )
