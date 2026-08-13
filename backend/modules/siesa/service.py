"""
Lógica de negocio de la causación FSP en Siesa.

Orquesta: prefill del modal (factura + mapeo por proveedor), construcción y
envío del payload, registro de cada intento en `siesa_causaciones`, y la
verificación del consecutivo real vía `ejecutarconsulta`.

Idempotencia (defensa contra doble causación):
- Una factura con causación 'exitoso'/'verificado' NO se vuelve a causar.
- Una causación 'enviando'/'enviado' (fallo de red con estado desconocido en
  el ERP) BLOQUEA nuevos envíos hasta pasar por `verificar`: si la consulta
  encuentra el documento → 'verificado' (no se reenvía); si no lo encuentra
  → 'error' (reintento seguro).
"""
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.logging import logger
from db.models import Factura, SiesaCausacion, SiesaProveedorConfig
from modules.siesa.builder import (
    DatosCausacionFSP,
    RenglonFSP,
    RetencionFSP,
    construir_payload_fsp,
    formatear_fecha,
    generar_amarre,
    normalizar_nit,
    validar_datos,
    verificar_aritmetica,
)
from modules.siesa.client import ConnektaNetworkError, SiesaConnektaClient
from modules.siesa.repository import SiesaRepository
from modules.siesa.schemas import (
    CausacionOut,
    CausarIn,
    CausarOut,
    ConfigProveedorOut,
    CuadreOut,
    PrepararOut,
    RenglonIn,
    RetencionIn,
    VerificarOut,
)

ESTADOS_BLOQUEO_REENVIO = ("enviando", "enviado")
ESTADOS_CAUSADA = ("exitoso", "verificado")


class SiesaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SiesaRepository(db)

    # ------------------------------------------------------------------
    # Infraestructura
    # ------------------------------------------------------------------

    def _exigir_habilitado(self) -> None:
        if not settings.siesa_habilitado:
            raise HTTPException(
                status_code=503,
                detail="La causación en Siesa está deshabilitada (SIESA_HABILITADO=false).",
            )
        if not settings.siesa_conni_key or not settings.siesa_conni_token:
            raise HTTPException(
                status_code=503,
                detail="Faltan credenciales de Siesa Connekta (SIESA_CONNI_KEY / SIESA_CONNI_TOKEN).",
            )

    def _client(self) -> SiesaConnektaClient:
        return SiesaConnektaClient(
            base_url=settings.siesa_base_url,
            conni_key=settings.siesa_conni_key,
            conni_token=settings.siesa_conni_token,
            id_compania=settings.siesa_id_compania,
            id_sistema=settings.siesa_id_sistema,
            id_documento=settings.siesa_id_documento,
            nombre_documento=settings.siesa_nombre_documento,
        )

    async def _get_factura_o_404(self, factura_id: UUID) -> Factura:
        factura = await self.repo.get_factura(factura_id)
        if not factura:
            raise HTTPException(status_code=404, detail="Factura no encontrada.")
        return factura

    # ------------------------------------------------------------------
    # Prefill del modal
    # ------------------------------------------------------------------

    @staticmethod
    def _separar_prefijo_numero(numero_factura: str) -> tuple[str, str]:
        """'FE99001' / 'FE-99001' → ('FE', '99001'); sin patrón → ('', tal cual)."""
        m = re.fullmatch(r"([A-Za-z]{1,6})[\s\-]?(\d+)", (numero_factura or "").strip())
        if m:
            return m.group(1).upper(), m.group(2)
        return "", (numero_factura or "").strip()

    @staticmethod
    def _notas_default(factura: Factura) -> str:
        """
        NOTAS nunca viaja vacío: el ERP exige el campo largo del Movto
        (registro 320, pos 233-488 — error real 12-Ago-2026). Default con
        trazabilidad hacia DocuFlow.
        """
        return f"DocuFlow {factura.numero_factura} {factura.proveedor}"[:250]

    def _armar_datos_builder(self, factura: Factura, data: CausarIn) -> DatosCausacionFSP:
        return DatosCausacionFSP(
            nit_proveedor=factura.nit_proveedor or "",
            sucursal_proveedor=data.sucursal_proveedor,
            tipo_proveedor=data.tipo_proveedor,
            cond_pago=data.cond_pago,
            fecha_emision=data.fecha_emision or factura.fecha_emision,
            prefijo_docto_proveedor=data.prefijo_docto_proveedor,
            numero_docto_proveedor=data.numero_docto_proveedor,
            renglones=[
                RenglonFSP(
                    codigo_servicio=r.codigo_servicio,
                    valor_bruto=Decimal(r.valor_bruto),
                    centro_costo=r.centro_costo,
                    motivo=r.motivo,
                    llave_impuesto=r.llave_impuesto,
                    tasa_iva=Decimal(r.tasa_iva) if r.tasa_iva is not None else None,
                    valor_iva=Decimal(r.valor_iva or 0),
                    notas=r.notas,
                    detalle=r.detalle,
                )
                for r in data.renglones
            ],
            retenciones=[
                RetencionFSP(
                    llave=ret.llave,
                    tasa=Decimal(ret.tasa),
                    clase_imp_base=ret.clase_imp_base,
                    base_minima=Decimal(ret.base_minima or 0),
                )
                for ret in data.retenciones
            ],
            total_factura=Decimal(factura.total),
            notas=(data.notas or "").strip() or self._notas_default(factura),
        )

    def _prefill(self, factura: Factura, config: Optional[SiesaProveedorConfig]) -> CausarIn:
        """
        Arma el CausarIn precargado: datos de la factura + mapeo del
        proveedor. Las RETENCIONES salen del mapeo (parametrización del
        agente retenedor), nunca de factura.retenciones_xml — esas solo se
        muestran como referencia informativa.
        """
        prefijo, numero = self._separar_prefijo_numero(factura.numero_factura)

        base = Decimal(factura.base_gravable) if factura.base_gravable is not None else None
        iva = Decimal(factura.valor_iva) if factura.valor_iva is not None else Decimal("0")
        if base is None and factura.total is not None:
            # Fallback razonable, editable en el modal: base = total − IVA
            base = Decimal(factura.total) - iva

        renglon = RenglonIn(
            codigo_servicio=(config.codigo_servicio if config else None) or "",
            valor_bruto=base if base and base > 0 else Decimal("1"),
            centro_costo=(config.centro_costo_siesa if config else None) or "",
            motivo=(config.id_motivo if config else None) or "",
            llave_impuesto=(config.llave_impuesto if config else None),
            tasa_iva=(Decimal(config.tasa_impuesto) if config and config.tasa_impuesto is not None else None),
            valor_iva=iva,
        )
        retenciones = [
            RetencionIn(
                llave=ret.llave_retencion,
                tasa=Decimal(ret.tasa),
                clase_imp_base=ret.clase_imp_base,
                base_minima=Decimal(ret.base_minima or 0),
            )
            for ret in (config.retenciones if config else [])
        ]
        return CausarIn(
            sucursal_proveedor=(config.sucursal if config else "001"),
            tipo_proveedor=(config.tipo_proveedor if config else None) or "",
            cond_pago=(config.cond_pago if config else None) or "",
            prefijo_docto_proveedor=prefijo,
            numero_docto_proveedor=numero,
            fecha_emision=factura.fecha_emision,
            notas=self._notas_default(factura),
            renglones=[renglon],
            retenciones=retenciones,
        )

    async def preparar(self, factura_id: UUID) -> PrepararOut:
        """Todo lo que el modal necesita para abrirse: prefill + estado + problemas."""
        factura = await self._get_factura_o_404(factura_id)
        nit = normalizar_nit(factura.nit_proveedor or "")
        config = await self.repo.get_config_por_nit(nit) if nit else None
        causaciones = await self.repo.get_causaciones_de_factura(factura_id)

        prefill = self._prefill(factura, config)

        problemas: list[str] = []
        cuadre = None
        if not nit:
            problemas.append("La factura no tiene NIT de proveedor.")
        if factura.fecha_emision is None:
            problemas.append("La factura no tiene fecha de emisión.")
        if factura.base_gravable is None:
            problemas.append(
                "La factura no tiene base gravable extraída del XML: "
                "verificar el valor propuesto (total − IVA) antes de causar."
            )
        if config is None:
            problemas.append(
                "El proveedor no tiene mapeo Siesa guardado: completar los "
                "datos de decisión en el modal (se pueden guardar como default)."
            )
        try:
            datos = self._armar_datos_builder(factura, prefill)
            problemas.extend(validar_datos(datos))
            if factura.fecha_emision is not None:
                cuadre = CuadreOut(**{k: v for k, v in verificar_aritmetica(datos).items()})
        except Exception as e:
            problemas.append(f"No se pudo validar el prefill: {e}")

        ya_causada = any(c.estado in ESTADOS_CAUSADA for c in causaciones)
        bloqueada = any(c.estado in ESTADOS_BLOQUEO_REENVIO for c in causaciones)
        if ya_causada:
            problemas.insert(0, "La factura YA fue causada en Siesa.")
        if bloqueada:
            problemas.insert(
                0,
                "Hay un envío con estado desconocido (fallo de red): "
                "verificar en Siesa antes de reintentar.",
            )

        return PrepararOut(
            factura_id=factura.id,
            proveedor=factura.proveedor,
            nit_proveedor=factura.nit_proveedor,
            nit_normalizado=nit or None,
            numero_factura=factura.numero_factura,
            fecha_emision=factura.fecha_emision,
            total=Decimal(factura.total),
            base_gravable=Decimal(factura.base_gravable) if factura.base_gravable is not None else None,
            valor_iva=Decimal(factura.valor_iva) if factura.valor_iva is not None else None,
            retenciones_xml=factura.retenciones_xml or [],
            prefill=prefill,
            config_proveedor=ConfigProveedorOut.model_validate(config) if config else None,
            problemas=problemas,
            cuadre=cuadre,
            causaciones=[CausacionOut.model_validate(c) for c in causaciones],
            puede_causar=not problemas and settings.siesa_habilitado,
            habilitado=settings.siesa_habilitado,
        )

    # ------------------------------------------------------------------
    # Causar
    # ------------------------------------------------------------------

    async def causar(self, factura_id: UUID, data: CausarIn, user_id: Optional[UUID]) -> CausarOut:
        self._exigir_habilitado()
        factura = await self._get_factura_o_404(factura_id)

        # Idempotencia — antes de cualquier otra cosa
        causaciones = await self.repo.get_causaciones_de_factura(factura_id)
        for c in causaciones:
            if c.estado in ESTADOS_CAUSADA:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"La factura ya fue causada en Siesa "
                        f"(causación {c.id}, estado '{c.estado}'"
                        + (f", FSP {c.numero_fsp}" if c.numero_fsp else "")
                        + "). No se reenvía."
                    ),
                )
            if c.estado in ESTADOS_BLOQUEO_REENVIO:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Hay un envío previo con estado desconocido "
                        f"(causación {c.id}, estado '{c.estado}'). Ejecutar la "
                        "verificación antes de reintentar — riesgo de doble causación."
                    ),
                )

        # Guardar mapeo como default del proveedor (aunque el ERP luego
        # rechace: los datos de decisión confirmados por el usuario valen)
        nit = normalizar_nit(factura.nit_proveedor or "")
        if data.guardar_como_default and nit:
            await self._guardar_default(nit, data)

        # Construcción del payload — el builder valida y bloquea (reglas 1-11)
        datos = self._armar_datos_builder(factura, data)
        amarre = generar_amarre()
        try:
            payload = construir_payload_fsp(
                datos,
                amarre=amarre,
                workaround_tercero_movto=settings.siesa_workaround_tercero_movto,
                workaround_sucursal_movto=settings.siesa_workaround_sucursal_movto,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        client = self._client()

        # Registrar ANTES de enviar: si el proceso muere a mitad, queda rastro
        causacion = SiesaCausacion(
            factura_id=factura.id,
            amarre=amarre,
            estado="enviando",
            payload_enviado=payload,
            ambiente=client.ambiente,
            creado_por_user_id=user_id,
        )
        causacion = await self.repo.crear_causacion(causacion)

        try:
            resultado = await client.importar_fsp(payload)
        except ConnektaNetworkError as e:
            # Estado DESCONOCIDO en el ERP: ni éxito ni error confirmado.
            causacion.estado = "enviado"
            causacion.respuesta = {"error_red": str(e)}
            await self.repo.guardar()
            raise HTTPException(
                status_code=502,
                detail=(
                    "Fallo de red al enviar a Siesa: el documento pudo o no "
                    "quedar causado. Usar 'Verificar en Siesa' antes de "
                    "reintentar (riesgo de doble causación)."
                ),
            )

        causacion.respuesta = (
            resultado.respuesta_cruda
            if isinstance(resultado.respuesta_cruda, dict)
            else {"respuesta": resultado.respuesta_cruda}
        )

        if not resultado.exito:
            causacion.estado = "error"
            await self.repo.guardar()
            # 422: el detalle legible (sección + campo + causa) va al modal
            raise HTTPException(status_code=422, detail=resultado.detalle_legible)

        causacion.estado = "exitoso"
        causacion.fecha_causacion = datetime.now(timezone.utc)
        await self.repo.guardar()
        logger.info(f"Factura {factura.id} causada en Siesa (amarre {amarre}).")

        # Recuperar el consecutivo real (best effort: el éxito ya está persistido)
        mensaje = "Causación exitosa en Siesa."
        try:
            numero = await self._consultar_numero_fsp(client, datos)
            if numero:
                causacion.estado = "verificado"
                causacion.numero_fsp = numero
                await self.repo.guardar()
                mensaje = f"Causación exitosa en Siesa — documento FSP {numero}."
            else:
                mensaje += " El número FSP se puede recuperar luego con 'Verificar'."
        except ConnektaNetworkError:
            mensaje += " No se pudo consultar el número FSP (red); usar 'Verificar' luego."

        return CausarOut(
            causacion=CausacionOut.model_validate(causacion),
            mensaje=mensaje,
        )

    async def _guardar_default(self, nit: str, data: CausarIn) -> None:
        primer_renglon = data.renglones[0] if data.renglones else None
        campos = {
            "sucursal": data.sucursal_proveedor,
            "tipo_proveedor": data.tipo_proveedor or None,
            "cond_pago": data.cond_pago or None,
            "id_motivo": (primer_renglon.motivo if primer_renglon else None) or None,
            "centro_costo_siesa": (primer_renglon.centro_costo if primer_renglon else None) or None,
            "codigo_servicio": (primer_renglon.codigo_servicio if primer_renglon else None) or None,
            "llave_impuesto": (primer_renglon.llave_impuesto if primer_renglon else None) or None,
            "tasa_impuesto": (primer_renglon.tasa_iva if primer_renglon else None),
        }
        retenciones = [
            {
                "llave_retencion": r.llave,
                "tasa": r.tasa,
                "clase_imp_base": r.clase_imp_base,
                "base_minima": r.base_minima,
            }
            for r in data.retenciones
        ]
        await self.repo.upsert_config(nit, campos, retenciones)

    # ------------------------------------------------------------------
    # Verificación del consecutivo / de envíos dudosos
    # ------------------------------------------------------------------

    async def _consultar_numero_fsp(
        self, client: SiesaConnektaClient, datos: DatosCausacionFSP
    ) -> Optional[str]:
        """
        Recupera el último FSP del tercero por fecha + valor vía
        `ejecutarconsulta` (la misma consulta del ecosistema que usa n8n,
        settings.siesa_consulta_fsp). Sin consulta configurada → None.
        """
        if not settings.siesa_consulta_fsp:
            logger.warning(
                "SIESA_CONSULTA_FSP no configurada: no se puede recuperar el "
                "consecutivo real del FSP."
            )
            return None

        # Parámetros con los nombres definidos en la consulta del ecosistema
        # (cafequindio_FSP_CONSECUTIVO_DOCUFLOW): Nit y Fecha (AAAAMMDD).
        filas = await client.ejecutar_consulta(
            settings.siesa_consulta_fsp,
            {
                "Nit": normalizar_nit(datos.nit_proveedor),
                "Fecha": formatear_fecha(datos.fecha_emision),
            },
        )
        if not filas:
            return None
        fila = filas[0]
        # Tolerante al nombre exacto de la columna de la consulta
        for key, valor in fila.items():
            if "consec" in key.lower() or "numero" in key.lower():
                if valor not in (None, ""):
                    return str(valor)
        return None

    async def verificar(self, causacion_id: UUID) -> VerificarOut:
        """
        Para causaciones 'exitoso' sin número: recupera el consecutivo.
        Para 'enviando'/'enviado' (estado desconocido tras fallo de red):
        decide — documento encontrado → 'verificado' (NO reenviar);
        no encontrado → 'error' (reintento seguro).
        """
        self._exigir_habilitado()
        causacion = await self.repo.get_causacion(causacion_id)
        if not causacion:
            raise HTTPException(status_code=404, detail="Causación no encontrada.")
        if causacion.estado == "verificado":
            return VerificarOut(
                causacion=CausacionOut.model_validate(causacion),
                mensaje=f"Ya verificada — documento FSP {causacion.numero_fsp}.",
            )
        if causacion.estado not in ("exitoso", "enviando", "enviado"):
            raise HTTPException(
                status_code=409,
                detail=f"La causación está en estado '{causacion.estado}': no hay nada que verificar.",
            )
        if not settings.siesa_consulta_fsp:
            raise HTTPException(
                status_code=503,
                detail="SIESA_CONSULTA_FSP no configurada: no se puede verificar contra el ERP.",
            )

        factura = await self._get_factura_o_404(causacion.factura_id)
        client = self._client()
        # La fecha del documento es la que VIAJÓ en el payload (puede diferir
        # de factura.fecha_emision si el usuario la ajustó en el modal).
        fecha_docto = None
        if causacion.payload_enviado:
            try:
                fecha_docto = causacion.payload_enviado["Docto. compra servicios"][0]["FECHA"]
            except (KeyError, IndexError, TypeError):
                fecha_docto = None
        if not fecha_docto and factura.fecha_emision:
            fecha_docto = formatear_fecha(factura.fecha_emision)
        try:
            filas = await client.ejecutar_consulta(
                settings.siesa_consulta_fsp,
                {
                    "Nit": normalizar_nit(factura.nit_proveedor or ""),
                    "Fecha": fecha_docto or "",
                },
            )
        except ConnektaNetworkError:
            raise HTTPException(status_code=502, detail="Fallo de red al consultar Siesa; reintentar la verificación.")

        numero = None
        if filas:
            for key, valor in filas[0].items():
                if ("consec" in key.lower() or "numero" in key.lower()) and valor not in (None, ""):
                    numero = str(valor)
                    break

        if numero or filas:
            causacion.estado = "verificado"
            causacion.numero_fsp = numero
            if causacion.fecha_causacion is None:
                causacion.fecha_causacion = datetime.now(timezone.utc)
            await self.repo.guardar()
            msg = (
                f"Documento encontrado en Siesa{f' — FSP {numero}' if numero else ''}. "
                "NO reenviar esta factura."
            )
            return VerificarOut(causacion=CausacionOut.model_validate(causacion), mensaje=msg)

        if causacion.estado in ESTADOS_BLOQUEO_REENVIO:
            causacion.estado = "error"
            await self.repo.guardar()
            return VerificarOut(
                causacion=CausacionOut.model_validate(causacion),
                mensaje=(
                    "El documento NO aparece en Siesa: el envío dudoso se marca "
                    "como error y es seguro reintentar la causación."
                ),
            )

        return VerificarOut(
            causacion=CausacionOut.model_validate(causacion),
            mensaje=(
                "La consulta no devolvió el documento todavía (puede tardar en "
                "reflejarse). La causación sigue 'exitoso'; reintentar la "
                "verificación más tarde."
            ),
        )
