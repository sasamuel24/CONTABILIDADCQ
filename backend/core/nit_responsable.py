"""
Tabla de NITs conocidos con sus responsables de área para enrutamiento de facturas.
Cuando llega una factura por ingesta XML, este módulo se consulta primero.

Valores de keyword: "cedi", "tiendas", "marketing", "mantenimiento", "compras", "comercial"
- Lista de un elemento  → asignación directa (confianza alta si el área existe)
- Lista de múltiples   → requiere confirmación humana (confianza media)
- "tiendas"            → se intenta resolver por ciudad/dirección del XML
"""
from typing import Optional

# NIT → lista de keywords de responsable (en orden de preferencia)
_NIT_RESPONSABLE: dict[str, list[str]] = {
    "901761363":    ["cedi"],
    "901373083":    ["cedi"],
    "890928257":    ["cedi"],
    "860000996":    ["cedi"],
    "900080634":    ["cedi", "marketing"],
    "900040299":    ["tiendas", "cedi"],
    "900718257":    ["cedi"],
    "900277192":    ["cedi"],
    "901731328":    ["cedi"],
    "860530547":    ["cedi"],
    "860016767":    ["cedi"],
    "91440300MA5EM":["cedi"],
    "900083863":    ["cedi"],
    "800245795":    ["cedi"],
    "890904478":    ["cedi", "tiendas"],
    "890800718":    ["cedi"],
    "800045797":    ["cedi"],
    "901037119":    ["cedi"],
    "LU24640654":   ["cedi"],
    "860028580":    ["cedi"],
    "800250778":    ["cedi"],
    "860006127":    ["cedi"],
    "890900608":    ["cedi", "tiendas", "comercial"],
    "805016704":    ["cedi"],
    "901534331":    ["cedi"],
    "900529276":    ["cedi"],
    "860007538":    ["cedi"],
    "860002063":    ["cedi"],
    "900438907":    ["tiendas"],
    "890900424":    ["cedi"],
    "891300241":    ["cedi"],
    "901026869":    ["cedi", "tiendas"],
    "901235670":    ["cedi", "tiendas"],
    "860007955":    ["cedi"],
    "900833934":    ["cedi", "tiendas"],
    "890916575":    ["cedi", "tiendas"],
    "900618834":    ["cedi"],
    "860004922":    ["cedi"],
    "1193389919":   ["cedi"],
    "900973989":    ["cedi"],
    "891903392":    ["cedi"],
    "900813998":    ["mantenimiento", "compras", "cedi"],
    "860524896":    ["cedi"],
    "900208583":    ["cedi", "tiendas"],
    "811006722":    ["cedi"],
    "901597547":    ["cedi", "tiendas"],
    "901554982":    ["cedi", "tiendas"],
}

# Set de NITs para consulta rápida de pertenencia
NITS_CONOCIDOS: frozenset[str] = frozenset(_NIT_RESPONSABLE.keys())


def _normalizar_nit(nit: str) -> str:
    return nit.strip().replace("-", "").replace(" ", "").upper()


def get_responsables_por_nit(nit: str) -> Optional[list[str]]:
    """
    Retorna la lista de keywords de responsable para el NIT dado, o None si no está en la tabla.
    Normaliza el NIT removiendo guiones/espacios antes de buscar.
    """
    if not nit:
        return None
    nit_norm = _normalizar_nit(nit)
    # Intentar con el NIT tal cual (ya normalizado) y también sin ceros a la izquierda
    resultado = _NIT_RESPONSABLE.get(nit_norm)
    if resultado is None:
        # Algunos NITs en BD pueden venir con formato distinto (ej. con dígito verificación)
        # Intentar sin el último dígito si es un NIT colombiano largo
        resultado = _NIT_RESPONSABLE.get(nit_norm.lstrip("0"))
    return resultado


def es_nit_conocido(nit: str) -> bool:
    """Retorna True si el NIT está en la tabla de proveedores conocidos."""
    return get_responsables_por_nit(nit) is not None
