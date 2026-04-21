import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { aprobarPaquetePorToken, PaqueteOut } from '../lib/api';

export function AprobarPaquetePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [paquete, setPaquete] = useState<PaqueteOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token de aprobación no proporcionado.');
      setLoading(false);
      return;
    }
    aprobarPaquetePorToken(token)
      .then((p) => { setPaquete(p); setLoading(false); })
      .catch((e) => { setError(e.message || 'Error al procesar la aprobación.'); setLoading(false); });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full text-center">
        {/* Título del sistema */}
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#14aab8' }}>
          CONTABILIDADCQ
        </h1>

        {loading && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#14aab8' }} />
            <p className="text-gray-600">Procesando aprobación...</p>
          </div>
        )}

        {!loading && paquete && (
          <div>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-700 mb-2">¡Paquete Aprobado!</h2>
            <p className="text-gray-600 mb-6">
              El paquete de gastos ha sido aprobado exitosamente.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
              <table className="w-full text-sm">
                <tbody>
                  {paquete.folio && (
                    <tr>
                      <td className="py-1 font-semibold text-gray-700 w-32">Folio:</td>
                      <td className="py-1 text-gray-900 font-mono">{paquete.folio}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-1 font-semibold text-gray-700">Técnico:</td>
                    <td className="py-1 text-gray-900">{paquete.tecnico?.nombre}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold text-gray-700">Semana:</td>
                    <td className="py-1 text-gray-900">{paquete.semana}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold text-gray-700">Monto Total:</td>
                    <td className="py-1 text-gray-900 font-bold">
                      ${Number(paquete.monto_total).toLocaleString('es-CO')} COP
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              El área de Radicación recibirá una notificación y enviará el paquete a Tesorería.
            </p>
          </div>
        )}

        {!loading && error && (
          <div>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">No se pudo aprobar</h2>
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
