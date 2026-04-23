import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronLeft, ChevronRight, FileText, Calendar, DollarSign, Building2, Activity, FolderInput, Archive } from 'lucide-react';
import { getFacturas, type FacturaListItem, type CarpetaTesoreria } from '../lib/api';
import { CarpetasPanelTesoreria } from './CarpetasPanelTesoreria';
import { AsignarCarpetaTesoreriaModal } from './AsignarCarpetaTesoreriaModal';
import { CentroDocumentalFacturaDetail } from './CentroDocumentalFacturaDetail';

export function CarpetasTesoreriaView() {
  // Estados
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [vistaActual, setVistaActual] = useState<'sin-archivar' | 'carpeta'>('sin-archivar');

  // Carpetas
  const [selectedCarpeta, setSelectedCarpeta] = useState<CarpetaTesoreria | null>(null);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [facturasToAssign, setFacturasToAssign] = useState<FacturaListItem[]>([]);

  // Selección masiva
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  // Detalle de factura
  const [selectedFactura, setSelectedFactura] = useState<FacturaListItem | null>(null);

  // Ordenamiento
  const [sortColumn, setSortColumn] = useState<keyof FacturaListItem>('fecha_emision');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const facturasResponse = await getFacturas(0, 10000);
        const facturasCerradas = facturasResponse.items.filter(f => f.estado === 'Pagada');
        setFacturas(facturasCerradas);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cargar datos';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSort = (column: keyof FacturaListItem) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleSelectCarpeta = (carpeta: CarpetaTesoreria | null) => {
    setSelectedCarpeta(carpeta);
    setVistaActual(carpeta ? 'carpeta' : 'sin-archivar');
    setCurrentPage(1);
    setSeleccionados(new Set());
  };

  // Filtrar facturas según la vista actual
  const filteredFacturas = facturas.filter(factura => {
    const matchesSearch =
      factura.numero_factura.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factura.proveedor.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (vistaActual === 'sin-archivar') {
      return factura.carpeta_tesoreria_id === null;
    }

    if (vistaActual === 'carpeta' && selectedCarpeta) {
      const getFacturaIds = (carpeta: CarpetaTesoreria): string[] => {
        const ids = carpeta.facturas?.map(f => f.id) || [];
        carpeta.children?.forEach(child => ids.push(...getFacturaIds(child)));
        return ids;
      };
      return getFacturaIds(selectedCarpeta).includes(factura.id);
    }

    return false;
  });

  // Ordenar
  const sortedFacturas = [...filteredFacturas].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    if (sortColumn === 'fecha_emision') {
      return sortDirection === 'asc'
        ? new Date(aValue as string).getTime() - new Date(bValue as string).getTime()
        : new Date(bValue as string).getTime() - new Date(aValue as string).getTime();
    }
    if (sortColumn === 'total') {
      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    }
    const strA = String(aValue).toLowerCase();
    const strB = String(bValue).toLowerCase();
    return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });

  // Paginación
  const totalPages = Math.ceil(sortedFacturas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFacturas = sortedFacturas.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortColumn, sortDirection, selectedCarpeta, vistaActual]);

  // Selección masiva
  const toggleSeleccion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodos = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ids = sortedFacturas.map(f => f.id);
    setSeleccionados(prev => prev.size === ids.length ? new Set() : new Set(ids));
  };

  const handleAsignarCarpeta = (factura: FacturaListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setFacturasToAssign([factura]);
    setShowAsignarModal(true);
  };

  const handleArchivarSeleccionados = () => {
    const facturasSeleccionadas = sortedFacturas.filter(f => seleccionados.has(f.id));
    setFacturasToAssign(facturasSeleccionadas);
    setShowAsignarModal(true);
  };

  const handleVerDetalle = (factura: FacturaListItem) => {
    setSelectedFactura(factura);
  };

  const handleAsignarSuccess = async () => {
    try {
      const facturasResponse = await getFacturas(0, 10000);
      const facturasCerradas = facturasResponse.items.filter(f => f.estado === 'Pagada');
      setFacturas(facturasCerradas);
      setSeleccionados(new Set());
      if (vistaActual === 'sin-archivar') setCurrentPage(1);
      setShowAsignarModal(false);
      setFacturasToAssign([]);
    } catch (err) {
      console.error('Error reloading facturas:', err);
    }
  };

  const getStatusColor = (estado: string): string => {
    const colors: Record<string, string> = {
      'Recibida': 'bg-blue-100 text-blue-700 border-blue-300',
      'Pendiente': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'Asignada': 'bg-purple-100 text-purple-700 border-purple-300',
      'En Curso': 'bg-indigo-100 text-indigo-700 border-indigo-300',
      'En Revisión Contabilidad': 'bg-orange-100 text-orange-700 border-orange-300',
      'Aprobada Tesorería': 'bg-teal-100 text-teal-700 border-teal-300',
      'Pagada': 'bg-green-100 text-green-700 border-green-300',
      'Rechazada': 'bg-red-100 text-red-700 border-red-300',
    };
    return colors[estado] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const todosSeleccionados = sortedFacturas.length > 0 && seleccionados.size === sortedFacturas.length;
  const algunoSeleccionado = seleccionados.size > 0 && seleccionados.size < sortedFacturas.length;

  return (
    <div className="flex-1 bg-white">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }} className="text-xl font-bold text-gray-900">
                {vistaActual === 'sin-archivar' ? 'Facturas Sin Archivar' : `Carpeta: ${selectedCarpeta?.nombre}`}
              </h2>
              <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm text-gray-500 mt-1">
                {vistaActual === 'sin-archivar'
                  ? `${filteredFacturas.length} facturas pendientes de archivar`
                  : `${filteredFacturas.length} facturas en esta carpeta`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Panel de carpetas */}
          <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
            <CarpetasPanelTesoreria
              onSelectCarpeta={handleSelectCarpeta}
              selectedCarpeta={selectedCarpeta}
            />
          </div>

          {/* Contenido principal */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Barra de búsqueda */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por número de factura o proveedor..."
                    style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Tabla */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">Cargando facturas...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <p className="text-red-600 font-medium mb-2">Error al cargar datos</p>
                    <p className="text-gray-500 text-sm">{error}</p>
                  </div>
                </div>
              ) : sortedFacturas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-gray-600 font-medium">
                    {vistaActual === 'sin-archivar'
                      ? '¡Todas las facturas están archivadas!'
                      : 'Esta carpeta no contiene facturas'}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    {vistaActual === 'sin-archivar'
                      ? 'Excelente trabajo organizando las facturas'
                      : 'Asigna facturas desde la vista "Sin Archivar"'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {/* Checkbox "seleccionar todos" */}
                          <th className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={todosSeleccionados}
                              ref={el => { if (el) el.indeterminate = algunoSeleccionado; }}
                              onChange={() => {}}
                              onClick={toggleTodos}
                              style={{ width: 15, height: 15, accentColor: '#00829a', cursor: 'pointer' }}
                              title="Seleccionar todos"
                            />
                          </th>
                          <th
                            onClick={() => handleSort('numero_factura')}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span>N° Factura</span>
                              {sortColumn === 'numero_factura' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort('fecha_emision')}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              <span>Fecha</span>
                              {sortColumn === 'fecha_emision' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort('proveedor')}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4" />
                              <span>Proveedor</span>
                              {sortColumn === 'proveedor' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort('area')}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4" />
                              <span>Área</span>
                              {sortColumn === 'area' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort('total')}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              <span>Total</span>
                              {sortColumn === 'total' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedFacturas.map((factura) => (
                          <tr
                            key={factura.id}
                            onClick={() => handleVerDetalle(factura)}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            style={{
                              backgroundColor: seleccionados.has(factura.id) ? '#e0f5f7' : undefined,
                            }}
                          >
                            {/* Checkbox */}
                            <td className="px-3 py-3 w-10" onClick={(e) => toggleSeleccion(factura.id, e)}>
                              <input
                                type="checkbox"
                                checked={seleccionados.has(factura.id)}
                                onChange={() => {}}
                                style={{ width: 15, height: 15, accentColor: '#00829a', cursor: 'pointer' }}
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono text-sm font-medium text-gray-900">
                                {factura.numero_factura}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {factura.fecha_emision
                                ? new Date(factura.fecha_emision).toLocaleDateString('es-ES', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                  })
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{factura.proveedor}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{factura.area}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              ${factura.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(factura.estado)}`}>
                                {factura.estado}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {vistaActual === 'sin-archivar' && (
                                <button
                                  onClick={(e) => handleAsignarCarpeta(factura, e)}
                                  style={{
                                    fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                                    backgroundColor: '#00829a',
                                    transition: 'background-color 0.2s',
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#14aab8'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00829a'}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg"
                                  title="Asignar a carpeta"
                                >
                                  <FolderInput className="w-3.5 h-3.5" />
                                  <span>Archivar</span>
                                </button>
                              )}
                              {vistaActual === 'carpeta' && factura.carpeta_tesoreria && (
                                <div className="flex items-center gap-2">
                                  <FolderInput style={{ color: '#00829a' }} className="w-5 h-5" />
                                  <span className="text-xs text-gray-500">{factura.carpeta_tesoreria.nombre}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </button>
                      <span className="text-sm text-gray-700">
                        Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span>
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barra flotante de selección masiva */}
      {seleccionados.size > 0 && createPortal(
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9998, display: 'flex', alignItems: 'center', gap: 20,
          background: '#00829a', color: '#fff', borderRadius: 14,
          padding: '14px 24px', boxShadow: '0 8px 32px rgba(0,130,154,0.35)',
          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
          minWidth: 360,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
            {seleccionados.size} factura{seleccionados.size !== 1 ? 's' : ''} seleccionada{seleccionados.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setSeleccionados(new Set())}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Limpiar
          </button>
          <button
            onClick={handleArchivarSeleccionados}
            style={{
              background: '#fff', border: 'none', color: '#00829a',
              borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Archive style={{ width: 15, height: 15 }} />
            Archivar seleccionadas
          </button>
        </div>,
        document.body
      )}

      {/* Modal de asignar carpeta */}
      {showAsignarModal && facturasToAssign.length > 0 && (
        <AsignarCarpetaTesoreriaModal
          isOpen={showAsignarModal}
          onClose={() => {
            setShowAsignarModal(false);
            setFacturasToAssign([]);
          }}
          facturas={facturasToAssign}
          onSuccess={handleAsignarSuccess}
        />
      )}

      {/* Modal de detalle de factura */}
      {selectedFactura && (
        <CentroDocumentalFacturaDetail
          factura={selectedFactura}
          onClose={() => setSelectedFactura(null)}
        />
      )}
    </div>
  );
}
