import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, FileText, Calendar, DollarSign, Building2, Activity, FolderOpen, Folder } from 'lucide-react';
import { getFacturas, getCarpetas, getEstados, type FacturaListItem, type Carpeta, type Estado } from '../lib/api';
import { CentroDocumentalFacturaDetail } from './CentroDocumentalFacturaDetail';

export function CarpetasView() {
  // Estados
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [carpetas, setCarpetas] = useState<Map<string, Carpeta>>(new Map());
  const [estados, setEstados] = useState<Estado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterArchivadas, setFilterArchivadas] = useState<'todas' | 'archivadas' | 'sin-archivar'>('todas');
  const [filterEstado, setFilterEstado] = useState<string>('todos');
  
  // Detalle de factura
  const [selectedFactura, setSelectedFactura] = useState<FacturaListItem | null>(null);
  
  // Ordenamiento
  const [sortColumn, setSortColumn] = useState<keyof FacturaListItem>('fecha_emision');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Cargar facturas y carpetas primero
        const [facturasResponse, carpetasResponse] = await Promise.all([
          getFacturas(0, 10000),
          getCarpetas()
        ]);
        
        setFacturas(facturasResponse.items);
        
        // Crear mapa de carpetas por ID (aplanando la jerarquía)
        const carpetasMap = new Map<string, Carpeta>();
        
        // Función recursiva para aplanar carpetas y subcarpetas
        const addCarpetasToMap = (carpetas: Carpeta[]) => {
          carpetas.forEach(carpeta => {
            carpetasMap.set(carpeta.id, carpeta);
            // Procesar subcarpetas recursivamente
            if (carpeta.children && carpeta.children.length > 0) {
              addCarpetasToMap(carpeta.children);
            }
          });
        };
        
        addCarpetasToMap(carpetasResponse);
        setCarpetas(carpetasMap);
        
        console.log(`Carpetas cargadas: ${carpetasMap.size} carpetas en el mapa`);
        console.log('Muestra de carpetas:', Array.from(carpetasMap.entries()).slice(0, 3));
        
        // Cargar estados por separado para mejor debugging
        try {
          console.log('Intentando cargar estados...');
          const estadosResponse = await getEstados();
          console.log('Respuesta de estados:', estadosResponse);
          console.log('Tipo de respuesta:', typeof estadosResponse);
          console.log('¿Es array?:', Array.isArray(estadosResponse));
          
          if (Array.isArray(estadosResponse)) {
            setEstados(estadosResponse);
            console.log(`✓ Estados cargados exitosamente: ${estadosResponse.length} estados`);
            console.log('Estados:', estadosResponse);
          } else {
            console.error('La respuesta de estados no es un array:', estadosResponse);
            setEstados([]);
          }
        } catch (estadosError) {
          console.error('Error al cargar estados:', estadosError);
          console.error('Detalles del error:', estadosError instanceof Error ? estadosError.message : estadosError);
          // No bloquear la carga de facturas si falla estados
          setEstados([]);
        }
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

  // Filtrar facturas
  const filteredFacturas = facturas.filter(factura => {
    // Filtro de búsqueda
    const matchesSearch = 
      factura.numero_factura.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factura.proveedor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (factura.carpeta?.nombre?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    // Filtro de archivado
    if (filterArchivadas === 'archivadas') {
      if (factura.carpeta_id === null) return false;
    } else if (filterArchivadas === 'sin-archivar') {
      if (factura.carpeta_id !== null) return false;
    }

    // Filtro de estado
    if (filterEstado !== 'todos') {
      if (factura.estado !== filterEstado) return false;
    }

    return true;
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
  }, [searchQuery, sortColumn, sortDirection, filterArchivadas, filterEstado]);

  const handleVerDetalle = (factura: FacturaListItem) => {
    setSelectedFactura(factura);
  };

  // Contar facturas archivadas vs sin archivar
  const facturasArchivadas = facturas.filter(f => f.carpeta_id !== null).length;
  const facturasSinArchivar = facturas.filter(f => f.carpeta_id === null).length;

  // Construir ruta completa de carpeta (Padre / Hijo / Nieto)
  const getCarpetaPath = (carpetaId: string | null, fallbackNombre?: string): string => {
    if (!carpetaId) return '';
    
    const path: string[] = [];
    let currentId: string | null = carpetaId;
    let foundInMap = false;
    
    // Recorrer hacia arriba siguiendo parent_id
    while (currentId) {
      const carpeta = carpetas.get(currentId);
      if (!carpeta) {
        console.warn(`Carpeta con ID ${currentId} no encontrada en el mapa`);
        break;
      }
      
      foundInMap = true;
      path.unshift(carpeta.nombre); // Agregar al inicio para mantener orden correcto
      currentId = carpeta.parent_id;
    }
    
    // Si no se encontró en el mapa pero hay un nombre de respaldo, usarlo
    if (!foundInMap && fallbackNombre) {
      return fallbackNombre;
    }
    
    return path.join(' / ') || fallbackNombre || 'Carpeta desconocida';
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
    <div className="flex-1 bg-white">
      <div className="h-full flex flex-col">
        {/* Header con título y estadísticas */}
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-xl font-bold text-gray-900">
                Trazabilidad de Facturas
              </h2>
              <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-gray-500 mt-1">
                Consulta general y ubicación de todas las facturas
              </p>
            </div>
            <div className="flex gap-4">
              <div className="text-center px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-gray-500">Total</p>
                <p style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-lg font-bold text-gray-900">{facturas.length}</p>
              </div>
              <div className="text-center px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-green-600">Archivadas</p>
                <p style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-lg font-bold text-green-700">{facturasArchivadas}</p>
              </div>
              <div className="text-center px-4 py-2 bg-yellow-50 rounded-lg border border-yellow-200">
                <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-yellow-600">Sin Archivar</p>
                <p style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-lg font-bold text-yellow-700">{facturasSinArchivar}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Barra de búsqueda y filtros */}
            <div className="mb-4 space-y-3">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por número de factura, proveedor o carpeta..."
                    style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilterArchivadas('todas')}
                    style={{
                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                      backgroundColor: filterArchivadas === 'todas' ? '#00829a' : 'white',
                      color: filterArchivadas === 'todas' ? 'white' : '#6b7280',
                      borderColor: filterArchivadas === 'todas' ? '#00829a' : '#d1d5db'
                    }}
                    className="px-4 py-2 text-sm font-medium border rounded-lg transition-colors"
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setFilterArchivadas('archivadas')}
                    style={{
                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                      backgroundColor: filterArchivadas === 'archivadas' ? '#00829a' : 'white',
                      color: filterArchivadas === 'archivadas' ? 'white' : '#6b7280',
                      borderColor: filterArchivadas === 'archivadas' ? '#00829a' : '#d1d5db'
                    }}
                    className="px-4 py-2 text-sm font-medium border rounded-lg transition-colors"
                  >
                    Archivadas
                  </button>
                  <button
                    onClick={() => setFilterArchivadas('sin-archivar')}
                    style={{
                      fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                      backgroundColor: filterArchivadas === 'sin-archivar' ? '#00829a' : 'white',
                      color: filterArchivadas === 'sin-archivar' ? 'white' : '#6b7280',
                      borderColor: filterArchivadas === 'sin-archivar' ? '#00829a' : '#d1d5db'
                    }}
                    className="px-4 py-2 text-sm font-medium border rounded-lg transition-colors"
                  >
                    Sin Archivar
                  </button>
                </div>
              </div>
              
              {/* Filtro por estado */}
              <div className="flex items-center gap-3">
                <label style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Estado:
                </label>
                <select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  disabled={estados.length === 0}
                >
                  <option value="todos">
                    {estados.length === 0 ? 'Cargando estados...' : 'Todos los estados'}
                  </option>
                  {estados.map(estado => (
                    <option key={estado.id} value={estado.label}>{estado.label}</option>
                  ))}
                </select>
                {estados.length === 0 && (
                  <span style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-red-500">
                    No se pudieron cargar los estados
                  </span>
                )}
                {filterEstado !== 'todos' && (
                  <button
                    onClick={() => setFilterEstado('todos')}
                    style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Limpiar filtro
                  </button>
                )}
              </div>
            </div>

            {/* Tabla de facturas */}
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
                <p className="text-gray-600 font-medium">No se encontraron facturas</p>
                <p className="text-gray-500 text-sm mt-1">
                  Intenta ajustar los filtros de búsqueda
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th 
                          onClick={() => handleSort('numero_factura')}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4" />
                            <span>Ubicación</span>
                          </div>
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
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-sm font-medium text-gray-900">
                              {factura.numero_factura}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {factura.fecha_emision 
                              ? new Date(factura.fecha_emision).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {factura.proveedor}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {factura.area}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            ${factura.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(factura.estado)}`}>
                              {factura.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {factura.carpeta ? (
                              <div className="flex items-center gap-2">
                                <Folder style={{color: '#00829a'}} className="w-4 h-4 flex-shrink-0" />
                                <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-xs text-gray-700">
                                  {getCarpetaPath(factura.carpeta.id, factura.carpeta.nombre)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <FolderOpen className="w-4 h-4 text-gray-400" />
                                <span style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-gray-400 italic">
                                  Sin archivar
                                </span>
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
                      style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </button>
                    <div className="flex items-center gap-2">
                      <span style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-gray-700">
                        Mostrando <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="font-medium">{startIndex + 1}</span> - <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="font-medium">{Math.min(startIndex + itemsPerPage, sortedFacturas.length)}</span> de <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="font-medium">{sortedFacturas.length}</span> facturas
                      </span>
                      <span style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-gray-500 ml-2">
                        (Página <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="font-medium">{currentPage}</span> de <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="font-medium">{totalPages}</span>)
                      </span>
                    </div>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}}
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
