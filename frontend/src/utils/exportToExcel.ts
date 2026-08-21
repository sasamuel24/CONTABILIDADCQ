import * as XLSX from 'xlsx';
import type { FacturaListItem, PaqueteListItem } from '../lib/api';

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
    'Es Activo Fijo':       factura.es_activo_fijo ? 'Sí' : 'No',
    'Sin OC/OS':            factura.sin_oc_os ? 'Sí' : 'No',
    'Sin CC/CO':            factura.sin_ccco ? 'Sí' : 'No',
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

// ---------------------------------------------------------------------------
// Paquetes de gastos (Tesorería)
// ---------------------------------------------------------------------------

const ESTADO_PAQUETE_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_validacion: 'En validación',
  en_revision: 'En revisión',
  devuelto: 'Devuelto',
  aprobado: 'Aprobado',
  en_tesoreria: 'En Tesorería',
  pagado: 'Pagado',
  cruzado: 'Cruzado',
};

function fmtFechaExcel(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-ES');
}

function paqueteToRow(p: PaqueteListItem): Record<string, string | number> {
  const montoAPagar = Number(p.monto_a_pagar ?? p.monto_total);
  return {
    'Folio':                  p.folio ?? '',
    'Semana':                 p.semana ?? '',
    'Fecha Inicio':           fmtFechaExcel(p.fecha_inicio),
    'Fecha Fin':              fmtFechaExcel(p.fecha_fin),
    'Técnico / Responsable':  p.tecnico?.nombre ?? '',
    'Cédula':                 p.tecnico?.cedula ?? '',
    'Email':                  p.tecnico?.email ?? '',
    'Estado':                 ESTADO_PAQUETE_LABEL[p.estado] ?? p.estado,
    'Monto Total (COP)':      Number(p.monto_total),
    'Valor a Pagar (COP)':    montoAPagar,
    'Monto Devuelto (COP)':   Number(p.monto_devuelto ?? 0),
    'Documentos':             p.total_documentos,
    'Enviado a Tesorería':    fmtFechaExcel(p.fecha_envio_tesoreria),
    'Fecha Cruce':            fmtFechaExcel(p.fecha_cruce),
    'Última Actualización':   fmtFechaExcel(p.updated_at),
  };
}

function buildResumenPaquetesPorEstado(paquetes: PaqueteListItem[]) {
  const mapa = new Map<string, { cantidad: number; total: number; aPagar: number }>();
  paquetes.forEach(p => {
    const label = ESTADO_PAQUETE_LABEL[p.estado] ?? p.estado;
    const prev = mapa.get(label) ?? { cantidad: 0, total: 0, aPagar: 0 };
    mapa.set(label, {
      cantidad: prev.cantidad + 1,
      total: prev.total + Number(p.monto_total),
      aPagar: prev.aPagar + Number(p.monto_a_pagar ?? p.monto_total),
    });
  });
  return Array.from(mapa.entries()).map(([estado, data]) => ({
    'Estado':               estado,
    'Cantidad':             data.cantidad,
    'Monto Total (COP)':    data.total,
    'Valor a Pagar (COP)':  data.aPagar,
  }));
}

export function exportPaquetesTesoreriaToExcel(
  paquetes: PaqueteListItem[],
  filename = 'informe_paquetes_gastos'
): void {
  const rows = paquetes.map(paqueteToRow);

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] ?? {}).map(key => ({ wch: Math.max(key.length + 4, 16) }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Paquetes');

  if (paquetes.length > 0) {
    const resumenSheet = XLSX.utils.json_to_sheet(buildResumenPaquetesPorEstado(paquetes));
    XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen por Estado');
  }

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filename}_${fecha}.xlsx`);
}
