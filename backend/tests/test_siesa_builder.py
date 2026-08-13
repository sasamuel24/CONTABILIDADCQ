"""
Tests del builder del payload FSP (modules/siesa/builder.py).

El caso dorado es el JSON EXACTO que creó la primera factura real en QA el
29-jul-2026 tras ~15 capas de errores depuradas. Si un cambio del builder
rompe la igualdad con ese payload, rompe la integración validada.
"""
from datetime import date
from decimal import Decimal

import pytest

from modules.siesa.builder import (
    DatosCausacionFSP,
    RenglonFSP,
    RetencionFSP,
    construir_payload_fsp,
    dias_condicion_pago,
    formatear_fecha,
    formatear_monto,
    formatear_tasa,
    generar_amarre,
    normalizar_nit,
    validar_datos,
    verificar_aritmetica,
)


def _datos_caso_dorado(total=Decimal("670000")) -> DatosCausacionFSP:
    """Datos que reproducen la factura validada en QA el 29-jul-2026."""
    return DatosCausacionFSP(
        nit_proveedor="830026510",
        sucursal_proveedor="001",
        tipo_proveedor="007",
        cond_pago="30D",
        fecha_emision=date(2026, 7, 24),
        prefijo_docto_proveedor="FE",
        numero_docto_proveedor="99001",
        renglones=[
            RenglonFSP(
                codigo_servicio="CS4515-1",
                valor_bruto=Decimal("563025"),
                centro_costo="0502",
                motivo="51",
                llave_impuesto="0010",
                tasa_iva=Decimal("19"),
                valor_iva=Decimal("106975"),
                notas="PRUEBA IMPORTADOR",
            )
        ],
        retenciones=[
            RetencionFSP(llave="1040", tasa=Decimal("2.5"), clase_imp_base="2"),
        ],
        total_factura=total,
        notas="PRUEBA IMPORTADOR",
    )


# El payload EXACTO de la sección 2 del diseño (el que funcionó en el ERP)
PAYLOAD_DORADO = {
    "Docto. compra servicios": [
        {
            "_TIPO_DOCTO": "FSP",
            "CONSEC_DOCTO": "90001",
            "FECHA": "20260724",
            "Tercero proveedor": "830026510",
            "NOTAS": "PRUEBA IMPORTADOR",
            "ID_SUCURSAL_PROV": "001",
            "TIPO_PROV": "007",
            "Fecha del documento proveedor": "20260724",
            "Prefijo del documento proveedor": "FE",
            "NUMERO_DOCTO_PRO": "99001",
            "COND_PAGO": "30D",
        }
    ],
    "Impuestos": [
        {
            "TIPO_DOCTO": "FSP",
            "CONSEC_DOCTO": "90001",
            "Numero de registro": "1",
            "LLAVE_IMPUESTO": "0010",
            "PORCENTAJE_BASE": "100.0000",
            "TASA": "19.0000",
            "Valor impuesto total": "106975",
        }
    ],
    "Retenciones": [
        {
            "Tipo de documento": "FSP",
            "Numero de documento": "90001",
            "Llave de retencion": "1040",
            "PORCENTAJE_BASE": "100.0000",
            "D_CLASE_IMP_BASE": "2",
            "BASE_MIN_MONEDA_DOCTO": "0",
            "_TASA": "2.5000",
            "_VLR_BASE": "563025",
            "VLR_RET": "14076",
            "_ID_TERCERO_PROVEEDOR": "830026510",
            "_ID_SUCURSAL_PROVEEDOR": "001",
            "DOCTO_PROVEEDOR": "FE",
        }
    ],
    "Cuotas CxP": [
        {
            "ID_TIPO_DOCTO": "FSP",
            "CONSEC_DOCTO": "90001",
            "PREFIJO_CRUCE": "",
            "_CONSEC_DOCTO_CRUCE": "",
            "NRO_CUOTA_CRUCE": "01",
            "VLR_CRUCE": "",
            "Porcentaje de la cuota respecto al total del documento.": "100",
            "FECHA_VCTO": "20260823",
            "Fecha de pronto pago de la cuota": "20260823",
        }
    ],
    "Movto. compra servicios": [
        {
            "ID_TIPO_DOCTO": "FSP",
            "_CONSEC_DOCTO": "90001",
            "Numero de registro": "1",
            "ID_TERCERO_PROVEEDOR": "7555488",
            "ID_SUCURSAL_PROVEEDOR": "001",
            "Codigo de servicio": "CS4515-1",
            "ID_MOTIVO": "51",
            "_ID_CO_MOVTO": "001",
            "D_UN_MOVTO": "",
            "_ID_CCOSTO_MOVTO": "0502",
            "DOCTO_PROVEEDOR": "FE",
            "Valor bruto en moneda del documento.": "563025",
            "_PREFIJO_CRUCE": "",
            "ID_TIPO_DOCTO_CRUCE": "",
            "_NUMERO_DOCTO_CRUCE": "",
            "NRO_CUOTA_CRUCE": "",
            "NOTAS": "PRUEBA IMPORTADOR",
            "DETALLE": "",
        }
    ],
}


class TestCasoDorado:
    def test_payload_identico_al_validado_en_qa(self):
        payload = construir_payload_fsp(
            _datos_caso_dorado(),
            amarre="90001",
            workaround_tercero_movto="7555488",
            workaround_sucursal_movto="001",
        )
        assert payload == PAYLOAD_DORADO

    def test_amarre_identico_en_las_5_secciones(self):
        payload = construir_payload_fsp(
            _datos_caso_dorado(), amarre="12345678",
            workaround_tercero_movto="7555488", workaround_sucursal_movto="001",
        )
        assert payload["Docto. compra servicios"][0]["CONSEC_DOCTO"] == "12345678"
        assert payload["Impuestos"][0]["CONSEC_DOCTO"] == "12345678"
        assert payload["Retenciones"][0]["Numero de documento"] == "12345678"
        assert payload["Cuotas CxP"][0]["CONSEC_DOCTO"] == "12345678"
        assert payload["Movto. compra servicios"][0]["_CONSEC_DOCTO"] == "12345678"

    def test_las_5_secciones_siempre_presentes(self):
        payload = construir_payload_fsp(
            _datos_caso_dorado(), amarre="90001",
            workaround_tercero_movto="7555488", workaround_sucursal_movto="001",
        )
        assert set(payload.keys()) == {
            "Docto. compra servicios", "Impuestos", "Retenciones",
            "Cuotas CxP", "Movto. compra servicios",
        }


class TestFormatos:
    def test_fechas_aaaammdd(self):
        assert formatear_fecha(date(2026, 7, 24)) == "20260724"
        assert formatear_fecha(date(2026, 1, 3)) == "20260103"

    def test_tasas_formato_0000(self):
        assert formatear_tasa(Decimal("19")) == "19.0000"
        assert formatear_tasa(Decimal("2.5")) == "2.5000"
        assert formatear_tasa(Decimal("100")) == "100.0000"

    def test_montos_enteros_redondeo_comercial(self):
        assert formatear_monto(Decimal("14075.625")) == "14076"   # half-up
        assert formatear_monto(Decimal("14075.4")) == "14075"
        assert formatear_monto(Decimal("563025")) == "563025"

    def test_nit_sin_dv(self):
        assert normalizar_nit("830026510-5") == "830026510"
        assert normalizar_nit("830.026.510-5") == "830026510"
        assert normalizar_nit(" 830026510 ") == "830026510"
        # Sin separador explícito NO se adivina el DV
        assert normalizar_nit("830026510") == "830026510"

    def test_dias_condicion_pago(self):
        assert dias_condicion_pago("30D") == 30
        assert dias_condicion_pago("CT") == 0
        assert dias_condicion_pago("CON") == 0
        assert dias_condicion_pago("07D") == 7      # patrón genérico
        assert dias_condicion_pago("XXX") is None
        assert dias_condicion_pago("") is None

    def test_fecha_pronto_pago_nunca_vacia(self):
        """Regla #2: '' no es vacío válido para fechas."""
        payload = construir_payload_fsp(
            _datos_caso_dorado(), amarre="90001",
            workaround_tercero_movto="7555488", workaround_sucursal_movto="001",
        )
        cuota = payload["Cuotas CxP"][0]
        assert cuota["Fecha de pronto pago de la cuota"] == cuota["FECHA_VCTO"]
        assert cuota["Fecha de pronto pago de la cuota"] != ""

    def test_amarre_generado_es_valido(self):
        amarre = generar_amarre()
        assert amarre.isdigit()
        assert 1 <= len(amarre) <= 20


class TestMultiRegistro:
    """Regla #9: N renglones × N retenciones desde el día uno."""

    def _datos_multi(self):
        datos = _datos_caso_dorado(total=Decimal("1170000"))
        datos.renglones = [
            RenglonFSP(
                codigo_servicio="CS4515-1", valor_bruto=Decimal("563025"),
                centro_costo="0502", motivo="51",
                llave_impuesto="0010", tasa_iva=Decimal("19"),
                valor_iva=Decimal("106975"),
            ),
            RenglonFSP(  # renglón excluido de IVA
                codigo_servicio="CS9999-1", valor_bruto=Decimal("500000"),
                centro_costo="1001", motivo="52",
            ),
        ]
        datos.retenciones = [
            RetencionFSP(llave="1040", tasa=Decimal("2.5")),                        # ReteFuente
            RetencionFSP(llave="1050", tasa=Decimal("15"), clase_imp_base="3"),     # ReteIVA
            RetencionFSP(llave="1060", tasa=Decimal("0.8"),
                         base_minima=Decimal("99999999")),                          # no alcanza base
        ]
        return datos

    def test_movto_un_registro_por_renglon(self):
        payload = construir_payload_fsp(self._datos_multi(), amarre="90002")
        movtos = payload["Movto. compra servicios"]
        assert len(movtos) == 2
        assert movtos[0]["Numero de registro"] == "1"
        assert movtos[1]["Numero de registro"] == "2"
        assert movtos[1]["_ID_CCOSTO_MOVTO"] == "1001"
        assert movtos[1]["ID_MOTIVO"] == "52"

    def test_impuesto_solo_para_renglones_con_iva_y_enlazado(self):
        payload = construir_payload_fsp(self._datos_multi(), amarre="90002")
        impuestos = payload["Impuestos"]
        assert len(impuestos) == 1
        # Enlaza con el renglón 1 del Movto (F320_ROWID)
        assert impuestos[0]["Numero de registro"] == "1"

    def test_retenciones_multiples_sobre_base_total(self):
        payload = construir_payload_fsp(self._datos_multi(), amarre="90002")
        rets = payload["Retenciones"]
        # La tercera no aplica: base 1_063_025 < base mínima
        assert len(rets) == 2
        assert all(r["_VLR_BASE"] == "1063025" for r in rets)
        assert rets[0]["VLR_RET"] == "26576"    # 1_063_025 × 2.5% = 26575.625 → half-up
        assert rets[1]["VLR_RET"] == "159454"   # 1_063_025 × 15% = 159453.75 → half-up
        assert rets[1]["D_CLASE_IMP_BASE"] == "3"


class TestReglaAritmetica:
    """Regla #11: si no cuadra base + IVA (− retenciones) vs total, NO se causa."""

    def test_cuadre_bruto(self):
        cuadre = verificar_aritmetica(_datos_caso_dorado(total=Decimal("670000")))
        assert cuadre["cuadra"] is True
        assert cuadre["bruto"] == Decimal("670000")
        assert cuadre["neto"] == Decimal("655924")  # 670000 − 14076

    def test_cuadre_neto(self):
        # Emisor que descuenta retenciones del total a pagar
        cuadre = verificar_aritmetica(_datos_caso_dorado(total=Decimal("655924")))
        assert cuadre["cuadra"] is True

    def test_tolerancia_un_peso(self):
        assert verificar_aritmetica(_datos_caso_dorado(total=Decimal("670001")))["cuadra"] is True
        assert verificar_aritmetica(_datos_caso_dorado(total=Decimal("670002")))["cuadra"] is False

    def test_descuadre_bloquea_la_causacion(self):
        datos = _datos_caso_dorado(total=Decimal("660000"))
        with pytest.raises(ValueError) as exc:
            construir_payload_fsp(datos, amarre="90001",
                                  workaround_tercero_movto="7555488",
                                  workaround_sucursal_movto="001")
        assert "regla #11" in str(exc.value)
        assert "NO se causa" in str(exc.value)


class TestValidaciones:
    def test_datos_completos_sin_problemas(self):
        assert validar_datos(_datos_caso_dorado()) == []

    def test_faltantes_reportados_sin_enviar(self):
        datos = _datos_caso_dorado()
        datos.tipo_proveedor = ""
        datos.cond_pago = ""
        datos.renglones[0].codigo_servicio = ""
        problemas = validar_datos(datos)
        assert len(problemas) == 3
        assert any("tipo de proveedor" in p.lower() for p in problemas)
        assert any("condición de pago" in p.lower() for p in problemas)
        assert any("código de servicio" in p.lower() for p in problemas)

    def test_motivo_max_2_chars(self):
        datos = _datos_caso_dorado()
        datos.renglones[0].motivo = "511"
        assert any("2 caracteres" in p for p in validar_datos(datos))

    def test_llave_retencion_4_chars(self):
        datos = _datos_caso_dorado()
        datos.retenciones[0].llave = "10400"
        assert any("Retención 1" in p for p in validar_datos(datos))

    def test_clase_imp_base_numerica(self):
        datos = _datos_caso_dorado()
        datos.retenciones[0].clase_imp_base = "AB"
        assert any("D_CLASE_IMP_BASE" in p for p in validar_datos(datos))

    def test_iva_sin_llave_impuesto(self):
        datos = _datos_caso_dorado()
        datos.renglones[0].llave_impuesto = None
        assert any("llave de impuesto" in p for p in validar_datos(datos))

    def test_sin_renglones(self):
        datos = _datos_caso_dorado()
        datos.renglones = []
        assert any("renglones" in p for p in validar_datos(datos))

    def test_construir_con_problemas_lanza_valueerror(self):
        datos = _datos_caso_dorado()
        datos.nit_proveedor = ""
        with pytest.raises(ValueError):
            construir_payload_fsp(datos, amarre="90001")

    def test_numero_docto_max_8_chars(self):
        """Límite real del conector (error 12-Ago-2026): NUMERO_DOCTO_PRO ≤ 8."""
        datos = _datos_caso_dorado()
        datos.numero_docto_proveedor = "66141204576"  # 11 chars (caso SODIMAC)
        problemas = validar_datos(datos)
        assert any("8 caracteres" in p for p in problemas)
        with pytest.raises(ValueError):
            construir_payload_fsp(datos, amarre="90001")


class TestLimitacionSeccionesObligatorias:
    """
    Limitación TEMPORAL del conector (errores reales del plano 12-Ago-2026,
    registros 321/314): el documento 249608 exige Impuestos y Retenciones con
    datos — ni [] ni fila neutra sobreviven al ERP. El builder bloquea antes
    de enviar. Retirar estos tests cuando el consultor ajuste el conector.
    """

    def _datos_sin_iva_ni_retenciones(self):
        datos = _datos_caso_dorado(total=Decimal("563025"))
        datos.renglones[0].valor_iva = Decimal("0")
        datos.renglones[0].llave_impuesto = None
        datos.renglones[0].tasa_iva = None
        datos.retenciones = []
        return datos

    def test_sin_iva_bloqueado_con_mensaje_claro(self):
        problemas = validar_datos(self._datos_sin_iva_ni_retenciones())
        assert any("registro 321" in p for p in problemas)
        assert any("registro 314" in p for p in problemas)
        with pytest.raises(ValueError):
            construir_payload_fsp(self._datos_sin_iva_ni_retenciones(), amarre="90001")

    def test_con_iva_y_retencion_no_hay_bloqueo(self):
        assert validar_datos(_datos_caso_dorado()) == []


class TestWorkaroundBugConector:
    """Regla #10: el tercero del Movto es configurable, no quemado."""

    def test_workaround_activo(self):
        payload = construir_payload_fsp(
            _datos_caso_dorado(), amarre="90001",
            workaround_tercero_movto="7555488", workaround_sucursal_movto="001",
        )
        movto = payload["Movto. compra servicios"][0]
        assert movto["ID_TERCERO_PROVEEDOR"] == "7555488"
        assert movto["ID_SUCURSAL_PROVEEDOR"] == "001"

    def test_sin_workaround_viaja_vacio(self):
        """Cuando el consultor Siesa arregle el conector: config en ''."""
        payload = construir_payload_fsp(_datos_caso_dorado(), amarre="90001")
        movto = payload["Movto. compra servicios"][0]
        assert movto["ID_TERCERO_PROVEEDOR"] == ""
        assert movto["ID_SUCURSAL_PROVEEDOR"] == ""
