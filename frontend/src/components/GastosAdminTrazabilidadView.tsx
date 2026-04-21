import { useState, useEffect } from 'react';
import { Search, FileText, Calendar, DollarSign, Building2, Activity, RefreshCw } from 'lucide-react';
import { getFacturas, type FacturaListItem } from '../lib/api';

const GADMIN_AREA_ID = 'c1589d0c-736b-4af4-89f2-81900d2dac16';

const ESTADO_COLOR: Record<string, string> = {
  'Recibida':                   'bg-blue-100 text-blue-700 border-blue-300',
  'Asignada a responsable':     'bg-purple-100 text-purple-700 border-purple-300',
  'En Contabilidad':            'bg-orange-100 text-orange-700 border-orange-300',
  'En Revisión Contabilidad':   'bg-orange-100 text-orange-700 border-orange-300',
  'En Tesorería':               'bg-teal-100 text-teal-700 border-teal-300',
  'Aprobada Tesorería':         'bg-teal-100 text-teal-700 border-teal-300',
  'Pagada':                     'bg-green-100 text-green-700 border-green-300',
  'Rechazada':                  'bg-red-100 text-red-700 border-red-300',
};

function estadoColor(estado: string) {
  return ESTADO_COLOR[estado] || 'bg-gray-100 text-gray-700 border-gray-300';
}

function fmt(fecha: string | null) {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function GastosAdminTrazabilidadView() {
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const cargar = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Cargar tanto las que siguen en GADMIN como las ya enviadas (por area_origen)
      const [enGadmin, enviadas] = await Promise.all([
        getFacturas(0, 5000, GADMIN_AREA_ID),
        getFacturas(0, 5000, undefined, GADMIN_AREA_ID),
      ]);
      // Combinar y deduplicar por id
      const map = new Map<string, FacturaListItem>();
      [...enGadmin.items, ...enviadas.items].forEach(f => map.set(f.id, f));
      setFacturas(Array.from(map.values()).sort((a, b) => {
        const da = new Date(a.fecha_emision ?? 0).getTime();
        const db = new Date(b.fecha_emision ?? 0).getTime();
        return db - da;
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar facturas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const estados = Array.from(new Set(facturas.map(f => f.estado))).sort();

  const filtradas = facturas.filter(f => {
    const ok = f.numero_factura.toLowerCase().includes(search.toLowerCase()) ||
               f.proveedor.toLowerCase().includes(search.toLowerCase());
    const okEstado = filterEstado === 'todos' || f.estado === filterEstado;
    return ok && okEstado;
  });

  const totalPages = Math.ceil(filtradas.length / itemsPerPage);
  const paginadas = filtradas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [search, filterEstado]);

  return (
    <div className="flex-1 bg-white flex flex-col">

      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
              Trazabilidad de Facturas
            </h2>
            <p className="text-sm text-gray-500 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              Seguimiento de todas las facturas subidas desde Gastos Fijos Café Quindío
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Total</p>
              <p className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>{facturas.length}</p>
            </div>
            <div className="text-center px-4 py-2 bg-teal-50 rounded-lg border border-teal-200">
              <p className="text-xs text-teal-600" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>En Tesorería</p>
              <p className="text-lg font-bold text-teal-700" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                {facturas.filter(f => f.estado.toLowerCase().includes('tesorería') || f.estado.toLowerCase().includes('tesoreria')).length}
              </p>
            </div>
            <div className="text-center px-4 py-2 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-green-600" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Pagadas</p>
              <p className="text-lg font-bold text-green-700" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                {facturas.filter(f => f.estado === 'Pagada').length}
              </p>
            </div>
            <button
              onClick={cargar}
              disabled={isLoading}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Recargar"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por N° factura o proveedor..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(20,170,184,0.4)'}
            onBlur={e => e.currentTarget.style.boxShadow = ''}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Estado:</span>
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(20,170,184,0.4)'}
            onBlur={e => e.currentTarget.style.boxShadow = ''}
          >
            <option value="todos">Todos</option>
            {estados.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#14aab8', borderTopColor: 'transparent' }} />
              <p className="text-sm text-gray-500" style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>Cargando facturas...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-red-600 text-sm">{error}</div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="w-14 h-14 text-gray-200 mb-3" />
            <p className="text-gray-500 text-sm" style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
              {facturas.length === 0 ? 'Aún no hay facturas subidas.' : 'No se encontraron resultados.'}
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-2"><FileText className="w-4 h-4" /><span>N° Factura</span></div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>Fecha Emisión</span></div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>Vencimiento</span></div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-2"><Building2 className="w-4 h-4" /><span>Proveedor</span></div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-2"><Activity className="w-4 h-4" /><span>Ubicación</span></div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-2"><DollarSign className="w-4 h-4" /><span>Total</span></div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginadas.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-gray-900">{f.numero_factura}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmt(f.fecha_emision)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmt(f.fecha_vencimiento)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{f.proveedor}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{f.area}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        ${f.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${estadoColor(f.estado)}`}>
                          {f.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  Mostrando {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtradas.length)} de {filtradas.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-600" style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
                    Pág. {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
