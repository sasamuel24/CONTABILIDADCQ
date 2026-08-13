"""
Tests del enriquecimiento Siesa del parser XML DIAN (base, IVA, retenciones).

Contrato central: la extracción es DEFENSIVA. Un XML sin datos de impuestos,
con estructura rara o corrupta jamás rompe el parseo de la factura — los
campos nuevos quedan en None/[] y el flujo vivo sigue igual.
"""
from core.xml_parser import parse_xml_dian


def _attached_document(invoice_inner: str) -> str:
    """Envuelve un Invoice en el sobre AttachedDocument DIAN (con CDATA)."""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<AttachedDocument xmlns="urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>ENV001</cbc:ID>
  <cbc:ParentDocumentID>FE99001</cbc:ParentDocumentID>
  <cbc:IssueDate>2026-07-24</cbc:IssueDate>
  <cac:SenderParty>
    <cac:PartyTaxScheme>
      <cbc:RegistrationName>PROVEEDOR PRUEBA SAS</cbc:RegistrationName>
      <cbc:CompanyID>830026510</cbc:CompanyID>
    </cac:PartyTaxScheme>
  </cac:SenderParty>
  <cac:Attachment>
    <cac:ExternalReference>
      <cbc:Description><![CDATA[{invoice_inner}]]></cbc:Description>
    </cac:ExternalReference>
  </cac:Attachment>
</AttachedDocument>"""


INVOICE_COMPLETO = """<Invoice
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>FE99001</cbc:ID>
  <cbc:IssueDate>2026-07-24</cbc:IssueDate>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>PROVEEDOR PRUEBA SAS</cbc:RegistrationName>
        <cbc:CompanyID>830026510</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:TaxTotal>
    <cbc:TaxAmount>106975.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount>563025.00</cbc:TaxableAmount>
      <cbc:TaxAmount>106975.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>19.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:WithholdingTaxTotal>
    <cbc:TaxAmount>14076.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount>563025.00</cbc:TaxableAmount>
      <cbc:TaxAmount>14076.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>2.50</cbc:Percent>
        <cac:TaxScheme><cbc:ID>06</cbc:ID><cbc:Name>ReteFuente</cbc:Name></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:WithholdingTaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount>563025.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount>563025.00</cbc:TaxExclusiveAmount>
    <cbc:PayableAmount>670000.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>"""


INVOICE_SIN_IMPUESTOS = """<Invoice
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>FE99002</cbc:ID>
  <cbc:IssueDate>2026-07-24</cbc:IssueDate>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount>50000.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>"""


class TestExtraccionImpuestos:
    def test_base_iva_y_retenciones(self):
        datos = parse_xml_dian(_attached_document(INVOICE_COMPLETO))
        assert datos.base_gravable == 563025.0
        assert datos.valor_iva == 106975.0
        assert len(datos.retenciones_xml) == 1
        ret = datos.retenciones_xml[0]
        assert ret["esquema_nombre"] == "ReteFuente"
        assert ret["porcentaje"] == 2.5
        assert ret["base"] == 563025.0
        assert ret["valor"] == 14076.0
        # Lo demás no se afectó
        assert datos.total == 670000.0
        assert datos.numero_factura == "FE99001"
        assert datos.nit_proveedor == "830026510"

    def test_iva_no_suma_retenciones(self):
        """WithholdingTaxTotal jamás debe contaminar valor_iva."""
        datos = parse_xml_dian(_attached_document(INVOICE_COMPLETO))
        assert datos.valor_iva == 106975.0  # no 106975 + 14076


class TestExtraccionDefensiva:
    """La regla de oro: el enriquecimiento nunca tumba la carga."""

    def test_xml_sin_impuestos_carga_igual(self):
        datos = parse_xml_dian(_attached_document(INVOICE_SIN_IMPUESTOS))
        assert datos.numero_factura == "FE99002"
        assert datos.total == 50000.0
        assert datos.base_gravable is None
        assert datos.valor_iva is None
        assert datos.retenciones_xml == []

    def test_invoice_interno_corrupto_usa_datos_del_sobre(self):
        datos = parse_xml_dian(_attached_document("<Invoice><roto"))
        # El sobre exterior salva la carga; los campos nuevos quedan en None
        assert datos.numero_factura == "FE99001"
        assert datos.proveedor == "PROVEEDOR PRUEBA SAS"
        assert datos.base_gravable is None
        assert datos.valor_iva is None
        assert datos.retenciones_xml == []

    def test_impuestos_con_valores_no_numericos(self):
        invoice = INVOICE_COMPLETO.replace("563025.00", "NO-NUMERICO")
        datos = parse_xml_dian(_attached_document(invoice))
        # Se carga la factura; los campos que no parsean quedan en None
        assert datos.numero_factura == "FE99001"
        assert datos.base_gravable is None
