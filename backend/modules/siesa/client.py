"""
Cliente HTTP de Siesa Connekta para la causación FSP.

Contrato REAL observado en QA (29-jul-2026), no documentación oficial:

- POST {base}/api/siesa/v3.1/conectoresimportar
  Query params SIEMPRE como parámetros (idCompania, idSistema, idDocumento,
  nombreDocumento) con la URL limpia — si van también en el path/body el
  servidor los concatena y rechaza con "The value 'x,y' is not valid".
- Headers de auth: `connikey` y `connitoken` (JWT). Vienen de settings/.env,
  JAMÁS se loggean (los tokens de QA circularon por chats y deben rotarse
  antes de producción).
- Éxito: [{"codigo":0,"mensaje":"Transacción Exitosa","detalle":"Importacion exitosa"}]
  ⚠️ NO devuelve el consecutivo asignado: se recupera con `ejecutarconsulta`.
- Todo error llega como HTTP 400 con {"codigo":N,"mensaje":...,"detalle":...}:
    codigo 1 + "Error en la Estructura"    → validación del conector; detalle
        es lista por campo (f_nivel=sección, f_valor=valor, f_detalle=causa).
    codigo 1 + "Error al importar el plano" → validación del ERP; detalle trae
        f_tipo_reg (311/320/321/314/353) y posiciones del plano.
    codigo 10 "Propiedad X sin reemplazar"  → configuración del ecosistema
        Connekta (Parámetros del ERP), NO es un error del request.
    codigo 3                                → credenciales del ERP en el
        ecosistema.
  El validador reporta POR CAPAS: corregir una capa destapa la siguiente.
"""
import json
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

from core.logging import logger


class ConnektaNetworkError(Exception):
    """
    Fallo de red/timeout con el POST ya (posiblemente) enviado: el estado en
    el ERP es DESCONOCIDO. Quien atrape esto debe dejar la causación en
    'enviado' y exigir verificación por consulta ANTES de permitir un
    reintento (riesgo de doble causación).
    """


@dataclass
class ResultadoImportacion:
    """Resultado parseado de `conectoresimportar`."""
    exito: bool
    codigo: Optional[int]
    mensaje: str
    detalle_legible: str
    respuesta_cruda: Any = field(default=None)
    status_http: Optional[int] = None


def _render_detalle(codigo: Optional[int], mensaje: str, detalle: Any) -> str:
    """
    Traduce el error del conector/ERP a texto legible (sección + campo +
    causa). El `detalle` es autodescriptivo: SIEMPRE se muestra completo.
    """
    if codigo == 0:
        return "Transacción exitosa."

    if codigo == 3:
        return (
            "Credenciales del ERP inválidas en el ecosistema Connekta "
            "(UsuarioERP/ClaveERP). Corregir en la plataforma Connekta, "
            "no en DocuFlow."
        )

    if codigo == 10:
        return (
            "Configuración del ecosistema Connekta incompleta (Parámetros del "
            f"ERP: WebServiceERP/IdCiaERP/UsuarioERP/ClaveERP). NO es un error "
            f"del request de DocuFlow. Mensaje del servidor: {mensaje}"
        )

    lineas: list[str] = []
    encabezado = f"Error del conector Siesa (codigo {codigo}): {mensaje}"
    if isinstance(mensaje, str) and "estructura" in mensaje.lower():
        encabezado += " — validación del conector."
    elif isinstance(mensaje, str) and "plano" in mensaje.lower():
        encabezado += " — validación del ERP (registros del plano)."
    lineas.append(encabezado)

    if isinstance(detalle, list):
        for item in detalle:
            if isinstance(item, dict):
                nivel = item.get("f_nivel")
                valor = item.get("f_valor")
                causa = item.get("f_detalle") or item.get("f_mensaje")
                tipo_reg = item.get("f_tipo_reg")
                partes = []
                if nivel:
                    partes.append(f"[{nivel}]")
                if tipo_reg:
                    partes.append(f"registro {tipo_reg}")
                if valor not in (None, ""):
                    partes.append(f"valor enviado '{valor}'")
                if causa:
                    partes.append(str(causa))
                if partes:
                    lineas.append("• " + " — ".join(partes))
                else:
                    lineas.append("• " + json.dumps(item, ensure_ascii=False))
            else:
                lineas.append(f"• {item}")
    elif detalle not in (None, ""):
        lineas.append(str(detalle))

    lineas.append(
        "Nota: el validador reporta por capas — corregir esto puede destapar "
        "el siguiente error."
    )
    return "\n".join(lineas)


class SiesaConnektaClient:
    """
    Cliente de la API de importación de Connekta. Sin estado; una instancia
    por request está bien. `transport` existe para inyectar
    httpx.MockTransport en tests.
    """

    def __init__(
        self,
        *,
        base_url: str,
        conni_key: str,
        conni_token: str,
        id_compania: int,
        id_sistema: int,
        id_documento: int,
        nombre_documento: str,
        timeout: float = 60.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self._conni_key = conni_key
        self._conni_token = conni_token
        self.id_compania = id_compania
        self.id_sistema = id_sistema
        self.id_documento = id_documento
        self.nombre_documento = nombre_documento
        self.timeout = timeout
        self._transport = transport

    @property
    def ambiente(self) -> str:
        return "qa" if "serviciosqa" in self.base_url else "prod"

    def _headers(self) -> dict:
        # Las credenciales nunca se loggean; este dict no debe salir a logs.
        return {
            "connikey": self._conni_key,
            "connitoken": self._conni_token,
        }

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=self.timeout, transport=self._transport)

    async def importar_fsp(self, payload: dict) -> ResultadoImportacion:
        """
        POST del payload de 5 secciones al importador. Devuelve el resultado
        parseado (nunca lanza por errores del contrato — solo por red, con
        ConnektaNetworkError).
        """
        url = f"{self.base_url}/api/siesa/v3.1/conectoresimportar"
        # SIEMPRE query params, URL limpia (regla validada: duplicarlos
        # produce "The value 'x,y' is not valid")
        params = {
            "idCompania": self.id_compania,
            "idSistema": self.id_sistema,
            "idDocumento": self.id_documento,
            "nombreDocumento": self.nombre_documento,
        }
        try:
            async with self._client() as client:
                resp = await client.post(
                    url, params=params, json=payload, headers=self._headers()
                )
        except httpx.HTTPError as e:
            # No sabemos si el ERP recibió el documento: estado desconocido.
            logger.error(f"Connekta importar_fsp: fallo de red ({type(e).__name__})")
            raise ConnektaNetworkError(
                "Fallo de red al enviar a Siesa: el estado del documento es "
                "desconocido. Verificar por consulta antes de reintentar."
            ) from e

        return self._parsear_respuesta(resp)

    def _parsear_respuesta(self, resp: httpx.Response) -> ResultadoImportacion:
        try:
            body = resp.json()
        except ValueError:
            return ResultadoImportacion(
                exito=False,
                codigo=None,
                mensaje=f"Respuesta no-JSON del servidor (HTTP {resp.status_code})",
                detalle_legible=(
                    f"Siesa respondió HTTP {resp.status_code} sin JSON válido: "
                    f"{resp.text[:500]}"
                ),
                respuesta_cruda=resp.text[:2000],
                status_http=resp.status_code,
            )

        # El éxito llega como lista de un elemento; los errores como dict.
        primero = body[0] if isinstance(body, list) and body else body
        if not isinstance(primero, dict):
            primero = {}

        codigo = primero.get("codigo")
        mensaje = str(primero.get("mensaje", ""))
        detalle = primero.get("detalle")
        exito = codigo == 0

        legible = _render_detalle(codigo, mensaje, detalle)
        # Loggear SIEMPRE el detalle completo (es autodescriptivo) — sin headers.
        if exito:
            logger.info(f"Connekta importar_fsp OK: {mensaje}")
        else:
            logger.warning(
                f"Connekta importar_fsp rechazado (HTTP {resp.status_code}, "
                f"codigo {codigo}): {json.dumps(body, ensure_ascii=False)[:4000]}"
            )

        return ResultadoImportacion(
            exito=exito,
            codigo=codigo,
            mensaje=mensaje,
            detalle_legible=legible,
            respuesta_cruda=body,
            status_http=resp.status_code,
        )

    async def ejecutar_consulta(self, descripcion: str, parametros: dict) -> list[dict]:
        """
        Ejecuta una consulta parametrizada de Connekta (`ejecutarconsulta`).
        Se usa para recuperar el consecutivo FSP real tras un éxito.

        Contrato REAL (consulta cafequindio_FSP_CONSECUTIVO_DOCUFLOW,
        creada 12-Ago-2026): path /api/connekta/v3.0.1/ejecutarconsulta,
        parámetro `paginacion` obligatorio, y `parametros` con el formato
        `Nombre = valor|Nombre = valor` (nombres tal como estén definidos en
        la consulta del ecosistema — p. ej. `Nit`, `Fecha`).

        `descripcion` es el nombre de la consulta (settings.siesa_consulta_fsp).
        Devuelve las filas como lista de dicts; lista vacía si no hay datos.
        """
        url = f"{self.base_url}/api/connekta/v3.0.1/ejecutarconsulta"
        params = {
            "idCompania": self.id_compania,
            "descripcion": descripcion,
            "paginacion": "numPag=1|tamPag=100",
            "parametros": "|".join(f"{k}={v}" for k, v in parametros.items()),
        }
        try:
            async with self._client() as client:
                resp = await client.get(url, params=params, headers=self._headers())
        except httpx.HTTPError as e:
            logger.error(f"Connekta ejecutar_consulta: fallo de red ({type(e).__name__})")
            raise ConnektaNetworkError(
                "Fallo de red al consultar Siesa."
            ) from e

        try:
            body = resp.json()
        except ValueError:
            logger.warning(
                f"Connekta ejecutar_consulta: respuesta no-JSON (HTTP {resp.status_code})"
            )
            return []

        # Tolerante a las dos formas vistas: {"detalle": {"Table": [...]}} /
        # {"detalle": [...]} / lista directa.
        if isinstance(body, dict):
            detalle = body.get("detalle", body)
            if isinstance(detalle, dict):
                for v in detalle.values():
                    if isinstance(v, list):
                        return [r for r in v if isinstance(r, dict)]
                return []
            if isinstance(detalle, list):
                return [r for r in detalle if isinstance(r, dict)]
            return []
        if isinstance(body, list):
            return [r for r in body if isinstance(r, dict)]
        return []
