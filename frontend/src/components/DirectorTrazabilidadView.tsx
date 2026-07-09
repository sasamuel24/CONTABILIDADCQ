import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  RefreshCw,
  Loader2,
  PackageOpen,
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  History,
  Receipt,
} from 'lucide-react';
import {
  listPaquetesGastos,
  getPaqueteGasto,
  type PaqueteListItem,
  type PaqueteOut,
  type EstadoPaquete,
} from '../lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMonto(v: number | string) {
  return `$ ${Number(v).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${meses[Number(m) - 1]} ${y}`;
}

function fmtFechaHora(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatSemanaLabel(semana: string | null | undefined) {
  if (!semana) return 'Sin semana';
  const match = semana.match(/^(\d{4})-W(\d+)$/);
  if (!match) return semana;
  return `Semana ${parseInt(match[2], 10)} — ${match[1]}`;
}

// ---------------------------------------------------------------------------
// Configuración de estados (los 7 del flujo) y tipos de flujo
// ---------------------------------------------------------------------------

const ESTADOS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  borrador:      { label: 'Borrador',      bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
  en_validacion: { label: 'En validación', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  en_revision:   { label: 'En revisión',   bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  devuelto:      { label: 'Devuelto',      bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  aprobado:      { label: 'Aprobado',      bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  en_tesoreria:  { label: 'En Tesorería',  bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' },
  pagado:        { label: 'Pagado',        bg: '#f0fdf4', color: '#065f46', border: '#6ee7b7' },
};

const TIPO_FLUJO_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  mantenimiento:     { label: 'Mantenimiento',       bg: '#e0f5f7', color: '#00829a', border: '#b2e0e8' },
  general:           { label: 'General (Caja Menor)', bg: '#fef9c3', color: '#a16207', border: '#fde68a' },
  tarjeta_cq:        { label: 'Tarjeta CQ',           bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' },
  tarjeta_comercial: { label: 'Tarjeta Comercial',    bg: '#ffe4e6', color: '#be123c', border: '#fecdd3' },
};

function EstadoBadgePaquete({ estado }: { estado: string }) {
  const cfg = ESTADOS_CONFIG[estado] ?? ESTADOS_CONFIG['borrador'];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
    >
      {cfg.label}
    </span>
  );
}

function TipoFlujoBadge({ tipo }: { tipo: string }) {
  const cfg = TIPO_FLUJO_CONFIG[tipo] ?? TIPO_FLUJO_CONFIG['mantenimiento'];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pipeline visual del estado (adaptado a los 7 estados snake_case)
// ---------------------------------------------------------------------------

function PipelineEstadoDirector({ estado }: { estado: EstadoPaquete }) {
  const pasos = [
    { key: 'borrador',      label: 'Borrador' },
    { key: 'en_validacion', label: 'Validación' },
    { key: 'en_revision',   label: 'Revisión' },
    { key: 'aprobado',      label: 'Aprobado' },
    { key: 'en_tesoreria',  label: 'Tesorería' },
    { key: 'pagado',        label: 'Pagado' },
  ];

  const indexActual =
    estado === 'borrador'      ? 0 :
    estado === 'en_validacion' ? 1 :
    estado === 'en_revision'   ? 2 :
    estado === 'devuelto'      ? 2 :
    estado === 'aprobado'      ? 3 :
    estado === 'en_tesoreria'  ? 4 : 5;

  return (
    <div className="flex items-center w-full">
      {pasos.map((paso, i) => {
        const activo     = i === indexActual && estado !== 'devuelto';
        const completado = i < indexActual;
        const devuelto   = estado === 'devuelto' && i === 2;

        return (
          <div key={paso.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center" style={{ minWidth: 52 }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm"
                style={{
                  backgroundColor: devuelto ? '#fee2e2' : activo ? '#00829a' : completado ? '#bbf7d0' : '#f3f4f6',
                  color: devuelto ? '#dc2626' : activo ? '#fff' : completado ? '#15803d' : '#9ca3af',
                  border: activo ? '2px solid #00829a' : devuelto ? '2px solid #dc2626' : '2px solid transparent',
                }}
              >
                {devuelto
                  ? <RotateCcw className="w-3.5 h-3.5" />
                  : (completado || activo)
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : i + 1}
              </div>
              <span
                className="text-xs mt-1.5 text-center leading-tight"
                style={{
                  fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                  color: devuelto ? '#dc2626' : activo ? '#00829a' : completado ? '#15803d' : '#9ca3af',
                  fontWeight: activo || devuelto ? 700 : 400,
                }}
              >
                {devuelto ? 'Devuelto' : paso.label}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div
                className="h-0.5 flex-1 mx-1 rounded-full"
                style={{ backgroundColor: i < indexActual ? '#bbf7d0' : '#e5e7eb' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detalle de paquete — SOLO LECTURA (Director Contable)
// ---------------------------------------------------------------------------

function DetallePaqueteDirector({ paqueteId, onCerrar }: { paqueteId: string; onCerrar: () => void }) {
  const [paquete, setPaquete] = useState<PaqueteOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      try {
        const p = await getPaqueteGasto(paqueteId);
        if (!cancelado) setPaquete(p);
      } catch {
        if (!cancelado) toast.error('Error al cargar el detalle del paquete');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [paqueteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
      </div>
    );
  }

  if (!paquete) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <PackageOpen className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>No se pudo cargar el paquete</p>
      </div>
    );
  }

  const historialOrdenado = [...paquete.historial_estados].sort(
    (a, b) => b.created_at.localeCompare(a.created_at)
  );

  const hitos: { label: string; fecha: string | null }[] = [
    { label: 'Enviado a revisión', fecha: paquete.fecha_envio },
    { label: 'Enviado a gerencia', fecha: paquete.fecha_envio_gerencia },
    { label: 'Aprobado', fecha: paquete.fecha_aprobacion },
    { label: 'Pagado', fecha: paquete.fecha_pago },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Volver */}
      <div>
        <button
          onClick={onCerrar}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors"
          style={{ color: '#00829a', borderColor: '#b2e0e8', backgroundColor: '#e0f5f7', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a trazabilidad
        </button>
      </div>

      {/* Cabecera del paquete */}
      <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-bold" style={{ color: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                {paquete.folio ?? formatSemanaLabel(paquete.semana)}
              </h3>
              <EstadoBadgePaquete estado={paquete.estado} />
              <TipoFlujoBadge tipo={paquete.tipo_flujo} />
            </div>
            <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              {formatSemanaLabel(paquete.semana)} · {fmtFecha(paquete.fecha_inicio)} al {fmtFecha(paquete.fecha_fin)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Valor a pagar</p>
            <p className="text-2xl font-bold" style={{ color: '#0e7490', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
              {fmtMonto(paquete.monto_a_pagar ?? paquete.monto_total)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              Monto total: {fmtMonto(paquete.monto_total)} · {paquete.total_documentos} documento{paquete.total_documentos !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Pipeline */}
        <div className="mb-6">
          <PipelineEstadoDirector estado={paquete.estado} />
        </div>

        {/* Datos generales */}
        <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Creado por</p>
            <p className="text-sm text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              {paquete.tecnico?.nombre ?? '—'}
            </p>
            <p className="text-xs text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>{paquete.tecnico?.email ?? ''}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Área</p>
            <p className="text-sm text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>{paquete.area?.nombre ?? '—'}</p>
          </div>
          {paquete.comercial_hijo && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Comercial (hijo)</p>
              <p className="text-sm text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>{paquete.comercial_hijo.nombre}</p>
            </div>
          )}
          {paquete.aprobador && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Aprobador de gerencia</p>
              <p className="text-sm text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                {paquete.aprobador.nombre}{paquete.aprobador.cargo ? ` · ${paquete.aprobador.cargo}` : ''}
              </p>
            </div>
          )}
          {paquete.revisado_por && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Revisado por</p>
              <p className="text-sm text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>{paquete.revisado_por.nombre}</p>
            </div>
          )}
          {hitos.filter(h => h.fecha).map(h => (
            <div key={h.label}>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>{h.label}</p>
              <p className="text-sm text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>{fmtFechaHora(h.fecha)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Línea de tiempo de auditoría */}
      <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4" style={{ color: '#00829a' }} />
          <p className="text-xs text-gray-400 uppercase tracking-wide" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            Línea de tiempo — cambios de estado
          </p>
        </div>
        {historialOrdenado.length === 0 ? (
          <p className="text-sm text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            Sin movimientos registrados todavía.
          </p>
        ) : (
          <div className="flex flex-col">
            {historialOrdenado.map((h, idx) => {
              const cfg = ESTADOS_CONFIG[h.estado_nuevo] ?? ESTADOS_CONFIG['borrador'];
              const cfgAnterior = h.estado_anterior ? (ESTADOS_CONFIG[h.estado_anterior] ?? ESTADOS_CONFIG['borrador']) : null;
              return (
                <div key={h.id} className="flex gap-3">
                  {/* Punto + línea vertical */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-3 h-3 rounded-full mt-1.5"
                      style={{ backgroundColor: cfg.color, border: `2px solid ${cfg.border}`, flexShrink: 0 }}
                    />
                    {idx < historialOrdenado.length - 1 && (
                      <div className="w-0.5 flex-1" style={{ backgroundColor: '#e5e7eb', minHeight: 24 }} />
                    )}
                  </div>
                  <div className="pb-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {cfgAnterior && (
                        <>
                          <span className="text-xs font-semibold" style={{ color: cfgAnterior.color, fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                            {cfgAnterior.label}
                          </span>
                          <span className="text-xs text-gray-400">→</span>
                        </>
                      )}
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                      {h.user?.nombre ?? 'Sistema'} · {fmtFechaHora(h.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial de observaciones */}
      {paquete.comentarios.length > 0 && (
        <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-4" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            Historial de observaciones
          </p>
          <div className="flex flex-col gap-3">
            {paquete.comentarios.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{
                  backgroundColor: c.tipo === 'devolucion' ? '#fef2f2' : c.tipo === 'aprobacion' ? '#f0fdf4' : '#f9fafb',
                  border: `1px solid ${c.tipo === 'devolucion' ? '#fecaca' : c.tipo === 'aprobacion' ? '#bbf7d0' : '#e5e7eb'}`,
                }}
              >
                <div className="flex-1">
                  <p className="text-sm text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>{c.texto}</p>
                  <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                    {c.user?.nombre ?? 'Sistema'} · {fmtFechaHora(c.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gastos del paquete (solo lectura) */}
      <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-4 h-4" style={{ color: '#00829a' }} />
          <p className="text-xs text-gray-400 uppercase tracking-wide" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            Gastos del paquete ({paquete.gastos.length})
          </p>
        </div>
        {paquete.gastos.length === 0 ? (
          <p className="text-sm text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Sin gastos registrados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  {['Fecha', 'Pagado a', 'Concepto', 'No. recibo', 'Valor'].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-semibold text-gray-500 whitespace-nowrap"
                      style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 12 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paquete.gastos.map((g, idx) => (
                  <tr key={g.id} className="border-t border-gray-100" style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', fontSize: 13 }}>
                      {fmtFecha(g.fecha)}
                    </td>
                    <td className="px-4 py-2 text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', fontSize: 13 }}>
                      {g.pagado_a}
                    </td>
                    <td className="px-4 py-2 text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', fontSize: 13 }}>
                      {g.concepto}
                      {g.estado_gasto === 'devuelto' && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                          Devuelto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', fontSize: 13 }}>
                      {g.no_recibo ?? '—'}
                    </td>
                    <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 13 }}>
                      {fmtMonto(g.valor_pagado)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-gray-500" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                    Total
                  </td>
                  <td className="px-4 py-2 font-bold whitespace-nowrap" style={{ color: '#0e7490', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', fontSize: 13 }}>
                    {fmtMonto(paquete.monto_total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista principal — Trazabilidad de legalizaciones (Director Contable)
// ---------------------------------------------------------------------------

export function DirectorTrazabilidadView() {
  const [paquetes, setPaquetes] = useState<PaqueteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipoFlujo, setFiltroTipoFlujo] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [paqueteDetalleId, setPaqueteDetalleId] = useState<string | null>(null);
  const FILAS_POR_PAGINA = 15;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // El backend acepta máximo 200 por llamada; paginamos hasta obtener todos
      const PAGE = 200;
      let skip = 0;
      let acumulados: PaqueteListItem[] = [];
      let total = Infinity;
      while (acumulados.length < total) {
        const res = await listPaquetesGastos({ skip, limit: PAGE });
        total = res.total;
        acumulados = [...acumulados, ...res.paquetes];
        if (res.paquetes.length < PAGE) break;
        skip += PAGE;
      }
      setPaquetes(acumulados);
    } catch {
      toast.error('Error al cargar la trazabilidad de legalizaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const hayFiltros = Boolean(filtroNombre || filtroEstado || filtroTipoFlujo || fechaDesde || fechaHasta);

  const limpiarFiltros = () => {
    setFiltroNombre('');
    setFiltroEstado('');
    setFiltroTipoFlujo('');
    setFechaDesde('');
    setFechaHasta('');
    setPagina(1);
  };

  const lista = paquetes
    .filter(p => !filtroEstado || p.estado === filtroEstado)
    .filter(p => !filtroTipoFlujo || p.tipo_flujo === filtroTipoFlujo)
    // El periodo del paquete se solapa con el rango de fechas escogido
    .filter(p => !fechaDesde || p.fecha_fin >= fechaDesde)
    .filter(p => !fechaHasta || p.fecha_inicio <= fechaHasta)
    .filter(p => {
      const q = filtroNombre.trim().toLowerCase();
      if (!q) return true;
      return (
        (p.tecnico?.nombre ?? '').toLowerCase().includes(q) ||
        (p.comercial_hijo?.nombre ?? '').toLowerCase().includes(q) ||
        (p.folio ?? '').toLowerCase().includes(q) ||
        (p.semana ?? '').toLowerCase().includes(q)
      );
    });

  const totalPaginas = Math.max(1, Math.ceil(lista.length / FILAS_POR_PAGINA));
  const paginaClamped = Math.min(pagina, totalPaginas);
  const listaPagina = lista.slice((paginaClamped - 1) * FILAS_POR_PAGINA, paginaClamped * FILAS_POR_PAGINA);

  const conteoEstados = paquetes.reduce<Record<string, number>>((acc, p) => {
    acc[p.estado] = (acc[p.estado] ?? 0) + 1;
    return acc;
  }, {});

  // Vista detalle solo lectura
  if (paqueteDetalleId) {
    return <DetallePaqueteDirector paqueteId={paqueteDetalleId} onCerrar={() => setPaqueteDetalleId(null)} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            Trazabilidad de Legalizaciones
          </h2>
          <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            Cajas menores y paquetes de legalización de gastos de todos los flujos — solo consulta
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors"
          style={{ color: '#00829a', borderColor: '#b2e0e8', backgroundColor: '#e0f5f7', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
        </div>
      ) : (
        <>
          {/* Tarjetas resumen por estado */}
          <div className="grid gap-3 mb-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            {Object.entries(ESTADOS_CONFIG).map(([estado, cfg]) => (
              <button
                key={estado}
                onClick={() => { setFiltroEstado(prev => prev === estado ? '' : estado); setPagina(1); }}
                style={{
                  background: filtroEstado === estado ? cfg.bg : '#fff',
                  border: `1.5px solid ${filtroEstado === estado ? cfg.border : '#e5e7eb'}`,
                  borderRadius: 10, padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <p style={{ fontSize: 22, fontWeight: 700, color: cfg.color, fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', marginBottom: 2 }}>
                  {conteoEstados[estado] ?? 0}
                </p>
                <p style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  {cfg.label}
                </p>
              </button>
            ))}
          </div>

          {/* Barra de filtros */}
          <div className="flex gap-3 mb-4 flex-wrap items-center">
            <input
              type="text"
              placeholder="Buscar por técnico, comercial, folio o semana..."
              value={filtroNombre}
              onChange={e => { setFiltroNombre(e.target.value); setPagina(1); }}
              className="text-sm px-3 py-1.5 rounded-lg border outline-none"
              style={{ borderColor: '#d1d5db', fontFamily: 'Neutra Text Book, Montserrat, sans-serif', minWidth: 260 }}
            />
            <select
              value={filtroTipoFlujo}
              onChange={e => { setFiltroTipoFlujo(e.target.value); setPagina(1); }}
              className="text-sm px-3 py-1.5 rounded-lg border outline-none"
              style={{ borderColor: '#d1d5db', fontFamily: 'Neutra Text Book, Montserrat, sans-serif', color: '#374151' }}
            >
              <option value="">Todos los flujos</option>
              {Object.entries(TIPO_FLUJO_CONFIG).map(([v, c]) => (
                <option key={v} value={v}>{c.label}</option>
              ))}
            </select>
            <select
              value={filtroEstado}
              onChange={e => { setFiltroEstado(e.target.value); setPagina(1); }}
              className="text-sm px-3 py-1.5 rounded-lg border outline-none"
              style={{ borderColor: '#d1d5db', fontFamily: 'Neutra Text Book, Montserrat, sans-serif', color: '#374151' }}
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS_CONFIG).map(([v, c]) => (
                <option key={v} value={v}>{c.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Desde</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={e => { setFechaDesde(e.target.value); setPagina(1); }}
                className="text-sm px-2 py-1.5 rounded-lg border outline-none"
                style={{ borderColor: '#d1d5db', fontFamily: 'Neutra Text Book, Montserrat, sans-serif', color: '#374151' }}
              />
              <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Hasta</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => { setFechaHasta(e.target.value); setPagina(1); }}
                className="text-sm px-2 py-1.5 rounded-lg border outline-none"
                style={{ borderColor: '#d1d5db', fontFamily: 'Neutra Text Book, Montserrat, sans-serif', color: '#374151' }}
              />
            </div>
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                Limpiar filtros
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', alignSelf: 'center', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              {lista.length} paquete{lista.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {lista.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <PackageOpen className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Sin resultados</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: '#00829a' }}>
                      {['Folio', 'Semana', 'Creado por', 'Tipo de flujo', 'Monto total', 'Valor a pagar', 'Estado', 'Última actualización'].map(h => (
                        <th key={h} className="px-5 py-3 text-left font-semibold text-white whitespace-nowrap"
                          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 12 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaPagina.map((p, idx) => {
                      const cfg = ESTADOS_CONFIG[p.estado] ?? ESTADOS_CONFIG['borrador'];
                      return (
                        <tr key={p.id}
                          className="border-t border-gray-100 cursor-pointer"
                          onClick={() => setPaqueteDetalleId(p.id)}
                          style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e0f5f7')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#f8fafc')}
                        >
                          <td className="px-5 py-3 font-semibold" style={{ color: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 12 }}>
                            {p.folio ?? '—'}
                          </td>
                          <td className="px-5 py-3">
                            <p className="font-semibold text-xs" style={{ color: '#374151', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>{formatSemanaLabel(p.semana)}</p>
                            <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>{fmtFecha(p.fecha_inicio)} – {fmtFecha(p.fecha_fin)}</p>
                          </td>
                          <td className="px-5 py-3 text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', fontSize: 13 }}>
                            {p.tecnico?.nombre ?? '—'}
                            {p.tipo_flujo === 'tarjeta_comercial' && p.comercial_hijo && (
                              <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                                Hijo: {p.comercial_hijo.nombre}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <TipoFlujoBadge tipo={p.tipo_flujo} />
                          </td>
                          <td className="px-5 py-3 font-semibold text-gray-700 whitespace-nowrap" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 13 }}>
                            {fmtMonto(Number(p.monto_total))}
                          </td>
                          <td className="px-5 py-3 font-semibold whitespace-nowrap" style={{ color: '#0e7490', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 13 }}>
                            {fmtMonto(Number(p.monto_a_pagar ?? p.monto_total))}
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                            {fmtFecha(p.updated_at.slice(0, 10))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer de paginación */}
            {lista.length > FILAS_POR_PAGINA && (
              <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: '#e5e7eb' }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  Mostrando {(paginaClamped - 1) * FILAS_POR_PAGINA + 1}–{Math.min(paginaClamped * FILAS_POR_PAGINA, lista.length)} de {lista.length}
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={paginaClamped === 1}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid #d1d5db',
                      background: '#fff', color: paginaClamped === 1 ? '#d1d5db' : '#374151',
                      cursor: paginaClamped === 1 ? 'not-allowed' : 'pointer',
                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    }}
                  >‹ Anterior</button>
                  <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Neutra Text Book, Montserrat, sans-serif', padding: '0 8px' }}>
                    Página {paginaClamped} de {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaClamped === totalPaginas}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid #d1d5db',
                      background: '#fff', color: paginaClamped === totalPaginas ? '#d1d5db' : '#374151',
                      cursor: paginaClamped === totalPaginas ? 'not-allowed' : 'pointer',
                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    }}
                  >Siguiente ›</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
