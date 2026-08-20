# Data maestra de retenciones por proveedor — Café Quindío S.A.S. (NIT 900273380-1)

Generado el 2026-08-20 a partir del ERP: `retencion.xls` (maestro de proveedores) cruzado con `exportar (30).xls` (catálogo de Llaves de Retención). Este archivo sirve como contexto para Claude Code o cualquier desarrollador: cópialo junto con los datos a la carpeta `data/` del proyecto.

## Archivos

| Archivo | Contenido | Filas |
|---|---|---|
| `proveedores_retenciones.json` | Un objeto por proveedor con array `retenciones` (formato ideal para una app) | 7.318 proveedores |
| `detalle_retenciones.csv` | Formato largo: una fila por proveedor y retención sujeta, con llave, tarifa y cuenta contable | 1.803 |
| `maestra_proveedores.csv` | Formato ancho: una fila por proveedor con las 5 clases de retención en columnas | 7.318 |
| `catalogo_llaves.csv` / `catalogo_llaves.json` | Catálogo de llaves de retención del ERP | 143 |
| `alertas.csv` | Casos que requieren revisión antes de usar la data en producción | 405 |

## Modelo de datos

- **Proveedor**: identificado por `codigo_nit` (código del ERP, en la práctica el NIT sin dígito de verificación). Atributos: `razon_social`, `tipo_proveedor`, `clase_proveedor`, `condicion_pago`, `ciudad`, `sucursal`.
- **Clases de retención** (columnas del ERP): `ICA` (retención de industria y comercio), `RENTA` (retención en la fuente por renta/compras), `RTECOMIS` (comisiones), `RTEHON` (honorarios), `RTESERV` (servicios).
- **Estado** por clase: `Sujeto a retención` (se aplica), `No sujeto a retención`, `Autoretenedor` (el proveedor se autorretiene, no se le practica), o vacío/`No definido`.
- **Llave**: código del catálogo que define `tarifa_pct` (en porcentaje: 2.5 = 2,5%), `base_minima` (en pesos colombianos: monto mínimo de la transacción a partir del cual se practica la retención; 0 = sin base mínima) y `cuenta_contable` donde se registra.

## Reglas de negocio para la app

1. Al registrar una factura de un proveedor, buscar sus retenciones en `detalle_retenciones` (o el array `retenciones` del JSON) filtrando `estado = "Sujeto a retención"`.
2. Aplicar cada retención solo si la base gravable de la factura es >= `base_minima` de la llave.
3. Valor retenido = base gravable x (`tarifa_pct` / 100).
4. Si el proveedor es `Autoretenedor` en una clase, NO practicarle retención de esa clase.
5. Una llave con formato `"3040 / 3041"` indica llaves duplicadas en el ERP con idéntica tarifa y cuenta; usar cualquiera de las dos, pero confirmar con contabilidad cuál es la vigente.

## Advertencias (ver alertas.csv)

- 365 asignaciones están marcadas `Sujeto a retención` pero **sin llave específica** (aparecen como `(sin llave asignada)` en detalle, con tarifa vacía). La app debe tratarlas como "pendiente de parametrizar", no asumir tarifa.
- 21 códigos de proveedor estaban duplicados en el ERP con configuración distinta; se combinaron tomando el valor definido.
- Los valores de texto conservan la ortografía original del ERP (mayúsculas, abreviaturas).

## Encoding

CSV en UTF-8 con BOM (abren bien en Excel), separador coma. JSON en UTF-8.
