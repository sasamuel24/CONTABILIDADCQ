"""Lógica de negocio para el módulo de anticipos."""
import secrets
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional

from db.models import (
    Anticipo, TokenAprobacionAnticipo, User, AprobadorGerencia
)
from modules.anticipos.repository import AnticipioRepository
from modules.anticipos.schemas import (
    AnticipioCreate, AnticipioDesembolsar, AnticipioRechazar,
    AnticipioOut, AnticipioListItem, AnticipioListResponse,
    UserBrief, AprobadorBrief, PaqueteBrief,
)
from modules.gastos.service import GastosService
from modules.gastos.schemas import PaqueteCreate
from core.email_service import EmailService
from core.logging import logger

email_service = EmailService()


class AnticipioService:

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AnticipioRepository(db)

    # ------------------------------------------------------------------
    # Fase 1: Empleado solicita anticipo
    # ------------------------------------------------------------------

    async def crear(self, user_id: UUID, data: AnticipioCreate) -> AnticipioOut:
        solicitante = await self.db.get(User, user_id)
        if not solicitante or not solicitante.is_active:
            raise HTTPException(status_code=400, detail="Usuario no válido.")
        if not solicitante.area_id:
            raise HTTPException(status_code=400, detail="Debe tener área asignada para solicitar un anticipo.")

        aprobador = await self.db.get(AprobadorGerencia, data.aprobador_id)
        if not aprobador or not aprobador.is_active:
            raise HTTPException(status_code=400, detail="El aprobador seleccionado no es válido.")

        year = datetime.now(tz=timezone.utc).year
        max_num = await self.repo.max_folio_number_by_year(year)
        folio = f"ANT-{year}-{max_num + 1:05d}"

        anticipo = Anticipo(
            folio=folio,
            created_by_user_id=user_id,
            assigned_to_user_id=user_id,
            monto=data.monto,
            descripcion=data.descripcion,
            estado="pendiente",
            aprobador_id=data.aprobador_id,
        )
        await self.repo.create(anticipo)

        token_str = secrets.token_urlsafe(48)
        token_obj = TokenAprobacionAnticipo(
            anticipo_id=anticipo.id,
            token=token_str,
            aprobador_email=aprobador.email,
            aprobador_nombre=aprobador.nombre,
            expires_at=datetime.now(tz=timezone.utc) + timedelta(hours=72),
        )
        await self.repo.create_token(token_obj)

        try:
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al crear anticipo: {e}")
            raise HTTPException(status_code=500, detail="Error al crear la solicitud.")

        anticipo_fresh = await self.repo.get_by_id(anticipo.id)
        await email_service.enviar_solicitud_aprobacion_anticipo(anticipo_fresh, token_str)
        return self._to_out(anticipo_fresh)

    # ------------------------------------------------------------------
    # Fase 2: Aprobador aprueba/rechaza via token
    # ------------------------------------------------------------------

    async def aprobar(self, token_str: str) -> AnticipioOut:
        token = await self.repo.get_token(token_str)
        self._validar_token(token)

        anticipo = await self.repo.get_by_id(token.anticipo_id)
        if not anticipo:
            raise HTTPException(status_code=404, detail="Anticipo no encontrado.")
        if anticipo.estado != "pendiente":
            raise HTTPException(status_code=400, detail=f"El anticipo ya fue procesado (estado: {anticipo.estado}).")

        anticipo.estado = "aprobado"
        anticipo.fecha_aprobacion = datetime.now(tz=timezone.utc)
        anticipo.aprobado_por_nombre = token.aprobador_nombre
        anticipo.aprobado_por_email = token.aprobador_email
        token.usado = True
        token.usado_at = datetime.now(tz=timezone.utc)
        await self.repo.save(anticipo)
        await self.db.commit()

        anticipo_fresh = await self.repo.get_by_id(anticipo.id)
        await email_service.enviar_notificacion_anticipo_aprobado(anticipo_fresh)
        return self._to_out(anticipo_fresh)

    async def rechazar(self, token_str: str, data: AnticipioRechazar) -> AnticipioOut:
        token = await self.repo.get_token(token_str)
        self._validar_token(token)

        anticipo = await self.repo.get_by_id(token.anticipo_id)
        if not anticipo:
            raise HTTPException(status_code=404, detail="Anticipo no encontrado.")
        if anticipo.estado != "pendiente":
            raise HTTPException(status_code=400, detail=f"El anticipo ya fue procesado (estado: {anticipo.estado}).")

        anticipo.estado = "rechazado"
        anticipo.motivo_rechazo = data.motivo
        token.usado = True
        token.usado_at = datetime.now(tz=timezone.utc)
        await self.repo.save(anticipo)
        await self.db.commit()

        anticipo_fresh = await self.repo.get_by_id(anticipo.id)
        await email_service.enviar_notificacion_anticipo_rechazado(anticipo_fresh)
        return self._to_out(anticipo_fresh)

    # ------------------------------------------------------------------
    # Fase 3: Tesorería desembolsa y crea paquete
    # ------------------------------------------------------------------

    async def desembolsar(
        self, anticipo_id: UUID, tesoreria_user_id: UUID, data: AnticipioDesembolsar
    ) -> AnticipioOut:
        anticipo = await self.repo.get_by_id(anticipo_id)
        if not anticipo:
            raise HTTPException(status_code=404, detail="Anticipo no encontrado.")
        if anticipo.estado != "aprobado":
            raise HTTPException(
                status_code=400,
                detail=f"Solo anticipos aprobados pueden desembolsarse. Estado actual: {anticipo.estado}"
            )

        solicitante = await self.db.get(User, anticipo.created_by_user_id)
        if not solicitante or not solicitante.area_id:
            raise HTTPException(status_code=400, detail="El solicitante no tiene área asignada.")

        anticipo.estado = "desembolsado"
        anticipo.fecha_desembolso = datetime.now(tz=timezone.utc)
        anticipo.desembolsado_por_user_id = tesoreria_user_id
        await self.repo.save(anticipo)

        gastos_svc = GastosService(self.db)
        area_code = solicitante.area.code.lower() if solicitante.area else ""
        paquete_data = PaqueteCreate(semana=data.semana)
        await gastos_svc._crear_paquete_para_anticipo(
            user_id=anticipo.created_by_user_id,
            area_id=solicitante.area_id,
            data=paquete_data,
            area_code=area_code,
            anticipo_id=anticipo.id,
        )

        try:
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al desembolsar anticipo: {e}")
            raise HTTPException(status_code=500, detail="Error al desembolsar el anticipo.")

        anticipo_fresh = await self.repo.get_by_id(anticipo.id)
        await email_service.enviar_notificacion_anticipo_desembolsado(anticipo_fresh)
        return self._to_out(anticipo_fresh)

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------

    async def listar_tesoreria(
        self, skip: int, limit: int, estado: Optional[str] = None
    ) -> AnticipioListResponse:
        """Tesorería ve anticipos aprobados, desembolsados y cerrados."""
        anticipos, total = await self.repo.list_tesoreria(skip, limit, estado)
        for a in anticipos:
            await self._auto_cerrar_si_pagado(a)
        return AnticipioListResponse(
            anticipos=[self._to_list_item(a) for a in anticipos],
            total=total,
        )

    async def listar_mis(
        self, user_id: UUID, estado: Optional[str] = None
    ) -> AnticipioListResponse:
        """Empleado ve sus propias solicitudes de anticipo (todos los estados)."""
        anticipos = await self.repo.list_by_user(user_id, estado)
        for a in anticipos:
            await self._auto_cerrar_si_pagado(a)
        return AnticipioListResponse(
            anticipos=[self._to_list_item(a) for a in anticipos],
            total=len(anticipos),
        )

    async def get_by_id(self, anticipo_id: UUID, user_id: UUID, is_tesoreria: bool) -> AnticipioOut:
        anticipo = await self.repo.get_by_id(anticipo_id)
        if not anticipo:
            raise HTTPException(status_code=404, detail="Anticipo no encontrado.")
        if not is_tesoreria and anticipo.created_by_user_id != user_id:
            raise HTTPException(status_code=403, detail="No tiene permiso para ver este anticipo.")
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

    def _validar_token(self, token: Optional[TokenAprobacionAnticipo]) -> None:
        if not token:
            raise HTTPException(status_code=404, detail="Token no encontrado.")
        if token.usado:
            raise HTTPException(status_code=400, detail="Este enlace ya fue utilizado.")
        if datetime.now(tz=timezone.utc) > token.expires_at:
            raise HTTPException(status_code=400, detail="El enlace ha expirado.")

    async def _auto_cerrar_si_pagado(self, anticipo: Anticipo) -> None:
        if anticipo.estado != "desembolsado" or not anticipo.paquetes:
            return
        todos_pagados = all(p.estado == "pagado" for p in anticipo.paquetes)
        if todos_pagados:
            anticipo.estado = "cerrado"
            await self.repo.save(anticipo)
            await self.db.commit()
            logger.info(f"Anticipo {anticipo.folio} cerrado automáticamente.")

    def _monto_legalizado(self, anticipo: Anticipo) -> Decimal:
        """Suma el monto de gastos registrados en todos los paquetes del anticipo.

        - Pagado: usa monto_a_pagar (definitivo).
        - En proceso (borrador, en_tesoreria, devuelto): usa monto_total (en curso).
        - Rechazado: no cuenta.
        """
        total = Decimal("0")
        for p in anticipo.paquetes:
            if p.estado == "rechazado":
                continue
            if p.estado == "pagado":
                total += Decimal(str(p.monto_a_pagar or p.monto_total or 0))
            else:
                total += Decimal(str(p.monto_total or 0))
        return total

    def _to_out(self, anticipo: Anticipo) -> AnticipioOut:
        monto_leg = self._monto_legalizado(anticipo)
        return AnticipioOut(
            id=anticipo.id,
            folio=anticipo.folio,
            solicitante=UserBrief.model_validate(anticipo.creado_por),
            monto=Decimal(str(anticipo.monto)),
            descripcion=anticipo.descripcion,
            estado=anticipo.estado,
            aprobador=AprobadorBrief.model_validate(anticipo.aprobador) if anticipo.aprobador else None,
            fecha_aprobacion=anticipo.fecha_aprobacion,
            aprobado_por_nombre=anticipo.aprobado_por_nombre,
            motivo_rechazo=anticipo.motivo_rechazo,
            fecha_desembolso=anticipo.fecha_desembolso,
            desembolsado_por=UserBrief.model_validate(anticipo.desembolsado_por) if anticipo.desembolsado_por else None,
            paquetes=[PaqueteBrief.model_validate(p) for p in anticipo.paquetes],
            monto_legalizado=monto_leg,
            diferencia=Decimal(str(anticipo.monto)) - monto_leg,
            created_at=anticipo.created_at,
            updated_at=anticipo.updated_at,
        )

    def _to_list_item(self, anticipo: Anticipo) -> AnticipioListItem:
        monto_leg = self._monto_legalizado(anticipo)
        # Estado del paquete más relevante (prioridad: en_tesoreria > devuelto > borrador > pagado)
        paquete_estado: Optional[str] = None
        if anticipo.paquetes:
            PRIORIDAD = {"en_tesoreria": 0, "devuelto": 1, "borrador": 2, "aprobado": 3, "pagado": 4}
            paquete_estado = sorted(
                anticipo.paquetes,
                key=lambda p: PRIORIDAD.get(p.estado, 99)
            )[0].estado
        return AnticipioListItem(
            id=anticipo.id,
            folio=anticipo.folio,
            solicitante=UserBrief.model_validate(anticipo.creado_por),
            monto=Decimal(str(anticipo.monto)),
            descripcion=anticipo.descripcion,
            estado=anticipo.estado,
            paquete_estado=paquete_estado,
            aprobador=AprobadorBrief.model_validate(anticipo.aprobador) if anticipo.aprobador else None,
            total_paquetes=len(anticipo.paquetes),
            monto_legalizado=monto_leg,
            diferencia=Decimal(str(anticipo.monto)) - monto_leg,
            created_at=anticipo.created_at,
        )
