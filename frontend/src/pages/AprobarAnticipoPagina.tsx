import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { AnticipoOut } from '../lib/api';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'https://r5k8qt1z4e.execute-api.us-east-2.amazonaws.com/v1/api/v1';

async function aprobarAnticipo(token: string): Promise<AnticipoOut> {
  const resp = await fetch(`${API_BASE}/anticipos/aprobar/${token}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al procesar la aprobación');
  }
  return resp.json();
}

async function rechazarAnticipo(token: string, motivo: string): Promise<AnticipoOut> {
  const resp = await fetch(`${API_BASE}/anticipos/rechazar/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al rechazar el anticipo');
  }
  return resp.json();
}

function fmtMonto(n: number) {
  return `$${n.toLocaleString('es-CO', { minimumFractionDigits: 0 })} COP`;
}

export function AprobarAnticipoPagina() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const accion = searchParams.get('accion'); // 'aprobar' | 'rechazar'

  const [step, setStep] = useState<'confirm' | 'motivo' | 'done' | 'error'>('confirm');
  const [anticipo, setAnticipo] = useState<AnticipoOut | null>(null);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Si la acción es aprobar, ejecutar automáticamente
  useEffect(() => {
    if (!token) { setStep('error'); setErrorMsg('Token no proporcionado.'); return; }
    if (accion === 'aprobar') {
      handleAprobar();
    }
    // Si es rechazar, mostrar formulario de motivo
    if (accion === 'rechazar') {
      setStep('motivo');
    }
  }, []);

  async function handleAprobar() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await aprobarAnticipo(token);
      setAnticipo(data);
      setStep('done');
    } catch (e: any) {
      setErrorMsg(e.message);
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRechazar(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !motivo.trim()) return;
    setLoading(true);
    try {
      const data = await rechazarAnticipo(token, motivo.trim());
      setAnticipo(data);
      setStep('done');
    } catch (e: any) {
      setErrorMsg(e.message);
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  const esRechazo = accion === 'rechazar' || (anticipo?.estado === 'rechazado');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full text-center">
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#14aab8' }}>
          DOCUFLOW
        </h1>
        <p className="text-sm text-gray-500 mb-6">Sistema de Gestión Contable</p>

        {/* Cargando */}
        {(loading || (accion === 'aprobar' && step === 'confirm')) && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#14aab8' }} />
            <p className="text-gray-600">Procesando...</p>
          </div>
        )}

        {/* Formulario de rechazo */}
        {!loading && step === 'motivo' && (
          <form onSubmit={handleRechazar} className="text-left">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-8 h-8 text-amber-500 shrink-0" />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Rechazar anticipo</h2>
                <p className="text-sm text-gray-500">Indica el motivo del rechazo</p>
              </div>
            </div>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
              placeholder="Escribe el motivo del rechazo (mínimo 5 caracteres)"
              rows={4}
              minLength={5}
              maxLength={500}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading || motivo.trim().length < 5}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#c0392b' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
              Confirmar rechazo
            </button>
          </form>
        )}

        {/* Éxito */}
        {!loading && step === 'done' && anticipo && (
          <div>
            {esRechazo ? (
              <>
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-red-700 mb-2">Anticipo Rechazado</h2>
                <p className="text-gray-600 mb-4">Has rechazado la solicitud. El empleado recibirá una notificación.</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-green-700 mb-2">¡Anticipo Aprobado!</h2>
                <p className="text-gray-600 mb-4">
                  Has aprobado la solicitud. Tesorería será notificada para proceder con el desembolso.
                </p>
              </>
            )}
            <div className={`rounded-lg p-4 text-left border ${esRechazo ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1 font-semibold text-gray-700 w-32">Folio:</td>
                    <td className="py-1 text-gray-900 font-mono">{anticipo.folio}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold text-gray-700">Solicitante:</td>
                    <td className="py-1 text-gray-900">{anticipo.solicitante.nombre}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold text-gray-700">Monto:</td>
                    <td className="py-1 text-gray-900 font-bold">{fmtMonto(anticipo.monto)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-400 text-sm mt-4">Puedes cerrar esta ventana.</p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">Error al procesar</h2>
            <p className="text-gray-600 bg-red-50 border border-red-200 rounded-lg p-4 mt-2">
              {errorMsg}
            </p>
            <p className="text-gray-400 text-sm mt-4">
              Si el problema persiste, contacte al administrador del sistema.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
