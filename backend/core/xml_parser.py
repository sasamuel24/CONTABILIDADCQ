"""
Parser de XML de facturación electrónica DIAN Colombia.

Formato: AttachedDocument UBL 2.1
La factura real (Invoice) viene embebida como CDATA dentro de
cac:Attachment/cac:ExternalReference/cbc:Description del documento envolvente.
"""
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import date
from typing import Optional
import re


# Namespaces usados por DIAN UBL 2.1
_NS = {
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
    "ad":  "urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2",
    "inv": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
}


@dataclass
class FacturaDIAN:
    """Datos extraídos de un XML de factura electrónica DIAN."""
    numero_factura: str
    proveedor: str
    nit_proveedor: Optional[str] = None
    fecha_emision: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    total: Optional[float] = None
    # Datos útiles para asignar área
    ciudad_receptor: Optional[str] = None
    direccion_receptor: Optional[str] = None
    descripciones_items: list[str] = field(default_factory=list)
    notas: list[str] = field(default_factory=list)
    tipo_documento: Optional[str] = None   # e.g. "35" = tiquete transporte
    info_adicional: dict = field(default_factory=dict)


def _text(element, xpath: str, ns: dict) -> Optional[str]:
    node = element.find(xpath, ns)
    if node is not None and node.text:
        return node.text.strip()
    return None


def _parse_date(raw: Optional[str]) -> Optional[date]:
    if not raw:
        return None
    if raw.startswith("0001"):   # fecha inválida DIAN ("0001-01-01")
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def _parse_total(raw: Optional[str]) -> Optional[float]:
    if not raw:
        return None
    try:
        return float(raw.replace(",", "").strip())
    except ValueError:
        return None


def _find_text_any_ns(root: ET.Element, local_tag: str) -> list[str]:
    """Busca texto en elementos por nombre local, ignorando namespace."""
    results = []
    for el in root.iter():
        tag = el.tag.split("}")[-1] if "}" in el.tag else el.tag
        if tag == local_tag and el.text and el.text.strip():
            results.append(el.text.strip())
    return results


def _parse_invoice_inner(xml_str: str) -> dict:
    """Parsea el XML Invoice interno (el que viene en el CDATA)."""
    try:
        root = ET.fromstring(xml_str.strip())
    except ET.ParseError:
        return {}

    # Namespace real del Invoice (puede variar según proveedor)
    tag = root.tag
    ns_inv = ""
    if "}" in tag:
        ns_inv = tag.split("}")[0].lstrip("{")

    def ns(xpath: str) -> str:
        # Sustituye prefijos estándar por el namespace detectado del Invoice
        return xpath

    ns_map = {
        "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
        "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    }

    result: dict = {}

    # Número de factura
    result["numero_factura"] = _text(root, ".//cbc:ID", ns_map)

    # Fechas
    result["fecha_emision"] = _parse_date(_text(root, "cbc:IssueDate", ns_map))
    result["fecha_vencimiento"] = _parse_date(_text(root, "cbc:DueDate", ns_map))
    if not result["fecha_vencimiento"]:
        result["fecha_vencimiento"] = _parse_date(
            _text(root, ".//cac:PaymentMeans/cbc:PaymentDueDate", ns_map)
        )

    # Proveedor
    result["proveedor"] = _text(
        root, ".//cac:AccountingSupplierParty//cac:PartyName/cbc:Name", ns_map
    ) or _text(
        root, ".//cac:AccountingSupplierParty//cbc:RegistrationName", ns_map
    )
    result["nit_proveedor"] = _text(
        root, ".//cac:AccountingSupplierParty//cbc:CompanyID", ns_map
    )

    # Total
    result["total"] = _parse_total(
        _text(root, ".//cac:LegalMonetaryTotal/cbc:PayableAmount", ns_map)
    )

    # Receptor — ciudad y dirección (pistas para asignar área)
    result["ciudad_receptor"] = _text(
        root, ".//cac:AccountingCustomerParty//cac:Address/cbc:CityName", ns_map
    )
    result["direccion_receptor"] = _text(
        root, ".//cac:AccountingCustomerParty//cac:AddressLine/cbc:Line", ns_map
    )

    # Descripciones de líneas de factura
    items = []
    for item_node in root.findall(".//cac:InvoiceLine/cac:Item/cbc:Description", ns_map):
        if item_node.text and item_node.text.strip():
            items.append(item_node.text.strip())
    result["descripciones_items"] = items

    # Tipo de documento
    result["tipo_documento"] = _text(root, "cbc:InvoiceTypeCode", ns_map)

    # InformacionAdicional (campo libre que algunos proveedores incluyen)
    info_adicional = {}
    current_name = None
    for el in root.iter():
        local = el.tag.split("}")[-1] if "}" in el.tag else el.tag
        if local == "Name" and el.text:
            current_name = el.text.strip()
        elif local == "Value" and el.text and current_name:
            info_adicional[current_name] = el.text.strip()
            current_name = None
    result["info_adicional"] = info_adicional

    return result


def parse_xml_dian(xml_content: str) -> FacturaDIAN:
    """
    Parsea un XML DIAN AttachedDocument y devuelve los datos estructurados.
    Lanza ValueError si el XML no tiene la estructura esperada.
    """
    try:
        outer = ET.fromstring(xml_content.strip())
    except ET.ParseError as e:
        raise ValueError(f"XML mal formado: {e}")

    ns_map = {
        "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
        "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    }

    # --- Datos del sobre exterior (AttachedDocument) ---
    proveedor_outer = _text(
        outer, ".//cac:SenderParty//cbc:RegistrationName", ns_map
    )
    nit_outer = _text(
        outer, ".//cac:SenderParty//cbc:CompanyID", ns_map
    )
    numero_outer = _text(outer, "cbc:ID", ns_map)
    fecha_outer = _parse_date(_text(outer, "cbc:IssueDate", ns_map))

    # --- Invoice interno (embebido como CDATA) ---
    cdata_node = outer.find(
        ".//cac:Attachment/cac:ExternalReference/cbc:Description", ns_map
    )
    inner_data: dict = {}
    if cdata_node is not None and cdata_node.text and cdata_node.text.strip():
        inner_text = cdata_node.text.strip()
        # El CDATA puede contener el <?xml ...> o empezar directo en <Invoice>
        if inner_text.startswith("<?xml"):
            inner_text = re.sub(r"<\?xml[^?]*\?>", "", inner_text, count=1).strip()
        inner_data = _parse_invoice_inner(inner_text)

    # Fusión: el Invoice interno tiene precedencia, el outer llena lo que falte
    numero = inner_data.get("numero_factura") or numero_outer or "SIN-NUMERO"
    proveedor = inner_data.get("proveedor") or proveedor_outer or "SIN-PROVEEDOR"
    nit = inner_data.get("nit_proveedor") or nit_outer
    fecha_emision = inner_data.get("fecha_emision") or fecha_outer
    fecha_vencimiento = inner_data.get("fecha_vencimiento")
    total = inner_data.get("total")
    ciudad_receptor = inner_data.get("ciudad_receptor")
    direccion_receptor = inner_data.get("direccion_receptor")
    descripciones = inner_data.get("descripciones_items", [])
    tipo_documento = inner_data.get("tipo_documento")
    info_adicional = inner_data.get("info_adicional", {})

    if not proveedor or not numero:
        raise ValueError("El XML no contiene proveedor o número de factura válidos")

    return FacturaDIAN(
        numero_factura=numero,
        proveedor=proveedor,
        nit_proveedor=nit,
        fecha_emision=fecha_emision,
        fecha_vencimiento=fecha_vencimiento,
        total=total,
        ciudad_receptor=ciudad_receptor,
        direccion_receptor=direccion_receptor,
        descripciones_items=descripciones,
        tipo_documento=tipo_documento,
        info_adicional=info_adicional,
    )
