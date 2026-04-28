import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, RefreshCw, X } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

interface FacturaBuzon {
  id: string;
  numero_factura: string;
  proveedor: string;
  nit_proveedor?: string;
  total: number;
  fecha_emision?: string;
  area: string;
  area_id?: string;
  pendiente_confirmacion: boolean;
  ai_area_confianza?: string;
  ai_area_razonamiento?: string;
}

interface Area {
  id: string;
  nombre: string;
  code: string;
}

type Seccion = 'auto_asignadas' | 'pendientes' | 'sin_asignar';

const confianzaConfig: Record<string, { label: string; color: string; bg: string; icon: JSX.Element }> = {
  alta:  { label: 'Alta',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  icon: <CheckCircle className="w-4 h-4 text-green-600" /> },
  media: { label: 'Media', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: <AlertCircle className="w-4 h-4 text-yellow-600" /> },
  baja:  { label: 'Baja',  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <AlertCircle className="w-4 h-4 text-orange-600" /> },
  nula:  { label: 'Sin identificar', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <XCircle className="w-4 h-4 text-red-600" /> },
};

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

export function BuzonXMLView() {
  const [facturas, setFacturas] = useState<FacturaBuzon[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seccion, setSeccion] = useState<Seccion>('pendientes');
  const [seleccionada, setSeleccionada] = useState<FacturaBuzon | null>(null);
  const [areaSeleccionada, setAreaSeleccionada] = useState('');
  const [actualizando, setActualizando] = useState(false);

  const token = localStorage.getItem('access_token');

  const cargarDatos = async () => {
    setIsLoading(true);
    try {
      const [facturasRes, areasRes] = await Promise.all([
        fetch(`${API_BASE_URL}/facturas?limit=500`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/areas`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const facturasData = await facturasRes.json();
      const areasData = await areasRes.json();

      const buzon: FacturaBuzon[] = (facturasData.items || []).filter(
        (f: any) => f.ai_area_confianza !== null && f.ai_area_confianza !== undefined
      );
      setFacturas(buzon);
      setAreas(areasData || []);
    } catch (e) {
      console.error('Error cargando buzón XML:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const abrirDetalle = (f: FacturaBuzon) => {
    setSeleccionada(f);
    setAreaSeleccionada(f.area_id || '');
  };

  const cerrar = () => {
    setSeleccionada(null);
    setAreaSeleccionada('');
  };

  const actualizarArea = async () => {
    if (!seleccionada || !areaSeleccionada) return;
    setActualizando(true);
    try {
      await fetch(
        `${API_BASE_URL}/facturas/${seleccionada.id}/confirmar-ingesta?area_id=${areaSeleccionada}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      await cargarDatos();
      cerrar();
    } finally {
      setActualizando(false);
    }
  };

  const autoAsignadas = facturas.filter(f => !f.pendiente_confirmacion && f.area_id);
  const pendientes    = facturas.filter(f => f.pendiente_confirmacion && f.area_id);
  const sinAsignar    = facturas.filter(f => !f.area_id);

  const secciones: { key: Seccion; label: string; count: number; dot: string }[] = [
    { key: 'auto_asignadas', label: 'Auto-asignadas',        count: autoAsignadas.length, dot: 'bg-green-500' },
    { key: 'pendientes',     label: 'Pendientes confirmación', count: pendientes.length,   dot: 'bg-yellow-500' },
    { key: 'sin_asignar',   label: 'Sin asignar',            count: sinAsignar.length,    dot: 'bg-red-500' },
  ];

  const facturasActivas =
    seccion === 'auto_asignadas' ? autoAsignadas :
    seccion === 'pendientes'     ? pendientes     :
    sinAsignar;

  const puedeActualizar = !!areaSeleccionada && areaSeleccionada !== seleccionada?.area_id;

  return (
    <div className="p-8">

      {/* Encabezado */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
          Buzón XML Automático
        </h2>
        <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
          Facturas electrónicas procesadas automáticamente desde el correo
        </p>
      </div>

      {/* Tarjetas de sección */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {secciones.map(s => (
          <button
            key={s.key}
            onClick={() => { setSeccion(s.key); cerrar(); }}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              seccion === s.key ? 'border-[#00829a] bg-[#f0fbfc]' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`w-3 h-3 rounded-full ${s.dot}`} />
              <span className="text-2xl font-bold text-gray-900">{s.count}</span>
            </div>
            <p className="text-sm font-medium text-gray-700">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Layout lista + panel detalle */}
      <div className="flex gap-4">

        {/* Lista */}
        <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden transition-all ${seleccionada ? 'flex-1' : 'w-full'}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              {secciones.find(s => s.key === seccion)?.label}
            </h3>
            <button
              onClick={cargarDatos}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#00829a]"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Cargando...</div>
          ) : facturasActivas.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No hay facturas en esta sección.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Factura</th>
                  <th className="px-6 py-3 text-left">Proveedor</th>
                  <th className="px-6 py-3 text-left">Total</th>
                  <th className="px-6 py-3 text-left">Área IA</th>
                  <th className="px-6 py-3 text-left">Confianza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturasActivas.map(f => {
                  const conf = confianzaConfig[f.ai_area_confianza || 'nula'];
                  const activa = seleccionada?.id === f.id;
                  return (
                    <tr
                      key={f.id}
                      onClick={() => abrirDetalle(f)}
                      className={`cursor-pointer transition-colors ${activa ? 'bg-[#f0fbfc]' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 text-sm">{f.numero_factura}</div>
                        <div className="text-xs text-gray-400">{f.fecha_emision || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{f.proveedor}</div>
                        {f.nit_proveedor && (
                          <div className="text-xs text-gray-400">NIT: {f.nit_proveedor}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {formatCOP(f.total)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{f.area || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${conf.bg} ${conf.color}`}>
                          {conf.icon}
                          {conf.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Panel detalle */}
        {seleccionada && (
          <div className="w-80 bg-white rounded-xl border border-gray-200 flex flex-col shrink-0">

            {/* Header panel */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ backgroundColor: '#00829a' }}>
              <div>
                <span className="text-white font-semibold text-sm">{seleccionada.numero_factura}</span>
                <span className="ml-3 px-2 py-0.5 rounded-full text-xs bg-white/20 text-white">Recibida por facturación</span>
              </div>
              <button onClick={cerrar} className="text-white/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info factura */}
            <div className="px-6 py-4 border-b border-gray-100 space-y-3">
              <h4 className="text-gray-900 font-medium text-sm">Información de la Factura</h4>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Proveedor</span>
                <span className="text-gray-900 text-right max-w-40 font-medium">{seleccionada.proveedor}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Área</span>
                <span className="text-gray-900">{seleccionada.area || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fecha Emisión</span>
                <span className="text-gray-900">{seleccionada.fecha_emision || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total a Pagar</span>
                <span className="text-gray-900 font-medium">{formatCOP(seleccionada.total)}</span>
              </div>
              {seleccionada.ai_area_razonamiento && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 leading-relaxed">
                  {seleccionada.ai_area_razonamiento}
                </div>
              )}
            </div>

            {/* Cambiar Área */}
            {(seleccionada.pendiente_confirmacion || !seleccionada.area_id) && (
              <div className="px-6 py-4 flex-1">
                <h4 className="text-gray-900 mb-3">Cambiar Área</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm">
                      Área Responsable
                    </label>
                    <select
                      value={areaSeleccionada}
                      onChange={e => setAreaSeleccionada(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                      style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
                      onFocus={e => { e.target.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)'; }}
                      onBlur={e => { e.target.style.boxShadow = ''; }}
                    >
                      <option value="">Seleccionar área...</option>
                      {areas.map(a => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={actualizarArea}
                    disabled={!puedeActualizar || actualizando}
                    className="w-full px-4 py-2.5 rounded-lg transition-all border-2 text-sm"
                    style={{
                      backgroundColor: puedeActualizar ? 'transparent' : '#f3f4f6',
                      borderColor:     puedeActualizar ? '#00829a' : '#d1d5db',
                      color:           puedeActualizar ? '#00829a' : '#9ca3af',
                      cursor:          puedeActualizar ? 'pointer' : 'not-allowed',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
                    }}
                    onMouseEnter={e => { if (puedeActualizar) { e.currentTarget.style.backgroundColor = 'rgba(20,170,184,0.05)'; e.currentTarget.style.borderColor = '#14aab8'; } }}
                    onMouseLeave={e => { if (puedeActualizar) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = '#00829a'; } }}
                  >
                    {actualizando ? 'Actualizando...' : 'Actualizar Área'}
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-xl">
              <button
                onClick={cerrar}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-100 transition-colors"
                style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
