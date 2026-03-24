"""Lógica de negocio para el módulo de gastos / legalización."""
import io
import secrets
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, List
from db.models import (
    PaqueteGasto, GastoLegalizacion, ArchivoGasto,
    ComentarioPaquete, HistorialEstadoPaquete, TokenAprobacionPaquete
)
from core.s3_service import s3_service
from core.logging import logger
from core.config import settings
from core.email_service import email_service
from modules.gastos.repository import (
    PaqueteRepository, GastoRepository, ArchivoGastoRepository,
    ComentarioPaqueteRepository, HistorialRepository
)
from modules.gastos.token_repository import TokenAprobacionRepository
from modules.gastos.schemas import (
    PaqueteCreate, GastoCreate, GastoUpdate, PaqueteDevolver,
    PaqueteOut, PaqueteListItem, GastoOut, ArchivoGastoOut, ComentarioPaqueteOut
)

CATEGORIAS_VALIDAS = {
    'Combustible', 'Hospedaje', 'Alimentacion',
    'Viaticos / Casetas', 'Materiales', 'Otro'
}
TIPOS_ARCHIVO = {'application/pdf', 'image/jpeg', 'image/png', 'image/jpg'}
ESTADOS_EDITABLE = {'borrador', 'devuelto'}


def _parse_semana(semana: str):
    """Convierte '2026-W09' en fecha_inicio (lunes) y fecha_fin (domingo)."""
    try:
        year_str, w_str = semana.split('-W')
        year, week_num = int(year_str), int(w_str)
        # datetime.fromisocalendar disponible desde Python 3.8
        lunes = datetime.fromisocalendar(year, week_num, 1).date()
        domingo = datetime.fromisocalendar(year, week_num, 7).date()
        return lunes, domingo
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Formato de semana inválido: '{semana}'. Use YYYY-Www (ej: 2026-W09)"
        )


def _s3_key(paquete_id: UUID, gasto_id: UUID, filename: str) -> str:
    return f"dev/facturas/gastos/{paquete_id}/{gasto_id}/{filename}"


class GastosService:

    def __init__(self, db: AsyncSession):
        self.db = db
        self.paquete_repo = PaqueteRepository(db)
        self.gasto_repo = GastoRepository(db)
        self.archivo_repo = ArchivoGastoRepository(db)
        self.comentario_repo = ComentarioPaqueteRepository(db)
        self.historial_repo = HistorialRepository(db)
        self.token_repo = TokenAprobacionRepository(db)

    # ------------------------------------------------------------------
    # Paquetes
    # ------------------------------------------------------------------

    async def crear_paquete(self, user_id: UUID, area_id: UUID, data: PaqueteCreate) -> PaqueteOut:
        fecha_inicio, fecha_fin = _parse_semana(data.semana)

        # Generar folio automático: PKG-{AÑO}-{N:05d}
        year_str, _ = data.semana.split('-W')
        year = int(year_str)
        count = await self.paquete_repo.count_paquetes_by_year(year)
        folio = f"PKG-{year}-{count + 1:05d}"

        paquete = PaqueteGasto(
            user_id=user_id,
            area_id=area_id,
            semana=data.semana,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            estado="borrador",
            folio=folio,
        )
        try:
            await self.paquete_repo.create(paquete)
            await self.historial_repo.create(HistorialEstadoPaquete(
                paquete_id=paquete.id,
                user_id=user_id,
                estado_anterior=None,
                estado_nuevo="borrador",
            ))
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al crear paquete: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el paquete de gastos.",
            )
        paquete = await self.paquete_repo.get_by_id(paquete.id)
        await email_service.enviar_confirmacion_creacion_paquete(paquete, paquete.tecnico.email)
        return PaqueteOut.model_validate(paquete)

    async def get_paquete(self, paquete_id: UUID, user_id: UUID, user_role: str, user_area: str = "") -> PaqueteOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_access(paquete, user_id, user_role, user_area)
        return self._to_out(paquete)

    async def list_paquetes_tecnico(
        self, user_id: UUID, skip: int, limit: int
    ) -> Tuple[List[PaqueteListItem], int]:
        paquetes, total = await self.paquete_repo.list_by_user(user_id, skip, limit)
        return [self._to_list_item(p) for p in paquetes], total

    async def list_paquetes_admin(
        self, skip: int, limit: int, estado: Optional[str]
    ) -> Tuple[List[PaqueteListItem], int]:
        paquetes, total = await self.paquete_repo.list_all(skip, limit, estado)
        return [self._to_list_item(p) for p in paquetes], total

    # Workflow ---------------------------------------------------------------

    async def enviar(self, paquete_id: UUID, user_id: UUID) -> PaqueteOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        if paquete.estado not in ESTADOS_EDITABLE:
            raise HTTPException(status_code=400, detail="Solo paquetes en borrador o devuelto pueden enviarse.")
        if paquete.user_id != user_id:
            raise HTTPException(status_code=403, detail="Solo el técnico propietario puede enviar el paquete.")
        if not paquete.gastos:
            raise HTTPException(status_code=400, detail="El paquete debe tener al menos un gasto antes de enviarse.")

        anterior = paquete.estado
        paquete.estado = "en_revision"
        paquete.fecha_envio = datetime.utcnow()
        await self.paquete_repo.save(paquete)
        await self.historial_repo.create(HistorialEstadoPaquete(
            paquete_id=paquete.id, user_id=user_id,
            estado_anterior=anterior, estado_nuevo="en_revision",
        ))

        await self.db.commit()

        # Notificar al responsable para que revise — él decidirá cuándo enviar el link al gerente
        paquete_actualizado = await self.paquete_repo.get_by_id(paquete_id)
        await email_service.enviar_notificacion_nuevo_paquete_responsable(
            paquete_actualizado, settings.email_responsable
        )

        return self._to_out(paquete_actualizado)

    async def reenviar_correo_aprobacion(self, paquete_id: UUID, user_id: UUID) -> dict:
        """Genera un nuevo token y reenvía el correo de solicitud de aprobación."""
        paquete = await self._get_paquete_or_404(paquete_id)
        if paquete.estado != "en_revision":
            raise HTTPException(status_code=400, detail="Solo se puede reenviar el correo cuando el paquete está en revisión.")

        token_str = secrets.token_urlsafe(48)
        expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=72)
        token_obj = TokenAprobacionPaquete(
            paquete_id=paquete.id,
            token=token_str,
            usado=False,
            expires_at=expires_at,
        )
        await self.token_repo.create(token_obj)
        await self.db.commit()

        paquete_actualizado = await self.paquete_repo.get_by_id(paquete_id)
        await email_service.enviar_solicitud_aprobacion(paquete_actualizado, token_str)
        logger.info(f"Correo de aprobación reenviado para paquete {paquete_id} por usuario {user_id}")
        return {"message": "Correo de aprobación reenviado correctamente."}

    async def aprobar(self, paquete_id: UUID, user_id: UUID) -> PaqueteOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        if paquete.estado != "en_revision":
            raise HTTPException(status_code=400, detail="Solo paquetes en revisión pueden aprobarse.")

        paquete.estado = "aprobado"
        paquete.fecha_aprobacion = datetime.utcnow()
        paquete.revisado_por_user_id = user_id
        await self.paquete_repo.save(paquete)
        await self.comentario_repo.create(ComentarioPaquete(
            paquete_id=paquete.id, user_id=user_id,
            texto="Paquete aprobado. Pendiente de envío a Tesorería por Facturación.", tipo="aprobacion",
        ))
        await self.historial_repo.create(HistorialEstadoPaquete(
            paquete_id=paquete.id, user_id=user_id,
            estado_anterior="en_revision", estado_nuevo="aprobado",
        ))
        await self.db.commit()
        paquete_aprobado = await self.paquete_repo.get_by_id(paquete_id)
        await email_service.enviar_notificacion_aprobado(paquete_aprobado, settings.email_approver)
        await email_service.enviar_notificacion_paquete_aprobado_tecnico(paquete_aprobado, paquete_aprobado.tecnico.email)
        return self._to_out(paquete_aprobado)

    async def devolver(self, paquete_id: UUID, user_id: UUID, data: PaqueteDevolver) -> PaqueteOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        if paquete.estado != "en_revision":
            raise HTTPException(status_code=400, detail="Solo paquetes en revisión pueden devolverse.")

        paquete.estado = "devuelto"
        paquete.revisado_por_user_id = user_id
        await self.paquete_repo.save(paquete)
        await self.comentario_repo.create(ComentarioPaquete(
            paquete_id=paquete.id, user_id=user_id,
            texto=data.motivo, tipo="devolucion",
        ))
        await self.historial_repo.create(HistorialEstadoPaquete(
            paquete_id=paquete.id, user_id=user_id,
            estado_anterior="en_revision", estado_nuevo="devuelto",
        ))
        await self.db.commit()
        return self._to_out(await self.paquete_repo.get_by_id(paquete_id))

    async def enviar_tesoreria(self, paquete_id: UUID, user_id: UUID) -> PaqueteOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        if paquete.estado != "aprobado":
            raise HTTPException(status_code=400, detail="Solo paquetes aprobados pueden enviarse a tesorería.")

        # Calcular monto a pagar excluyendo gastos devueltos
        monto_a_pagar = sum(
            float(g.valor_pagado) for g in paquete.gastos
            if getattr(g, "estado_gasto", None) != "devuelto"
        )
        devueltos = [g for g in paquete.gastos if getattr(g, "estado_gasto", None) == "devuelto"]
        monto_devuelto = float(paquete.monto_total) - monto_a_pagar

        paquete.estado = "en_tesoreria"
        paquete.monto_a_pagar = monto_a_pagar
        await self.paquete_repo.save(paquete)

        texto_comentario = "Paquete enviado a Tesorería para procesamiento de pago."
        if devueltos:
            nombres = ", ".join(f"{g.pagado_a} (${float(g.valor_pagado):,.0f})" for g in devueltos)
            texto_comentario += (
                f" Monto a pagar: ${monto_a_pagar:,.2f} COP"
                f" (se descontaron ${monto_devuelto:,.2f} COP de gastos devueltos: {nombres})."
            )
        await self.comentario_repo.create(ComentarioPaquete(
            paquete_id=paquete.id, user_id=user_id,
            texto=texto_comentario, tipo="envio_tesoreria",
        ))
        await self.historial_repo.create(HistorialEstadoPaquete(
            paquete_id=paquete.id, user_id=user_id,
            estado_anterior="aprobado", estado_nuevo="en_tesoreria",
        ))
        await self.db.commit()
        return self._to_out(await self.paquete_repo.get_by_id(paquete_id))

    async def pagar(self, paquete_id: UUID, user_id: UUID) -> PaqueteOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        if paquete.estado != "en_tesoreria":
            raise HTTPException(status_code=400, detail="Solo paquetes enviados a tesorería pueden marcarse como pagados.")

        paquete.estado = "pagado"
        paquete.fecha_pago = datetime.utcnow()
        await self.paquete_repo.save(paquete)
        await self.comentario_repo.create(ComentarioPaquete(
            paquete_id=paquete.id, user_id=user_id,
            texto="Pago procesado y legalizado.", tipo="pago",
        ))
        await self.historial_repo.create(HistorialEstadoPaquete(
            paquete_id=paquete.id, user_id=user_id,
            estado_anterior="en_tesoreria", estado_nuevo="pagado",
        ))
        await self.db.commit()
        paquete_pagado = await self.paquete_repo.get_by_id(paquete_id)
        await email_service.enviar_notificacion_pago_tecnico(paquete_pagado, paquete_pagado.tecnico.email)
        return self._to_out(paquete_pagado)

    # ------------------------------------------------------------------
    # Gastos
    # ------------------------------------------------------------------

    async def agregar_gasto(
        self, paquete_id: UUID, user_id: UUID, data: GastoCreate
    ) -> GastoOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_editable(paquete, user_id)

        gasto = GastoLegalizacion(
            paquete_id=paquete_id,
            fecha=data.fecha,
            no_identificacion=data.no_identificacion,
            pagado_a=data.pagado_a,
            concepto=data.concepto,
            no_recibo=data.no_recibo,
            centro_costo_id=data.centro_costo_id,
            centro_operacion_id=data.centro_operacion_id,
            cuenta_auxiliar_id=data.cuenta_auxiliar_id,
            valor_pagado=data.valor_pagado,
            orden=data.orden,
        )
        await self.gasto_repo.create(gasto)
        await self.paquete_repo.recalculate_totals(paquete_id)
        await self.db.commit()
        gasto = await self.gasto_repo.get_by_id(gasto.id)
        return GastoOut.model_validate(gasto)

    async def editar_gasto(
        self, paquete_id: UUID, gasto_id: UUID, user_id: UUID, data: GastoUpdate,
        user_role: str = ""
    ) -> GastoOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_editable(paquete, user_id, user_role=user_role)
        gasto = await self._get_gasto_or_404(gasto_id, paquete_id)

        for field, value in data.model_dump(exclude_none=True).items():
            setattr(gasto, field, value)
        gasto.updated_at = datetime.utcnow()

        await self.gasto_repo.save(gasto)
        await self.paquete_repo.recalculate_totals(paquete_id)
        await self.db.commit()
        return GastoOut.model_validate(await self.gasto_repo.get_by_id(gasto_id))

    async def eliminar_gasto(self, paquete_id: UUID, gasto_id: UUID, user_id: UUID) -> None:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_editable(paquete, user_id)
        gasto = await self._get_gasto_or_404(gasto_id, paquete_id)

        for archivo in gasto.archivos:
            try:
                s3_service.delete_file(archivo.s3_key)
            except Exception:
                logger.warning(f"No se pudo eliminar de S3: {archivo.s3_key}")

        await self.gasto_repo.delete(gasto)
        await self.paquete_repo.recalculate_totals(paquete_id)
        await self.db.commit()

    # ------------------------------------------------------------------
    # Archivos soporte
    # ------------------------------------------------------------------

    async def subir_archivo(
        self,
        paquete_id: UUID,
        gasto_id: UUID,
        user_id: UUID,
        categoria: str,
        file: UploadFile,
    ) -> ArchivoGastoOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_editable(paquete, user_id)
        gasto = await self._get_gasto_or_404(gasto_id, paquete_id)

        if len(gasto.archivos) >= 2:
            raise HTTPException(
                status_code=400,
                detail="Máximo 2 archivos por gasto."
            )

        if categoria not in CATEGORIAS_VALIDAS:
            raise HTTPException(
                status_code=400,
                detail=f"Categoría inválida. Válidas: {sorted(CATEGORIAS_VALIDAS)}"
            )
        content_type = file.content_type or ""
        nombre_lower = (file.filename or "").lower()
        if not content_type or content_type == "application/octet-stream":
            if nombre_lower.endswith(".pdf"):
                content_type = "application/pdf"
            elif nombre_lower.endswith((".jpg", ".jpeg")):
                content_type = "image/jpeg"
            elif nombre_lower.endswith(".png"):
                content_type = "image/png"
        if content_type not in TIPOS_ARCHIVO:
            raise HTTPException(
                status_code=400,
                detail="Solo se aceptan archivos PDF o imágenes (JPEG/PNG)."
            )

        s3_key = _s3_key(paquete_id, gasto_id, file.filename)
        file_content = await file.read()

        upload_result = s3_service.upload_fileobj(
            io.BytesIO(file_content), s3_key, content_type
        )

        archivo = ArchivoGasto(
            paquete_id=paquete_id,
            gasto_id=gasto_id,
            filename=file.filename,
            s3_key=s3_key,
            categoria=categoria,
            content_type=content_type,
            size_bytes=upload_result["size_bytes"],
            uploaded_by_user_id=user_id,
        )
        await self.archivo_repo.create(archivo)
        await self.paquete_repo.recalculate_totals(paquete_id)
        await self.db.commit()

        download_url = s3_service.presign_get_url(s3_key)
        out = ArchivoGastoOut.model_validate(archivo)
        out.download_url = download_url
        return out

    async def eliminar_archivo(
        self, paquete_id: UUID, gasto_id: UUID, archivo_id: UUID, user_id: UUID
    ) -> None:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_editable(paquete, user_id)
        gasto = await self._get_gasto_or_404(gasto_id, paquete_id)

        archivo = next((a for a in gasto.archivos if a.id == archivo_id), None)
        if not archivo:
            raise HTTPException(status_code=404, detail="Archivo no encontrado en este gasto.")

        try:
            s3_service.delete_file(archivo.s3_key)
        except Exception:
            logger.warning(f"No se pudo eliminar de S3: {archivo.s3_key}")
        await self.archivo_repo.delete(archivo)
        await self.paquete_repo.recalculate_totals(paquete_id)
        await self.db.commit()

    async def get_download_url(
        self, paquete_id: UUID, gasto_id: UUID, archivo_id: UUID, user_id: UUID, user_role: str
    ) -> str:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_access(paquete, user_id, user_role)
        gasto = await self._get_gasto_or_404(gasto_id, paquete_id)

        archivo = next((a for a in gasto.archivos if a.id == archivo_id), None)
        if not archivo:
            raise HTTPException(status_code=404, detail="Archivo no encontrado en este gasto.")

        return s3_service.presign_get_url(archivo.s3_key)

    async def subir_aprobacion_gerencia(
        self, paquete_id: UUID, user_id: UUID, user_role: str, file: UploadFile
    ) -> PaqueteOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_access(paquete, user_id, user_role)
        if paquete.estado not in {"en_revision", "borrador", "devuelto"}:
            raise HTTPException(
                status_code=400,
                detail="Solo se puede subir la aprobación cuando el paquete está en revisión."
            )

        content_type = file.content_type or ""
        nombre_lower = (file.filename or "").lower()
        if not content_type or content_type == "application/octet-stream":
            if nombre_lower.endswith(".pdf"):
                content_type = "application/pdf"
            elif nombre_lower.endswith((".jpg", ".jpeg")):
                content_type = "image/jpeg"
            elif nombre_lower.endswith(".png"):
                content_type = "image/png"
        if content_type not in TIPOS_ARCHIVO:
            raise HTTPException(status_code=400, detail="Solo se aceptan archivos PDF o imágenes (JPEG/PNG).")

        s3_key = f"dev/facturas/gastos/{paquete_id}/aprobacion_gerencia/{file.filename}"
        if paquete.aprobacion_gerencia_s3_key:
            try:
                s3_service.delete_file(paquete.aprobacion_gerencia_s3_key)
            except Exception:
                logger.warning(f"No se pudo eliminar de S3: {paquete.aprobacion_gerencia_s3_key}")

        file_content = await file.read()
        s3_service.upload_fileobj(io.BytesIO(file_content), s3_key, content_type)

        paquete.aprobacion_gerencia_s3_key = s3_key
        paquete.aprobacion_gerencia_filename = file.filename
        await self.paquete_repo.save(paquete)
        await self.db.commit()
        return self._to_out(await self.paquete_repo.get_by_id(paquete_id))

    async def get_aprobacion_gerencia_download_url(
        self, paquete_id: UUID, user_id: UUID, user_role: str
    ) -> str:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_access(paquete, user_id, user_role)
        if not paquete.aprobacion_gerencia_s3_key:
            raise HTTPException(status_code=404, detail="Este paquete no tiene aprobación de gerencia adjunta.")
        return s3_service.presign_get_url(paquete.aprobacion_gerencia_s3_key)

    # ------------------------------------------------------------------
    # Aprobación por token (Fase 2)
    # ------------------------------------------------------------------

    async def aprobar_por_token(self, token_str: str, ip: str) -> PaqueteOut:
        """Aprueba un paquete usando el token de aprobación enviado por email."""
        try:
            token_obj = await self.token_repo.get_by_token(token_str)
            if not token_obj:
                raise HTTPException(status_code=404, detail="Token de aprobación no válido.")

            if token_obj.usado:
                raise HTTPException(status_code=400, detail="Este token ya fue utilizado.")

            now_utc = datetime.now(tz=timezone.utc)
            # expires_at puede ser naive o aware; normalizamos
            expires_at = token_obj.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now_utc > expires_at:
                raise HTTPException(status_code=400, detail="El token de aprobación ha expirado.")

            # Marcar token como usado
            token_obj.usado = True
            token_obj.usado_at = now_utc
            token_obj.usado_por_ip = ip
            await self.db.flush()

            # Cambiar paquete a aprobado
            paquete = await self._get_paquete_or_404(token_obj.paquete_id)
            if paquete.estado != "en_revision":
                raise HTTPException(
                    status_code=400,
                    detail=f"El paquete está en estado '{paquete.estado}' y no puede aprobarse por este medio."
                )

            paquete.estado = "aprobado"
            paquete.fecha_aprobacion = now_utc
            await self.paquete_repo.save(paquete)
            await self.comentario_repo.create(ComentarioPaquete(
                paquete_id=paquete.id,
                user_id=None,
                texto="Paquete aprobado vía enlace de email. Pendiente de envío a Tesorería por Facturación.",
                tipo="aprobacion",
            ))
            await self.historial_repo.create(HistorialEstadoPaquete(
                paquete_id=paquete.id,
                user_id=None,
                estado_anterior="en_revision",
                estado_nuevo="aprobado",
            ))
            await self.db.commit()

            # Notificar a Facturación y al técnico
            paquete_final = await self.paquete_repo.get_by_id(paquete.id)
            await email_service.enviar_notificacion_aprobado(paquete_final, settings.email_approver)
            await email_service.enviar_notificacion_paquete_aprobado_tecnico(paquete_final, paquete_final.tecnico.email)

            return self._to_out(paquete_final)
        except HTTPException:
            raise
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al aprobar paquete por token: {e}")
            raise HTTPException(status_code=500, detail="Error interno al procesar la aprobación.")

    # ------------------------------------------------------------------
    # Devolución individual de gasto (Fase 3)
    # ------------------------------------------------------------------

    async def devolver_gasto_individual(
        self, paquete_id: UUID, gasto_id: UUID, user_id: UUID, motivo: str
    ) -> GastoOut:
        """Facturación/Admin devuelve un gasto individual con un motivo."""
        try:
            paquete = await self._get_paquete_or_404(paquete_id)
            gasto = await self._get_gasto_or_404(gasto_id, paquete_id)

            if gasto.estado_gasto == "devuelto":
                raise HTTPException(status_code=400, detail="Este gasto ya fue devuelto.")

            gasto.estado_gasto = "devuelto"
            gasto.motivo_devolucion_gasto = motivo
            gasto.devuelto_por_user_id = user_id
            gasto.fecha_devolucion_gasto = datetime.now(tz=timezone.utc)
            await self.gasto_repo.save(gasto)

            # Crear comentario de devolución en el paquete
            await self.comentario_repo.create(ComentarioPaquete(
                paquete_id=paquete_id,
                user_id=user_id,
                texto=f"Gasto devuelto ({gasto.pagado_a} - ${float(gasto.valor_pagado):,.2f}): {motivo}",
                tipo="devolucion_gasto",
            ))
            await self.db.commit()

            gasto = await self.gasto_repo.get_by_id(gasto_id)
            return GastoOut.model_validate(gasto)
        except HTTPException:
            raise
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al devolver gasto individual: {e}")
            raise HTTPException(status_code=500, detail="Error interno al devolver el gasto.")

    async def reenviar_gasto_individual(
        self, paquete_id: UUID, gasto_id: UUID, user_id: UUID
    ) -> GastoOut:
        """El técnico propietario reenvía un gasto que fue devuelto."""
        try:
            paquete = await self._get_paquete_or_404(paquete_id)

            if paquete.user_id != user_id:
                raise HTTPException(
                    status_code=403,
                    detail="Solo el técnico propietario puede reenviar un gasto devuelto."
                )

            gasto = await self._get_gasto_or_404(gasto_id, paquete_id)

            if gasto.estado_gasto != "devuelto":
                raise HTTPException(
                    status_code=400,
                    detail=f"El gasto no está devuelto (estado actual: '{gasto.estado_gasto}')."
                )

            gasto.estado_gasto = "pendiente"
            gasto.motivo_devolucion_gasto = None
            gasto.devuelto_por_user_id = None
            gasto.fecha_devolucion_gasto = None
            await self.gasto_repo.save(gasto)

            # Verificar si quedan otros gastos devueltos en el paquete
            gastos_aun_devueltos = [
                g for g in paquete.gastos
                if g.id != gasto_id and getattr(g, "estado_gasto", None) == "devuelto"
            ]
            if not gastos_aun_devueltos:
                # Todos los gastos devueltos han sido corregidos — notificar a Facturación
                await self.comentario_repo.create(ComentarioPaquete(
                    paquete_id=paquete.id,
                    user_id=user_id,
                    texto=(
                        "Todos los gastos devueltos han sido corregidos por el técnico. "
                        "El paquete está listo para ser enviado a Tesorería."
                    ),
                    tipo="aprobacion",
                ))

            await self.db.commit()

            gasto = await self.gasto_repo.get_by_id(gasto_id)
            return GastoOut.model_validate(gasto)
        except HTTPException:
            raise
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al reenviar gasto individual: {e}")
            raise HTTPException(status_code=500, detail="Error interno al reenviar el gasto.")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_paquete_or_404(self, paquete_id: UUID) -> PaqueteGasto:
        paquete = await self.paquete_repo.get_by_id(paquete_id)
        if not paquete:
            raise HTTPException(status_code=404, detail=f"Paquete {paquete_id} no encontrado.")
        return paquete

    async def _get_gasto_or_404(self, gasto_id: UUID, paquete_id: UUID) -> GastoLegalizacion:
        gasto = await self.gasto_repo.get_by_id(gasto_id)
        if not gasto or gasto.paquete_id != paquete_id:
            raise HTTPException(status_code=404, detail=f"Gasto {gasto_id} no encontrado en este paquete.")
        return gasto

    def _check_access(self, paquete: PaqueteGasto, user_id: UUID, user_role: str, user_area: str = "") -> None:
        roles_admin = {"admin", "fact", "contabilidad", "tesoreria", "tes", "gerencia", "responsable"}
        if user_role.lower() not in roles_admin and user_area.lower() not in roles_admin and paquete.user_id != user_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este paquete.")

    def _check_editable(self, paquete: PaqueteGasto, user_id: UUID, user_role: str = "") -> None:
        # Responsable puede editar asignaciones (CC/CO/CA) en paquetes en_revision
        roles_supervisor = {"responsable", "admin", "contabilidad"}
        if user_role.lower() in roles_supervisor:
            if paquete.estado in ESTADOS_EDITABLE or paquete.estado == "en_revision":
                return
            raise HTTPException(
                status_code=400,
                detail=f"El paquete está en estado '{paquete.estado}' y no puede modificarse."
            )
        if paquete.estado not in ESTADOS_EDITABLE:
            raise HTTPException(
                status_code=400,
                detail=f"El paquete está en estado '{paquete.estado}' y no puede modificarse."
            )
        if paquete.user_id != user_id:
            raise HTTPException(status_code=403, detail="Solo el técnico propietario puede modificar este paquete.")

    def _to_out(self, paquete: PaqueteGasto) -> PaqueteOut:
        return PaqueteOut.model_validate(paquete)

    def _to_list_item(self, paquete: PaqueteGasto) -> PaqueteListItem:
        comentario_devolucion = None
        for c in sorted(paquete.comentarios, key=lambda x: x.created_at, reverse=True):
            if c.tipo == "devolucion":
                comentario_devolucion = c.texto
                break
        tiene_gastos_devueltos = any(
            getattr(g, "estado_gasto", None) == "devuelto" for g in paquete.gastos
        )
        item = PaqueteListItem.model_validate(paquete)
        item.comentario_devolucion = comentario_devolucion
        item.tiene_gastos_devueltos = tiene_gastos_devueltos
        return item
