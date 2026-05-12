import { useState, useEffect } from 'react';
import { Search, RefreshCw, CheckCircle2, Clock, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { getHistorialArea, type HistorialFacturaItem } from '../lib/api';

type SortDir = 'asc' | 'desc' | null;
type HistSortCol = 'numero_factura' | 'proveedor' | 'total' | 'estado_label' | 'assigned_at' | 'fecha_envio_contabilidad' | 'fecha_envio_tesoreria' | 'fecha_cierre';

function SortIconHist({ col, sortCol, sortDir }: { col: HistSortCol; sortCol: HistSortCol | null; sortDir: SortDir }) {
  if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 text-gray-400 shrink-0" />;
  if (sortDir === 'asc') return <ChevronUp className="w-3 h-3 text-[#00829a] shrink-0" />;
  return <ChevronDown className="w-3 h-3 text-[#00829a] shrink-0" />;
}

const FONT = "'Neutra Text', 'Montserrat', sans-serif";

const ESTADO_COLOR: Record<string, string> = {
  'Recibida':                   'bg-blue-100 text-blue-700',
  'Asignada a responsable':     'bg-purple-100 text-purple-700',
  'En Contabilidad':            'bg-orange-100 text-orange-700',
  'En Tesorería':               'bg-teal-100 text-teal-700',
  'Pagada':                     'bg-green-100 text-green-700',
  'Rechazada':                  'bg-red-100 text-red-700',
};

function estadoColor(label: string) {
  return ESTADO_COLOR[label] ?? 'bg-gray-100 text-gray-600';
}

function fmtDate(iso: string | null) {
  if (!iso) return <span className="text-gray-300">—</span>;
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtCOP(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {done
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
        : <Clock className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
      <span className={done ? 'text-green-700' : 'text-gray-400'}>{label}</span>
    </div>
  );
}

function inferirPasos(item: HistorialFacturaItem) {
  const label = item.estado_label.toLowerCase();
  const enOPasadoTesoreria = label.includes('tesor') || item.es_finalizada;
  const esFinalizada = item.es_finalizada;

  return {
    area: true, // si está en el historial, ya pasó por el área
    contabilidad: !!item.fecha_envio_contabilidad || enOPasadoTesoreria,
    tesoreria: !!item.fecha_envio_tesoreria || esFinalizada,
    pagada: !!item.fecha_cierre || esFinalizada,
  };
}

const ITEMS_PER_PAGE = 20;

export function ResponsableHistorialView() {
  const [items, setItems] = useState<HistorialFacturaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<HistSortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  function handleSort(col: HistSortCol) {
    if (sortCol !== col) { setSortCol(col); setSortDir('asc'); setPage(1); }
    else if (sortDir === 'asc') { setSortDir('desc'); setPage(1); }
    else { setSortCol(null); setSortDir(null); }
  }

  const cargar = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getHistorialArea();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el historial');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const filtered = items.filter(f => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      f.numero_factura.toLowerCase().includes(q) ||
      f.proveedor.toLowerCase().includes(q);
    const matchEstado =
      filterEstado === 'todos' ||
      (filterEstado === 'finalizadas' && f.es_finalizada) ||
      (filterEstado === 'en_curso' && !f.es_finalizada);
    return matchSearch && matchEstado;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol || !sortDir) return 0;
    const dateMs = (v: string | null) => v ? new Date(v).getTime() : 0;
    let av: string | number, bv: string | number;
    switch (sortCol) {
      case 'numero_factura':            av = a.numero_factura;  bv = b.numero_factura;  break;
      case 'proveedor':                 av = a.proveedor;       bv = b.proveedor;       break;
      case 'total':                     av = a.total;           bv = b.total;           break;
      case 'estado_label':              av = a.estado_label;    bv = b.estado_label;    break;
      case 'assigned_at':               av = dateMs(a.assigned_at);               bv = dateMs(b.assigned_at);               break;
      case 'fecha_envio_contabilidad':  av = dateMs(a.fecha_envio_contabilidad);  bv = dateMs(b.fecha_envio_contabilidad);  break;
      case 'fecha_envio_tesoreria':     av = dateMs(a.fecha_envio_tesoreria);     bv = dateMs(b.fecha_envio_tesoreria);     break;
      case 'fecha_cierre':              av = dateMs(a.fecha_cierre);              bv = dateMs(b.fecha_cierre);              break;
      default: return 0;
    }
    if (typeof av === 'string') {
      const cmp = av.localeCompare(bv as string, 'es', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleEstado = (v: string) => { setFilterEstado(v); setPage(1); };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: FONT }}>
          Historial de Facturas
        </h2>
        <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: FONT }}>
          Todas las facturas que han pasado por tu área, con seguimiento hasta el cierre en Tesorería
        </p>
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00829a]/30"
            placeholder="Buscar por número o proveedor…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ fontFamily: FONT }}
          />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00829a]/30"
          value={filterEstado}
          onChange={e => handleEstado(e.target.value)}
          style={{ fontFamily: FONT }}
        >
          <option value="todos">Todos los estados</option>
          <option value="en_curso">En curso</option>
          <option value="finalizadas">Finalizadas (Pagadas)</option>
        </select>
        <button
          onClick={cargar}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          style={{ fontFamily: FONT }}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Contador */}
      <p className="text-xs text-gray-400 mb-3" style={{ fontFamily: FONT }}>
        {filtered.length} factura{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Estado de carga */}
      {isLoading && (
        <div className="flex justify-center py-20 text-gray-400">
          <div className="animate-spin w-6 h-6 border-2 border-[#00829a] border-t-transparent rounded-full" />
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm" style={{ fontFamily: FONT }}>
          {error}
        </div>
      )}

      {/* Tabla */}
      {!isLoading && !error && (
        <>
          {paginated.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm" style={{ fontFamily: FONT }}>
              No se encontraron facturas
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {(
                      [
                        { col: 'numero_factura',           label: 'N° Factura'       },
                        { col: 'proveedor',                label: 'Proveedor'         },
                        { col: 'total',                    label: 'Total'             },
                        { col: 'estado_label',             label: 'Estado'            },
                        { col: null,                       label: 'Flujo'             },
                        { col: 'assigned_at',              label: 'Recibida en Área'  },
                        { col: 'fecha_envio_contabilidad', label: 'Contabilidad'      },
                        { col: 'fecha_envio_tesoreria',    label: 'Tesorería'         },
                        { col: 'fecha_cierre',             label: 'Cierre'            },
                      ] as { col: HistSortCol | null; label: string }[]
                    ).map(({ col, label }) => (
                      <th
                        key={label}
                        className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${col ? 'cursor-pointer select-none hover:bg-gray-100 transition-colors' : ''}`}
                        style={{ fontFamily: FONT }}
                        onClick={() => col && handleSort(col)}
                      >
                        <div className="flex items-center gap-1">
                          {label}
                          {col && <SortIconHist col={col} sortCol={sortCol} sortDir={sortDir} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((f, i) => (
                    <tr
                      key={f.id}
                      className={`border-b border-gray-50 transition-colors hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      {/* N° Factura */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-800 whitespace-nowrap">
                        {f.numero_factura}
                      </td>

                      {/* Proveedor */}
                      <td className="px-4 py-3 max-w-[180px]">
                        <span
                          className="block truncate text-gray-700 text-sm"
                          style={{ fontFamily: FONT }}
                          title={f.proveedor}
                        >
                          {f.proveedor}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap font-medium text-xs">
                        {fmtCOP(f.total)}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${estadoColor(f.estado_label)}`}
                          style={{ fontFamily: FONT }}
                        >
                          {f.estado_label}
                        </span>
                      </td>

                      {/* Flujo */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const pasos = inferirPasos(f);
                          return (
                            <div className="flex flex-col gap-0.5">
                              <Step done={pasos.area} label="Área" />
                              <Step done={pasos.contabilidad} label="Contabilidad" />
                              <Step done={pasos.tesoreria} label="Tesorería" />
                              <Step done={pasos.pagada} label="Pagada" />
                            </div>
                          );
                        })()}
                      </td>

                      {/* Recibida en área */}
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap" style={{ fontFamily: FONT }}>
                        {fmtDate(f.assigned_at)}
                      </td>

                      {/* Contabilidad */}
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap" style={{ fontFamily: FONT }}>
                        {fmtDate(f.fecha_envio_contabilidad)}
                      </td>

                      {/* Tesorería */}
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap" style={{ fontFamily: FONT }}>
                        {fmtDate(f.fecha_envio_tesoreria)}
                      </td>

                      {/* Cierre */}
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {f.fecha_cierre
                          ? <span className="text-green-600 font-medium" style={{ fontFamily: FONT }}>{fmtDate(f.fecha_cierre)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-400" style={{ fontFamily: FONT }}>
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
