import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { aprobarFacturaPorToken, AprobacionEmailOut } from '../lib/api';

export function AprobarFacturaPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [aprobacion, setAprobacion] = useState<AprobacionEmailOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token de aprobación no proporcionado.');
      setLoading(false);
      return;
    }
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
  }, [token]);

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full text-center">
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#14aab8' }}>
          CONTABILIDADCQ
        </h1>

        {loading && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#14aab8' }} />
            <p className="text-gray-600">Procesando aprobación...</p>
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
                    <td className="py-1.5 text-gray-900 font-bold">
                      ${Number(aprobacion.total).toLocaleString('es-CO')} COP
                    </td>
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
