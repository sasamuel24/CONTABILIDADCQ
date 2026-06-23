import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, RefreshCw, Store, AlertTriangle, Banknote, Clock, Search, Filter,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getRepresadasTiendas, getFacturas,
  RepresadasTiendasResponse, FacturaListItem,
} from '../lib/api';

const fmtMoney = (n: number) =>
  '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const diasDesde = (iso: string | null): number | null => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86_400_000));
};

const colorDias = (d: number | null): string => {
  if (d === null) return 'text-gray-400';
  if (d >= 15) return 'text-red-600';
  if (d >= 7) return 'text-amber-600';
  return 'text-emerald-600';
};

export function JefeZonaPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [resumen, setResumen] = useState<RepresadasTiendasResponse | null>(null);
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroArea, setFiltroArea] = useState<string>(''); // nombre de la tienda o '' = todas
  const [busqueda, setBusqueda] = useState('');           // buscador de la tabla de detalle
  const [buscarTienda, setBuscarTienda] = useState('');   // buscador del panel "Represadas por tienda"
  const [limiteTiendas, setLimiteTiendas] = useState(15); // slider: cuántas tiendas mostrar

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resumenData, facturasData] = await Promise.all([
        getRepresadasTiendas(),
        // Facturas represadas: todas las tiendas, estado por CÓDIGO 'asignada'
        // (el label es "Asignada a responsable", por eso se filtra por code, no por label)
        getFacturas(0, 0, undefined, undefined, undefined, undefined, undefined, true, 'asignada'),
      ]);
      setResumen(resumenData);
      setFacturas(facturasData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el monitoreo de tiendas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const facturasFiltradas = facturas.filter((f) => {
    // Comparación con trim: los nombres de área pueden traer espacios sobrantes.
    const areaOk = !filtroArea || (f.area || '').trim() === filtroArea.trim();
    const q = busqueda.trim().toLowerCase();
    const textoOk = !q
      || f.numero_factura.toLowerCase().includes(q)
      || f.proveedor.toLowerCase().includes(q)
      || (f.area || '').toLowerCase().includes(q);
    return areaOk && textoOk;
  });

  // Panel "Represadas por tienda": buscador por nombre + slider de cantidad.
  const tiendasTodas = resumen?.areas ?? [];
  const tiendasBuscadas = tiendasTodas.filter((t) =>
    !buscarTienda.trim() || t.nombre.toLowerCase().includes(buscarTienda.trim().toLowerCase())
  );
  const maxSlider = Math.max(1, tiendasBuscadas.length);
  const tiendasVisibles = tiendasBuscadas.slice(0, limiteTiendas);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 md:px-8 bg-white border-b border-gray-200" style={{ height: 56 }}>
        <div className="h-8 px-3 rounded-lg flex items-center" style={{ backgroundColor: '#00829a' }}>
          <span className="text-white text-sm font-bold" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>DocuFlow</span>
        </div>
        <span className="flex-1 text-sm font-semibold text-gray-700 truncate">
          Jefe de Zona · {user?.nombre ?? ''}
        </span>
        <button
          onClick={cargar}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Actualizar</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Salir</span>
        </button>
      </header>

      <main className="flex-1 overflow-auto px-4 md:px-8 py-6 max-w-7xl w-full mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            Monitoreo de Tiendas
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Facturas <span className="font-semibold">represadas</span> — asignadas al responsable y aún sin enviar a Contabilidad
          </p>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-center">{error}</div>
        ) : (
          <>
            {/* Tarjetas resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Card
                icon={<AlertTriangle className="w-5 h-5" />}
                label="Facturas represadas"
                value={loading ? null : String(resumen?.total_represadas ?? 0)}
                accent="#dc2626"
              />
              <Card
                icon={<Banknote className="w-5 h-5" />}
                label="Monto represado"
                value={loading ? null : fmtMoney(resumen?.monto_total ?? 0)}
                accent="#00829a"
              />
              <Card
                icon={<Store className="w-5 h-5" />}
                label="Tiendas con represadas"
                value={loading ? null : String(resumen?.tiendas_con_represadas ?? 0)}
                accent="#7c3aed"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Desglose por tienda */}
              <section className="lg:col-span-1">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-gray-400" />
                      <h2 className="text-sm font-bold text-gray-700">Represadas por tienda</h2>
                    </div>
                    {/* Buscador por nombre de tienda */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        value={buscarTienda}
                        onChange={(e) => setBuscarTienda(e.target.value)}
                        placeholder="Buscar tienda..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    {/* Slider: cantidad de tiendas a mostrar */}
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={maxSlider}
                        value={Math.min(limiteTiendas, maxSlider)}
                        onChange={(e) => setLimiteTiendas(Number(e.target.value))}
                        className="flex-1 accent-teal-600 cursor-pointer"
                        disabled={loading || tiendasBuscadas.length === 0}
                      />
                      <span className="text-xs text-gray-500 whitespace-nowrap font-mono">
                        {Math.min(limiteTiendas, maxSlider)} / {tiendasBuscadas.length}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto">
                    {loading ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                      </div>
                    ) : tiendasTodas.length === 0 ? (
                      <div className="py-12 text-center text-gray-400 text-sm">No hay facturas represadas 🎉</div>
                    ) : tiendasBuscadas.length === 0 ? (
                      <div className="py-12 text-center text-gray-400 text-sm">Ninguna tienda coincide con "{buscarTienda}"</div>
                    ) : (
                      <>
                        <button
                          onClick={() => setFiltroArea('')}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors"
                          style={{ backgroundColor: filtroArea === '' ? 'rgba(0,130,154,0.08)' : 'transparent' }}
                        >
                          <span className={filtroArea === '' ? 'font-semibold text-teal-700' : 'text-gray-600'}>Todas las tiendas</span>
                          <span className="text-gray-500 font-mono">{resumen?.total_represadas ?? 0}</span>
                        </button>
                        {tiendasVisibles.map((t) => {
                          const d = diasDesde(t.mas_antigua);
                          const activo = filtroArea === t.nombre;
                          return (
                            <button
                              key={t.area_id}
                              onClick={() => setFiltroArea(activo ? '' : t.nombre)}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors text-left"
                              style={{ backgroundColor: activo ? 'rgba(0,130,154,0.08)' : 'transparent' }}
                            >
                              <div className="min-w-0">
                                <div className={`truncate ${activo ? 'font-semibold text-teal-700' : 'text-gray-700'}`}>{t.nombre}</div>
                                <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" />
                                  {d === null ? '—' : `${d} día${d === 1 ? '' : 's'}`} · {fmtMoney(t.monto)}
                                </div>
                              </div>
                              <span className="ml-2 shrink-0 inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
                                {t.count}
                              </span>
                            </button>
                          );
                        })}
                        {tiendasVisibles.length < tiendasBuscadas.length && (
                          <div className="px-4 py-2.5 text-center text-xs text-gray-400">
                            Mostrando {tiendasVisibles.length} de {tiendasBuscadas.length} tiendas · usa el slider para ver más
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* Detalle de facturas */}
              <section className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: 560 }}>
                  <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <h2 className="text-sm font-bold text-gray-700">
                        {filtroArea || 'Todas las tiendas'}
                        <span className="ml-2 text-gray-400 font-normal">({facturasFiltradas.length})</span>
                      </h2>
                    </div>
                    <div className="relative sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="N° factura, proveedor, tienda..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold">N° Factura</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold">Proveedor</th>
                          <th className="hidden md:table-cell text-left px-4 py-3 text-gray-500 font-semibold">Tienda</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-semibold">Total</th>
                          <th className="hidden sm:table-cell text-left px-4 py-3 text-gray-500 font-semibold">Emisión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {loading ? (
                          Array(6).fill(0).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                              <td className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-32" /></td>
                              <td className="hidden md:table-cell px-4 py-3"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                              <td className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-16 ml-auto" /></td>
                              <td className="hidden sm:table-cell px-4 py-3"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                            </tr>
                          ))
                        ) : facturasFiltradas.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-12 text-gray-400">No hay facturas represadas para este filtro</td></tr>
                        ) : (
                          facturasFiltradas.map((f) => (
                            <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3"><span className="font-mono text-gray-900 text-xs">{f.numero_factura}</span></td>
                              <td className="px-4 py-3"><span className="text-gray-800">{f.proveedor}</span></td>
                              <td className="hidden md:table-cell px-4 py-3"><span className="text-gray-600">{f.area}</span></td>
                              <td className="px-4 py-3 text-right whitespace-nowrap text-gray-900">{fmtMoney(f.total)}</td>
                              <td className="hidden sm:table-cell px-4 py-3 text-gray-500 text-xs">{f.fecha_emision ?? '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Card({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | null; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accent + '1a', color: accent }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        {value === null ? (
          <div className="h-7 w-20 bg-gray-100 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
        )}
      </div>
    </div>
  );
}
