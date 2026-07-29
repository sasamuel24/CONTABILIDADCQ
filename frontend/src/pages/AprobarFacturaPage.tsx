import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import {
  aprobarFacturaPorToken,
  rechazarFacturaPorToken,
  AprobacionEmailOut,
  RechazoEmailOut,
} from '../lib/api';

/**
 * Landing de los botones del correo de aprobación de facturas.
 *
 * El correo trae dos enlaces a esta misma página: `accion=aprobar` (aprueba al
 * abrir, como siempre) y `accion=rechazar`, que primero pide el motivo. Los
 * correos enviados antes de esta pantalla no llevan `accion`; en ese caso se
 * mantiene el comportamiento anterior y se aprueba, para no romper enlaces
 * todavía vigentes (duran 72 horas).
 */
export function AprobarFacturaPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const accion = searchParams.get('accion'); // 'aprobar' | 'rechazar' | null
  const esRechazo = accion === 'rechazar';

  const [loading, setLoading] = useState(!esRechazo);
  const [aprobacion, setAprobacion] = useState<AprobacionEmailOut | null>(null);
  const [rechazo, setRechazo] = useState<RechazoEmailOut | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token de aprobación no proporcionado.');
      setLoading(false);
      return;
    }
    // El rechazo NO se dispara solo: primero hay que escribir el motivo.
    if (esRechazo) return;

    aprobarFacturaPorToken(token)
      .then((data) => { setAprobacion(data); setLoading(false); })
      .catch((e) => {
        const msg =
          typeof e?.message === 'string' && e.message
            ? e.message
            : typeof e === 'string'
            ? e
            : 'Error al procesar la aprobación. El enlace puede haber expirado o ya fue utilizado.';
        setError(msg);
        setLoading(false);
      });
  }, [token, esRechazo]);

  const confirmarRechazo = async () => {
    if (!token || motivo.trim().length < 5) return;
    setLoading(true);
    setError(null);
    try {
      setRechazo(await rechazarFacturaPorToken(token, motivo.trim()));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el rechazo.');
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const formatTotal = (total: number) =>
    `$${Number(total).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP`;

  const mostrarFormularioRechazo = esRechazo && !rechazo && !error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full text-center">
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#14aab8' }}>
          DOCUFLOW
        </h1>

        {loading && !mostrarFormularioRechazo && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#14aab8' }} />
            <p className="text-gray-600">
              {esRechazo ? 'Registrando el rechazo...' : 'Procesando aprobación...'}
            </p>
          </div>
        )}

        {/* Rechazo: pedir el motivo antes de registrar nada */}
        {mostrarFormularioRechazo && (
          <div className="text-left">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-9 h-9 text-red-500 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-red-700">Rechazar factura</h2>
                <p className="text-sm text-gray-500">
                  Indique por qué la rechaza. El motivo queda registrado en DocuFlow
                  y se notifica al área responsable.
                </p>
              </div>
            </div>
            <textarea
              className="w-full rounded-xl px-4 py-3 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-300 min-h-[120px]"
              placeholder="Escriba el motivo del rechazo (mínimo 5 caracteres)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
            />
            <button
              onClick={confirmarRechazo}
              disabled={loading || motivo.trim().length < 5}
              className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Registrando...' : 'Confirmar rechazo'}
            </button>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Si prefiere aprobarla, vuelva al correo y use el botón «Aprobar Factura».
            </p>
          </div>
        )}

        {!loading && aprobacion && (
          <div>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-700 mb-2">¡Factura Aprobada!</h2>
            <p className="text-gray-600 mb-6">
              La factura ha sido aprobada exitosamente. El equipo responsable será notificado.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700 w-36">N° Factura:</td>
                    <td className="py-1.5 text-gray-900 font-mono">{aprobacion.numero_factura}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700">Proveedor:</td>
                    <td className="py-1.5 text-gray-900">{aprobacion.proveedor}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700">Valor Total:</td>
                    <td className="py-1.5 text-gray-900 font-bold">{formatTotal(aprobacion.total)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700">Aprobado por:</td>
                    <td className="py-1.5 text-gray-900">{aprobacion.aprobado_por_nombre}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700">Fecha:</td>
                    <td className="py-1.5 text-gray-900">{formatFecha(aprobacion.fecha_aprobacion_email)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              El equipo de contabilidad continuará con el proceso de la factura.
            </p>
          </div>
        )}

        {!loading && rechazo && (
          <div>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">Factura rechazada</h2>
            <p className="text-gray-600 mb-6">
              El rechazo quedó registrado. El área responsable fue notificada y podrá
              corregir la factura para volver a enviarla.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700 w-36">N° Factura:</td>
                    <td className="py-1.5 text-gray-900 font-mono">{rechazo.numero_factura}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700">Proveedor:</td>
                    <td className="py-1.5 text-gray-900">{rechazo.proveedor}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700">Valor Total:</td>
                    <td className="py-1.5 text-gray-900 font-bold">{formatTotal(rechazo.total)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700">Rechazado por:</td>
                    <td className="py-1.5 text-gray-900">{rechazo.rechazado_por_nombre}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700">Fecha:</td>
                    <td className="py-1.5 text-gray-900">{formatFecha(rechazo.fecha_rechazo_email)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-gray-700 align-top">Motivo:</td>
                    <td className="py-1.5 text-gray-900 whitespace-pre-wrap">{rechazo.motivo_rechazo}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && error && (
          <div>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">
              {esRechazo ? 'No se pudo rechazar' : 'No se pudo aprobar'}
            </h2>
            <p className="text-gray-600 bg-red-50 border border-red-200 rounded-lg p-4 mt-2">
              {error}
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
