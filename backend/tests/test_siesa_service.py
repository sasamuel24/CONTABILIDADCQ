"""
Tests del candado de idempotencia y las compuertas del servicio de causación
(modules/siesa/service.py), con repositorio simulado (sin BD).

La regla que protegen: NUNCA reenviar una factura ya causada ni una con envío
de estado desconocido (riesgo de doble causación en el ERP).
"""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from core.config import settings
from modules.siesa.schemas import CausarIn, RenglonIn, RetencionIn
from modules.siesa.service import SiesaService


FACTURA_ID = uuid4()


def _factura():
    return SimpleNamespace(
        id=FACTURA_ID,
        proveedor="PROVEEDOR PRUEBA SAS",
        nit_proveedor="830026510",
        numero_factura="FE99001",
        fecha_emision=date(2026, 7, 24),
        total=Decimal("670000"),
        base_gravable=Decimal("563025"),
        valor_iva=Decimal("106975"),
        retenciones_xml=None,
    )


def _causacion(estado: str):
    return SimpleNamespace(id=uuid4(), estado=estado, numero_fsp=None)


def _causar_in() -> CausarIn:
    return CausarIn(
        tipo_proveedor="007",
        cond_pago="30D",
        prefijo_docto_proveedor="FE",
        numero_docto_proveedor="99001",
        renglones=[RenglonIn(
            codigo_servicio="CS4515-1",
            valor_bruto=Decimal("563025"),
            centro_costo="0502",
            motivo="51",
            llave_impuesto="0010",
            tasa_iva=Decimal("19"),
            valor_iva=Decimal("106975"),
        )],
        # El conector exige Retenciones con datos (limitación 12-Ago-2026)
        retenciones=[RetencionIn(llave="1040", tasa=Decimal("2.5"))],
    )


def _servicio(monkeypatch, causaciones_existentes: list, habilitado=True) -> SiesaService:
    monkeypatch.setattr(settings, "siesa_habilitado", habilitado)
    monkeypatch.setattr(settings, "siesa_conni_key", "k")
    monkeypatch.setattr(settings, "siesa_conni_token", "t")

    svc = SiesaService.__new__(SiesaService)  # sin __init__: no hay BD
    svc.db = None

    async def get_factura(fid):
        return _factura()

    async def get_causaciones(fid):
        return causaciones_existentes

    svc.repo = SimpleNamespace(
        get_factura=get_factura,
        get_causaciones_de_factura=get_causaciones,
    )
    return svc


class TestIdempotencia:
    @pytest.mark.anyio
    async def test_ya_causada_exitoso_no_se_reenvia(self, monkeypatch):
        svc = _servicio(monkeypatch, [_causacion("exitoso")])
        with pytest.raises(HTTPException) as exc:
            await svc.causar(FACTURA_ID, _causar_in(), None)
        assert exc.value.status_code == 409
        assert "ya fue causada" in exc.value.detail.lower()

    @pytest.mark.anyio
    async def test_ya_verificada_no_se_reenvia(self, monkeypatch):
        svc = _servicio(monkeypatch, [_causacion("verificado")])
        with pytest.raises(HTTPException) as exc:
            await svc.causar(FACTURA_ID, _causar_in(), None)
        assert exc.value.status_code == 409

    @pytest.mark.anyio
    async def test_envio_dudoso_exige_verificar(self, monkeypatch):
        """Fallo de red previo (estado 'enviado'): bloquea hasta verificar."""
        svc = _servicio(monkeypatch, [_causacion("enviado")])
        with pytest.raises(HTTPException) as exc:
            await svc.causar(FACTURA_ID, _causar_in(), None)
        assert exc.value.status_code == 409
        assert "verificación" in exc.value.detail.lower()
        assert "doble causación" in exc.value.detail.lower()

    @pytest.mark.anyio
    async def test_causacion_previa_con_error_no_bloquea(self, monkeypatch):
        """Un intento fallido confirmado ('error') permite reintentar.

        El flujo sigue de largo hasta intentar registrar la causación nueva
        (repo.crear_causacion no existe en el fake) — lo que prueba que el
        candado de idempotencia NO lo detuvo.
        """
        svc = _servicio(monkeypatch, [_causacion("error")])
        with pytest.raises(AttributeError):
            await svc.causar(FACTURA_ID, _causar_in(), None)


class TestCompuertas:
    @pytest.mark.anyio
    async def test_deshabilitado_responde_503(self, monkeypatch):
        svc = _servicio(monkeypatch, [], habilitado=False)
        with pytest.raises(HTTPException) as exc:
            await svc.causar(FACTURA_ID, _causar_in(), None)
        assert exc.value.status_code == 503

    @pytest.mark.anyio
    async def test_sin_credenciales_responde_503(self, monkeypatch):
        svc = _servicio(monkeypatch, [])
        monkeypatch.setattr(settings, "siesa_conni_key", "")
        with pytest.raises(HTTPException) as exc:
            await svc.causar(FACTURA_ID, _causar_in(), None)
        assert exc.value.status_code == 503

    @pytest.mark.anyio
    async def test_descuadre_aritmetico_bloquea_con_400(self, monkeypatch):
        """Regla #11 de punta a punta: el service la aplica vía el builder."""
        svc = _servicio(monkeypatch, [])
        data = _causar_in()
        data.renglones[0].valor_iva = Decimal("999999")  # descuadra vs total
        with pytest.raises(HTTPException) as exc:
            await svc.causar(FACTURA_ID, data, None)
        assert exc.value.status_code == 400
        assert "regla #11" in exc.value.detail


class TestPrefill:
    def test_separar_prefijo_numero(self):
        assert SiesaService._separar_prefijo_numero("FE99001") == ("FE", "99001")
        assert SiesaService._separar_prefijo_numero("FE-99001") == ("FE", "99001")
        assert SiesaService._separar_prefijo_numero("fev 123") == ("FEV", "123")
        assert SiesaService._separar_prefijo_numero("99001") == ("", "99001")
        assert SiesaService._separar_prefijo_numero("SETP990011223") == ("SETP", "990011223")
