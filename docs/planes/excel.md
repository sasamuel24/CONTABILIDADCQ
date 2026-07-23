# Plan de Implementación: Exportar Informe a Excel
## Vista: Centro Documental (`CentroDocumentalPage.tsx`)
**Fecha:** 2026-03-09

---

## Objetivo

Agregar un botón **"Exportar a Excel"** en la vista de Centro Documental que permita a la Directora de Contabilidad descargar un archivo `.xlsx` con todas las facturas actualmente visibles en la tabla (respetando los filtros activos).

---

## Librería a Utilizar

**SheetJS (xlsx)** — la librería estándar para generar archivos Excel desde el navegador sin necesidad de backend.

- Paquete npm: `xlsx`
- Peso: ~1MB (solo se carga cuando se usa)
- Genera archivos `.xlsx` nativos que abren correctamente en Excel

---

## Paso 1 — Instalar la dependencia

```bash
cd C:\desarollos\CONTABILIDADCQ\frontend
npm install xlsx
```

Verificar que se agrega en `package.json` bajo `dependencies`.

---

## Paso 2 — Crear el utility `exportToExcel.ts`

**Archivo:** `src/utils/exportToExcel.ts`

Este archivo centraliza toda la lógica de exportación para que sea reutilizable en otras vistas.

### Estructura del archivo

```typescript
import * as XLSX from 'xlsx';
import type { FacturaListItem } from '../lib/api';

/**
 * Transforma un FacturaListItem al formato de fila para Excel.
 * Convierte campos técnicos a valores legibles por humanos.
 */
function facturaToRow(factura: FacturaListItem): Record<string, string | number | boolean> {
  return {
    'Número Factura':       factura.numero_factura,
    'Proveedor':            factura.proveedor,
    'Área':                 factura.area,
    'Estado':               factura.estado,
    'Fecha Emisión':        factura.fecha_emision
                              ? new Date(factura.fecha_emision).toLocaleDateString('es-ES')
                              : '',
    'Fecha Vencimiento':    factura.fecha_vencimiento
                              ? new Date(factura.fecha_vencimiento).toLocaleDateString('es-ES')
                              : '',
    'Total (MXN)':          factura.total,
    'Centro de Costo':      factura.centro_costo ?? '',
    'Centro de Operación':  factura.centro_operacion ?? '',
    'Unidad de Negocio':    factura.unidad_negocio ?? '',
    'Cuenta Auxiliar':      factura.cuenta_auxiliar ?? '',
    'Destino':              factura.destino_inventarios ?? '',
    'Requiere Inventarios': factura.requiere_entrada_inventarios ? 'Sí' : 'No',
    'Tiene Anticipo':       factura.tiene_anticipo ? 'Sí' : 'No',
    '% Anticipo':           factura.porcentaje_anticipo ?? '',
    'Es Gasto ADM':         factura.es_gasto_adm ? 'Sí' : 'No',
    'Presenta Novedad':     factura.presenta_novedad ? 'Sí' : 'No',
    'Carpeta Contabilidad': factura.carpeta?.nombre ?? 'Sin asignar',
    'Carpeta Tesorería':    factura.carpeta_tesoreria?.nombre ?? 'Sin asignar',
    'Motivo Devolución':    factura.motivo_devolucion ?? '',
    'Archivos Adjuntos':    factura.files.length,
  };
}

/**
 * Genera y descarga un archivo Excel con las facturas proporcionadas.
 * @param facturas  - Array de facturas (ya filtradas y ordenadas)
 * @param filename  - Nombre del archivo sin extensión
 */
export function exportFacturasToExcel(
  facturas: FacturaListItem[],
  filename = 'informe_facturas'
): void {
  // 1. Convertir cada factura a una fila
  const rows = facturas.map(facturaToRow);

  // 2. Crear hoja de trabajo desde el array de objetos
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 3. Ajustar anchos de columna automáticamente
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.max(key.length, 18),
  }));
  worksheet['!cols'] = colWidths;

  // 4. Crear libro de trabajo con dos hojas
  const workbook = XLSX.utils.book_new();

  // Hoja 1: Detalle completo
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Facturas');

  // Hoja 2: Resumen por estado
  const resumenPorEstado = buildResumenPorEstado(facturas);
  const resumenSheet = XLSX.utils.json_to_sheet(resumenPorEstado);
  XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen por Estado');

  // Hoja 3: Resumen por área
  const resumenPorArea = buildResumenPorArea(facturas);
  const areaSheet = XLSX.utils.json_to_sheet(resumenPorArea);
  XLSX.utils.book_append_sheet(workbook, areaSheet, 'Resumen por Área');

  // 5. Generar nombre con fecha actual
  const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const finalFilename = `${filename}_${fecha}.xlsx`;

  // 6. Descargar el archivo
  XLSX.writeFile(workbook, finalFilename);
}

/** Agrupación de totales por estado */
function buildResumenPorEstado(facturas: FacturaListItem[]) {
  const mapa = new Map<string, { cantidad: number; total: number }>();
  facturas.forEach(f => {
    const prev = mapa.get(f.estado) ?? { cantidad: 0, total: 0 };
    mapa.set(f.estado, {
      cantidad: prev.cantidad + 1,
      total:    prev.total + f.total,
    });
  });
  return Array.from(mapa.entries()).map(([estado, data]) => ({
    Estado:          estado,
    'Cantidad':      data.cantidad,
    'Total (MXN)':   data.total,
  }));
}

/** Agrupación de totales por área */
function buildResumenPorArea(facturas: FacturaListItem[]) {
  const mapa = new Map<string, { cantidad: number; total: number }>();
  facturas.forEach(f => {
    const prev = mapa.get(f.area) ?? { cantidad: 0, total: 0 };
    mapa.set(f.area, {
      cantidad: prev.cantidad + 1,
      total:    prev.total + f.total,
    });
  });
  return Array.from(mapa.entries()).map(([area, data]) => ({
    Área:           area,
    'Cantidad':     data.cantidad,
    'Total (MXN)':  data.total,
  }));
}
```

---

## Paso 3 — Agregar el botón en `CentroDocumentalPage.tsx`

### 3.1 Importar el utility

```tsx
// Al inicio del archivo, junto al resto de imports
import { exportFacturasToExcel } from '../utils/exportToExcel';
```

### 3.2 Agregar el ícono de descarga

En la línea 2, agregar `Download` al import de lucide-react:

```tsx
import { Search, ChevronLeft, ChevronRight, FileText, Calendar,
  DollarSign, Building2, Activity, LogOut, FileBarChart,
  FolderInput, Download } from 'lucide-react';
```

### 3.3 Agregar estado de carga para el export

```tsx
// Junto al resto de useState (línea ~17)
const [isExporting, setIsExporting] = useState(false);
```

### 3.4 Crear el handler de exportación

```tsx
// Después de handleLogout (~línea 190)
const handleExportExcel = async () => {
  if (sortedFacturas.length === 0) return;
  setIsExporting(true);
  try {
    // Construir nombre descriptivo según filtros activos
    let nombre = 'informe_facturas';
    if (selectedCarpeta) nombre += `_${selectedCarpeta.nombre.replace(/\s+/g, '_')}`;
    if (selectedArea !== 'Todas') nombre += `_${selectedArea.replace(/\s+/g, '_')}`;
    if (selectedEstado !== 'Todos') nombre += `_${selectedEstado.replace(/\s+/g, '_')}`;

    exportFacturasToExcel(sortedFacturas, nombre);
  } finally {
    setIsExporting(false);
  }
};
```

### 3.5 Insertar el botón en la UI

En el header de la tabla (cerca de la línea 371-378), junto al contador "Facturas (N)":

```tsx
{/* Header de la tabla con contador */}
<div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
  <h2 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}}
      className="text-lg font-semibold text-gray-900">
    Facturas ({sortedFacturas.length})
  </h2>

  <div className="flex items-center gap-3">
    {/* Rango visible */}
    <div className="text-sm text-gray-500">
      Mostrando {startIndex + 1}–{Math.min(startIndex + itemsPerPage, sortedFacturas.length)} de {sortedFacturas.length}
    </div>

    {/* Botón Exportar */}
    {sortedFacturas.length > 0 && (
      <button
        onClick={handleExportExcel}
        disabled={isExporting}
        style={{
          backgroundColor: isExporting ? '#9ca3af' : '#00829a',
          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isExporting)
            e.currentTarget.style.backgroundColor = '#14aab8';
        }}
        onMouseLeave={(e) => {
          if (!isExporting)
            e.currentTarget.style.backgroundColor = '#00829a';
        }}
        className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg disabled:cursor-not-allowed"
        title="Exportar tabla actual a Excel"
      >
        <Download className="w-4 h-4" />
        {isExporting ? 'Generando...' : 'Exportar Excel'}
      </button>
    )}
  </div>
</div>
```

---

## Paso 4 — Verificar tipos en TypeScript

Asegurarse de que el archivo `src/utils/exportToExcel.ts` no genere errores de TypeScript.

Si SheetJS no incluye tipos, instalar:

```bash
npm install --save-dev @types/xlsx
```

> Nota: Las versiones modernas de `xlsx` ya incluyen sus propios tipos, así que este paso puede no ser necesario.

---

## Estructura del Excel Resultante

El archivo descargado tendrá el nombre:

```
informe_facturas_[carpeta]_[area]_[estado]_2026-03-09.xlsx
```

Y contendrá **3 hojas**:

| Hoja | Contenido |
|------|-----------|
| **Facturas** | Una fila por factura con todos los campos de la tabla más campos adicionales |
| **Resumen por Estado** | Agrupación: Estado / Cantidad / Total MXN |
| **Resumen por Área** | Agrupación: Área / Cantidad / Total MXN |

### Columnas de la Hoja "Facturas"

| Columna | Campo fuente |
|---------|-------------|
| Número Factura | `numero_factura` |
| Proveedor | `proveedor` |
| Área | `area` |
| Estado | `estado` |
| Fecha Emisión | `fecha_emision` (formateada) |
| Fecha Vencimiento | `fecha_vencimiento` (formateada) |
| Total (MXN) | `total` (numérico) |
| Centro de Costo | `centro_costo` |
| Centro de Operación | `centro_operacion` |
| Unidad de Negocio | `unidad_negocio` |
| Cuenta Auxiliar | `cuenta_auxiliar` |
| Destino | `destino_inventarios` |
| Requiere Inventarios | `requiere_entrada_inventarios` → Sí/No |
| Tiene Anticipo | `tiene_anticipo` → Sí/No |
| % Anticipo | `porcentaje_anticipo` |
| Es Gasto ADM | `es_gasto_adm` → Sí/No |
| Presenta Novedad | `presenta_novedad` → Sí/No |
| Carpeta Contabilidad | `carpeta.nombre` |
| Carpeta Tesorería | `carpeta_tesoreria.nombre` |
| Motivo Devolución | `motivo_devolucion` |
| Archivos Adjuntos | `files.length` (conteo) |

---

## Comportamiento Esperado

1. La directora aplica filtros (por área, estado, fechas, carpeta, búsqueda).
2. La tabla muestra las facturas filtradas.
3. Hace clic en **"Exportar Excel"**.
4. El botón muestra "Generando..." mientras procesa.
5. Se descarga automáticamente un archivo `.xlsx` con el nombre descriptivo.
6. El archivo abre en Excel con 3 hojas: Facturas, Resumen por Estado, Resumen por Área.
7. **El export respeta exactamente los filtros activos** — solo exporta lo que está visible en pantalla.

---

## Archivos a Modificar / Crear

| Acción | Archivo |
|--------|---------|
| **Crear** | `src/utils/exportToExcel.ts` |
| **Modificar** | `src/pages/CentroDocumentalPage.tsx` |
| **Instalar** | `npm install xlsx` |

---

## Notas de Implementación

- **Sin backend necesario**: Todo el procesamiento ocurre en el navegador con SheetJS.
- **Performance**: Con hasta 10,000 facturas (el límite actual de `getFacturas(0, 10000)`), SheetJS genera el archivo en < 1 segundo.
- **El export usa `sortedFacturas`** (ya filtrado y ordenado), no `paginatedFacturas`, por lo que exporta TODAS las filas filtradas, no solo la página actual.
- La columna `Total (MXN)` se guarda como número (no texto) para que Excel pueda hacer sumas/promedios.

---

## Orden de Implementación

1. `npm install xlsx`
2. Crear `src/utils/exportToExcel.ts`
3. Modificar `CentroDocumentalPage.tsx`:
   - Agregar import del utility
   - Agregar `Download` al import de lucide-react
   - Agregar `useState` para `isExporting`
   - Agregar `handleExportExcel`
   - Reemplazar el div del header de la tabla con la versión que incluye el botón
4. Probar en dev con `npm run dev`
