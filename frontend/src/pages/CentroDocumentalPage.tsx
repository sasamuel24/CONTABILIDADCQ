import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, FileText, Calendar, DollarSign, Building2, Activity, LogOut, FileBarChart, FolderInput } from 'lucide-react';
import { getFacturas, getAreas, type FacturaListItem, type Area, type Carpeta } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CarpetasPanel } from '../components/CarpetasPanel';
import { AsignarCarpetaModal } from '../components/AsignarCarpetaModal';

export function CentroDocumentalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Estados
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('Todas');
  const [selectedEstado, setSelectedEstado] = useState('Todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  
  // Carpetas
  const [selectedCarpeta, setSelectedCarpeta] = useState<Carpeta | null>(null);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [facturaToAssign, setFacturaToAssign] = useState<FacturaListItem | null>(null);
  
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

        const [facturasResponse, areasData] = await Promise.all([
          getFacturas(0, 10000), // Cargar todas las facturas
          getAreas()
        ]);

        setFacturas(facturasResponse.items);
        setAreas(areasData);
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

  // Mapeo de estados a proceso actual
  const getProcesoActual = (estado: string): string => {
    const estadosRevision = ['Recibida', 'Pendiente', 'Asignada', 'En Curso'];
    const estadosPago = ['En Revisión Contabilidad', 'Aprobada Tesorería'];
    const estadosArchivada = ['Cerrada', 'Rechazada'];

    if (estadosRevision.includes(estado)) return 'Revisión';
    if (estadosPago.includes(estado)) return 'Pago';
    if (estadosArchivada.includes(estado)) return 'Archivada';
    return 'Revisión';
  };

  // Filtrar facturas
  const filteredFacturas = facturas.filter(factura => {
    // Filtro de búsqueda
    const matchesSearch = 
      factura.numero_factura.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factura.proveedor.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filtro de área
    const matchesArea = selectedArea === 'Todas' || factura.area === selectedArea;
    
    // Filtro de estado
    const matchesEstado = selectedEstado === 'Todos' || factura.estado === selectedEstado;
    
    // Filtro de fecha desde
    const matchesFechaDesde = !fechaDesde || (factura.fecha_emision && new Date(factura.fecha_emision) >= new Date(fechaDesde));
    
    // Filtro de fecha hasta
    const matchesFechaHasta = !fechaHasta || (factura.fecha_emision && new Date(factura.fecha_emision) <= new Date(fechaHasta));

    // Filtro de carpeta
    let matchesCarpeta = true;
    if (selectedCarpeta) {
      // Obtener IDs de todas las facturas en la carpeta seleccionada y sus subcarpetas
      const getFacturaIds = (carpeta: Carpeta): string[] => {
        const ids = carpeta.facturas?.map(f => f.id) || [];
        carpeta.children?.forEach(child => {
          ids.push(...getFacturaIds(child));
        });
        return ids;
      };
      const carpetaFacturaIds = getFacturaIds(selectedCarpeta);
      matchesCarpeta = carpetaFacturaIds.includes(factura.id);
    }

    return matchesSearch && matchesArea && matchesEstado && matchesFechaDesde && matchesFechaHasta && matchesCarpeta;
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
  }, [searchQuery, selectedArea, selectedEstado, fechaDesde, fechaHasta, sortColumn, sortDirection, selectedCarpeta]);

  const handleAsignarCarpeta = (factura: FacturaListItem) => {
    setFacturaToAssign(factura);
    setShowAsignarModal(true);
  };

  const handleAsignarSuccess = async () => {
    // Recargar facturas después de asignar
    try {
      const [facturasResponse] = await Promise.all([
        getFacturas(0, 10000)
      ]);
      setFacturas(facturasResponse.items);
    } catch (err) {
      console.error('Error reloading facturas:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Estados únicos de las facturas
  const estadosUnicos = Array.from(new Set(facturas.map(f => f.estado))).sort();

  // Color del tag según proceso
  const getProcesoColor = (proceso: string): string => {
    switch (proceso) {
      case 'Revisión': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Pago': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Archivada': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header style={{background: 'linear-gradient(to right, #00829a, #14aab8)'}} className="border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileBarChart className="w-8 h-8 text-white" />
              <div>
                <h1 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-xl font-bold text-white">Centro Documental</h1>
                <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif', opacity: 0.9}} className="text-sm text-white">Directora Contabilidad</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
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
                onSelectCarpeta={setSelectedCarpeta}
                selectedCarpeta={selectedCarpeta}
              />
            </div>

            {/* Contenido principal - 9 columnas */}
            <div className="col-span-9">
              {/* Filtros */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-lg font-semibold text-gray-900">Filtros</h2>
                  {selectedCarpeta && (
                    <div style={{backgroundColor: '#e0f5f7', borderColor: '#00829a'}} className="flex items-center gap-2 px-3 py-1 border rounded-lg">
                      <FolderInput className="w-4 h-4" style={{color: '#00829a'}} />
                      <span style={{color: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm font-medium">{selectedCarpeta.nombre}</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Búsqueda */}
                  <div className="lg:col-span-2">
                    <label style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="block text-sm font-medium text-gray-700 mb-1">
                      Buscar
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Número de factura o proveedor"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Filtro por área */}
                  <div>
                    <label style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="block text-sm font-medium text-gray-700 mb-1">
                      Área
                    </label>
                    <select
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Todas">Todas las áreas</option>
                      {areas.map(area => (
                        <option key={area.id} value={area.nombre}>{area.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por estado */}
                  <div>
                    <label style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="block text-sm font-medium text-gray-700 mb-1">
                      Estado
                    </label>
                    <select
                      value={selectedEstado}
                      onChange={(e) => setSelectedEstado(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Todos">Todos los estados</option>
                      {estadosUnicos.map(estado => (
                        <option key={estado} value={estado}>{estado}</option>
                      ))}
                    </select>
                  </div>

                  {/* Fecha desde */}
                  <div>
                    <label style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha desde
                    </label>
                    <input
                      type="date"
                      value={fechaDesde}
                      onChange={(e) => setFechaDesde(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Fecha hasta */}
                  <div>
                    <label style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha hasta
                    </label>
                    <input
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => setFechaHasta(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Botón limpiar filtros */}
                {(searchQuery || selectedArea !== 'Todas' || selectedEstado !== 'Todos' || fechaDesde || fechaHasta) && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedArea('Todas');
                        setSelectedEstado('Todos');
                        setFechaDesde('');
                        setFechaHasta('');
                      }}
                      style={{
                        fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                        color: '#00829a',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#14aab8'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#00829a'}
                      className="text-sm font-medium"
                    >
                      Limpiar filtros
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
                    <p className="text-gray-600 font-medium">No hay facturas disponibles</p>
                    <p className="text-gray-500 text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
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
                                <span>Número Factura</span>
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
                                <span>Fecha Emisión</span>
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
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Archivado
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Proceso Actual
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedFacturas.map((factura) => {
                            const proceso = getProcesoActual(factura.estado);
                            const procesoColor = getProcesoColor(proceso);
                            
                            return (
                              <tr key={factura.id} className="hover:bg-gray-50 transition-colors">
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
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <div className="flex justify-center" title={factura.carpeta ? `Archivado en: ${factura.carpeta.nombre}` : 'Sin archivar'}>
                                    <FolderInput style={{color: factura.carpeta ? '#00829a' : '#ef4444'}} className="w-5 h-5" />
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${procesoColor}`}>
                                    {proceso}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <button
                                    onClick={() => handleAsignarCarpeta(factura)}
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
                                    <span>Carpeta</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
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
    </div>
  );
}
