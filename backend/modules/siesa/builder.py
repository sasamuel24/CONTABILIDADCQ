"""
Builder del payload FSP (Factura de Servicios) para el importador de
Siesa Connekta (`conectoresimportar`, documento 249608).

Módulo PURO: no toca BD ni red. Recibe los datos ya resueltos (factura
legalizada + datos de decisión del mapeo por proveedor) y devuelve el JSON
de las 5 secciones, aplicando las REGLAS DURAS validadas contra el ERP el
29-jul-2026 (cada una costó una ronda de error real):

 1. Fechas SIEMPRE en AAAAMMDD.
 2. "" no es vacío válido para fechas: 'Fecha de pronto pago de la cuota'
    siempre con fecha real (la de vencimiento).
 3. NIT sin dígito de verificación.
 4. Enviar TODAS las llaves de todas las secciones; las no usadas en "".
 5. CONSEC_DOCTO es solo amarre interno (F_CONSEC_AUTO_REG=1): único por
    envío e idéntico en las 5 secciones; el ERP asigna el número real.
 6. El éxito NO devuelve el consecutivo: recuperarlo por consulta posterior
    (responsabilidad del service en Fase 2, no de este builder).
 7. Cuota propia: campos de cruce en "", NRO_CUOTA_CRUCE="01", Porcentaje=100.
 8. Formatos: ID_MOTIVO máx 2 chars; D_CLASE_IMP_BASE numérico máx 3;
    llaves de impuesto/retención 4 chars alfanuméricos; tasas '000.0000'.
 9. Multi-registro: Impuestos/Retenciones/Movto son arrays; 'Numero de
    registro' enlaza cada impuesto con su renglón del Movto (F320_ROWID).
10. ⚠️ BUG ABIERTO del conector: ID_TERCERO_PROVEEDOR/ID_SUCURSAL_PROVEEDOR
    del Movto rechazan tanto el proveedor real como el vacío. El éxito en QA
    se logró con un tercero DISTINTO (workaround, NO patrón de producción).
    Por eso ambos llegan como parámetros configurables
    (settings.siesa_workaround_tercero_movto / _sucursal_movto): hoy el valor
    del workaround, "" cuando el consultor Siesa arregle el conector.
11. Validación aritmética (regla de este módulo, no del conector):
    base + IVA − retenciones debe cuadrar contra el total de la factura
    (PayableAmount del XML). Si no cuadra → NO se causa y se reporta la
    diferencia. Esta verificación fue la que delató un VLR_RET malo en las
    pruebas manuales.

NOTA TRIBUTARIA: las retenciones que recibe este builder salen de la
parametrización del agente retenedor (siesa_proveedor_config), NUNCA de las
retenciones declaradas por el emisor en el XML DIAN (esas son informativas).
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import re
import time
from typing import Optional

from modules.siesa.constants import CONDICIONES_PAGO

TIPO_DOCTO = "FSP"

# Tolerancia de la validación aritmética (regla #11): 1 peso por redondeos.
TOLERANCIA_CUADRE = Decimal("1")


# =============================================================================
# Datos de entrada
# =============================================================================

@dataclass
class RetencionFSP:
    """Retención parametrizada por Café Quindío para este proveedor."""
    llave: str                      # 4 chars alfanuméricos, ej. '1040'
    tasa: Decimal                   # porcentaje, ej. Decimal('2.5')
    clase_imp_base: str = "2"       # numérico máx 3
    base_minima: Decimal = Decimal("0")


@dataclass
class RenglonFSP:
    """Un renglón de servicio del Movto (con su IVA opcional asociado)."""
    codigo_servicio: str            # ej. 'CS4515-1'
    valor_bruto: Decimal            # base gravable del renglón
    centro_costo: str               # ccosto Siesa, ej. '0502'
    motivo: str                     # máx 2 chars, ej. '51'
    llave_impuesto: Optional[str] = None   # ej. '0010' (requerida si hay IVA)
    tasa_iva: Optional[Decimal] = None     # ej. Decimal('19')
    valor_iva: Decimal = Decimal("0")      # IVA del renglón (del XML, no calculado)
    notas: str = ""
    detalle: str = ""


@dataclass
class DatosCausacionFSP:
    """Todo lo necesario para armar el payload de una causación FSP."""
    nit_proveedor: str              # se normaliza (sin DV) al construir
    sucursal_proveedor: str         # ej. '001'
    tipo_proveedor: str             # ej. '007'
    cond_pago: str                  # ej. '30D'
    fecha_emision: date             # FECHA y fecha del documento proveedor
    prefijo_docto_proveedor: str    # ej. 'FE'
    numero_docto_proveedor: str     # número de la factura del proveedor
    renglones: list[RenglonFSP] = field(default_factory=list)
    retenciones: list[RetencionFSP] = field(default_factory=list)
    total_factura: Decimal = Decimal("0")   # PayableAmount / facturas.total
    notas: str = ""


# =============================================================================
# Helpers de formato (reglas #1, #3, #8)
# =============================================================================

def normalizar_nit(nit: str) -> str:
    """
    Regla #3: NIT sin dígito de verificación.
    Quita puntos/espacios y el sufijo '-DV' si viene con separador explícito.
    No adivina el DV cuando no hay separador (recortar dígitos a ciegas
    corrompería NITs válidos).
    """
    limpio = re.sub(r"[.\s]", "", (nit or "").strip())
    if "-" in limpio:
        limpio = limpio.split("-")[0]
    return limpio


def formatear_fecha(d: date) -> str:
    """Regla #1: fechas SIEMPRE en AAAAMMDD."""
    return d.strftime("%Y%m%d")


def formatear_tasa(valor: Decimal) -> str:
    """Regla #8: tasas y porcentajes en formato '000.0000'."""
    return str(Decimal(valor).quantize(Decimal("0.0001")))


def formatear_monto(valor: Decimal) -> str:
    """Montos en pesos enteros, redondeo comercial (half-up)."""
    return str(Decimal(valor).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def dias_condicion_pago(cond_pago: str) -> Optional[int]:
    """Días de plazo de una condición de pago ('30D'→30, 'CT'/'CON'→0)."""
    cond = (cond_pago or "").strip().upper()
    if cond in CONDICIONES_PAGO:
        return CONDICIONES_PAGO[cond]
    m = re.fullmatch(r"(\d{1,3})D", cond)
    if m:
        return int(m.group(1))
    return None


def generar_amarre() -> str:
    """
    Regla #5: CONSEC_DOCTO es solo amarre interno — único por envío,
    idéntico en las 5 secciones. El ERP recalcula el número real.
    """
    return str(int(time.time()) % 100_000_000)


# =============================================================================
# Validación (previa al envío: si algo falta o no cuadra, NO se causa)
# =============================================================================

def verificar_aritmetica(datos: DatosCausacionFSP) -> dict:
    """
    Regla #11: base + IVA − retenciones debe cuadrar contra el total de la
    factura. Acepta cuadre bruto (base+IVA == total, el caso normal DIAN:
    el emisor no descuenta retenciones del PayableAmount) o cuadre neto
    (base+IVA−ret == total, emisores que sí las descuentan).
    """
    base_total = sum((r.valor_bruto for r in datos.renglones), Decimal("0"))
    iva_total = sum((r.valor_iva for r in datos.renglones), Decimal("0"))
    ret_total = sum(
        (_valor_retencion(ret, base_total) for ret in _retenciones_aplicables(datos.retenciones, base_total)),
        Decimal("0"),
    )
    bruto = base_total + iva_total
    neto = bruto - ret_total
    total = Decimal(datos.total_factura)

    dif_bruto = abs(bruto - total)
    dif_neto = abs(neto - total)
    cuadra = dif_bruto <= TOLERANCIA_CUADRE or dif_neto <= TOLERANCIA_CUADRE

    return {
        "cuadra": cuadra,
        "base_total": base_total,
        "iva_total": iva_total,
        "retenciones_total": ret_total,
        "bruto": bruto,           # base + IVA
        "neto": neto,             # base + IVA − retenciones (valor de la cuota)
        "total_factura": total,
        "diferencia_bruto": bruto - total,
        "diferencia_neto": neto - total,
    }


def validar_datos(datos: DatosCausacionFSP) -> list[str]:
    """
    Devuelve la lista de problemas que impiden causar. Lista vacía = OK.
    El builder se niega a construir un payload con problemas (regla de
    diseño: nunca enviar incompleto para 'ver qué dice el ERP').
    """
    problemas: list[str] = []

    if not normalizar_nit(datos.nit_proveedor):
        problemas.append("Falta el NIT del proveedor.")
    if not (datos.sucursal_proveedor or "").strip():
        problemas.append("Falta la sucursal del proveedor (ID_SUCURSAL_PROV).")
    if not (datos.tipo_proveedor or "").strip():
        problemas.append("Falta el tipo de proveedor Siesa (TIPO_PROV).")
    if dias_condicion_pago(datos.cond_pago) is None:
        problemas.append(
            f"Condición de pago inválida o faltante: '{datos.cond_pago}' "
            "(se espera 30D, CT, CON, etc.)."
        )
    if not isinstance(datos.fecha_emision, date):
        problemas.append("Falta la fecha de emisión de la factura.")
    if not (datos.prefijo_docto_proveedor or "").strip():
        problemas.append("Falta el prefijo del documento del proveedor.")
    numero_docto = (datos.numero_docto_proveedor or "").strip()
    if not numero_docto:
        problemas.append("Falta el número del documento del proveedor.")
    elif len(numero_docto) > 8:
        # Límite real del conector (error observado 12-Ago-2026):
        # "El campo 'NUMERO_DOCTO_PRO' supera el tamaño permitido (8)".
        # No se trunca en silencio: el usuario decide qué 8 caracteres van
        # (p. ej. los últimos del número del proveedor).
        problemas.append(
            f"El número del documento '{numero_docto}' supera los 8 caracteres "
            "que permite el conector (NUMERO_DOCTO_PRO): recortarlo en el modal."
        )
    if not datos.renglones:
        problemas.append("La causación no tiene renglones de servicio.")

    for i, r in enumerate(datos.renglones, start=1):
        if not (r.codigo_servicio or "").strip():
            problemas.append(f"Renglón {i}: falta el código de servicio.")
        if not (r.centro_costo or "").strip():
            problemas.append(f"Renglón {i}: falta el centro de costo Siesa.")
        motivo = (r.motivo or "").strip()
        if not motivo:
            problemas.append(f"Renglón {i}: falta el motivo (ID_MOTIVO).")
        elif len(motivo) > 2:
            problemas.append(
                f"Renglón {i}: ID_MOTIVO '{motivo}' excede 2 caracteres (regla #8)."
            )
        if r.valor_bruto is None or Decimal(r.valor_bruto) <= 0:
            problemas.append(f"Renglón {i}: el valor bruto debe ser mayor que cero.")
        if Decimal(r.valor_iva or 0) > 0:
            if not _llave_valida(r.llave_impuesto):
                problemas.append(
                    f"Renglón {i}: tiene IVA pero la llave de impuesto "
                    f"'{r.llave_impuesto}' no es válida (4 caracteres alfanuméricos)."
                )
            if r.tasa_iva is None:
                problemas.append(f"Renglón {i}: tiene IVA pero falta la tasa.")

    for j, ret in enumerate(datos.retenciones, start=1):
        if not _llave_valida(ret.llave):
            problemas.append(
                f"Retención {j}: llave '{ret.llave}' inválida "
                "(4 caracteres alfanuméricos, regla #8)."
            )
        if ret.tasa is None or Decimal(ret.tasa) <= 0:
            problemas.append(f"Retención {j}: la tasa debe ser mayor que cero.")
        clase = (ret.clase_imp_base or "").strip()
        if not clase.isdigit() or len(clase) > 3:
            problemas.append(
                f"Retención {j}: D_CLASE_IMP_BASE '{clase}' inválida "
                "(numérica, máximo 3 dígitos, regla #8)."
            )

    # LIMITACIÓN TEMPORAL del conector (validada contra el ERP 12-Ago-2026):
    # el documento 249608 exige las secciones Impuestos y Retenciones CON
    # datos. Ni [] ni una fila neutra pasan la capa del plano (registros
    # 321/314: "el dato es obligatorio" en la llave). Hasta que el consultor
    # Siesa configure las secciones como omitibles, las facturas sin IVA o
    # sin retención NO son causables — mejor bloquear aquí con mensaje claro
    # que quemar intentos contra el ERP. Al llegar el ajuste, retirar estas
    # dos validaciones (la fila neutra ya queda lista en construir_payload).
    if datos.renglones and not any(Decimal(r.valor_iva or 0) > 0 for r in datos.renglones):
        problemas.append(
            "La factura no tiene IVA y el conector exige la sección Impuestos "
            "con datos (registro 321) — limitación actual del documento 249608, "
            "pendiente ajuste del consultor Siesa."
        )
    if not datos.retenciones:
        problemas.append(
            "No hay retenciones parametrizadas y el conector exige la sección "
            "Retenciones con datos (registro 314) — limitación actual del "
            "documento 249608, pendiente ajuste del consultor Siesa. "
            "Agregar la retención que aplica Café Quindío en el modal."
        )

    # Regla #11 — solo tiene sentido si lo anterior está completo
    if not problemas:
        cuadre = verificar_aritmetica(datos)
        if not cuadre["cuadra"]:
            problemas.append(
                "No cuadra la aritmética (regla #11): "
                f"base {cuadre['base_total']} + IVA {cuadre['iva_total']} "
                f"= {cuadre['bruto']} (neto tras retenciones: {cuadre['neto']}) "
                f"vs total de la factura {cuadre['total_factura']} — "
                f"diferencia bruto {cuadre['diferencia_bruto']}, "
                f"neto {cuadre['diferencia_neto']}. NO se causa."
            )

    return problemas


def _llave_valida(llave: Optional[str]) -> bool:
    return bool(llave) and bool(re.fullmatch(r"[A-Za-z0-9]{4}", llave.strip()))


def _retenciones_aplicables(retenciones: list[RetencionFSP], base_total: Decimal) -> list[RetencionFSP]:
    """Una retención solo aplica si la base alcanza su base mínima."""
    return [r for r in retenciones if base_total >= Decimal(r.base_minima or 0)]


def _valor_retencion(ret: RetencionFSP, base_total: Decimal) -> Decimal:
    """VLR_RET = base × tasa, redondeo comercial a peso."""
    bruto = base_total * Decimal(ret.tasa) / Decimal("100")
    return bruto.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


# =============================================================================
# Construcción del payload
# =============================================================================

def construir_payload_fsp(
    datos: DatosCausacionFSP,
    amarre: str,
    workaround_tercero_movto: str = "",
    workaround_sucursal_movto: str = "",
) -> dict:
    """
    Arma el JSON de las 5 secciones para `conectoresimportar`.

    Lanza ValueError con la lista de problemas si `validar_datos` encuentra
    alguno — este builder nunca produce un payload inválido a sabiendas.

    `workaround_*_movto`: ver regla #10 (bug abierto del conector). Mientras
    el bug siga vivo deben llegar con el tercero alterno configurado; cuando
    Siesa lo corrija se configuran en "" y el campo viaja vacío.
    """
    problemas = validar_datos(datos)
    if problemas:
        raise ValueError("Causación FSP bloqueada:\n- " + "\n- ".join(problemas))

    nit = normalizar_nit(datos.nit_proveedor)
    fecha = formatear_fecha(datos.fecha_emision)
    dias = dias_condicion_pago(datos.cond_pago)
    fecha_vcto = formatear_fecha(datos.fecha_emision + timedelta(days=dias))
    prefijo = (datos.prefijo_docto_proveedor or "").strip()

    base_total = sum((r.valor_bruto for r in datos.renglones), Decimal("0"))

    # --- Docto. compra servicios (cabecera) ---
    docto = [{
        "_TIPO_DOCTO": TIPO_DOCTO,
        "CONSEC_DOCTO": amarre,
        "FECHA": fecha,
        "Tercero proveedor": nit,
        "NOTAS": datos.notas or "",
        "ID_SUCURSAL_PROV": datos.sucursal_proveedor,
        "TIPO_PROV": datos.tipo_proveedor,
        "Fecha del documento proveedor": fecha,
        "Prefijo del documento proveedor": prefijo,
        "NUMERO_DOCTO_PRO": datos.numero_docto_proveedor,
        "COND_PAGO": datos.cond_pago,
    }]

    # --- Impuestos (uno por renglón con IVA; regla #9: Numero de registro
    #     enlaza con el renglón del Movto) ---
    impuestos = []
    for i, r in enumerate(datos.renglones, start=1):
        if Decimal(r.valor_iva or 0) > 0:
            impuestos.append({
                "TIPO_DOCTO": TIPO_DOCTO,
                "CONSEC_DOCTO": amarre,
                "Numero de registro": str(i),
                "LLAVE_IMPUESTO": r.llave_impuesto.strip(),
                "PORCENTAJE_BASE": "100.0000",
                "TASA": formatear_tasa(r.tasa_iva),
                "Valor impuesto total": formatear_monto(r.valor_iva),
            })

    # --- Retenciones (parametrización propia; base = suma de renglones) ---
    retenciones = []
    for ret in _retenciones_aplicables(datos.retenciones, base_total):
        retenciones.append({
            "Tipo de documento": TIPO_DOCTO,
            "Numero de documento": amarre,
            "Llave de retencion": ret.llave.strip(),
            "PORCENTAJE_BASE": "100.0000",
            "D_CLASE_IMP_BASE": ret.clase_imp_base.strip(),
            "BASE_MIN_MONEDA_DOCTO": formatear_monto(ret.base_minima or Decimal("0")),
            "_TASA": formatear_tasa(ret.tasa),
            "_VLR_BASE": formatear_monto(base_total),
            "VLR_RET": formatear_monto(_valor_retencion(ret, base_total)),
            "_ID_TERCERO_PROVEEDOR": nit,
            "_ID_SUCURSAL_PROVEEDOR": datos.sucursal_proveedor,
            "DOCTO_PROVEEDOR": prefijo,
        })

    # --- Cuotas CxP (cuota propia, regla #7; fechas reales, regla #2) ---
    cuotas = [{
        "ID_TIPO_DOCTO": TIPO_DOCTO,
        "CONSEC_DOCTO": amarre,
        "PREFIJO_CRUCE": "",
        "_CONSEC_DOCTO_CRUCE": "",
        "NRO_CUOTA_CRUCE": "01",
        "VLR_CRUCE": "",
        "Porcentaje de la cuota respecto al total del documento.": "100",
        "FECHA_VCTO": fecha_vcto,
        "Fecha de pronto pago de la cuota": fecha_vcto,
    }]

    # --- Movto. compra servicios (regla #4: todas las llaves; regla #10:
    #     tercero del movto configurable por el bug abierto del conector) ---
    movtos = []
    for i, r in enumerate(datos.renglones, start=1):
        movtos.append({
            "ID_TIPO_DOCTO": TIPO_DOCTO,
            "_CONSEC_DOCTO": amarre,
            "Numero de registro": str(i),
            "ID_TERCERO_PROVEEDOR": workaround_tercero_movto,
            "ID_SUCURSAL_PROVEEDOR": workaround_sucursal_movto,
            "Codigo de servicio": r.codigo_servicio.strip(),
            "ID_MOTIVO": r.motivo.strip(),
            "_ID_CO_MOVTO": "001",
            "D_UN_MOVTO": "",
            "_ID_CCOSTO_MOVTO": r.centro_costo.strip(),
            "DOCTO_PROVEEDOR": prefijo,
            "Valor bruto en moneda del documento.": formatear_monto(r.valor_bruto),
            "_PREFIJO_CRUCE": "",
            "ID_TIPO_DOCTO_CRUCE": "",
            "_NUMERO_DOCTO_CRUCE": "",
            "NRO_CUOTA_CRUCE": "",
            "NOTAS": r.notas or datos.notas or "",
            "DETALLE": r.detalle or "",
        })

    # Regla #4 COMPLETA (dos errores reales el 12-Ago-2026): una sección con
    # lista vacía [] es rechazada ("campo obligatorio no fue enviado"), y en
    # la fila en blanco los campos numéricos/decimales tampoco aceptan ""
    # ("se esperaba un dato numérico/decimal"). Cuando Impuestos o
    # Retenciones no aplican se envía UNA fila neutra: "" en los campos
    # alfanuméricos y 0 (con su formato) EXACTAMENTE en los campos que el
    # validador exigió tipados — no más, para no inventar contrato.
    if not impuestos:
        impuestos = [{
            "TIPO_DOCTO": "",
            "CONSEC_DOCTO": "0",
            "Numero de registro": "0",
            "LLAVE_IMPUESTO": "",
            "PORCENTAJE_BASE": "0.0000",
            "TASA": "",
            "Valor impuesto total": "",
        }]
    if not retenciones:
        retenciones = [{
            "Tipo de documento": "",
            "Numero de documento": "0",
            "Llave de retencion": "",
            "PORCENTAJE_BASE": "0.0000",
            "D_CLASE_IMP_BASE": "0",
            "BASE_MIN_MONEDA_DOCTO": "0",
            "_TASA": "",
            "_VLR_BASE": "",
            "VLR_RET": "",
            "_ID_TERCERO_PROVEEDOR": "",
            "_ID_SUCURSAL_PROVEEDOR": "",
            "DOCTO_PROVEEDOR": "",
        }]

    return {
        "Docto. compra servicios": docto,
        "Impuestos": impuestos,
        "Retenciones": retenciones,
        "Cuotas CxP": cuotas,
        "Movto. compra servicios": movtos,
    }
