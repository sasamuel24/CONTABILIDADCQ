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
 *
 * OJO — los estilos van EN LÍNEA a propósito: `index.css` es un snapshot parcial
 * de Tailwind al que le faltan clases muy usadas (`bg-red-600`, `rounded-xl`,
 * `font-bold`, `text-xs`…). El botón de confirmar quedaba invisible —sin fondo y
 * con texto blanco— porque `bg-red-600` no existe. Esta página la abren
 * aprobadores externos desde su correo, así que no puede depender de que una
 * clase esté o no en ese snapshot.
 */

const COLORES = {
  marca: '#14aab8',
  rojo: '#b91c1c',
  rojoOscuro: '#991b1b',
  rojoFondo: '#fef2f2',
  rojoBorde: '#fecaca',
  verde: '#15803d',
  verdeFondo: '#f0fdf4',
  verdeBorde: '#bbf7d0',
  texto: '#1f2937',
  textoSuave: '#6b7280',
  borde: '#e5e7eb',
};

const estilos: Record<string, React.CSSProperties> = {
  pagina: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    padding: '16px',
    fontFamily: "'Neutra Text', 'Montserrat', Arial, sans-serif",
  },
  tarjeta: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    padding: '32px',
    maxWidth: '520px',
    width: '100%',
  },
  marca: {
    fontSize: '22px',
    fontWeight: 700,
    color: COLORES.marca,
    textAlign: 'center',
    margin: '0 0 24px',
    letterSpacing: '0.5px',
  },
  titulo: { fontSize: '19px', fontWeight: 700, margin: '0 0 6px' },
  parrafo: { fontSize: '14px', color: COLORES.textoSuave, margin: '0 0 16px', lineHeight: 1.5 },
  textarea: {
    width: '100%',
    minHeight: '120px',
    padding: '12px 14px',
    fontSize: '14px',
    fontFamily: 'inherit',
    color: COLORES.texto,
    border: `1px solid ${COLORES.borde}`,
    borderRadius: '10px',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  boton: {
    width: '100%',
    marginTop: '16px',
    padding: '13px 20px',
    fontSize: '15px',
    fontWeight: 700,
    fontFamily: 'inherit',
    color: '#fff',
    backgroundColor: COLORES.rojo,
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'opacity .15s ease',
  },
  botonDeshabilitado: { opacity: 0.5, cursor: 'not-allowed' },
  nota: { fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '14px' },
  caja: { borderRadius: '10px', padding: '16px', textAlign: 'left', border: '1px solid' },
  celdaEtiqueta: {
    padding: '6px 0',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    width: '130px',
    verticalAlign: 'top',
  },
  celdaValor: { padding: '6px 0', fontSize: '13px', color: '#111827' },
};

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

  const motivoValido = motivo.trim().length >= 5;

  const confirmarRechazo = async () => {
    if (!token || !motivoValido) return;
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

  const filas = (datos: [string, string][]) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {datos.map(([etiqueta, valor]) => (
          <tr key={etiqueta}>
            <td style={estilos.celdaEtiqueta}>{etiqueta}</td>
            <td style={{ ...estilos.celdaValor, whiteSpace: 'pre-wrap' }}>{valor}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={estilos.pagina}>
      <div style={estilos.tarjeta}>
        <h1 style={estilos.marca}>DOCUFLOW</h1>

        {loading && !mostrarFormularioRechazo && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '32px 0' }}>
            <Loader2 className="animate-spin" style={{ width: 44, height: 44, color: COLORES.marca }} />
            <p style={{ ...estilos.parrafo, margin: 0 }}>
              {esRechazo ? 'Registrando el rechazo...' : 'Procesando aprobación...'}
            </p>
          </div>
        )}

        {/* Rechazo: pedir el motivo antes de registrar nada */}
        {mostrarFormularioRechazo && (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
              <AlertTriangle style={{ width: 34, height: 34, color: COLORES.rojo, flexShrink: 0 }} />
              <div>
                <h2 style={{ ...estilos.titulo, color: COLORES.rojo }}>Rechazar factura</h2>
                <p style={{ ...estilos.parrafo, margin: 0 }}>
                  Indique por qué la rechaza. El motivo queda registrado en DocuFlow
                  y se notifica al área responsable.
                </p>
              </div>
            </div>

            <textarea
              style={estilos.textarea}
              placeholder="Escriba el motivo del rechazo (mínimo 5 caracteres)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              onFocus={(e) => { e.currentTarget.style.borderColor = COLORES.rojo; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = COLORES.borde; }}
              autoFocus
            />

            <button
              onClick={confirmarRechazo}
              disabled={loading || !motivoValido}
              style={{
                ...estilos.boton,
                ...(loading || !motivoValido ? estilos.botonDeshabilitado : {}),
              }}
            >
              {loading ? 'Registrando...' : 'Confirmar rechazo'}
            </button>

            {!motivoValido && motivo.length > 0 && (
              <p style={{ ...estilos.nota, color: COLORES.rojo }}>
                Escriba al menos 5 caracteres para poder confirmar.
              </p>
            )}
            <p style={estilos.nota}>
              Si prefiere aprobarla, vuelva al correo y use el botón «Aprobar Factura».
            </p>
          </div>
        )}

        {!loading && aprobacion && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2 style={{ width: 60, height: 60, color: COLORES.verde, margin: '0 auto 14px' }} />
            <h2 style={{ ...estilos.titulo, color: COLORES.verde }}>¡Factura aprobada!</h2>
            <p style={estilos.parrafo}>
              La factura ha sido aprobada exitosamente. El equipo responsable será notificado.
            </p>
            <div style={{ ...estilos.caja, backgroundColor: COLORES.verdeFondo, borderColor: COLORES.verdeBorde }}>
              {filas([
                ['N° Factura:', aprobacion.numero_factura],
                ['Proveedor:', aprobacion.proveedor],
                ['Valor Total:', formatTotal(aprobacion.total)],
                ['Aprobado por:', aprobacion.aprobado_por_nombre],
                ['Fecha:', formatFecha(aprobacion.fecha_aprobacion_email)],
              ])}
            </div>
            <p style={estilos.nota}>
              El equipo de contabilidad continuará con el proceso de la factura.
            </p>
          </div>
        )}

        {!loading && rechazo && (
          <div style={{ textAlign: 'center' }}>
            <XCircle style={{ width: 60, height: 60, color: COLORES.rojo, margin: '0 auto 14px' }} />
            <h2 style={{ ...estilos.titulo, color: COLORES.rojo }}>Factura rechazada</h2>
            <p style={estilos.parrafo}>
              El rechazo quedó registrado. El área responsable fue notificada y podrá
              corregir la factura para volver a enviarla.
            </p>
            <div style={{ ...estilos.caja, backgroundColor: COLORES.rojoFondo, borderColor: COLORES.rojoBorde }}>
              {filas([
                ['N° Factura:', rechazo.numero_factura],
                ['Proveedor:', rechazo.proveedor],
                ['Valor Total:', formatTotal(rechazo.total)],
                ['Rechazado por:', rechazo.rechazado_por_nombre],
                ['Fecha:', formatFecha(rechazo.fecha_rechazo_email)],
                ['Motivo:', rechazo.motivo_rechazo],
              ])}
            </div>
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center' }}>
            <XCircle style={{ width: 60, height: 60, color: COLORES.rojo, margin: '0 auto 14px' }} />
            <h2 style={{ ...estilos.titulo, color: COLORES.rojoOscuro }}>
              {esRechazo ? 'No se pudo rechazar' : 'No se pudo aprobar'}
            </h2>
            <div style={{ ...estilos.caja, backgroundColor: COLORES.rojoFondo, borderColor: COLORES.rojoBorde, textAlign: 'center' }}>
              <p style={{ ...estilos.parrafo, margin: 0, color: COLORES.rojoOscuro }}>{error}</p>
            </div>
            <p style={estilos.nota}>
              Si el problema persiste, contacte al administrador del sistema.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
