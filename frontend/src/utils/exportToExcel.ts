import * as XLSX from 'xlsx';
import type { FacturaListItem } from '../lib/api';

function facturaToRow(factura: FacturaListItem): Record<string, string | number> {
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
    'Total (COP)':          factura.total,
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

function buildResumenPorEstado(facturas: FacturaListItem[]) {
  const mapa = new Map<string, { cantidad: number; total: number }>();
  facturas.forEach(f => {
    const prev = mapa.get(f.estado) ?? { cantidad: 0, total: 0 };
    mapa.set(f.estado, { cantidad: prev.cantidad + 1, total: prev.total + f.total });
  });
  return Array.from(mapa.entries()).map(([estado, data]) => ({
    'Estado':        estado,
    'Cantidad':      data.cantidad,
    'Total (COP)':   data.total,
  }));
}

function buildResumenPorArea(facturas: FacturaListItem[]) {
  const mapa = new Map<string, { cantidad: number; total: number }>();
  facturas.forEach(f => {
    const prev = mapa.get(f.area) ?? { cantidad: 0, total: 0 };
    mapa.set(f.area, { cantidad: prev.cantidad + 1, total: prev.total + f.total });
  });
  return Array.from(mapa.entries()).map(([area, data]) => ({
    'Área':          area,
    'Cantidad':      data.cantidad,
    'Total (COP)':   data.total,
  }));
}

export function exportFacturasToExcel(
  facturas: FacturaListItem[],
  filename = 'informe_facturas'
): void {
  const rows = facturas.map(facturaToRow);

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ancho de columnas
  const colWidths = Object.keys(rows[0] ?? {}).map(key => ({ wch: Math.max(key.length + 4, 18) }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Facturas');

  if (facturas.length > 0) {
    const resumenEstadoSheet = XLSX.utils.json_to_sheet(buildResumenPorEstado(facturas));
    XLSX.utils.book_append_sheet(workbook, resumenEstadoSheet, 'Resumen por Estado');

    const resumenAreaSheet = XLSX.utils.json_to_sheet(buildResumenPorArea(facturas));
    XLSX.utils.book_append_sheet(workbook, resumenAreaSheet, 'Resumen por Área');
  }

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filename}_${fecha}.xlsx`);
}
