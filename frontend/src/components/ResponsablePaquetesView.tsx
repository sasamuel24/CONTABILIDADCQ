/**
 * Vista de paquetes de gastos para el rol Responsable.
 * Permite ver, aprobar y devolver paquetes enviados por los técnicos.
 */
import { useState, useEffect, useCallback } from 'react';
import { ZoomableImage } from './ZoomableImage';
import {
  listPaquetesGastos,
  getPaqueteGasto,
  aprobarPaquete,
  devolverPaquete,
  devolverGasto,
  pagarPaquete,
  enviarATesoreria,
  editarGasto,
  getDownloadUrlArchivoGasto,
  proxyDownloadArchivoGasto,
  getAprobacionGerenciaDownloadUrl,
  reenviarCorreoAprobacion,
  getCentrosCosto,
  getCentrosOperacion,
  getCuentasAuxiliares,
  subirDocContable,
  getDocContableDownloadUrl,
  eliminarDocContable,
  subirCmPdfGasto,
  getCmPdfGastoDownloadUrl,
  eliminarCmPdfGasto,
  PaqueteListItem,
  PaqueteOut,
  GastoOut,
  EstadoPaquete,
  CentroCosto,
  CentroOperacion,
  CuentaAuxiliar,
} from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
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
  Wallet,
  Send,
  Mail,
  RefreshCw,
  Eye,
  X as XIcon,
  Trash2,
  FileCheck,
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
  const match = semana.match(/^(\d{4})-W(\d+)$/);
  if (!match) return semana;
  return `Semana ${parseInt(match[2], 10)} — ${match[1]}`;
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
  borrador:      { label: 'Borrador',          bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  en_revision:   { label: 'En revisión',       bg: '#fffbeb', color: '#b45309', dot: '#f59e0b' },
  devuelto:      { label: 'Devuelto',           bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  aprobado:      { label: 'Pendiente',          bg: '#fff7ed', color: '#c2410c', dot: '#f97316' },
  en_tesoreria:  { label: 'En Tesorería',      bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' },
  pagado:        { label: 'Pagado',             bg: '#f0fdf4', color: '#0e7490', dot: '#06b6d4' },
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
  titulo = 'Devolver paquete',
  descripcion = 'Indica el motivo por el que se devuelve al técnico.',
  onConfirmar,
  onCancelar,
  loading,
}: {
  titulo?: string;
  descripcion?: string;
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
          {titulo}
        </h3>
        <p
          style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
          className="text-sm text-gray-500 mb-4"
        >
          {descripcion}
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
  soloDevueltos = false,
}: {
  paqueteId: string;
  onCerrar: () => void;
  onAccion: () => void;
  soloDevueltos?: boolean;
}) {
  const [paquete, setPaquete] = useState<PaqueteOut | null>(null);
  const { user } = useAuth();
  const rolActual = user?.role?.toLowerCase() ?? '';
  const areaActual = user?.area?.code?.toLowerCase() ?? '';

  const [loading, setLoading] = useState(true);
  const [loadingAprobar, setLoadingAprobar] = useState(false);
  const [showDevolver, setShowDevolver] = useState(false);
  const [loadingDevolver, setLoadingDevolver] = useState(false);
  const [showDevolverGastoId, setShowDevolverGastoId] = useState<string | null>(null);
  const [loadingDevolverGasto, setLoadingDevolverGasto] = useState(false);
  const [savingAsignaciones, setSavingAsignaciones] = useState(false);
  const [uploadingAprobacion, setUploadingAprobacion] = useState(false);
  const [loadingPagar, setLoadingPagar] = useState(false);
  const [loadingEnviarTes, setLoadingEnviarTes] = useState(false);
  const [loadingReenviarCorreo, setLoadingReenviarCorreo] = useState(false);
  const [correoGerEnviado, setCorreoGerEnviado] = useState(false);
  const [filtroGastos, setFiltroGastos] = useState<'todos' | 'devueltos'>(soloDevueltos ? 'devueltos' : 'todos');

  // Documento Contable General
  const [uploadingDocContable, setUploadingDocContable] = useState(false);
  const [eliminandoDocContable, setEliminandoDocContable] = useState(false);

  // CM PDF por gasto: gastoId → estado de subida
  const [uploadingCmPdf, setUploadingCmPdf] = useState<Record<string, boolean>>({});
  const [eliminandoCmPdf, setEliminandoCmPdf] = useState<Record<string, boolean>>({});

  // Preview de soportes (archivos por gasto)
  const [previewArchivo, setPreviewArchivo] = useState<{ url: string; filename: string; contentType: string; gastoId: string; archivoId: string } | null>(null);
  // Preview genérico para doc contable y CM PDF (siempre PDF)
  const [previewDoc, setPreviewDoc] = useState<{ url: string; filename: string } | null>(null);
  // Selección múltiple: "gastoId:archivoId"
  const [selectedArchivos, setSelectedArchivos] = useState<Set<string>>(new Set());

  // Catálogos
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [centrosOperacion, setCentrosOperacion] = useState<CentroOperacion[]>([]);
  const [cuentasAuxiliares, setCuentasAuxiliares] = useState<CuentaAuxiliar[]>([]);

  // Ediciones locales de asignaciones por gasto
  const [asignaciones, setAsignaciones] = useState<Record<string, AsignacionLocal>>({});

  // Sincronizar correoGerEnviado cuando se actualiza el paquete
  useEffect(() => {
    if (paquete) setCorreoGerEnviado(!!paquete.fecha_envio_gerencia);
  }, [paquete]);

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

  const handleDevolverGasto = async (motivo: string) => {
    if (!paquete || !showDevolverGastoId) return;
    setLoadingDevolverGasto(true);
    try {
      await devolverGasto(paquete.id, showDevolverGastoId, motivo);
      toast.success('Gasto devuelto al técnico');
      setShowDevolverGastoId(null);
      // Recargar paquete
      const updated = await getPaqueteGasto(paquete.id);
      setPaquete(updated);
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Error al devolver el gasto';
      toast.error(msg);
    } finally {
      setLoadingDevolverGasto(false);
    }
  };

  const handleEnviarTesoreria = async () => {
    if (!paquete) return;
    setLoadingEnviarTes(true);
    try {
      const updated = await enviarATesoreria(paquete.id);
      setPaquete(updated);
      toast.success('Paquete enviado a Tesorería');
      onAccion();
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Error al enviar a Tesorería';
      toast.error(msg);
    } finally {
      setLoadingEnviarTes(false);
    }
  };

  const handleDescargar = async (gastoId: string, archivoId: string, filename?: string) => {
    try {
      await proxyDownloadArchivoGasto(paqueteId, gastoId, archivoId, filename ?? archivoId);
    } catch {
      toast.error('No se pudo descargar el archivo');
    }
  };

  const handlePreview = async (gastoId: string, arch: { id: string; filename: string; content_type: string }) => {
    try {
      const { download_url } = await getDownloadUrlArchivoGasto(paqueteId, gastoId, arch.id);
      setPreviewArchivo({ url: download_url, filename: arch.filename, contentType: arch.content_type, gastoId, archivoId: arch.id });
    } catch {
      toast.error('No se pudo cargar la vista previa');
    }
  };

  const handleDescargarSeleccionados = async () => {
    if (!paquete) return;
    for (const key of selectedArchivos) {
      const [gastoId, archivoId] = key.split(':');
      const gasto = paquete.gastos.find((g) => g.id === gastoId);
      const arch = gasto?.archivos.find((a) => a.id === archivoId);
      await handleDescargar(gastoId, archivoId, arch?.filename);
    }
  };

  const toggleArchivo = (gastoId: string, archivoId: string) => {
    const key = `${gastoId}:${archivoId}`;
    setSelectedArchivos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleReenviarCorreo = async () => {
    if (!paquete) return;
    setLoadingReenviarCorreo(true);
    try {
      await reenviarCorreoAprobacion(paquete.id);
      setCorreoGerEnviado(true);
      toast.success('Correo de aprobación enviado al Gerente Administrativo');
    } catch {
      toast.error('Error al enviar el correo de aprobación');
    } finally {
      setLoadingReenviarCorreo(false);
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

  const handlePreviewDocContable = async () => {
    if (!paquete?.doc_contable_filename) return;
    try {
      const { download_url } = await getDocContableDownloadUrl(paquete.id);
      setPreviewDoc({ url: download_url, filename: paquete.doc_contable_filename });
    } catch {
      toast.error('No se pudo cargar la vista previa');
    }
  };

  const handlePreviewCmPdf = async (gastoId: string, filename: string) => {
    if (!paquete) return;
    try {
      const { download_url } = await getCmPdfGastoDownloadUrl(paquete.id, gastoId);
      setPreviewDoc({ url: download_url, filename });
    } catch {
      toast.error('No se pudo cargar la vista previa del CM PDF');
    }
  };

  const handleSubirDocContable = async (file: File) => {
    if (!paquete) return;
    setUploadingDocContable(true);
    try {
      const updated = await subirDocContable(paquete.id, file);
      setPaquete(updated);
      toast.success('Documento contable subido correctamente');
    } catch {
      toast.error('Error al subir el documento contable');
    } finally {
      setUploadingDocContable(false);
    }
  };

  const handleDescargarDocContable = async () => {
    if (!paquete) return;
    try {
      const { download_url } = await getDocContableDownloadUrl(paquete.id);
      window.open(download_url, '_blank');
    } catch {
      toast.error('No se pudo obtener el enlace de descarga');
    }
  };

  const handleEliminarDocContable = async () => {
    if (!paquete) return;
    setEliminandoDocContable(true);
    try {
      const updated = await eliminarDocContable(paquete.id);
      setPaquete(updated);
      toast.success('Documento contable eliminado');
    } catch {
      toast.error('Error al eliminar el documento contable');
    } finally {
      setEliminandoDocContable(false);
    }
  };

  const handleSubirCmPdf = async (gastoId: string, file: File) => {
    if (!paquete) return;
    setUploadingCmPdf((prev) => ({ ...prev, [gastoId]: true }));
    try {
      const updated = await subirCmPdfGasto(paquete.id, gastoId, file);
      setPaquete(updated);
      toast.success('CM PDF subido correctamente');
    } catch {
      toast.error('Error al subir el CM PDF');
    } finally {
      setUploadingCmPdf((prev) => ({ ...prev, [gastoId]: false }));
    }
  };

  const handleDescargarCmPdf = async (gastoId: string) => {
    if (!paquete) return;
    try {
      const { download_url } = await getCmPdfGastoDownloadUrl(paquete.id, gastoId);
      window.open(download_url, '_blank');
    } catch {
      toast.error('No se pudo obtener el enlace de descarga del CM PDF');
    }
  };

  const handleEliminarCmPdf = async (gastoId: string) => {
    if (!paquete) return;
    setEliminandoCmPdf((prev) => ({ ...prev, [gastoId]: true }));
    try {
      const updated = await eliminarCmPdfGasto(paquete.id, gastoId);
      setPaquete(updated);
      toast.success('CM PDF eliminado');
    } catch {
      toast.error('Error al eliminar el CM PDF');
    } finally {
      setEliminandoCmPdf((prev) => ({ ...prev, [gastoId]: false }));
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

  // Responsable de Mantenimiento aprueba/devuelve paquetes en revisión
  const esResponsable = ['admin', 'responsable'].includes(rolActual) || ['admin', 'responsable', 'mant'].includes(areaActual);
  // Facturación envía paquetes aprobados a Tesorería
  const esFact = ['admin', 'fact'].includes(rolActual) || ['admin', 'fact'].includes(areaActual);
  const esTes = ['admin', 'tesoreria', 'tes'].includes(rolActual) || ['admin', 'tesoreria', 'tes'].includes(areaActual);

  const puedeActuar = paquete.estado === 'en_revision' && esResponsable;
  const puedeEnviarTesoreria = paquete.estado === 'aprobado' && esFact;
  const puedeDevolverComoFact = paquete.estado === 'aprobado' && esFact;
  // Facturación puede gestionar doc contable cuando está aprobado
  const puedeGestionarDocContable = paquete.estado === 'aprobado' && esFact;
  // Doc contable visible (para ver/descargar) desde aprobado en adelante
  const verDocContable = ['aprobado', 'en_tesoreria', 'pagado'].includes(paquete.estado);
  // CM PDF: facturación puede subir cuando aprobado; todos ven si existe
  const puedeGestionarCmPdf = paquete.estado === 'aprobado' && esFact;

  const gastosDevueltos = paquete.gastos.filter((g) => g.estado_gasto === 'devuelto');
  const gastosVisibles = filtroGastos === 'devueltos' ? gastosDevueltos : paquete.gastos;
  const hayDevueltos = gastosDevueltos.length > 0;
  // Cualquier rol puede subir documentos mientras está en revisión
  const puedeSubirDocs = paquete.estado === 'en_revision';
  const puedeEditarAsignaciones = paquete.estado === 'en_revision';
  const puedeMarcarPagado = paquete.estado === 'en_tesoreria' && esTes;

  return (
    <>
      {showDevolver && (
        <ModalDevolver
          onConfirmar={handleDevolver}
          onCancelar={() => setShowDevolver(false)}
          loading={loadingDevolver}
        />
      )}
      {showDevolverGastoId && (
        <ModalDevolver
          titulo="Devolver gasto individual"
          descripcion="El gasto será devuelto al técnico para corrección. El resto del paquete no se ve afectado."
          onConfirmar={handleDevolverGasto}
          onCancelar={() => setShowDevolverGastoId(null)}
          loading={loadingDevolverGasto}
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
              <div className="flex items-center gap-2 flex-wrap">
                <p
                  style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#00829a' }}
                  className="text-lg font-bold"
                >
                  {formatSemanaLabel(paquete.semana)}
                </p>
                {paquete.folio && (
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded border"
                    style={{ backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0', fontFamily: 'monospace' }}
                  >
                    {paquete.folio}
                  </span>
                )}
              </div>
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
              {paquete.monto_a_pagar !== null && paquete.monto_a_pagar !== paquete.monto_total ? (
                <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="flex flex-col gap-0.5">
                  <span>
                    <span className="text-gray-400">Total bruto: </span>
                    <span className="line-through text-gray-400">{fmtMonto(paquete.monto_total)}</span>
                  </span>
                  <span>
                    <span className="text-gray-400">Gastos devueltos: </span>
                    <span className="font-semibold text-red-500">−{fmtMonto(paquete.monto_total - paquete.monto_a_pagar)}</span>
                  </span>
                  <span>
                    <span className="text-gray-400">A pagar: </span>
                    <span className="font-bold text-green-600">{fmtMonto(paquete.monto_a_pagar)}</span>
                  </span>
                </span>
              ) : (
                <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  <span className="text-gray-400">Total: </span>
                  <span className="font-semibold text-gray-700">{fmtMonto(paquete.monto_total)}</span>
                </span>
              )}
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

          {/* Aprobación vía correo electrónico */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span
                  className="text-sm font-semibold text-gray-600"
                  style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                >
                  Aprobación de Gerencia
                </span>
              </div>

              {paquete.estado === 'en_revision' ? (
                <div className="flex flex-col gap-2 items-end">
                  {correoGerEnviado && (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border"
                      style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Correo enviado al <strong>Gerente Administrativo</strong></span>
                    </div>
                  )}
                  <button
                    onClick={handleReenviarCorreo}
                    disabled={loadingReenviarCorreo}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors hover:opacity-90 disabled:opacity-50"
                    style={{
                      color: correoGerEnviado ? '#00829a' : '#fff',
                      borderColor: correoGerEnviado ? '#b2e0e8' : '#1a3c6e',
                      backgroundColor: correoGerEnviado ? '#e0f5f7' : '#1a3c6e',
                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    }}
                  >
                    {loadingReenviarCorreo
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : correoGerEnviado
                        ? <RefreshCw className="w-3.5 h-3.5" />
                        : <Send className="w-3.5 h-3.5" />}
                    {correoGerEnviado ? 'Reenviar correo' : 'Enviar correo al Gerente Administrativo'}
                  </button>
                </div>
              ) : paquete.aprobacion_gerencia_filename ? (
                <button
                  onClick={handleDescargarAprobacion}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={{ color: '#00829a', borderColor: '#b2e0e8', backgroundColor: '#e0f5f7', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  {paquete.aprobacion_gerencia_filename}
                </button>
              ) : (
                <span className="text-xs text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  Aprobada vía correo electrónico
                </span>
              )}
            </div>
          </div>

          {/* Documento Contable General */}
          {verDocContable && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-gray-400" />
                  <span
                    className="text-sm font-semibold text-gray-600"
                    style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                  >
                    Documento Contable General
                  </span>
                  <span
                    className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full"
                    style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                  >
                    Facturas electrónicas
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {paquete.doc_contable_filename ? (
                    <>
                      <button
                        onClick={handlePreviewDocContable}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:opacity-80"
                        style={{ color: '#00829a', borderColor: '#b2e0e8', backgroundColor: '#e0f5f7', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                        title="Vista previa"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleDescargarDocContable}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:opacity-80"
                        style={{ color: '#00829a', borderColor: '#b2e0e8', backgroundColor: '#e0f5f7', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {paquete.doc_contable_filename}
                      </button>
                      {puedeGestionarDocContable && (
                        <button
                          onClick={handleEliminarDocContable}
                          disabled={eliminandoDocContable}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border transition-colors hover:bg-red-50 disabled:opacity-50"
                          style={{ color: '#ef4444', borderColor: '#fca5a5', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                          title="Eliminar documento contable"
                        >
                          {eliminandoDocContable ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </>
                  ) : puedeGestionarDocContable ? (
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors hover:opacity-90"
                      style={{ color: '#fff', backgroundColor: '#00829a', borderColor: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                      {uploadingDocContable
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Upload className="w-3.5 h-3.5" />}
                      {uploadingDocContable ? 'Subiendo...' : 'Adjuntar PDF contable'}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        disabled={uploadingDocContable}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleSubirDocContable(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  ) : (
                    <span className="text-xs text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                      Sin documento contable
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción — En revisión: solo guardar asignaciones si hay cambios */}
          {puedeActuar && hayAsignacionesDirty && (
            <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={handleGuardarAsignaciones}
                disabled={savingAsignaciones}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 border"
                style={{ color: '#00829a', borderColor: '#b2e0e8', backgroundColor: '#e0f5f7', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                {savingAsignaciones ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar asignaciones
              </button>
            </div>
          )}

          {/* Botones de acción — Aprobado: enviar a Tesorería o devolver */}
          {puedeEnviarTesoreria && (
            <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100 flex-wrap items-center">
              <div className="flex-1">
                {hayDevueltos ? (
                  <div
                    className="rounded-lg px-3 py-2 text-xs border"
                    style={{ backgroundColor: '#fffbeb', borderColor: '#fcd34d', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                  >
                    <p className="font-semibold text-amber-700 mb-1">Resumen de pago</p>
                    <p className="text-gray-600">
                      Total bruto: <span className="line-through">{fmtMonto(paquete.monto_total)}</span>
                    </p>
                    <p className="text-red-600">
                      Gastos devueltos: −{fmtMonto(gastosDevueltos.reduce((s, g) => s + g.valor_pagado, 0))}
                      <span className="text-gray-400 ml-1">({gastosDevueltos.length} gasto{gastosDevueltos.length !== 1 ? 's' : ''})</span>
                    </p>
                    <p className="font-bold text-green-700 mt-0.5">
                      A pagar a Tesorería: {fmtMonto(paquete.monto_total - gastosDevueltos.reduce((s, g) => s + g.valor_pagado, 0))}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                    El paquete fue aprobado. Envíalo a Tesorería o devuelve gastos con observaciones.
                  </p>
                )}
              </div>
              <button
                onClick={handleEnviarTesoreria}
                disabled={loadingEnviarTes || loadingDevolver}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#1d4ed8', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                {loadingEnviarTes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar a Tesorería
              </button>
            </div>
          )}

          {/* Botones de acción — En Tesorería: marca como pagado */}
          {puedeMarcarPagado && (
            <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100 flex-wrap items-center">
              <div className="flex-1">
                <p
                  className="text-xs text-gray-500"
                  style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                >
                  El paquete está pendiente de pago por parte de Tesorería.
                </p>
              </div>
              <button
                onClick={async () => {
                  setLoadingPagar(true);
                  try {
                    const updated = await pagarPaquete(paquete.id);
                    setPaquete(updated);
                    toast.success('Paquete marcado como pagado');
                    onAccion();
                  } catch (e: unknown) {
                    const msg = (e as { detail?: string })?.detail ?? 'Error al marcar como pagado';
                    toast.error(msg);
                  } finally {
                    setLoadingPagar(false);
                  }
                }}
                disabled={loadingPagar}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#1d4ed8', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                {loadingPagar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Marcar como pagado
              </button>
            </div>
          )}
        </div>

        {/* Gastos — tabla completa */}
        <div
          className="bg-white rounded-2xl border p-6 mb-4"
          style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              className="text-xs text-gray-400 uppercase tracking-wide"
            >
              Detalle de gastos ({gastosVisibles.length}{filtroGastos === 'devueltos' ? ` de ${paquete.gastos.length}` : ''})
            </p>
            <div className="flex items-center gap-2">
              {hayDevueltos && (
                <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
                  <button
                    onClick={() => setFiltroGastos('todos')}
                    className="px-3 py-1 text-xs font-semibold transition-colors"
                    style={{
                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                      backgroundColor: filtroGastos === 'todos' ? '#00829a' : 'white',
                      color: filtroGastos === 'todos' ? 'white' : '#6b7280',
                    }}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFiltroGastos('devueltos')}
                    className="px-3 py-1 text-xs font-semibold transition-colors flex items-center gap-1"
                    style={{
                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                      backgroundColor: filtroGastos === 'devueltos' ? '#ef4444' : 'white',
                      color: filtroGastos === 'devueltos' ? 'white' : '#ef4444',
                    }}
                  >
                    <AlertCircle className="w-3 h-3" />
                    Solo devueltos ({gastosDevueltos.length})
                  </button>
                </div>
              )}
              {selectedArchivos.size > 0 && (
                <button
                  onClick={handleDescargarSeleccionados}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ backgroundColor: '#00829a', color: 'white', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar seleccionados ({selectedArchivos.size})
                </button>
              )}
              {puedeEditarAsignaciones && (
                <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-xs text-gray-400">
                  Puedes asignar CC / CO / Cuenta Contable
                </p>
              )}
            </div>
          </div>

          {gastosVisibles.length === 0 ? (
            <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm text-gray-400 text-center py-4">
              Sin gastos registrados
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: puedeDevolverComoFact ? 1350 : 1250 }}>
                <thead>
                  <tr style={{ backgroundColor: '#00829a' }}>
                    {[
                      'Fecha', 'Pagado a', 'Concepto', 'No. Recibo',
                      'Centro Costo', 'Centro Operación', 'Cuenta Contable',
                      'Valor', 'Soporte', 'CM PDF',
                      ...(puedeDevolverComoFact ? ['Acción'] : []),
                    ].map((h) => (
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
                  {gastosVisibles.map((g, idx) => {
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
                              {g.archivos.map((arch) => {
                                const selKey = `${g.id}:${arch.id}`;
                                const isSelected = selectedArchivos.has(selKey);
                                return (
                                  <div
                                    key={arch.id}
                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors"
                                    style={{ borderColor: isSelected ? '#00829a' : '#b2e0e8', backgroundColor: isSelected ? '#e6f7fa' : 'transparent' }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleArchivo(g.id, arch.id)}
                                      className="w-3 h-3 shrink-0 cursor-pointer accent-[#00829a]"
                                      title="Seleccionar para descargar"
                                    />
                                    <button
                                      onClick={() => handlePreview(g.id, arch)}
                                      className="flex items-center gap-1 flex-1 text-left hover:underline min-w-0"
                                      style={{ color: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                                      title="Ver previsualización"
                                    >
                                      <Eye className="w-3 h-3 shrink-0" />
                                      <span className="truncate max-w-[90px]">{arch.filename}</span>
                                    </button>
                                    <button
                                      onClick={() => handleDescargar(g.id, arch.id, arch.filename)}
                                      className="shrink-0 hover:text-[#005f70] transition-colors"
                                      style={{ color: '#00829a' }}
                                      title="Descargar"
                                    >
                                      <Download className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        {/* CM PDF */}
                        <td className="px-2 py-2" style={{ minWidth: 130 }}>
                          {g.cm_pdf_filename ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                onClick={() => handlePreviewCmPdf(g.id, g.cm_pdf_filename!)}
                                className="flex items-center gap-1 text-xs px-1.5 py-1 rounded-lg border transition-colors hover:opacity-80"
                                style={{ color: '#7c3aed', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                                title="Vista previa"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDescargarCmPdf(g.id)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors hover:opacity-80 max-w-[80px]"
                                style={{ color: '#7c3aed', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                                title={g.cm_pdf_filename}
                              >
                                <Download className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[55px]">{g.cm_pdf_filename}</span>
                              </button>
                              {puedeGestionarCmPdf && (
                                <button
                                  onClick={() => handleEliminarCmPdf(g.id)}
                                  disabled={!!eliminandoCmPdf[g.id]}
                                  className="shrink-0 p-1 rounded transition-colors hover:bg-red-50 disabled:opacity-50"
                                  style={{ color: '#ef4444' }}
                                  title="Eliminar CM PDF"
                                >
                                  {eliminandoCmPdf[g.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          ) : puedeGestionarCmPdf ? (
                            <label
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border cursor-pointer transition-colors hover:opacity-90 whitespace-nowrap"
                              style={{ color: '#7c3aed', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                            >
                              {uploadingCmPdf[g.id]
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Paperclip className="w-3 h-3" />}
                              {uploadingCmPdf[g.id] ? 'Subiendo...' : 'CM PDF'}
                              <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                disabled={!!uploadingCmPdf[g.id]}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleSubirCmPdf(g.id, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {puedeDevolverComoFact && (
                          <td className="px-2 py-2">
                            {g.estado_gasto === 'devuelto' ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                              >
                                <AlertCircle className="w-3 h-3" />
                                Devuelto
                              </span>
                            ) : (
                              <button
                                onClick={() => setShowDevolverGastoId(g.id)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors hover:bg-red-50 whitespace-nowrap"
                                style={{ color: '#ef4444', borderColor: '#fca5a5', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                              >
                                <RotateCcw className="w-3 h-3" />
                                Devolver
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={7} className="py-3 px-2 text-xs font-semibold text-gray-500" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                      {filtroGastos === 'devueltos' ? 'Total devueltos' : 'Total'}
                    </td>
                    <td className="py-3 px-2 font-bold text-sm" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: filtroGastos === 'devueltos' ? '#ef4444' : '#00829a' }}>
                      {fmtMonto(gastosVisibles.reduce((s, g) => s + g.valor_pagado, 0))}
                    </td>
                    <td /><td />
                    {puedeDevolverComoFact && <td />}
                  </tr>
                  {filtroGastos === 'devueltos' && paquete.monto_total > gastosDevueltos.reduce((s, g) => s + g.valor_pagado, 0) && (
                    <tr>
                      <td colSpan={7} className="py-2 px-2 text-xs font-semibold text-green-700" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                        Monto a pagar (sin devueltos)
                      </td>
                      <td className="py-2 px-2 font-bold text-sm text-green-700" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                        {fmtMonto(paquete.monto_total - gastosDevueltos.reduce((s, g) => s + g.valor_pagado, 0))}
                      </td>
                      <td /><td />
                      {puedeDevolverComoFact && <td />}
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Modal previsualización doc contable / CM PDF */}
        {previewDoc && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setPreviewDoc(null)}
          >
            <div
              className="bg-white flex flex-col"
              style={{ width: 'min(1200px, 95vw)', height: '92vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 border-b border-gray-200 flex-shrink-0" style={{ height: 52 }}>
                <span className="text-sm font-semibold text-gray-800 truncate" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                  {previewDoc.filename}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewDoc.url}
                    download={previewDoc.filename}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ backgroundColor: '#00829a', color: 'white', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar
                  </a>
                  <button onClick={() => setPreviewDoc(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <XIcon className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-gray-50">
                <iframe
                  src={`${previewDoc.url}#zoom=page-width`}
                  className="w-full h-full border-0"
                  title={previewDoc.filename}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal previsualización de soporte */}
        {previewArchivo && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setPreviewArchivo(null)}
          >
            <div
              className="bg-white flex flex-col"
              style={{ width: 'min(1200px, 95vw)', height: '92vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 border-b border-gray-200 flex-shrink-0" style={{ height: 52 }}>
                <span className="text-sm font-semibold text-gray-800 truncate" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                  {previewArchivo.filename}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (previewArchivo.gastoId && previewArchivo.archivoId) {
                        await handleDescargar(previewArchivo.gastoId, previewArchivo.archivoId, previewArchivo.filename);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ backgroundColor: '#00829a', color: 'white', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar
                  </button>
                  <button onClick={() => setPreviewArchivo(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <XIcon className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-hidden bg-gray-50">
                {previewArchivo.contentType === 'application/pdf' ? (
                  <iframe
                    src={`${previewArchivo.url}#zoom=page-width`}
                    className="w-full h-full border-0"
                    title={previewArchivo.filename}
                  />
                ) : previewArchivo.contentType?.startsWith('image/') ? (
                  <ZoomableImage src={previewArchivo.url} alt={previewArchivo.filename} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-sm text-gray-500">Vista previa no disponible para este tipo de archivo.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
  const { user } = useAuth();
  const rolLista = user?.role?.toLowerCase() ?? '';
  const areaLista = user?.area?.code?.toLowerCase() ?? '';
  const esFact = ['admin', 'fact'].includes(rolLista) || ['admin', 'fact'].includes(areaLista);

  const [vista, setVista] = useState<Vista>('lista');
  const [paqueteActivo, setPaqueteActivo] = useState<string | null>(null);
  const [abrioDesdeDevueltos, setAbrioDesdeDevueltos] = useState(false);
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
    setAbrioDesdeDevueltos(false);
    onVistaChange?.('lista');
  };

  const paquetesEnviados = paquetes.filter((p) => p.estado !== 'borrador');

  // Para facturación: "En revisión" muestra los aprobados por responsable (pendientes de enviar a tesorería)
  // Para responsable: "En revisión" muestra los enviados por el técnico (pendientes de aprobar)
  const estadoRevision: EstadoPaquete = esFact ? 'aprobado' : 'en_revision';

  const paquetesFiltrados =
    filtro === 'todos'
      ? paquetesEnviados
      : filtro === 'devuelto'
        ? paquetesEnviados.filter(
            (p) => p.estado === 'devuelto' || p.tiene_gastos_devueltos
          )
        : paquetesEnviados.filter((p) => p.estado === (filtro === 'en_revision' ? estadoRevision : filtro));

  const pendientes = paquetes.filter((p) => p.estado === estadoRevision).length;
  const devueltosCount = paquetes.filter(
    (p) => p.estado !== 'borrador' && (p.estado === 'devuelto' || p.tiene_gastos_devueltos)
  ).length;

  const FILTROS: { value: Filtro; label: string }[] = [
    { value: 'en_revision',  label: 'En revisión' },
    { value: 'en_tesoreria', label: 'En Tesorería' },
    { value: 'devuelto',     label: 'Devueltos' },
    { value: 'pagado',       label: 'Pagados' },
    { value: 'todos',        label: 'Todos' },
  ];

  if (vista === 'detalle' && paqueteActivo) {
    return (
      <DetallePaqueteResponsable
        paqueteId={paqueteActivo}
        onCerrar={irALista}
        onAccion={irALista}
        soloDevueltos={abrioDesdeDevueltos}
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
                style={{ backgroundColor: filtro === 'en_revision' ? 'rgba(255,255,255,0.3)' : '#f59e0b', color: 'white' }}
              >
                {pendientes}
              </span>
            )}
            {f.value === 'devuelto' && devueltosCount > 0 && (
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                style={{ backgroundColor: filtro === 'devuelto' ? 'rgba(255,255,255,0.3)' : '#ef4444', color: 'white' }}
              >
                {devueltosCount}
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
              onClick={() => {
                setPaqueteActivo(p.id);
                setVista('detalle');
                setAbrioDesdeDevueltos(filtro === 'devuelto' && p.tiene_gastos_devueltos);
                onVistaChange?.('detalle');
              }}
              className="w-full text-left bg-white rounded-xl border transition-all p-5 hover:shadow-md"
              style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#00829a' }}
                      className="text-sm font-bold"
                    >
                      {formatSemanaLabel(p.semana)}
                    </p>
                    {p.folio && (
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded border"
                        style={{ backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}
                      >
                        {p.folio}
                      </span>
                    )}
                    {p.tiene_gastos_devueltos && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                      >
                        <AlertCircle className="w-3 h-3" />
                        Gastos devueltos
                      </span>
                    )}
                  </div>
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
