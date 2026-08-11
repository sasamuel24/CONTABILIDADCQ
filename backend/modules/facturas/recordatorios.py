"""
Recordatorios de aprobaciones de facturas pendientes por correo.

Los correos de aprobación (Gerencia y dual OPS/CALIDAD) llevan un token que vence
a las 72 horas. Si el gerente no responde a tiempo, la aprobación se pierde y hay
que reenviar la solicitud a mano. Este módulo busca los enlaces VIGENTES cuya
factura sigue pendiente y le envía a cada aprobador UN SOLO correo consolidado
con todas sus facturas y los mismos botones de aprobar/rechazar.

Reglas para recordar un token:
- No usado y no vencido (sigue siendo el enlace válido del correo original).
- Es el token MÁS RECIENTE de su (factura, tipo): un reenvío genera token nuevo
  y el anterior no debe producir recordatorios duplicados.
- La factura sigue esperando ESA aprobación (según tipo None/OPS/CALIDAD).
- El token tiene al menos EDAD_MINIMA_HORAS (no recordar recién enviado).
- No se le recordó en las últimas INTERVALO_MINIMO_HORAS.

Con el ciclo diario a las 7:00 a.m. Colombia esto produce como máximo 2
recordatorios por enlace dentro de sus 72 horas de vida.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import logger
from core.config import settings
from core.email_service import email_service
from db.models import Factura, TokenAprobacionFactura

# Colombia no tiene horario de verano: offset fijo UTC-5
TZ_BOGOTA = timezone(timedelta(hours=-5))
HORA_ENVIO_LOCAL = 7  # 7:00 a.m. hora Colombia

EDAD_MINIMA_HORAS = 12       # no recordar tokens con menos de 12h de emitidos
INTERVALO_MINIMO_HORAS = 20  # no repetir recordatorio antes de 20h

TIPO_LABEL = {
    "OPS": "Aprobación Gerencia Operaciones",
    "CALIDAD": "Aprobación Calidad Café",
}


def _factura_sigue_pendiente(factura: Factura, tipo: str | None) -> bool:
    """La factura aún espera la aprobación que cubre este token."""
    if tipo == "OPS":
        return bool(factura.fecha_envio_aprobacion_ops) and not factura.fecha_aprobacion_ops
    if tipo == "CALIDAD":
        return bool(factura.fecha_envio_aprobacion_calidad) and not factura.fecha_aprobacion_calidad
    return bool(factura.fecha_envio_gerencia) and not factura.fecha_aprobacion_email


async def enviar_recordatorios_aprobacion(db: AsyncSession) -> dict:
    """Envía los recordatorios consolidados. Devuelve un resumen de lo enviado."""
    ahora = datetime.now(tz=timezone.utc)

    # Todos los tokens vigentes (no usados, no vencidos) con su factura
    result = await db.execute(
        select(TokenAprobacionFactura, Factura)
        .join(Factura, Factura.id == TokenAprobacionFactura.factura_id)
        .where(
            TokenAprobacionFactura.usado == False,  # noqa: E712
            TokenAprobacionFactura.expires_at > ahora,
        )
        .order_by(TokenAprobacionFactura.created_at.desc())
    )
    filas = result.all()

    # Solo el token más reciente por (factura, tipo): los reenvíos generan token
    # nuevo y el viejo sigue "vigente" pero ya no es el que se debe recordar.
    vistos: set = set()
    candidatos: list[tuple[TokenAprobacionFactura, Factura]] = []
    for token, factura in filas:
        clave = (token.factura_id, token.tipo_aprobacion)
        if clave in vistos:
            continue
        vistos.add(clave)
        candidatos.append((token, factura))

    # Filtros de pendiente real, edad mínima y anti-repetición
    a_recordar: list[tuple[TokenAprobacionFactura, Factura]] = []
    for token, factura in candidatos:
        if not _factura_sigue_pendiente(factura, token.tipo_aprobacion):
            continue
        if token.created_at and token.created_at > ahora - timedelta(hours=EDAD_MINIMA_HORAS):
            continue
        if (
            token.recordatorio_enviado_at
            and token.recordatorio_enviado_at > ahora - timedelta(hours=INTERVALO_MINIMO_HORAS)
        ):
            continue
        a_recordar.append((token, factura))

    if not a_recordar:
        logger.info("Recordatorios de aprobación: no hay facturas pendientes que recordar.")
        return {"aprobadores": 0, "facturas": 0, "detalle": []}

    # Agrupar por aprobador → un solo correo con todas sus facturas
    por_aprobador: dict[str, dict] = {}
    for token, factura in a_recordar:
        email = (token.aprobador_email or "").strip().lower()
        if not email:
            continue
        grupo = por_aprobador.setdefault(
            email, {"nombre": token.aprobador_nombre, "tokens": []}
        )
        grupo["tokens"].append((token, factura))

    detalle = []
    total_facturas = 0
    for email, grupo in por_aprobador.items():
        items = []
        for token, factura in grupo["tokens"]:
            horas_restantes = max(0, int((token.expires_at - ahora).total_seconds() // 3600))
            vence_local = token.expires_at.astimezone(TZ_BOGOTA)
            items.append({
                "numero": factura.numero_factura,
                "proveedor": factura.proveedor,
                "total": float(factura.total),
                "tipo_label": TIPO_LABEL.get(token.tipo_aprobacion, ""),
                "vence_str": vence_local.strftime("%d/%m/%Y %I:%M %p"),
                "horas_restantes": horas_restantes,
                "aprobar_url": f"{settings.frontend_url}/aprobar-factura?token={token.token}&accion=aprobar",
                "rechazar_url": f"{settings.frontend_url}/aprobar-factura?token={token.token}&accion=rechazar",
            })
        # Las que vencen primero, de primeras en la tabla
        items.sort(key=lambda it: it["horas_restantes"])

        try:
            await email_service.enviar_recordatorio_aprobaciones_pendientes(
                aprobador_nombre=grupo["nombre"],
                aprobador_email=email,
                items=items,
            )
        except Exception as e:
            logger.error(f"Error enviando recordatorio de aprobaciones a {email}: {e}")
            continue

        # Solo se marca si el correo salió: si falló, el próximo ciclo reintenta
        for token, _ in grupo["tokens"]:
            token.recordatorio_enviado_at = ahora
        total_facturas += len(items)
        detalle.append({"aprobador": email, "facturas": len(items)})

    await db.commit()
    logger.info(
        f"Recordatorios de aprobación enviados: {len(detalle)} aprobador(es), "
        f"{total_facturas} factura(s) pendiente(s)."
    )
    return {"aprobadores": len(detalle), "facturas": total_facturas, "detalle": detalle}


def _segundos_hasta_proximo_envio() -> float:
    """Segundos hasta las próximas HORA_ENVIO_LOCAL en hora Colombia."""
    ahora_local = datetime.now(tz=TZ_BOGOTA)
    proximo = ahora_local.replace(hour=HORA_ENVIO_LOCAL, minute=0, second=0, microsecond=0)
    if proximo <= ahora_local:
        proximo += timedelta(days=1)
    return (proximo - ahora_local).total_seconds()


async def ciclo_recordatorios_aprobacion() -> None:
    """Tarea de fondo: corre los recordatorios todos los días a las 7:00 a.m. Colombia.

    Nota: el backend corre con 1 worker de uvicorn (EC2). Si algún día se suben
    los workers, este ciclo debe moverse a un cron externo para no duplicar correos.
    """
    from db.session import AsyncSessionLocal

    logger.info(
        f"Ciclo de recordatorios de aprobación iniciado "
        f"(diario {HORA_ENVIO_LOCAL}:00 hora Colombia)."
    )
    while True:
        try:
            await asyncio.sleep(_segundos_hasta_proximo_envio())
            async with AsyncSessionLocal() as db:
                try:
                    await enviar_recordatorios_aprobacion(db)
                except Exception:
                    await db.rollback()
                    raise
        except asyncio.CancelledError:
            logger.info("Ciclo de recordatorios de aprobación detenido.")
            raise
        except Exception as e:
            logger.error(f"Error en ciclo de recordatorios de aprobación: {e}")
            # Espera corta antes de recalcular, para no ciclar en caliente ante un error
            await asyncio.sleep(300)
