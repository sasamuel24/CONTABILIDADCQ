/**
 * Vista de paquetes de gastos para Tesorería.
 * Lista paquetes en_tesoreria/pagados y permite abrir una vista de auditoría
 * completa antes de registrar el pago.
 */
import { useState, useEffect, useCallback } from 'react';
import { ZoomableImage } from './ZoomableImage';
import { createPortal } from 'react-dom';
import {
  listPaquetesGastos,
  getPaqueteGasto,
  pagarPaquete,
  pagarPaquetesMasivo,
  getAprobacionGerenciaDownloadUrl,
  getDocContableDownloadUrl,
  getCmPdfGastoDownloadUrl,
  getDownloadUrlArchivoGasto,
  proxyDownloadArchivoGasto,
  PaqueteListItem,
  PaqueteOut,
  GastoOut,
} from '../lib/api';
import { toast } from 'sonner';
import {
  Loader2,
  CalendarDays,
  Wallet,
  CheckCircle2,
  PackageOpen,
  RefreshCw,
  ArrowLeft,
  Download,
  FileText,
  Banknote,
  User,
  Mail,
  FileCheck,
  Eye,
  ShieldCheck,
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
// Vista detalle / auditoría de un paquete (Tesorería)
// ---------------------------------------------------------------------------

function DetalleAuditoriaTes({
  paqueteId,
  onCerrar,
  onPagado,
}: {
  paqueteId: string;
  onCerrar: () => void;
  onPagado: () => void;
}) {
  const [paquete, setPaquete] = useState<PaqueteOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPagar, setLoadingPagar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<{ url: string; filename: string; contentType: string } | null>(null);
  const [modalPagarOpen, setModalPagarOpen] = useState(false);
  const [fechaPagoSeleccionada, setFechaPagoSeleccionada] = useState<string>(() => {
    const hoy = new Date();
    return hoy.toISOString().slice(0, 10);
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getPaqueteGasto(paqueteId);
        setPaquete(data);
      } catch {
        toast.error('Error al cargar el paquete');
      } finally {
        setLoading(false);
      }
    })();
  }, [paqueteId]);

  const handleAbrirModalPagar = () => {
    const hoy = new Date();
    setFechaPagoSeleccionada(hoy.toISOString().slice(0, 10));
    setModalPagarOpen(true);
  };

  const handleConfirmarPago = async () => {
    if (!paquete) return;
    setLoadingPagar(true);
    try {
      const fechaISO = fechaPagoSeleccionada ? `${fechaPagoSeleccionada}T12:00:00` : undefined;
      const updated = await pagarPaquete(paquete.id, fechaISO);
      setPaquete(updated);
      setModalPagarOpen(false);
      toast.success('Paquete marcado como pagado');
      onPagado();
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Error al registrar el pago';
      toast.error(msg);
    } finally {
      setLoadingPagar(false);
    }
  };

  const handleDescargarAprobacion = async () => {
    if (!paquete) return;
    try {
      const { download_url } = await getAprobacionGerenciaDownloadUrl(paquete.id);
      window.open(download_url, '_blank');
    } catch {
      toast.error('No se pudo descargar la aprobación de gerencia');
    }
  };

  const handleDescargarDocContable = async () => {
    if (!paquete) return;
    try {
      const { download_url } = await getDocContableDownloadUrl(paquete.id);
      window.open(download_url, '_blank');
    } catch {
      toast.error('No se pudo descargar el documento contable');
    }
  };

  const handlePreviewDocContable = async () => {
    if (!paquete?.doc_contable_filename) return;
    try {
      const { download_url } = await getDocContableDownloadUrl(paquete.id);
      setPreviewUrl({ url: download_url, filename: paquete.doc_contable_filename, contentType: 'application/pdf' });
    } catch {
      toast.error('No se pudo cargar la vista previa');
    }
  };

  const handleDescargarCmPdf = async (gastoId: string) => {
    if (!paquete) return;
    try {
      const { download_url } = await getCmPdfGastoDownloadUrl(paquete.id, gastoId);
      window.open(download_url, '_blank');
    } catch {
      toast.error('No se pudo descargar el CM PDF');
    }
  };

  const handlePreviewCmPdf = async (gastoId: string, filename: string) => {
    if (!paquete) return;
    try {
      const { download_url } = await getCmPdfGastoDownloadUrl(paquete.id, gastoId);
      setPreviewUrl({ url: download_url, filename, contentType: 'application/pdf' });
    } catch {
      toast.error('No se pudo cargar la vista previa del CM PDF');
    }
  };

  const handleDescargarSoporte = async (gasto: GastoOut, archivoId: string, filename: string) => {
    if (!paquete) return;
    try {
      await proxyDownloadArchivoGasto(paquete.id, gasto.id, archivoId, filename);
    } catch {
      toast.error('No se pudo descargar el soporte');
    }
  };

  const handlePreviewSoporte = async (gasto: GastoOut, arch: { id: string; filename: string; content_type: string }) => {
    if (!paquete) return;
    try {
      const { download_url } = await getDownloadUrlArchivoGasto(paquete.id, gasto.id, arch.id);
      setPreviewUrl({ url: download_url, filename: arch.filename, contentType: arch.content_type });
    } catch {
      toast.error('No se pudo cargar la vista previa');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
      </div>
    );
  }

  if (!paquete) return null;

  const gastosDevueltos = paquete.gastos.filter((g) => g.estado_gasto === 'devuelto');
  const montoAPagar = paquete.monto_a_pagar ?? paquete.monto_total;
  const yaPagado = paquete.estado === 'pagado';

  return (
    <>
      {/* Modal previsualización */}
      {previewUrl && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="bg-white flex flex-col"
            style={{ width: 'min(1200px, 95vw)', height: '92vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 border-b border-gray-200 flex-shrink-0" style={{ height: 52 }}>
              <span className="text-sm font-semibold text-gray-800 truncate" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                {previewUrl.filename}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl.url}
                  download={previewUrl.filename}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ backgroundColor: '#00829a', color: 'white', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </a>
                <button onClick={() => setPreviewUrl(null)} className="px-3 py-1.5 text-xs rounded-lg border text-gray-600 hover:bg-gray-50">
                  Cerrar
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-50">
              {previewUrl.contentType === 'application/pdf' ? (
                <iframe src={`${previewUrl.url}#zoom=page-width`} className="w-full h-full border-0" title={previewUrl.filename} />
              ) : previewUrl.contentType?.startsWith('image/') ? (
                <ZoomableImage src={previewUrl.url} alt={previewUrl.filename} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-sm text-gray-500">Vista previa no disponible.</p>
                </div>
              )}
            </div>
          </div>
        </div>
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
        <div className="bg-white rounded-2xl border p-6 mb-4" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* Título y badge */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#00829a' }} className="text-lg font-bold">
                  {formatSemanaLabel(paquete.semana)}
                </p>
                {paquete.folio && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded border" style={{ backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}>
                    {paquete.folio}
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: yaPagado ? '#f0fdf4' : '#eff6ff',
                    color: yaPagado ? '#0e7490' : '#1d4ed8',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: yaPagado ? '#06b6d4' : '#3b82f6' }} />
                  {yaPagado ? 'Pagado' : 'En Tesorería'}
                </span>
              </div>
              <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm text-gray-400 mt-0.5">
                {formatRango(paquete.fecha_inicio, paquete.fecha_fin)}
              </p>
            </div>

            {/* Badge auditoría */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
              style={{ color: '#7c3aed', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Modo Auditoría
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm mb-5">
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
                {paquete.monto_a_pagar !== null && paquete.monto_a_pagar !== paquete.monto_total ? (
                  <span className="flex flex-col gap-0.5">
                    <span><span className="text-gray-400">Bruto: </span><span className="line-through text-gray-400">{fmtMonto(paquete.monto_total)}</span></span>
                    <span><span className="text-gray-400">A pagar: </span><span className="font-bold text-green-600">{fmtMonto(paquete.monto_a_pagar ?? 0)}</span></span>
                  </span>
                ) : (
                  <span><span className="text-gray-400">Total: </span><span className="font-semibold text-gray-700">{fmtMonto(paquete.monto_total)}</span></span>
                )}
              </span>
            </div>
            {paquete.fecha_envio && (
              <div className="flex items-center gap-2 text-gray-600">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  <span className="text-gray-400">Enviado por Radicación: </span>
                  {fmtFecha(paquete.fecha_envio.slice(0, 10))}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <FileText className="w-4 h-4 text-gray-400" />
              <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                <span className="text-gray-400">Documentos: </span>{paquete.total_documentos}
              </span>
            </div>
          </div>

          {/* Aprobación de Gerencia */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-600" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                  Aprobación de Gerencia
                </span>
              </div>
              {paquete.aprobacion_gerencia_filename ? (
                <button
                  onClick={handleDescargarAprobacion}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:opacity-80"
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
          <div className="pt-4 mt-4 border-t border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-600" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                  Documento Contable General
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  Facturas electrónicas
                </span>
              </div>
              {paquete.doc_contable_filename ? (
                <div className="flex items-center gap-1.5">
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
                </div>
              ) : (
                <span className="text-xs text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  Sin documento contable adjunto
                </span>
              )}
            </div>
          </div>

          {/* Botón Pagar */}
          {!yaPagado && (
            <div className="flex items-center justify-between mt-5 pt-5 border-t border-gray-100 flex-wrap gap-3">
              <div>
                {gastosDevueltos.length > 0 ? (
                  <div className="rounded-lg px-3 py-2 text-xs border" style={{ backgroundColor: '#fffbeb', borderColor: '#fcd34d' }}>
                    <p className="font-semibold text-amber-700 mb-0.5">Resumen de pago</p>
                    <p className="text-gray-600">Gastos devueltos: <span className="text-red-600 font-semibold">{gastosDevueltos.length}</span></p>
                    <p className="text-green-700 font-bold">A pagar: {fmtMonto(montoAPagar)}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                    Verifique los documentos y confirme el pago al técnico.
                  </p>
                )}
              </div>
              <button
                onClick={handleAbrirModalPagar}
                disabled={loadingPagar}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#0e7490', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                <Wallet className="w-4 h-4" />
                Registrar Pago
              </button>
            </div>
          )}

          {/* Modal: seleccionar fecha de pago — renderizado en document.body para evitar conflictos de z-index/transform */}
          {modalPagarOpen && createPortal(
            <div
              style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                backgroundColor: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onClick={(e) => { if (e.target === e.currentTarget) setModalPagarOpen(false); }}
            >
              <div
                style={{
                  background: '#fff', borderRadius: 14, padding: '28px 28px 24px',
                  width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                  fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <p style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 18, color: '#111827' }}>
                  Confirmar registro de pago
                </p>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Fecha de pago
                </label>
                <input
                  type="date"
                  value={fechaPagoSeleccionada}
                  onChange={(e) => setFechaPagoSeleccionada(e.target.value)}
                  style={{
                    width: '100%', border: '1px solid #d1d5db', borderRadius: 8,
                    padding: '8px 12px', fontSize: 14, outline: 'none',
                    fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                  <button
                    onClick={() => setModalPagarOpen(false)}
                    disabled={loadingPagar}
                    style={{
                      padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      color: '#374151', border: '1px solid #d1d5db', background: '#fff',
                      cursor: 'pointer', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmarPago}
                    disabled={loadingPagar || !fechaPagoSeleccionada}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      color: '#fff', background: '#0e7490', border: 'none',
                      cursor: loadingPagar || !fechaPagoSeleccionada ? 'not-allowed' : 'pointer',
                      opacity: loadingPagar || !fechaPagoSeleccionada ? 0.6 : 1,
                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    }}
                  >
                    {loadingPagar ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" /> : <Wallet style={{ width: 15, height: 15 }} />}
                    Confirmar pago
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {yaPagado && paquete.fecha_pago && (
            <div className="flex items-center gap-2 mt-5 pt-5 border-t border-gray-100">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm font-semibold text-green-700" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                Pagado el {fmtFecha(paquete.fecha_pago.slice(0, 10))}
              </span>
            </div>
          )}
        </div>

        {/* Tabla de gastos — auditoría completa */}
        <div className="bg-white rounded-2xl border p-6 mb-4" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-4" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            Detalle de gastos ({paquete.gastos.length})
          </p>

          {paquete.gastos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              Sin gastos registrados
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 1100 }}>
                <thead>
                  <tr style={{ backgroundColor: '#00829a' }}>
                    {['Fecha', 'Pagado a', 'Concepto', 'No. Recibo', 'Centro Costo', 'Centro Operación', 'Cuenta Contable', 'Valor', 'Soportes', 'CM PDF', 'Estado'].map((h) => (
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
                  {paquete.gastos.map((g, idx) => (
                    <tr
                      key={g.id}
                      className="border-t border-gray-100"
                      style={{
                        backgroundColor: g.estado_gasto === 'devuelto'
                          ? '#fef2f2'
                          : idx % 2 === 0 ? '#fff' : '#f8fafc',
                      }}
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
                      <td className="px-2 py-2 text-gray-500" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                        {g.no_recibo || '—'}
                      </td>
                      <td className="px-2 py-2 text-gray-600" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', minWidth: 120 }}>
                        {g.centro_costo?.nombre ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-gray-600" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', minWidth: 130 }}>
                        {g.centro_operacion?.nombre ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-gray-600" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', minWidth: 140 }}>
                        {g.cuenta_auxiliar ? `${g.cuenta_auxiliar.codigo} — ${g.cuenta_auxiliar.descripcion}` : '—'}
                      </td>
                      <td className="px-2 py-2 font-semibold whitespace-nowrap" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', color: '#00829a' }}>
                        {fmtMonto(g.valor_pagado)}
                      </td>

                      {/* Soportes */}
                      <td className="px-2 py-2" style={{ minWidth: 120 }}>
                        {g.archivos.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {g.archivos.map((arch) => (
                              <div key={arch.id} className="flex items-center gap-1">
                                <button
                                  onClick={() => handlePreviewSoporte(g, arch)}
                                  className="flex items-center gap-1 text-xs hover:underline"
                                  style={{ color: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                                  title="Ver previsualización"
                                >
                                  <Eye className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[80px]">{arch.filename}</span>
                                </button>
                                <button
                                  onClick={() => handleDescargarSoporte(g, arch.id, arch.filename)}
                                  className="shrink-0 hover:opacity-70 transition-opacity"
                                  style={{ color: '#00829a' }}
                                  title="Descargar"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* CM PDF */}
                      <td className="px-2 py-2" style={{ minWidth: 130 }}>
                        {g.cm_pdf_filename ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handlePreviewCmPdf(g.id, g.cm_pdf_filename!)}
                              className="flex items-center gap-1 text-xs px-1.5 py-1 rounded-lg border hover:opacity-80 transition-opacity"
                              style={{ color: '#7c3aed', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                              title="Vista previa"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDescargarCmPdf(g.id)}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border hover:opacity-80 transition-opacity max-w-[85px]"
                              style={{ color: '#7c3aed', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                              title={g.cm_pdf_filename}
                            >
                              <Download className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[55px]">{g.cm_pdf_filename}</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Estado del gasto */}
                      <td className="px-2 py-2">
                        {g.estado_gasto === 'devuelto' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                            Devuelto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={7} className="py-3 px-2 text-xs font-semibold text-gray-500" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                      Total a pagar
                    </td>
                    <td className="py-3 px-2 font-bold text-sm" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#0e7490' }}>
                      {fmtMonto(montoAPagar)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
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
// Vista principal — lista de paquetes Tesorería
// ---------------------------------------------------------------------------

export function TesoreriaPaquetesView() {
  const [pendientes, setPendientes] = useState<PaqueteListItem[]>([]);
  const [historial, setHistorial] = useState<PaqueteListItem[]>([]);
  const [trazabilidad, setTrazabilidad] = useState<PaqueteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTraz, setLoadingTraz] = useState(false);
  const [tab, setTab] = useState<'pendientes' | 'historial' | 'trazabilidad'>('pendientes');
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [paginaTraz, setPaginaTraz] = useState(1);
  const FILAS_POR_PAGINA = 15;

  // Detalle / auditoría
  const [paqueteDetalleId, setPaqueteDetalleId] = useState<string | null>(null);

  // Selección masiva
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [modalMasivoOpen, setModalMasivoOpen] = useState(false);
  const [fechaMasivoSeleccionada, setFechaMasivoSeleccionada] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [loadingMasivo, setLoadingMasivo] = useState(false);

  // Ordenamiento pendientes
  type SortCol = 'semana' | 'tecnico' | 'monto_total' | 'monto_a_pagar' | 'fecha_envio_tesoreria';
  const [sortCol, setSortCol] = useState<SortCol>('semana');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSortPend = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [resPendientes, resHistorial] = await Promise.all([
        listPaquetesGastos({ estado: 'en_tesoreria', limit: 200 }),
        listPaquetesGastos({ estado: 'pagado', limit: 200 }),
      ]);
      setPendientes(resPendientes.paquetes);
      setHistorial(resHistorial.paquetes);
    } catch {
      toast.error('Error al cargar los paquetes de tesorería');
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarTrazabilidad = useCallback(async () => {
    setLoadingTraz(true);
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
      setTrazabilidad(acumulados);
    } catch {
      toast.error('Error al cargar la trazabilidad');
    } finally {
      setLoadingTraz(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleSeleccion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodos = (ids: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    setSeleccionados(prev =>
      prev.size === ids.length ? new Set() : new Set(ids)
    );
  };

  const handleAbrirModalMasivo = () => {
    setFechaMasivoSeleccionada(new Date().toISOString().slice(0, 10));
    setModalMasivoOpen(true);
  };

  const handleConfirmarPagoMasivo = async () => {
    if (seleccionados.size === 0) return;
    setLoadingMasivo(true);
    try {
      const fechaISO = fechaMasivoSeleccionada ? `${fechaMasivoSeleccionada}T12:00:00` : undefined;
      const resultado = await pagarPaquetesMasivo(Array.from(seleccionados), fechaISO);
      setModalMasivoOpen(false);
      setSeleccionados(new Set());
      if (resultado.errores.length === 0) {
        toast.success(`${resultado.pagados} paquete${resultado.pagados !== 1 ? 's' : ''} marcado${resultado.pagados !== 1 ? 's' : ''} como pagado${resultado.pagados !== 1 ? 's' : ''}`);
      } else {
        toast.success(`${resultado.pagados} pagado${resultado.pagados !== 1 ? 's' : ''}`);
        toast.error(`${resultado.errores.length} error${resultado.errores.length !== 1 ? 'es' : ''} al procesar`);
      }
      await cargar();
    } catch {
      toast.error('Error al procesar el pago masivo');
    } finally {
      setLoadingMasivo(false);
    }
  };

  // Si estamos en detalle, renderizar la vista de auditoría
  if (paqueteDetalleId) {
    return (
      <div className="p-8">
        <DetalleAuditoriaTes
          paqueteId={paqueteDetalleId}
          onCerrar={() => setPaqueteDetalleId(null)}
          onPagado={() => {
            setPaqueteDetalleId(null);
            cargar();
          }}
        />
      </div>
    );
  }

  const listaBase = tab === 'pendientes' ? pendientes : tab === 'historial' ? historial : [];
  const listaFiltrada = filtroNombre.trim()
    ? listaBase.filter(p =>
        (p.tecnico?.nombre ?? '').toLowerCase().includes(filtroNombre.trim().toLowerCase())
      )
    : listaBase;

  const lista = [...listaFiltrada].sort((a, b) => {
    let aVal: string | number | null;
    let bVal: string | number | null;
    switch (sortCol) {
      case 'semana':
        aVal = a.fecha_inicio ?? '';
        bVal = b.fecha_inicio ?? '';
        break;
      case 'tecnico':
        aVal = a.tecnico?.nombre ?? '';
        bVal = b.tecnico?.nombre ?? '';
        break;
      case 'monto_total':
        aVal = Number(a.monto_total);
        bVal = Number(b.monto_total);
        break;
      case 'monto_a_pagar':
        aVal = Number(a.monto_a_pagar ?? a.monto_total);
        bVal = Number(b.monto_a_pagar ?? b.monto_total);
        break;
      case 'fecha_envio_tesoreria':
        aVal = a.fecha_envio_tesoreria ?? '';
        bVal = b.fecha_envio_tesoreria ?? '';
        break;
    }
    if (aVal === bVal) return 0;
    if (aVal === '' || aVal === null) return 1;
    if (bVal === '' || bVal === null) return -1;
    const cmp = typeof aVal === 'number'
      ? aVal - (bVal as number)
      : String(aVal).localeCompare(String(bVal));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Trazabilidad con doble filtro
  const listaTraz = trazabilidad
    .filter(p => !filtroEstado || p.estado === filtroEstado)
    .filter(p => !filtroNombre.trim() || (p.tecnico?.nombre ?? '').toLowerCase().includes(filtroNombre.trim().toLowerCase()));

  const totalPaginasTraz = Math.max(1, Math.ceil(listaTraz.length / FILAS_POR_PAGINA));
  const paginaTrazClamped = Math.min(paginaTraz, totalPaginasTraz);
  const listaTrazPagina = listaTraz.slice((paginaTrazClamped - 1) * FILAS_POR_PAGINA, paginaTrazClamped * FILAS_POR_PAGINA);

  const ESTADOS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
    borrador:     { label: 'Borrador',       bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
    en_revision:  { label: 'En revisión',    bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    devuelto:     { label: 'Devuelto',       bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    aprobado:     { label: 'Aprobado',       bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    en_tesoreria: { label: 'En Tesorería',   bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' },
    pagado:       { label: 'Pagado',         bg: '#f0fdf4', color: '#065f46', border: '#6ee7b7' },
  };

  const conteoEstados = trazabilidad.reduce<Record<string, number>>((acc, p) => {
    acc[p.estado] = (acc[p.estado] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            Paquetes de Gastos
          </h2>
          <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            Pagos pendientes remitidos por Radicación
          </p>
        </div>
        <button
          onClick={tab === 'trazabilidad' ? cargarTrazabilidad : cargar}
          disabled={tab === 'trazabilidad' ? loadingTraz : loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors"
          style={{ color: '#00829a', borderColor: '#b2e0e8', backgroundColor: '#e0f5f7', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(tab === 'trazabilidad' ? loadingTraz : loading) ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { value: 'pendientes',   label: 'Pendientes de pago', count: pendientes.length },
          { value: 'historial',    label: 'Pagados',            count: historial.length },
          { value: 'trazabilidad', label: 'Trazabilidad',       count: 0 },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => {
              const v = t.value as 'pendientes' | 'historial' | 'trazabilidad';
              setTab(v);
              setSeleccionados(new Set());
              setFiltroNombre('');
              setFiltroEstado('');
              if (v === 'trazabilidad') cargarTrazabilidad();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: tab === t.value ? 'white' : 'transparent',
              color: tab === t.value ? '#00829a' : '#6b7280',
              boxShadow: tab === t.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: tab === t.value ? (t.value === 'pendientes' ? '#1d4ed8' : '#0e7490') : '#e5e7eb',
                  color: tab === t.value ? 'white' : '#6b7280',
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: TRAZABILIDAD ─────────────────────────────────────── */}
      {tab === 'trazabilidad' && (
        <>
          {loadingTraz ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
            </div>
          ) : (
            <>
              {/* Tarjetas resumen por estado */}
              <div className="grid grid-cols-3 gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {Object.entries(ESTADOS_CONFIG).map(([estado, cfg]) => (
                  <button
                    key={estado}
                    onClick={() => { setFiltroEstado(prev => prev === estado ? '' : estado); setPaginaTraz(1); }}
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
              <div className="flex gap-3 mb-4 flex-wrap">
                <input
                  type="text"
                  placeholder="Filtrar por técnico..."
                  value={filtroNombre}
                  onChange={e => { setFiltroNombre(e.target.value); setPaginaTraz(1); }}
                  className="text-sm px-3 py-1.5 rounded-lg border outline-none"
                  style={{ borderColor: '#d1d5db', fontFamily: 'Neutra Text Book, Montserrat, sans-serif', minWidth: 220 }}
                />
                <select
                  value={filtroEstado}
                  onChange={e => { setFiltroEstado(e.target.value); setPaginaTraz(1); }}
                  className="text-sm px-3 py-1.5 rounded-lg border outline-none"
                  style={{ borderColor: '#d1d5db', fontFamily: 'Neutra Text Book, Montserrat, sans-serif', color: '#374151' }}
                >
                  <option value="">Todos los estados</option>
                  {Object.entries(ESTADOS_CONFIG).map(([v, c]) => (
                    <option key={v} value={v}>{c.label}</option>
                  ))}
                </select>
                {(filtroNombre || filtroEstado) && (
                  <button
                    onClick={() => { setFiltroNombre(''); setFiltroEstado(''); setPaginaTraz(1); }}
                    style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                  >
                    Limpiar filtros
                  </button>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', alignSelf: 'center', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  {listaTraz.length} paquete{listaTraz.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Tabla trazabilidad */}
              <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {listaTraz.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <PackageOpen className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Sin resultados</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: '#00829a' }}>
                        {['Folio', 'Semana', 'Técnico', 'Monto total', 'Valor a pagar', 'Estado', 'Última actualización'].map(h => (
                          <th key={h} className="px-5 py-3 text-left font-semibold text-white whitespace-nowrap"
                            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 12 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {listaTrazPagina.map((p, idx) => {
                        const cfg = ESTADOS_CONFIG[p.estado] ?? ESTADOS_CONFIG['borrador'];
                        return (
                          <tr key={p.id}
                            className="border-t border-gray-100"
                            style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}
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
                )}

                {/* Footer de paginación */}
                {listaTraz.length > FILAS_POR_PAGINA && (
                  <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: '#e5e7eb' }}>
                    <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                      Mostrando {(paginaTrazClamped - 1) * FILAS_POR_PAGINA + 1}–{Math.min(paginaTrazClamped * FILAS_POR_PAGINA, listaTraz.length)} de {listaTraz.length}
                    </span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button
                        onClick={() => setPaginaTraz(1)}
                        disabled={paginaTrazClamped === 1}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid #d1d5db',
                          background: '#fff', color: paginaTrazClamped === 1 ? '#d1d5db' : '#374151',
                          cursor: paginaTrazClamped === 1 ? 'not-allowed' : 'pointer',
                          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                        }}
                      >«</button>
                      <button
                        onClick={() => setPaginaTraz(p => Math.max(1, p - 1))}
                        disabled={paginaTrazClamped === 1}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid #d1d5db',
                          background: '#fff', color: paginaTrazClamped === 1 ? '#d1d5db' : '#374151',
                          cursor: paginaTrazClamped === 1 ? 'not-allowed' : 'pointer',
                          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                        }}
                      >‹</button>

                      {/* Números de página */}
                      {Array.from({ length: totalPaginasTraz }, (_, i) => i + 1)
                        .filter(n => n === 1 || n === totalPaginasTraz || Math.abs(n - paginaTrazClamped) <= 1)
                        .reduce<(number | 'ellipsis')[]>((acc, n, i, arr) => {
                          if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                          acc.push(n);
                          return acc;
                        }, [])
                        .map((item, i) =>
                          item === 'ellipsis' ? (
                            <span key={`e${i}`} style={{ padding: '4px 6px', fontSize: 12, color: '#9ca3af' }}>…</span>
                          ) : (
                            <button
                              key={item}
                              onClick={() => setPaginaTraz(item as number)}
                              style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 12,
                                border: '1px solid',
                                borderColor: paginaTrazClamped === item ? '#0e7490' : '#d1d5db',
                                background: paginaTrazClamped === item ? '#0e7490' : '#fff',
                                color: paginaTrazClamped === item ? '#fff' : '#374151',
                                cursor: 'pointer', fontWeight: paginaTrazClamped === item ? 700 : 400,
                                fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                              }}
                            >{item}</button>
                          )
                        )
                      }

                      <button
                        onClick={() => setPaginaTraz(p => Math.min(totalPaginasTraz, p + 1))}
                        disabled={paginaTrazClamped === totalPaginasTraz}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid #d1d5db',
                          background: '#fff', color: paginaTrazClamped === totalPaginasTraz ? '#d1d5db' : '#374151',
                          cursor: paginaTrazClamped === totalPaginasTraz ? 'not-allowed' : 'pointer',
                          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                        }}
                      >›</button>
                      <button
                        onClick={() => setPaginaTraz(totalPaginasTraz)}
                        disabled={paginaTrazClamped === totalPaginasTraz}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid #d1d5db',
                          background: '#fff', color: paginaTrazClamped === totalPaginasTraz ? '#d1d5db' : '#374151',
                          cursor: paginaTrazClamped === totalPaginasTraz ? 'not-allowed' : 'pointer',
                          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                        }}
                      >»</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── TABS: PENDIENTES / HISTORIAL ──────────────────────────── */}
      {tab !== 'trazabilidad' && (
      <>
      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
        </div>
      ) : listaBase.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <PackageOpen className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            {tab === 'pendientes' ? 'No hay pagos pendientes por el momento' : 'No hay paquetes pagados aún'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* Totalizador */}
          {tab === 'pendientes' && (
            <div className="flex items-center justify-between px-6 py-3 border-b" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <span className="text-sm text-green-700" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Total a pagar</span>
              <span className="text-lg font-bold text-green-800" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                {fmtMonto(lista.reduce((sum, p) => sum + Number(p.monto_a_pagar ?? p.monto_total), 0))}
              </span>
            </div>
          )}

            {/* Filtro por nombre */}
          <div className="px-5 py-3 border-b" style={{ borderColor: '#e5e7eb' }}>
            <input
              type="text"
              placeholder="Filtrar por nombre del técnico..."
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
              className="w-full max-w-xs text-sm px-3 py-1.5 rounded-lg border outline-none"
              style={{ borderColor: '#d1d5db', fontFamily: 'Neutra Text Book, Montserrat, sans-serif', color: '#374151' }}
            />
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#00829a' }}>
                {tab === 'pendientes' && (
                  <th className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={lista.length > 0 && seleccionados.size === lista.length}
                      ref={el => { if (el) el.indeterminate = seleccionados.size > 0 && seleccionados.size < lista.length; }}
                      onChange={() => {}}
                      onClick={(e) => toggleTodos(lista.map(p => p.id), e)}
                      style={{ width: 15, height: 15, accentColor: '#fff', cursor: 'pointer' }}
                      title="Seleccionar todos"
                    />
                  </th>
                )}
                {/* Cabeceras ordenables — solo activas en pendientes */}
                {([
                  { label: 'Semana',                col: 'semana' as SortCol,                  icon: <CalendarDays className="w-3.5 h-3.5" /> },
                  { label: 'Técnico',               col: 'tecnico' as SortCol,                 icon: <User className="w-3.5 h-3.5" /> },
                  { label: 'Monto total',            col: 'monto_total' as SortCol,             icon: <Banknote className="w-3.5 h-3.5" /> },
                  { label: 'Valor a pagar',          col: 'monto_a_pagar' as SortCol,           icon: <Banknote className="w-3.5 h-3.5" /> },
                  { label: 'Enviado por Radicación', col: 'fecha_envio_tesoreria' as SortCol,   icon: <CalendarDays className="w-3.5 h-3.5" /> },
                ] as { label: string; col: SortCol; icon: React.ReactNode }[]).map(({ label, col, icon }) => (
                  <th
                    key={col}
                    onClick={() => tab === 'pendientes' && handleSortPend(col)}
                    className="px-5 py-3 text-left font-semibold text-white whitespace-nowrap"
                    style={{
                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                      fontSize: 12,
                      cursor: tab === 'pendientes' ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      {icon}
                      {label}
                      {tab === 'pendientes' && sortCol === col && (
                        <span style={{ fontSize: 11, opacity: 0.9 }}>
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th
                  className="px-5 py-3 text-left font-semibold text-white whitespace-nowrap"
                  style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 12 }}
                >
                  {tab === 'pendientes' ? 'Acción' : 'Estado'}
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p, idx) => (
                <tr
                  key={p.id}
                  className="border-t border-gray-100 transition-colors hover:bg-blue-50 cursor-pointer"
                  style={{
                    backgroundColor: seleccionados.has(p.id)
                      ? '#e0f5f7'
                      : idx % 2 === 0 ? '#fff' : '#f8fafc',
                  }}
                  onClick={() => setPaqueteDetalleId(p.id)}
                >
                  {/* Checkbox selección masiva */}
                  {tab === 'pendientes' && (
                    <td className="px-4 py-4 w-10" onClick={(e) => toggleSeleccion(p.id, e)}>
                      <input
                        type="checkbox"
                        checked={seleccionados.has(p.id)}
                        onChange={() => {}}
                        style={{ width: 15, height: 15, accentColor: '#0e7490', cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  {/* Semana */}
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', color: '#00829a' }}>
                      {formatSemanaLabel(p.semana)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                      {fmtFecha(p.fecha_inicio)} – {fmtFecha(p.fecha_fin)}
                    </p>
                  </td>

                  {/* Técnico */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
                      >
                        {(p.tecnico?.nombre ?? 'T').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-800" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                        {p.tecnico?.nombre ?? '—'}
                      </span>
                    </div>
                  </td>

                  {/* Monto total */}
                  <td className="px-5 py-4">
                    <span className="text-sm" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', color: '#374151' }}>
                      {fmtMonto(p.monto_total)}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                      {p.total_documentos} soporte{p.total_documentos !== 1 ? 's' : ''}
                    </p>
                  </td>

                  {/* Valor a pagar (monto_total - devueltos) */}
                  <td className="px-5 py-4">
                    {p.monto_a_pagar != null ? (
                      <>
                        <span className="text-base font-bold" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#15803d' }}>
                          {fmtMonto(p.monto_a_pagar)}
                        </span>
                        {Number(p.monto_a_pagar) < Number(p.monto_total) && (
                          <p className="text-xs mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', color: '#dc2626' }}>
                            -{fmtMonto(Number(p.monto_total) - Number(p.monto_a_pagar))} devuelto
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-base font-bold" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#15803d' }}>
                        {fmtMonto(p.monto_total)}
                      </span>
                    )}
                  </td>

                  {/* Fecha envío a Tesorería (por Facturación) */}
                  <td className="px-5 py-4">
                    {p.fecha_envio_tesoreria ? (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                        <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                          {fmtFecha(p.fecha_envio_tesoreria.slice(0, 10))}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Acción / Estado */}
                  <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                    {tab === 'pendientes' ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPaqueteDetalleId(p.id); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: '#0e7490', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                      >
                        <Wallet className="w-4 h-4" />
                        Pagar
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="font-semibold" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', color: '#15803d' }}>Pagado</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={tab === 'pendientes' ? 7 : 6} className="px-5 py-10 text-center text-sm text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                    Sin resultados para "{filtroNombre}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </> /* fin bloque pendientes/historial */
      )}

      {/* Barra flotante de selección masiva */}
      {tab === 'pendientes' && seleccionados.size > 0 && createPortal(
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9998, display: 'flex', alignItems: 'center', gap: 20,
          background: '#0e7490', color: '#fff', borderRadius: 14,
          padding: '14px 24px', boxShadow: '0 8px 32px rgba(14,116,144,0.35)',
          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
          minWidth: 380,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {seleccionados.size} paquete{seleccionados.size !== 1 ? 's' : ''} seleccionado{seleccionados.size !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              Total: {fmtMonto(
                lista
                  .filter(p => seleccionados.has(p.id))
                  .reduce((sum, p) => sum + Number(p.monto_a_pagar ?? p.monto_total), 0)
              )}
            </span>
          </div>
          <button
            onClick={() => setSeleccionados(new Set())}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Limpiar
          </button>
          <button
            onClick={handleAbrirModalMasivo}
            style={{
              background: '#fff', border: 'none', color: '#0e7490',
              borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Wallet style={{ width: 15, height: 15 }} />
            Registrar pago
          </button>
        </div>,
        document.body
      )}

      {/* Modal pago masivo */}
      {modalMasivoOpen && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalMasivoOpen(false); }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 14, padding: '28px 28px 24px',
              width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#111827' }}>
              Registrar pago masivo
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              Se registrará el pago de{' '}
              <strong style={{ color: '#0e7490' }}>{seleccionados.size} paquete{seleccionados.size !== 1 ? 's' : ''}</strong>
              {' '}por un total de{' '}
              <strong style={{ color: '#0e7490' }}>
                {fmtMonto(
                  lista
                    .filter(p => seleccionados.has(p.id))
                    .reduce((sum, p) => sum + Number(p.monto_a_pagar ?? p.monto_total), 0)
                )}
              </strong>
            </p>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Fecha de pago
            </label>
            <input
              type="date"
              value={fechaMasivoSeleccionada}
              onChange={(e) => setFechaMasivoSeleccionada(e.target.value)}
              style={{
                width: '100%', border: '1px solid #d1d5db', borderRadius: 8,
                padding: '8px 12px', fontSize: 14, outline: 'none',
                fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={() => setModalMasivoOpen(false)}
                disabled={loadingMasivo}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: '#374151', border: '1px solid #d1d5db', background: '#fff',
                  cursor: 'pointer', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarPagoMasivo}
                disabled={loadingMasivo || !fechaMasivoSeleccionada}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: '#fff', background: '#0e7490', border: 'none',
                  cursor: loadingMasivo || !fechaMasivoSeleccionada ? 'not-allowed' : 'pointer',
                  opacity: loadingMasivo || !fechaMasivoSeleccionada ? 0.6 : 1,
                  fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                }}
              >
                {loadingMasivo
                  ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
                  : <Wallet style={{ width: 15, height: 15 }} />
                }
                Confirmar pago
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
