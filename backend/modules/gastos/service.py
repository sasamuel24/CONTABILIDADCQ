"""Lógica de negocio para el módulo de gastos / legalización."""
import io
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime
from typing import Optional, Tuple, List
from db.models import (
    PaqueteGasto, GastoLegalizacion, ArchivoGasto,
    ComentarioPaquete, HistorialEstadoPaquete
)
from core.s3_service import s3_service
from core.logging import logger
from modules.gastos.repository import (
    PaqueteRepository, GastoRepository, ArchivoGastoRepository,
    ComentarioPaqueteRepository, HistorialRepository
)
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

    # ------------------------------------------------------------------
    # Paquetes
    # ------------------------------------------------------------------

    async def crear_paquete(self, user_id: UUID, area_id: UUID, data: PaqueteCreate) -> PaqueteOut:
        fecha_inicio, fecha_fin = _parse_semana(data.semana)
        paquete = PaqueteGasto(
            user_id=user_id,
            area_id=area_id,
            semana=data.semana,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            estado="borrador",
        )
        await self.paquete_repo.create(paquete)
        await self.historial_repo.create(HistorialEstadoPaquete(
            paquete_id=paquete.id,
            user_id=user_id,
            estado_anterior=None,
            estado_nuevo="borrador",
        ))
        await self.db.commit()
        paquete = await self.paquete_repo.get_by_id(paquete.id)
        return PaqueteOut.model_validate(paquete)

    async def get_paquete(self, paquete_id: UUID, user_id: UUID, user_role: str) -> PaqueteOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_access(paquete, user_id, user_role)
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
        return self._to_out(await self.paquete_repo.get_by_id(paquete_id))

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
            texto="Paquete aprobado.", tipo="aprobacion",
        ))
        await self.historial_repo.create(HistorialEstadoPaquete(
            paquete_id=paquete.id, user_id=user_id,
            estado_anterior="en_revision", estado_nuevo="aprobado",
        ))
        await self.db.commit()
        return self._to_out(await self.paquete_repo.get_by_id(paquete_id))

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

    async def pagar(self, paquete_id: UUID, user_id: UUID) -> PaqueteOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        if paquete.estado != "aprobado":
            raise HTTPException(status_code=400, detail="Solo paquetes aprobados pueden marcarse como pagados.")

        paquete.estado = "pagado"
        paquete.fecha_pago = datetime.utcnow()
        await self.paquete_repo.save(paquete)
        await self.comentario_repo.create(ComentarioPaquete(
            paquete_id=paquete.id, user_id=user_id,
            texto="Pago procesado y legalizado.", tipo="pago",
        ))
        await self.historial_repo.create(HistorialEstadoPaquete(
            paquete_id=paquete.id, user_id=user_id,
            estado_anterior="aprobado", estado_nuevo="pagado",
        ))
        await self.db.commit()
        return self._to_out(await self.paquete_repo.get_by_id(paquete_id))

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
        self, paquete_id: UUID, gasto_id: UUID, user_id: UUID, data: GastoUpdate
    ) -> GastoOut:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_editable(paquete, user_id)
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

        if gasto.archivo:
            s3_service.delete_file(gasto.archivo.s3_key)

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

        if categoria not in CATEGORIAS_VALIDAS:
            raise HTTPException(
                status_code=400,
                detail=f"Categoría inválida. Válidas: {sorted(CATEGORIAS_VALIDAS)}"
            )
        # Inferir content_type desde extensión si el browser no lo envía
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

        # Si ya existe, eliminar registro de BD (S3 puede carecer de permiso DeleteObject)
        if gasto.archivo:
            try:
                s3_service.delete_file(gasto.archivo.s3_key)
            except Exception:
                logger.warning(f"No se pudo eliminar de S3: {gasto.archivo.s3_key}")
            await self.archivo_repo.delete(gasto.archivo)
            await self.db.flush()

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
        self, paquete_id: UUID, gasto_id: UUID, user_id: UUID
    ) -> None:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_editable(paquete, user_id)
        gasto = await self._get_gasto_or_404(gasto_id, paquete_id)

        if not gasto.archivo:
            raise HTTPException(status_code=404, detail="Este gasto no tiene archivo adjunto.")

        try:
            s3_service.delete_file(gasto.archivo.s3_key)
        except Exception:
            logger.warning(f"No se pudo eliminar de S3: {gasto.archivo.s3_key}")
        await self.archivo_repo.delete(gasto.archivo)
        await self.paquete_repo.recalculate_totals(paquete_id)
        await self.db.commit()

    async def get_download_url(
        self, paquete_id: UUID, gasto_id: UUID, user_id: UUID, user_role: str
    ) -> str:
        paquete = await self._get_paquete_or_404(paquete_id)
        self._check_access(paquete, user_id, user_role)
        gasto = await self._get_gasto_or_404(gasto_id, paquete_id)

        if not gasto.archivo:
            raise HTTPException(status_code=404, detail="Este gasto no tiene archivo adjunto.")

        return s3_service.presign_get_url(gasto.archivo.s3_key)

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

    def _check_access(self, paquete: PaqueteGasto, user_id: UUID, user_role: str) -> None:
        roles_admin = {"admin", "contabilidad", "tesoreria", "gerencia"}
        if user_role.lower() not in roles_admin and paquete.user_id != user_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este paquete.")

    def _check_editable(self, paquete: PaqueteGasto, user_id: UUID) -> None:
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
        item = PaqueteListItem.model_validate(paquete)
        item.comentario_devolucion = comentario_devolucion
        return item
