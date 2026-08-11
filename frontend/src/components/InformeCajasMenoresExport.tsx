/**
 * Botón + modal para descargar el informe Excel de legalizaciones de cajas
 * menores por área. Lo usan Radicación (ResponsablePaquetesView) y el
 * Director de Contabilidad (DirectorTrazabilidadView).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { exportarInformeCajasMenores } from '../lib/api';

export function InformeCajasMenoresExport({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const descargar = async () => {
    if (!hasta) return;
    setLoading(true);
    try {
      await exportarInformeCajasMenores(hasta, desde || undefined);
      setOpen(false);
      toast.success('Informe descargado');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al exportar el informe';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors hover:bg-gray-50 ${className}`}
        style={{ color: '#a16207', borderColor: '#fde68a', backgroundColor: 'white', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
        title="Exportar el informe Excel de legalizaciones de cajas menores por área"
      >
        <Download className="w-3.5 h-3.5" />
        Informe cajas menores
      </button>

      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="bg-white rounded-2xl p-7 w-full"
            style={{ maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#fef9c3' }}>
                <Download className="w-5 h-5" style={{ color: '#a16207' }} />
              </div>
              <p className="text-base font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                Informe de cajas menores
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              Excel con 4 hojas: resumen por caja menor, por usuario, paquetes y detalle
              de gastos. Cubre los reembolsos de cajas menores (técnicos de mantenimiento
              y legalización general). El corte incluye los paquetes cuya semana inicia
              en o antes de la fecha "Hasta" (la semana del corte entra completa).
            </p>
            <div className="flex gap-3 mb-1">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Desde (opcional)</label>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#d1d5db' }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hasta <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#d1d5db' }}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-5">Sin "Desde" el informe sale desde el inicio de la operación.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-semibold border text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: '#d1d5db', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                Cancelar
              </button>
              <button
                onClick={descargar}
                disabled={loading || !hasta || (!!desde && desde > hasta)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#a16207', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Descargar Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
