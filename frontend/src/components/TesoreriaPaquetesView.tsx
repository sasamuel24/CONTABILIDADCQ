/**
 * Vista simplificada de paquetes de gastos para Tesorería.
 * Solo muestra paquetes en estado "en_tesoreria" y permite marcarlos como pagados.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listPaquetesGastos,
  pagarPaquete,
  PaqueteListItem,
} from '../lib/api';
import { toast } from 'sonner';
import {
  Loader2,
  Banknote,
  User,
  CalendarDays,
  Wallet,
  CheckCircle2,
  PackageOpen,
  RefreshCw,
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
  const [anio, s] = semana.split('-W');
  return `Semana ${s} — ${anio}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TesoreriaPaquetesView() {
  const [pendientes, setPendientes] = useState<PaqueteListItem[]>([]);
  const [historial, setHistorial] = useState<PaqueteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes');

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

  useEffect(() => { cargar(); }, [cargar]);

  const handlePagar = async (paquete: PaqueteListItem) => {
    setPagandoId(paquete.id);
    try {
      await pagarPaquete(paquete.id);
      toast.success(`Pago registrado — ${paquete.tecnico?.nombre ?? 'Técnico'}`);
      await cargar();
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Error al registrar el pago';
      toast.error(msg);
    } finally {
      setPagandoId(null);
    }
  };

  const lista = tab === 'pendientes' ? pendientes : historial;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
          >
            Paquetes de Gastos
          </h2>
          <p
            className="text-sm text-gray-400 mt-0.5"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
          >
            Pagos pendientes remitidos por Facturación
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { value: 'pendientes', label: `Pendientes de pago`, count: pendientes.length },
          { value: 'historial',  label: 'Pagados',           count: historial.length },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value as 'pendientes' | 'historial')}
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

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
        </div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <PackageOpen className="w-12 h-12 mb-3 opacity-30" />
          <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm">
            {tab === 'pendientes' ? 'No hay pagos pendientes por el momento' : 'No hay paquetes pagados aún'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* Totalizador */}
          {tab === 'pendientes' && (
            <div
              className="flex items-center justify-between px-6 py-3 border-b"
              style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}
            >
              <span style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} className="text-sm text-green-700">
                Total a pagar
              </span>
              <span style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }} className="text-lg font-bold text-green-800">
                {fmtMonto(pendientes.reduce((sum, p) => sum + Number(p.monto_total), 0))}
              </span>
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#00829a' }}>
                {['Semana', 'Técnico', 'Monto', 'Enviado por Facturación', tab === 'pendientes' ? 'Acción' : 'Pagado'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left font-semibold text-white whitespace-nowrap"
                    style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 12 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((p, idx) => (
                <tr
                  key={p.id}
                  className="border-t border-gray-100 transition-colors hover:bg-gray-50"
                  style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}
                >
                  {/* Semana */}
                  <td className="px-5 py-4">
                    <p style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', color: '#00829a' }} className="text-sm font-semibold">
                      {formatSemanaLabel(p.semana)}
                    </p>
                    <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-xs text-gray-400 mt-0.5">
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
                      <span style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} className="text-gray-800">
                        {p.tecnico?.nombre ?? '—'}
                      </span>
                    </div>
                  </td>

                  {/* Monto */}
                  <td className="px-5 py-4">
                    <span
                      className="text-base font-bold"
                      style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#15803d' }}
                    >
                      {fmtMonto(p.monto_total)}
                    </span>
                    <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-xs text-gray-400 mt-0.5">
                      {p.total_documentos} soporte{p.total_documentos !== 1 ? 's' : ''}
                    </p>
                  </td>

                  {/* Fecha envío */}
                  <td className="px-5 py-4">
                    {p.fecha_envio ? (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                        <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                          {fmtFecha(p.fecha_envio.slice(0, 10))}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Acción / Estado pagado */}
                  <td className="px-5 py-4">
                    {tab === 'pendientes' ? (
                      <button
                        onClick={() => handlePagar(p)}
                        disabled={pagandoId === p.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: '#0e7490', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                      >
                        {pagandoId === p.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Wallet className="w-4 h-4" />
                        }
                        Pagar
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', color: '#15803d' }}>Pagado</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
