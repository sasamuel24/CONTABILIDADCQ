import { useState, useEffect } from 'react';
import { Search, LogOut, FolderInput, FileText, Calendar, DollarSign, Building2, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { getFacturas, type FacturaListItem, type Carpeta } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CarpetasPanel } from '../components/CarpetasPanel';
import { AsignarCarpetaModal } from '../components/AsignarCarpetaModal';
import { CentroDocumentalFacturaDetail } from '../components/CentroDocumentalFacturaDetail';

export function CarpetasGestionPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Estados
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [vistaActual, setVistaActual] = useState<'sin-archivar' | 'carpeta'>('sin-archivar');
  
  // Carpetas
  const [selectedCarpeta, setSelectedCarpeta] = useState<Carpeta | null>(null);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [facturaToAssign, setFacturaToAssign] = useState<FacturaListItem | null>(null);
  
  // Detalle de factura
  const [selectedFactura, setSelectedFactura] = useState<FacturaListItem | null>(null);
  
  // Ordenamiento
  const [sortColumn, setSortColumn] = useState<keyof FacturaListItem>('fecha_emision');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const facturasResponse = await getFacturas(0, 10000);
        setFacturas(facturasResponse.items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cargar datos';
        setError(message);
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Función de ordenamiento
  const handleSort = (column: keyof FacturaListItem) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Manejar selección de carpeta
  const handleSelectCarpeta = (carpeta: Carpeta | null) => {
    setSelectedCarpeta(carpeta);
    if (carpeta) {
      setVistaActual('carpeta');
    } else {
      setVistaActual('sin-archivar');
    }
    setCurrentPage(1);
  };

  // Filtrar facturas según la vista actual
  const filteredFacturas = facturas.filter(factura => {
    // Filtro de búsqueda
    const matchesSearch = 
      factura.numero_factura.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factura.proveedor.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    // Vista de facturas sin archivar
    if (vistaActual === 'sin-archivar') {
      return factura.carpeta_id === null;
    }

    // Vista de carpeta específica
    if (vistaActual === 'carpeta' && selectedCarpeta) {
      // Obtener IDs de todas las facturas en la carpeta seleccionada y sus subcarpetas
      const getFacturaIds = (carpeta: Carpeta): string[] => {
        const ids = carpeta.facturas?.map(f => f.id) || [];
        carpeta.children?.forEach(child => {
          ids.push(...getFacturaIds(child));
        });
        return ids;
      };
      const carpetaFacturaIds = getFacturaIds(selectedCarpeta);
      return carpetaFacturaIds.includes(factura.id);
    }

    return false;
  });

  // Ordenar facturas
  const sortedFacturas = [...filteredFacturas].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (sortColumn === 'fecha_emision') {
      const dateA = new Date(aValue as string).getTime();
      const dateB = new Date(bValue as string).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    if (sortColumn === 'total') {
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number) 
        : (bValue as number) - (aValue as number);
    }
    
    const strA = String(aValue).toLowerCase();
    const strB = String(bValue).toLowerCase();
    return sortDirection === 'asc' 
      ? strA.localeCompare(strB) 
      : strB.localeCompare(strA);
  });

  // Paginación
  const totalPages = Math.ceil(sortedFacturas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFacturas = sortedFacturas.slice(startIndex, startIndex + itemsPerPage);

  // Reset página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortColumn, sortDirection, selectedCarpeta, vistaActual]);

  const handleAsignarCarpeta = (factura: FacturaListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setFacturaToAssign(factura);
    setShowAsignarModal(true);
  };

  const handleVerDetalle = (factura: FacturaListItem) => {
    setSelectedFactura(factura);
  };

  const handleAsignarSuccess = async () => {
    // Recargar facturas después de asignar
    try {
      const facturasResponse = await getFacturas(0, 10000);
      setFacturas(facturasResponse.items);
    } catch (err) {
      console.error('Error reloading facturas:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackToInbox = () => {
    navigate('/contabilidad');
  };

  // Color del estado
  const getStatusColor = (estado: string): string => {
    const colors: Record<string, string> = {
      'Recibida': 'bg-blue-100 text-blue-700 border-blue-300',
      'Pendiente': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'Asignada': 'bg-purple-100 text-purple-700 border-purple-300',
      'En Curso': 'bg-indigo-100 text-indigo-700 border-indigo-300',
      'En Revisión Contabilidad': 'bg-orange-100 text-orange-700 border-orange-300',
      'Aprobada Tesorería': 'bg-teal-100 text-teal-700 border-teal-300',
      'Cerrada': 'bg-green-100 text-green-700 border-green-300',
      'Rechazada': 'bg-red-100 text-red-700 border-red-300',
    };
    return colors[estado] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header style={{background: 'linear-gradient(to right, #00829a, #14aab8)'}} className="border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderInput className="w-8 h-8 text-white" />
              <div>
                <h1 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-xl font-bold text-white">Gestión de Carpetas</h1>
                <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif', opacity: 0.9}} className="text-sm text-white">
                  {user?.area?.nombre || 'Contabilidad'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToInbox}
                style={{
                  fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                className="px-4 py-2 text-white rounded-lg"
              >
                ← Volver a Bandeja
              </button>
              <div className="text-right">
                <p style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm font-medium text-white">{user?.nombre}</p>
                <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif', opacity: 0.9}} className="text-xs text-white">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                style={{transition: 'background-color 0.2s'}}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                className="p-2 rounded-lg"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-12 gap-6">
            {/* Panel de carpetas - 3 columnas */}
            <div className="col-span-3">
              <CarpetasPanel 
                onSelectCarpeta={handleSelectCarpeta}
                selectedCarpeta={selectedCarpeta}
              />
            </div>

            {/* Contenido principal - 9 columnas */}
            <div className="col-span-9">
              {/* Filtros y búsqueda */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-lg font-semibold text-gray-900">
                    {vistaActual === 'sin-archivar' ? 'Facturas Sin Archivar' : `Carpeta: ${selectedCarpeta?.nombre}`}
                  </h2>
                  {vistaActual === 'sin-archivar' ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                      <span className="text-sm text-yellow-800 font-medium">
                        {filteredFacturas.length} facturas pendientes de archivar
                      </span>
                    </div>
                  ) : (
                    <div style={{backgroundColor: '#e0f5f7', borderColor: '#00829a'}} className="border-2 rounded-lg px-4 py-2">
                      <span style={{color: '#00829a'}} className="text-sm font-medium">
                        {filteredFacturas.length} facturas en esta carpeta
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Búsqueda */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por número de factura o proveedor..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Botón limpiar búsqueda */}
                {searchQuery && (
                  <div className="mt-4">
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{
                        fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                        color: '#00829a',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#14aab8'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#00829a'}
                      className="text-sm font-medium"
                    >
                      Limpiar búsqueda
                    </button>
                  </div>
                )}
              </div>

              {/* Tabla */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Header de la tabla con contador */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-lg font-semibold text-gray-900">
                    Facturas ({sortedFacturas.length})
                  </h2>
                  <div className="text-sm text-gray-500">
                    Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedFacturas.length)} de {sortedFacturas.length}
                  </div>
                </div>

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
                    {/* Tabla */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th 
                              onClick={() => handleSort('numero_factura')}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                <span>N° Factura</span>
                                {sortColumn === 'numero_factura' && (
                                  <span className="text-blue-600">
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleSort('fecha_emision')}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>Fecha</span>
                                {sortColumn === 'fecha_emision' && (
                                  <span className="text-blue-600">
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleSort('proveedor')}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                <span>Proveedor</span>
                                {sortColumn === 'proveedor' && (
                                  <span className="text-blue-600">
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleSort('area')}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                <span>Área</span>
                                {sortColumn === 'area' && (
                                  <span className="text-blue-600">
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleSort('total')}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                <span>Total</span>
                                {sortColumn === 'total' && (
                                  <span className="text-blue-600">
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Estado
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-mono text-sm font-medium text-gray-900">
                                  {factura.numero_factura}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {factura.fecha_emision 
                                  ? new Date(factura.fecha_emision).toLocaleDateString('es-ES', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {factura.proveedor}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {factura.area}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                ${factura.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(factura.estado)}`}>
                                  {factura.estado}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {vistaActual === 'sin-archivar' && (
                                  <button
                                    onClick={(e) => handleAsignarCarpeta(factura, e)}
                                    style={{
                                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                                      backgroundColor: '#00829a',
                                      transition: 'background-color 0.2s'
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
                                {vistaActual === 'carpeta' && factura.carpeta && (
                                  <div className="flex items-center gap-2">
                                    <FolderInput style={{color: '#00829a'}} className="w-5 h-5" />
                                    <span className="text-xs text-gray-500">{factura.carpeta.nombre}</span>
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
                      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Anterior
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">
                            Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span>
                          </span>
                        </div>
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
      </main>

      {/* Modal de asignar carpeta */}
      {showAsignarModal && facturaToAssign && (
        <AsignarCarpetaModal
          isOpen={showAsignarModal}
          onClose={() => {
            setShowAsignarModal(false);
            setFacturaToAssign(null);
          }}
          factura={facturaToAssign}
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
