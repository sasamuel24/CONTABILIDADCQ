/**
 * Vista de paquetes de gastos para el rol Responsable.
 * Permite ver, aprobar y devolver paquetes enviados por los técnicos.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listPaquetesGastos,
  getPaqueteGasto,
  aprobarPaquete,
  devolverPaquete,
  editarGasto,
  getDownloadUrlArchivoGasto,
  subirAprobacionGerencia,
  getAprobacionGerenciaDownloadUrl,
  getCentrosCosto,
  getCentrosOperacion,
  getCuentasAuxiliares,
  PaqueteListItem,
  PaqueteOut,
  GastoOut,
  EstadoPaquete,
  CentroCosto,
  CentroOperacion,
  CuentaAuxiliar,
} from '../lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  ChevronRight,
  FileText,
  Banknote,
  CalendarDays,
  User,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Download,
  PackageOpen,
  Filter,
  Save,
  Paperclip,
  Upload,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMonto(v: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
}

function fmtFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${meses[Number(m) - 1]} ${y}`;
}

function formatSemanaLabel(semana: string | null | undefined) {
  if (!semana) return 'Sin semana';
  const [anio, s] = semana.split('-S');
  return `Semana ${s} — ${anio}`;
}

function formatRango(inicio: string, fin: string) {
  return `${fmtFecha(inicio)} al ${fmtFecha(fin)}`;
}

// ---------------------------------------------------------------------------
// Estado badge
// ---------------------------------------------------------------------------

type EstadoUI = {
  label: string;
  bg: string;
  color: string;
  dot: string;
};

const ESTADO_MAP: Record<EstadoPaquete, EstadoUI> = {
  borrador:    { label: 'Borrador',      bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  en_revision: { label: 'En revisión',   bg: '#fffbeb', color: '#b45309', dot: '#f59e0b' },
  devuelto:    { label: 'Devuelto',      bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  aprobado:    { label: 'Aprobado',      bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  pagado:      { label: 'Pagado',        bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' },
};

function EstadoBadge({ estado }: { estado: EstadoPaquete }) {
  const ui = ESTADO_MAP[estado] ?? ESTADO_MAP.borrador;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: ui.bg, color: ui.color, fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ui.dot }} />
      {ui.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal devolver
// ---------------------------------------------------------------------------

function ModalDevolver({
  onConfirmar,
  onCancelar,
  loading,
}: {
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
  loading: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3
          style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
          className="text-lg font-bold text-gray-900 mb-1"
        >
          Devolver paquete
        </h3>
        <p
          style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
          className="text-sm text-gray-500 mb-4"
        >
          Indica el motivo por el que se devuelve al técnico.
        </p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={4}
          placeholder="Escribe el motivo de devolución..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 mb-4"
          style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', focusRingColor: '#00829a' } as React.CSSProperties}
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancelar}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => motivo.trim() && onConfirmar(motivo.trim())}
            disabled={loading || !motivo.trim()}
            className="px-4 py-2 text-sm rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#ef4444', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Devolver'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tipos locales para edición de asignaciones
// ---------------------------------------------------------------------------

type AsignacionLocal = {
  centroCostoId: string;
  centroOperacionId: string;
  cuentaAuxiliarId: string;
  dirty: boolean;
};

// ---------------------------------------------------------------------------
// Detalle del paquete (con tabla editable CC/CO/CA)
// ---------------------------------------------------------------------------

function DetallePaqueteResponsable({
  paqueteId,
  onCerrar,
  onAccion,
}: {
  paqueteId: string;
  onCerrar: () => void;
  onAccion: () => void;
}) {
  const [paquete, setPaquete] = useState<PaqueteOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAprobar, setLoadingAprobar] = useState(false);
  const [showDevolver, setShowDevolver] = useState(false);
  const [loadingDevolver, setLoadingDevolver] = useState(false);
  const [savingAsignaciones, setSavingAsignaciones] = useState(false);
  const [uploadingAprobacion, setUploadingAprobacion] = useState(false);

  // Catálogos
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [centrosOperacion, setCentrosOperacion] = useState<CentroOperacion[]>([]);
  const [cuentasAuxiliares, setCuentasAuxiliares] = useState<CuentaAuxiliar[]>([]);

  // Ediciones locales de asignaciones por gasto
  const [asignaciones, setAsignaciones] = useState<Record<string, AsignacionLocal>>({});

  // Cargar paquete y catálogos
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [data, cc, co, ca] = await Promise.all([
          getPaqueteGasto(paqueteId),
          getCentrosCosto(),
          getCentrosOperacion(),
          getCuentasAuxiliares(),
        ]);
        setPaquete(data);
        setCentrosCosto(cc);
        setCentrosOperacion(co);
        setCuentasAuxiliares(ca);
        // Inicializar asignaciones con datos actuales de cada gasto
        const init: Record<string, AsignacionLocal> = {};
        data.gastos.forEach((g: GastoOut) => {
          init[g.id] = {
            centroCostoId: g.centro_costo_id ?? '',
            centroOperacionId: g.centro_operacion_id ?? '',
            cuentaAuxiliarId: g.cuenta_auxiliar_id ?? '',
            dirty: false,
          };
        });
        setAsignaciones(init);
      } catch {
        toast.error('Error al cargar el paquete');
      } finally {
        setLoading(false);
      }
    })();
  }, [paqueteId]);

  const setAsignacion = (gastoId: string, campo: keyof Omit<AsignacionLocal, 'dirty'>, valor: string) => {
    setAsignaciones((prev) => ({
      ...prev,
      [gastoId]: {
        ...prev[gastoId],
        [campo]: valor,
        // Al cambiar CC, limpiar CO
        ...(campo === 'centroCostoId' ? { centroOperacionId: '' } : {}),
        dirty: true,
      },
    }));
  };

  const hayAsignacionesDirty = Object.values(asignaciones).some((a) => a.dirty);

  const handleGuardarAsignaciones = async () => {
    if (!paquete) return;
    setSavingAsignaciones(true);
    try {
      const promises = paquete.gastos
        .filter((g) => asignaciones[g.id]?.dirty)
        .map((g) => {
          const a = asignaciones[g.id];
          return editarGasto(paquete.id, g.id, {
            centro_costo_id: a.centroCostoId || undefined,
            centro_operacion_id: a.centroOperacionId || undefined,
            cuenta_auxiliar_id: a.cuentaAuxiliarId || undefined,
          });
        });
      await Promise.all(promises);
      // Marcar como no dirty
      setAsignaciones((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((k) => { updated[k] = { ...updated[k], dirty: false }; });
        return updated;
      });
      toast.success('Asignaciones guardadas correctamente');
    } catch {
      toast.error('Error al guardar las asignaciones');
    } finally {
      setSavingAsignaciones(false);
    }
  };

  const handleAprobar = async () => {
    if (!paquete) return;
    // Guardar asignaciones pendientes antes de aprobar
    if (hayAsignacionesDirty) {
      await handleGuardarAsignaciones();
    }
    setLoadingAprobar(true);
    try {
      await aprobarPaquete(paquete.id);
      toast.success('Paquete aprobado correctamente');
      onAccion();
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Error al aprobar';
      toast.error(msg);
    } finally {
      setLoadingAprobar(false);
    }
  };

  const handleDevolver = async (motivo: string) => {
    if (!paquete) return;
    setLoadingDevolver(true);
    try {
      await devolverPaquete(paquete.id, motivo);
      toast.success('Paquete devuelto al técnico');
      setShowDevolver(false);
      onAccion();
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Error al devolver';
      toast.error(msg);
    } finally {
      setLoadingDevolver(false);
    }
  };

  const handleDescargar = async (gastoId: string, archivoId: string) => {
    try {
      const { download_url } = await getDownloadUrlArchivoGasto(paqueteId, gastoId, archivoId);
      window.open(download_url, '_blank');
    } catch {
      toast.error('No se pudo obtener el enlace de descarga');
    }
  };

  const handleSubirAprobacion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !paquete) return;
    setUploadingAprobacion(true);
    try {
      const updated = await subirAprobacionGerencia(paquete.id, file);
      setPaquete(updated);
      toast.success('Aprobación de gerencia adjuntada correctamente');
    } catch {
      toast.error('Error al subir la aprobación de gerencia');
    } finally {
      setUploadingAprobacion(false);
      e.target.value = '';
    }
  };

  const handleDescargarAprobacion = async () => {
    if (!paquete) return;
    try {
      const { download_url } = await getAprobacionGerenciaDownloadUrl(paquete.id);
      window.open(download_url, '_blank');
    } catch {
      toast.error('No se pudo obtener el enlace de descarga');
    }
  };

  const selectCls = 'w-full rounded px-1.5 py-1 text-xs text-gray-800 border border-transparent hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none bg-transparent';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
      </div>
    );
  }

  if (!paquete) return null;

  const puedeActuar = paquete.estado === 'en_revision';
  const puedeEditarAsignaciones = paquete.estado === 'en_revision';

  return (
    <>
      {showDevolver && (
        <ModalDevolver
          onConfirmar={handleDevolver}
          onCancelar={() => setShowDevolver(false)}
          loading={loadingDevolver}
        />
      )}

      <div className="w-full">
        {/* Back */}
        <button
          onClick={onCerrar}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la lista
        </button>

        {/* Header card */}
        <div
          className="bg-white rounded-2xl border p-6 mb-4"
          style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p
                style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#00829a' }}
                className="text-lg font-bold"
              >
                {formatSemanaLabel(paquete.semana)}
              </p>
              <p
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                className="text-sm text-gray-400 mt-0.5"
              >
                {formatRango(paquete.fecha_inicio, paquete.fecha_fin)}
              </p>
            </div>
            <EstadoBadge estado={paquete.estado} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <User className="w-4 h-4 text-gray-400" />
              <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                <span className="text-gray-400">Técnico: </span>
                <span className="font-semibold text-gray-700">{paquete.tecnico?.nombre ?? '—'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Banknote className="w-4 h-4 text-gray-400" />
              <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                <span className="text-gray-400">Total: </span>
                <span className="font-semibold text-gray-700">{fmtMonto(paquete.monto_total)}</span>
              </span>
            </div>
            {paquete.fecha_envio && (
              <div className="flex items-center gap-2 text-gray-600">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  <span className="text-gray-400">Enviado: </span>
                  {fmtFecha(paquete.fecha_envio.slice(0, 10))}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <FileText className="w-4 h-4 text-gray-400" />
              <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                <span className="text-gray-400">Documentos: </span>
                {paquete.total_documentos}
              </span>
            </div>
          </div>

          {/* Aprobación de gerencia */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-gray-400" />
                <span
                  className="text-sm font-semibold text-gray-600"
                  style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                >
                  Aprobación de Gerencia
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {paquete.aprobacion_gerencia_filename ? (
                  <>
                    <button
                      onClick={handleDescargarAprobacion}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                      style={{ color: '#00829a', borderColor: '#b2e0e8', backgroundColor: '#e0f5f7', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {paquete.aprobacion_gerencia_filename}
                    </button>
                    {puedeActuar && (
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors"
                        style={{ color: '#6b7280', borderColor: '#e5e7eb', backgroundColor: '#f9fafb', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                      >
                        {uploadingAprobacion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Reemplazar
                        <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleSubirAprobacion} disabled={uploadingAprobacion} />
                      </label>
                    )}
                  </>
                ) : (
                  puedeActuar ? (
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors"
                      style={{ color: '#b45309', borderColor: '#fcd34d', backgroundColor: '#fffbeb', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                    >
                      {uploadingAprobacion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Adjuntar aprobación
                      <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleSubirAprobacion} disabled={uploadingAprobacion} />
                    </label>
                  ) : (
                    <span className="text-xs text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Sin adjunto</span>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          {puedeActuar && (
            <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100 flex-wrap">
              {hayAsignacionesDirty && (
                <button
                  onClick={handleGuardarAsignaciones}
                  disabled={savingAsignaciones}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 border"
                  style={{ color: '#00829a', borderColor: '#b2e0e8', backgroundColor: '#e0f5f7', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                >
                  {savingAsignaciones ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar asignaciones
                </button>
              )}
              <button
                onClick={handleAprobar}
                disabled={loadingAprobar || savingAsignaciones}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#16a34a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                {loadingAprobar ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Aprobar paquete
              </button>
              <button
                onClick={() => setShowDevolver(true)}
                disabled={loadingAprobar || savingAsignaciones}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors border"
                style={{ color: '#ef4444', borderColor: '#fca5a5', backgroundColor: '#fef2f2', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                <RotateCcw className="w-4 h-4" />
                Devolver
              </button>
            </div>
          )}
        </div>

        {/* Gastos — tabla completa */}
        <div
          className="bg-white rounded-2xl border p-6 mb-4"
          style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <p
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              className="text-xs text-gray-400 uppercase tracking-wide"
            >
              Detalle de gastos ({paquete.gastos.length})
            </p>
            {puedeEditarAsignaciones && (
              <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-xs text-gray-400">
                Puedes asignar Centro Costo, Centro Operación y Cuenta Contable a cada gasto
              </p>
            )}
          </div>

          {paquete.gastos.length === 0 ? (
            <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm text-gray-400 text-center py-4">
              Sin gastos registrados
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 1100 }}>
                <thead>
                  <tr style={{ backgroundColor: '#00829a' }}>
                    {['Fecha', 'Pagado a', 'Concepto', 'No. Recibo', 'Centro Costo', 'Centro Operación', 'Cuenta Contable', 'Valor', 'Soporte'].map((h) => (
                      <th
                        key={h}
                        className="px-2 py-2.5 text-left font-semibold text-white whitespace-nowrap"
                        style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 11 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paquete.gastos.map((g, idx) => {
                    const asig = asignaciones[g.id] ?? { centroCostoId: '', centroOperacionId: '', cuentaAuxiliarId: '', dirty: false };
                    const coFiltrados = centrosOperacion.filter(
                      (c) => !asig.centroCostoId || c.centro_costo_id === asig.centroCostoId
                    );
                    return (
                      <tr
                        key={g.id}
                        className="border-t border-gray-100"
                        style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}
                      >
                        <td className="px-2 py-2 text-gray-600 whitespace-nowrap" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                          {fmtFecha(g.fecha)}
                        </td>
                        <td className="px-2 py-2 text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', minWidth: 110 }}>
                          {g.pagado_a}
                        </td>
                        <td className="px-2 py-2 text-gray-700" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', minWidth: 120 }}>
                          {g.concepto}
                        </td>
                        <td className="px-2 py-2 text-gray-500" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', minWidth: 80 }}>
                          {g.no_recibo || '—'}
                        </td>

                        {/* CENTRO COSTO */}
                        <td className="px-1 py-1" style={{ minWidth: 140 }}>
                          {puedeEditarAsignaciones ? (
                            <select
                              value={asig.centroCostoId}
                              onChange={(e) => setAsignacion(g.id, 'centroCostoId', e.target.value)}
                              className={selectCls}
                              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                            >
                              <option value="">-- Seleccionar --</option>
                              {centrosCosto.map((c) => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                              {g.centro_costo?.nombre ?? '—'}
                            </span>
                          )}
                        </td>

                        {/* CENTRO OPERACIÓN */}
                        <td className="px-1 py-1" style={{ minWidth: 150 }}>
                          {puedeEditarAsignaciones ? (
                            <select
                              value={asig.centroOperacionId}
                              onChange={(e) => setAsignacion(g.id, 'centroOperacionId', e.target.value)}
                              disabled={!asig.centroCostoId}
                              className={`${selectCls} disabled:opacity-50`}
                              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                            >
                              <option value="">-- Seleccionar --</option>
                              {coFiltrados.map((c) => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                              {g.centro_operacion?.nombre ?? '—'}
                            </span>
                          )}
                        </td>

                        {/* CUENTA CONTABLE */}
                        <td className="px-1 py-1" style={{ minWidth: 160 }}>
                          {puedeEditarAsignaciones ? (
                            <select
                              value={asig.cuentaAuxiliarId}
                              onChange={(e) => setAsignacion(g.id, 'cuentaAuxiliarId', e.target.value)}
                              className={selectCls}
                              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                            >
                              <option value="">-- Seleccionar --</option>
                              {cuentasAuxiliares.map((c) => (
                                <option key={c.id} value={c.id}>{c.codigo} — {c.descripcion}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                              {g.cuenta_auxiliar ? `${g.cuenta_auxiliar.codigo} — ${g.cuenta_auxiliar.descripcion}` : '—'}
                            </span>
                          )}
                        </td>

                        <td className="px-2 py-2 font-semibold whitespace-nowrap" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', color: '#00829a' }}>
                          {fmtMonto(g.valor_pagado)}
                        </td>
                        <td className="px-2 py-2">
                          {g.archivos.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {g.archivos.map((arch) => (
                                <button
                                  key={arch.id}
                                  onClick={() => handleDescargar(g.id, arch.id)}
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-gray-50 w-full text-left"
                                  style={{ color: '#00829a', borderColor: '#b2e0e8', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                                  title={arch.filename}
                                >
                                  <Download className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[100px]">{arch.filename}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={7} className="py-3 px-2 text-xs font-semibold text-gray-500" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                      Total
                    </td>
                    <td className="py-3 px-2 font-bold text-sm" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#00829a' }}>
                      {fmtMonto(paquete.monto_total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Comentarios */}
        {paquete.comentarios.length > 0 && (
          <div
            className="bg-white rounded-2xl border p-6"
            style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <p
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              className="text-xs text-gray-400 uppercase tracking-wide mb-4"
            >
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
                  <AlertCircle
                    className="w-4 h-4 shrink-0 mt-0.5"
                    style={{ color: c.tipo === 'devolucion' ? '#ef4444' : c.tipo === 'aprobacion' ? '#22c55e' : '#6b7280' }}
                  />
                  <div className="flex-1">
                    <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm text-gray-700">
                      {c.texto}
                    </p>
                    <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-xs text-gray-400 mt-1">
                      {c.user?.nombre ?? 'Sistema'} · {fmtFecha(c.created_at.slice(0, 10))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Vista principal
// ---------------------------------------------------------------------------

type Vista = 'lista' | 'detalle';
type Filtro = 'todos' | EstadoPaquete;

export function ResponsablePaquetesView({
  onVistaChange,
}: {
  onVistaChange?: (v: 'lista' | 'detalle') => void;
}) {
  const [vista, setVista] = useState<Vista>('lista');
  const [paqueteActivo, setPaqueteActivo] = useState<string | null>(null);
  const [paquetes, setPaquetes] = useState<PaqueteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('en_revision');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPaquetesGastos({ limit: 200 });
      setPaquetes(res.paquetes);
    } catch {
      toast.error('Error al cargar los paquetes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (vista === 'lista') cargar();
  }, [vista, cargar]);

  const irALista = () => {
    setVista('lista');
    setPaqueteActivo(null);
    onVistaChange?.('lista');
  };

  // Solo mostrar paquetes que han sido enviados (excluir borradores)
  const paquetesEnviados = paquetes.filter((p) => p.estado !== 'borrador');

  const paquetesFiltrados =
    filtro === 'todos' ? paquetesEnviados : paquetesEnviados.filter((p) => p.estado === filtro);

  const pendientes = paquetesEnviados.filter((p) => p.estado === 'en_revision').length;

  const FILTROS: { value: Filtro; label: string }[] = [
    { value: 'en_revision', label: 'En revisión' },
    { value: 'aprobado',    label: 'Aprobados' },
    { value: 'devuelto',    label: 'Devueltos' },
    { value: 'pagado',      label: 'Pagados' },
    { value: 'todos',       label: 'Todos' },
  ];

  if (vista === 'detalle' && paqueteActivo) {
    return (
      <DetallePaqueteResponsable
        paqueteId={paqueteActivo}
        onCerrar={irALista}
        onAccion={() => {
          irALista();
        }}
      />
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Filtros */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
            style={{
              backgroundColor: filtro === f.value ? '#00829a' : 'white',
              color: filtro === f.value ? 'white' : '#6b7280',
              borderColor: filtro === f.value ? '#00829a' : '#e5e7eb',
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
            }}
          >
            {f.label}
            {f.value === 'en_revision' && pendientes > 0 && (
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                style={{ backgroundColor: filtro === 'en_revision' ? 'rgba(255,255,255,0.3)' : '#f59e0b', color: filtro === 'en_revision' ? 'white' : 'white' }}
              >
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
        </div>
      )}

      {!loading && paquetesFiltrados.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <PackageOpen className="w-12 h-12 mb-3 opacity-30" />
          <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm">
            No hay paquetes {filtro !== 'todos' ? `con estado "${ESTADO_MAP[filtro as EstadoPaquete]?.label ?? filtro}"` : ''}
          </p>
        </div>
      )}

      {!loading && paquetesFiltrados.length > 0 && (
        <div className="flex flex-col gap-3">
          {paquetesFiltrados.map((p) => (
            <button
              key={p.id}
              onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); onVistaChange?.('detalle'); }}
              className="w-full text-left bg-white rounded-xl border transition-all p-5 hover:shadow-md"
              style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p
                    style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#00829a' }}
                    className="text-sm font-bold"
                  >
                    {formatSemanaLabel(p.semana)}
                  </p>
                  <p
                    style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                    className="text-xs text-gray-400 mt-0.5"
                  >
                    {formatRango(p.fecha_inicio, p.fecha_fin)}
                  </p>
                </div>
                <EstadoBadge estado={p.estado} />
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>{p.tecnico?.nombre ?? '—'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Banknote className="w-3 h-3" />
                  {fmtMonto(p.monto_total)}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {p.total_documentos} doc{p.total_documentos !== 1 ? 's' : ''}
                </span>
                {p.fecha_envio && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {fmtFecha(p.fecha_envio.slice(0, 10))}
                  </span>
                )}
              </div>

              <div className="flex justify-end mt-2">
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
