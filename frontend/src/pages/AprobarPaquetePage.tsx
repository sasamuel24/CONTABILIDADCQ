import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import {
  aprobarPaquetePorToken,
  rechazarPaquetePorToken,
  PaqueteOut,
  RechazoPaqueteOut,
} from '../lib/api';

/**
 * Landing de los botones del correo de aprobación de paquetes de gastos.
 *
 * El correo trae dos enlaces a esta misma página: `accion=aprobar` (aprueba al
 * abrir, como siempre) y `accion=rechazar`, que primero pide el motivo. Los
 * correos enviados antes de esta pantalla no llevan `accion`; en ese caso se
 * aprueba, para no romper enlaces todavía vigentes (duran 72 horas).
 *
 * OJO — los estilos van EN LÍNEA a propósito: `index.css` es un snapshot parcial
 * de Tailwind al que le faltan clases muy usadas (`bg-red-600`, `rounded-xl`…).
 * En la pantalla equivalente de facturas el botón de confirmar quedó invisible
 * por eso. Esta página la abren aprobadores externos desde su correo, así que no
 * puede depender de que una clase esté o no en ese snapshot.
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

export function AprobarPaquetePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const accion = searchParams.get('accion'); // 'aprobar' | 'rechazar' | null
  const esRechazo = accion === 'rechazar';

  const [loading, setLoading] = useState(!esRechazo);
  const [paquete, setPaquete] = useState<PaqueteOut | null>(null);
  const [rechazo, setRechazo] = useState<RechazoPaqueteOut | null>(null);
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

    aprobarPaquetePorToken(token)
      .then((p) => { setPaquete(p); setLoading(false); })
      .catch((e) => {
        setError(e?.message || 'Error al procesar la aprobación.');
        setLoading(false);
      });
  }, [token, esRechazo]);

  const motivoValido = motivo.trim().length >= 5;

  const confirmarRechazo = async () => {
    if (!token || !motivoValido) return;
    setLoading(true);
    setError(null);
    try {
      setRechazo(await rechazarPaquetePorToken(token, motivo.trim()));
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

  const formatMonto = (monto: string | number) =>
    `$${Number(monto).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP`;

  const mostrarFormularioRechazo = esRechazo && !rechazo && !error;
  const pendientes = paquete?.solicitudes_pendientes ?? 0;
  const esAprobacionParcial = !!paquete?.aprobacion_parcial && pendientes > 0;

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
                <h2 style={{ ...estilos.titulo, color: COLORES.rojo }}>Rechazar paquete de gastos</h2>
                <p style={{ ...estilos.parrafo, margin: 0 }}>
                  Indique por qué lo rechaza. El paquete vuelve a quien lo legalizó
                  con el motivo, para que lo corrija y lo envíe de nuevo.
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
              Si prefiere aprobarlo, vuelva al correo y use el botón «Aprobar Paquete».
            </p>
          </div>
        )}

        {!loading && paquete && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2 style={{ width: 60, height: 60, color: COLORES.verde, margin: '0 auto 14px' }} />
            {esAprobacionParcial ? (
              <>
                <h2 style={{ ...estilos.titulo, color: COLORES.verde }}>¡Aprobación registrada!</h2>
                <p style={estilos.parrafo}>
                  Los gastos a su cargo fueron aprobados. El paquete quedará aprobado por completo
                  cuando respondan los demás aprobadores ({pendientes} solicitud
                  {pendientes !== 1 ? 'es' : ''} pendiente{pendientes !== 1 ? 's' : ''}).
                </p>
              </>
            ) : (
              <>
                <h2 style={{ ...estilos.titulo, color: COLORES.verde }}>¡Paquete aprobado!</h2>
                <p style={estilos.parrafo}>
                  El paquete de gastos ha sido aprobado exitosamente.
                </p>
              </>
            )}
            <div style={{ ...estilos.caja, backgroundColor: COLORES.verdeFondo, borderColor: COLORES.verdeBorde }}>
              {filas([
                ...(paquete.folio ? ([['Folio:', paquete.folio]] as [string, string][]) : []),
                ['Técnico:', paquete.tecnico?.nombre ?? '—'],
                ['Semana:', paquete.semana],
                ['Monto Total:', formatMonto(paquete.monto_total)],
              ])}
            </div>
            <p style={estilos.nota}>
              {esAprobacionParcial
                ? 'No necesita hacer nada más. Su aprobación quedó registrada en el sistema.'
                : 'El área de Radicación recibirá una notificación y enviará el paquete a Tesorería.'}
            </p>
          </div>
        )}

        {!loading && rechazo && (
          <div style={{ textAlign: 'center' }}>
            <XCircle style={{ width: 60, height: 60, color: COLORES.rojo, margin: '0 auto 14px' }} />
            <h2 style={{ ...estilos.titulo, color: COLORES.rojo }}>Paquete rechazado</h2>
            <p style={estilos.parrafo}>
              El rechazo quedó registrado. Quien legalizó el paquete fue notificado y
              podrá corregirlo para volver a enviarlo.
            </p>
            <div style={{ ...estilos.caja, backgroundColor: COLORES.rojoFondo, borderColor: COLORES.rojoBorde }}>
              {filas([
                ...(rechazo.folio ? ([['Folio:', rechazo.folio]] as [string, string][]) : []),
                ['Técnico:', rechazo.tecnico_nombre],
                ['Semana:', rechazo.semana],
                ['Monto Total:', formatMonto(rechazo.monto_total)],
                ['Rechazado por:', rechazo.rechazado_por_nombre],
                ['Fecha:', formatFecha(rechazo.fecha_rechazo)],
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
