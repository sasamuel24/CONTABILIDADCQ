"""
Maestros de Siesa UNOEE relevantes para la causación FSP.

Valores reales tomados de QA (compañía 1) el 29-jul-2026. Son SEEDS para
selects del modal y para poblar `siesa_proveedor_config` — NO se usan en
lógica de negocio (la lógica recibe los códigos ya decididos).

⚠️ Las llaves de impuesto/retención definitivas dependen de la
parametrización tributaria y están pendientes con Contabilidad; las de la
prueba validada fueron impuesto '0010' (IVA 19%) y retención '1040' (2.5%).
"""

# Motivos (grupo 301, compras)
MOTIVOS = {
    "51": "Compras Administración",
    "52": "Compras Ventas",
    "53": "Gastos Gerenciales",
    "73": "Compras Producción",
    "15": "Activos Fijos",
    "17": "Diferidos",
    "90": "Distribución",
}

# Centros de costo activos
CENTROS_COSTO = {
    "0501": "Gerencia General",
    "0502": "Gerencia Financiera",
    "1001": "Gerencia Comercial",
    "1101": "Publicidad",
    "1503": "Planta",
    "1504": "Planta",
    "0801": "Tiendas",
    "1201": "Lotes",
    "1202": "Lotes",
    "1002": "Proyectos",
    "1599": "Generales",
}

# Tipos de proveedor
TIPOS_PROVEEDOR = {
    "005": "Honorarios",
    "006": "Servicios de Mantenimiento",
    "007": "Servicios Técnicos",
    "008": "Arrendamientos",
    "009": "Servicios Públicos",
    "012": "Transportes",
    "015": "Publicidad",
    "021": "Comisiones",
}

# Condiciones de pago (código → días; contado = 0)
CONDICIONES_PAGO = {
    "01D": 1,
    "05D": 5,
    "08D": 8,
    "15D": 15,
    "30D": 30,
    "45D": 45,
    "60D": 60,
    "90D": 90,
    "CT": 0,
    "CON": 0,
}
