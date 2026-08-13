"""
Tests del cliente Connekta (modules/siesa/client.py) contra el contrato REAL
observado en QA (sección 5 del diseño): éxito codigo:0, errores HTTP 400 por
capas (codigo 1 estructura / 1 plano / 3 credenciales / 10 ecosistema), y
fallo de red como estado desconocido.
"""
import json

import httpx
import pytest

from modules.siesa.client import (
    ConnektaNetworkError,
    SiesaConnektaClient,
    _render_detalle,
)


def _client(handler) -> SiesaConnektaClient:
    return SiesaConnektaClient(
        base_url="https://serviciosqa.siesacloud.com",
        conni_key="key-test",
        conni_token="token-test",
        id_compania=2211,
        id_sistema=2,
        id_documento=249608,
        nombre_documento="FACTURA DE SERVICIOS DIRECTA",
        transport=httpx.MockTransport(handler),
    )


PAYLOAD_MINIMO = {"Docto. compra servicios": []}


class TestImportarExito:
    @pytest.mark.anyio
    async def test_exito_codigo_0(self):
        capturado = {}

        def handler(request: httpx.Request) -> httpx.Response:
            capturado["url"] = request.url
            capturado["headers"] = request.headers
            return httpx.Response(
                200,
                json=[{"codigo": 0, "mensaje": "Transacción Exitosa",
                       "detalle": "Importacion exitosa"}],
            )

        resultado = await _client(handler).importar_fsp(PAYLOAD_MINIMO)
        assert resultado.exito is True
        assert resultado.codigo == 0
        assert resultado.status_http == 200

    @pytest.mark.anyio
    async def test_query_params_y_url_limpia(self):
        """Regla validada: los 4 identificadores SIEMPRE como query params."""
        capturado = {}

        def handler(request: httpx.Request) -> httpx.Response:
            capturado["url"] = request.url
            return httpx.Response(200, json=[{"codigo": 0, "mensaje": "ok", "detalle": ""}])

        await _client(handler).importar_fsp(PAYLOAD_MINIMO)
        url = capturado["url"]
        assert url.path == "/api/siesa/v3.1/conectoresimportar"
        assert url.params["idCompania"] == "2211"
        assert url.params["idSistema"] == "2"
        assert url.params["idDocumento"] == "249608"
        assert url.params["nombreDocumento"] == "FACTURA DE SERVICIOS DIRECTA"

    @pytest.mark.anyio
    async def test_headers_de_auth(self):
        capturado = {}

        def handler(request: httpx.Request) -> httpx.Response:
            capturado["connikey"] = request.headers.get("connikey")
            capturado["connitoken"] = request.headers.get("connitoken")
            return httpx.Response(200, json=[{"codigo": 0, "mensaje": "ok", "detalle": ""}])

        await _client(handler).importar_fsp(PAYLOAD_MINIMO)
        assert capturado["connikey"] == "key-test"
        assert capturado["connitoken"] == "token-test"

    @pytest.mark.anyio
    async def test_el_exito_no_trae_consecutivo(self):
        """El contrato NO devuelve el número FSP: hay que consultarlo aparte."""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json=[{"codigo": 0, "mensaje": "Transacción Exitosa",
                       "detalle": "Importacion exitosa"}],
            )

        resultado = await _client(handler).importar_fsp(PAYLOAD_MINIMO)
        assert "consecutivo" not in json.dumps(resultado.respuesta_cruda).lower()


class TestContratosDeError:
    @pytest.mark.anyio
    async def test_error_estructura_codigo_1(self):
        """Validación del conector: detalle por campo (f_nivel/f_valor/f_detalle)."""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(400, json={
                "codigo": 1,
                "mensaje": "Error en la Estructura",
                "detalle": [
                    {"f_nivel": "Docto. compra servicios",
                     "f_valor": "24/07/2026",
                     "f_detalle": "El formato de la fecha no es válido"},
                ],
            })

        resultado = await _client(handler).importar_fsp(PAYLOAD_MINIMO)
        assert resultado.exito is False
        assert resultado.codigo == 1
        assert "Docto. compra servicios" in resultado.detalle_legible
        assert "24/07/2026" in resultado.detalle_legible
        assert "formato de la fecha" in resultado.detalle_legible
        assert "por capas" in resultado.detalle_legible  # advertencia de capas

    @pytest.mark.anyio
    async def test_error_plano_codigo_1(self):
        """Validación del ERP: f_tipo_reg (311/320/...) y posiciones del plano."""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(400, json={
                "codigo": 1,
                "mensaje": "Error al importar el plano",
                "detalle": [
                    {"f_tipo_reg": "320",
                     "f_detalle": "Dato obligatorio, posición 43"},
                ],
            })

        resultado = await _client(handler).importar_fsp(PAYLOAD_MINIMO)
        assert resultado.exito is False
        assert "registro 320" in resultado.detalle_legible
        assert "posición 43" in resultado.detalle_legible

    @pytest.mark.anyio
    async def test_codigo_10_es_config_del_ecosistema(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(400, json={
                "codigo": 10,
                "mensaje": "Propiedad: WebServiceERP sin reemplazar",
                "detalle": None,
            })

        resultado = await _client(handler).importar_fsp(PAYLOAD_MINIMO)
        assert resultado.exito is False
        assert "ecosistema" in resultado.detalle_legible.lower()
        assert "NO es un error del request" in resultado.detalle_legible
        assert "WebServiceERP" in resultado.detalle_legible

    @pytest.mark.anyio
    async def test_codigo_3_credenciales(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(400, json={"codigo": 3, "mensaje": "Error de autenticación ERP", "detalle": None})

        resultado = await _client(handler).importar_fsp(PAYLOAD_MINIMO)
        assert resultado.exito is False
        assert "credenciales" in resultado.detalle_legible.lower()

    @pytest.mark.anyio
    async def test_respuesta_no_json(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(502, text="<html>Bad Gateway</html>")

        resultado = await _client(handler).importar_fsp(PAYLOAD_MINIMO)
        assert resultado.exito is False
        assert resultado.codigo is None
        assert "502" in resultado.detalle_legible

    @pytest.mark.anyio
    async def test_fallo_de_red_es_estado_desconocido(self):
        """Ni éxito ni error: quien llama debe dejar 'enviado' y verificar."""

        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        with pytest.raises(ConnektaNetworkError) as exc:
            await _client(handler).importar_fsp(PAYLOAD_MINIMO)
        assert "verificar" in str(exc.value).lower()


class TestEjecutarConsulta:
    @pytest.mark.anyio
    async def test_parametros_pipe_y_filas(self):
        capturado = {}

        def handler(request: httpx.Request) -> httpx.Response:
            capturado["url"] = request.url
            return httpx.Response(200, json={
                "detalle": {"Table": [
                    {"f_consec_docto": "12345", "f_fecha": "20260724"},
                ]},
            })

        filas = await _client(handler).ejecutar_consulta(
            "cafequindio_FSP_CONSECUTIVO_DOCUFLOW", {"Nit": "830026510", "Fecha": "20260724"}
        )
        url = capturado["url"]
        assert url.path == "/api/connekta/v3.0.1/ejecutarconsulta"
        assert url.params["descripcion"] == "cafequindio_FSP_CONSECUTIVO_DOCUFLOW"
        assert url.params["paginacion"] == "numPag=1|tamPag=100"
        assert url.params["parametros"] == "Nit=830026510|Fecha=20260724"
        assert filas == [{"f_consec_docto": "12345", "f_fecha": "20260724"}]

    @pytest.mark.anyio
    async def test_formas_alternativas_de_respuesta(self):
        def handler_lista(request):
            return httpx.Response(200, json=[{"consecutivo": "9"}])

        def handler_detalle_lista(request):
            return httpx.Response(200, json={"detalle": [{"consecutivo": "9"}]})

        def handler_vacio(request):
            return httpx.Response(200, json={"detalle": []})

        assert await _client(handler_lista).ejecutar_consulta("Q", {}) == [{"consecutivo": "9"}]
        assert await _client(handler_detalle_lista).ejecutar_consulta("Q", {}) == [{"consecutivo": "9"}]
        assert await _client(handler_vacio).ejecutar_consulta("Q", {}) == []


class TestRenderDetalle:
    def test_exito(self):
        assert "exitosa" in _render_detalle(0, "ok", None).lower()

    def test_detalle_desconocido_se_muestra_crudo(self):
        legible = _render_detalle(1, "Error raro", [{"campo_nuevo": "x"}])
        assert "campo_nuevo" in legible

    def test_detalle_string(self):
        legible = _render_detalle(1, "Error", "detalle plano en texto")
        assert "detalle plano en texto" in legible
